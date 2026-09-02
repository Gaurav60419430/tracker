'use client';

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownRight, ArrowLeft, ArrowRight, ArrowUpRight, Bell, CalendarDays, Check, CircleDollarSign, Download, LayoutDashboard, Pencil, Plus, Search, Settings2, Sparkles, Target, Trash2, WalletCards, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';

type Transaction = { id: string; name: string; category: string; amount: number; date: string };
type MonthData = { salary: number; budget: number; savingsGoal: number; transactions: Transaction[] };
type Ledger = Record<string, MonthData>;
type ModelContext = { registerTool: (tool: Record<string, unknown>, options?: { signal?: AbortSignal }) => void | Promise<void> };

const categories = ['Food', 'Transport', 'Housing', 'Shopping', 'Subscriptions', 'Health', 'Fun', 'Other'];
const categoryColors: Record<string, string> = { Food: '#ffab67', Transport: '#66e1db', Housing: '#a889ff', Shopping: '#ff769a', Subscriptions: '#7f9dff', Health: '#6de08b', Fun: '#ffd65b', Other: '#9a98a5' };
const STORAGE_KEY = 'moneta-ledger-v1';
const now = new Date();
const initialMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
const demoTransactions: Transaction[] = [
  { id: 'demo-1', name: 'Rent', category: 'Housing', amount: 16000, date: '2026-09-01' },
  { id: 'demo-2', name: 'The Coffee Atlas', category: 'Food', amount: 420, date: '2026-09-02' },
  { id: 'demo-3', name: 'Metro card', category: 'Transport', amount: 1200, date: '2026-09-02' },
  { id: 'demo-4', name: 'Figma Pro', category: 'Subscriptions', amount: 1299, date: '2026-09-03' },
  { id: 'demo-5', name: 'Groceries', category: 'Food', amount: 3240, date: '2026-09-03' },
  { id: 'demo-6', name: 'Running shoes', category: 'Shopping', amount: 4899, date: '2026-09-03' },
  { id: 'demo-7', name: 'Electricity', category: 'Housing', amount: 2079, date: '2026-09-03' },
  { id: 'demo-8', name: 'Movie night', category: 'Fun', amount: 1700, date: '2026-09-03' },
];

const emptyMonth = (): MonthData => ({ salary: 0, budget: 50000, savingsGoal: 20000, transactions: [] });
const money = (value: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
const monthLabel = (key: string) => new Date(`${key}-01T12:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
const shiftMonth = (key: string, delta: number) => { const date = new Date(`${key}-01T12:00:00`); date.setMonth(date.getMonth() + delta); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`; };

export default function Home() {
  const [ledger, setLedger] = useState<Ledger>({ [initialMonth]: { salary: 80000, budget: 50000, savingsGoal: 32400, transactions: initialMonth === '2026-09' ? demoTransactions : [] } });
  const [activeMonth, setActiveMonth] = useState(initialMonth);
  const [hydrated, setHydrated] = useState(false);
  const [editingSalary, setEditingSalary] = useState(false);
  const [salaryDraft, setSalaryDraft] = useState('');
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Food');
  const [date, setDate] = useState(`${initialMonth}-${String(Math.min(now.getDate(), 28)).padStart(2, '0')}`);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const [toast, setToast] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => { try { const saved = localStorage.getItem(STORAGE_KEY); if (saved) setLedger(JSON.parse(saved) as Ledger); } catch { /* Keep safe starter data. */ } setHydrated(true); }, []);
  useEffect(() => { if (hydrated) localStorage.setItem(STORAGE_KEY, JSON.stringify(ledger)); }, [ledger, hydrated]);
  useEffect(() => { setDate(`${activeMonth}-01`); setEditingSalary(false); }, [activeMonth]);
  useEffect(() => { const onKey = (event: KeyboardEvent) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); nameRef.current?.focus(); } if (event.key === 'Escape') setEditingSalary(false); }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey); }, []);

  const month = ledger[activeMonth] ?? emptyMonth();
  const spent = month.transactions.reduce((sum, item) => sum + item.amount, 0);
  const balance = month.salary - spent;
  const savingsRate = month.salary > 0 ? Math.max(0, (balance / month.salary) * 100) : 0;
  const daysInMonth = new Date(Number(activeMonth.slice(0, 4)), Number(activeMonth.slice(5, 7)), 0).getDate();
  const elapsed = activeMonth === initialMonth ? Math.max(1, now.getDate()) : daysInMonth;
  const dailyBurn = spent / elapsed;
  const projectedSpend = dailyBurn * daysInMonth;
  const projectedSavings = month.salary - projectedSpend;
  const runway = dailyBurn > 0 ? Math.max(0, balance / dailyBurn) : 0;
  const budgetUse = month.budget > 0 ? Math.min(100, (spent / month.budget) * 100) : 0;
  const paceDelta = month.budget > 0 ? ((spent / month.budget) - (elapsed / daysInMonth)) * 100 : 0;
  const breakdown = useMemo(() => categories.map((item) => ({ name: item, amount: month.transactions.filter((transaction) => transaction.category === item).reduce((sum, transaction) => sum + transaction.amount, 0) })).filter((item) => item.amount > 0).sort((a, b) => b.amount - a.amount), [month.transactions]);
  const visibleTransactions = useMemo(() => month.transactions.filter((item) => (filter === 'All' || item.category === filter) && item.name.toLowerCase().includes(search.toLowerCase())).sort((a, b) => b.date.localeCompare(a.date)), [month.transactions, filter, search]);
  const donut = useMemo(() => { let cursor = 0; return breakdown.map((item) => { const start = spent ? (cursor / spent) * 100 : 0; cursor += item.amount; return `${categoryColors[item.name]} ${start}% ${(cursor / Math.max(spent, 1)) * 100}%`; }).join(', '); }, [breakdown, spent]);

  const showToast = (message: string) => { setToast(message); window.setTimeout(() => setToast(''), 2200); };
  const ensureMonth = useCallback((key: string) => setLedger((current) => current[key] ? current : { ...current, [key]: emptyMonth() }), []);
  const updateMonth = useCallback((fn: (current: MonthData) => MonthData) => setLedger((current) => ({ ...current, [activeMonth]: fn(current[activeMonth] ?? emptyMonth()) })), [activeMonth]);
  const navigateMonth = (delta: number) => { const key = shiftMonth(activeMonth, delta); ensureMonth(key); setActiveMonth(key); };
  const addExpense = useCallback((expense: { name: string; amount: number; category: string; date: string }) => { if (!expense.name.trim() || !Number.isFinite(expense.amount) || expense.amount <= 0 || !categories.includes(expense.category) || !expense.date.startsWith(activeMonth)) throw new Error('Enter a valid name, positive amount, category, and date in this month.'); const transaction: Transaction = { ...expense, name: expense.name.trim(), id: crypto.randomUUID() }; setLedger((current) => ({ ...current, [activeMonth]: { ...(current[activeMonth] ?? emptyMonth()), transactions: [...(current[activeMonth]?.transactions ?? []), transaction] } })); return transaction; }, [activeMonth]);
  const submitExpense = (event: FormEvent) => { event.preventDefault(); try { addExpense({ name, amount: Number(amount), category, date }); setName(''); setAmount(''); showToast('Expense captured'); } catch (error) { showToast(error instanceof Error ? error.message : 'Could not add expense'); } };
  const saveSalary = () => { const next = Number(salaryDraft); if (!Number.isFinite(next) || next < 0) return showToast('Enter a valid salary'); updateMonth((current) => ({ ...current, salary: next })); setEditingSalary(false); showToast('Salary updated'); };
  const removeTransaction = (id: string) => { updateMonth((current) => ({ ...current, transactions: current.transactions.filter((item) => item.id !== id) })); showToast('Transaction removed'); };
  const exportCsv = () => { const rows = [['Date', 'Description', 'Category', 'Amount'], ...month.transactions.map((item) => [item.date, item.name, item.category, String(item.amount)])]; const blob = new Blob([rows.map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(',')).join('\n')], { type: 'text/csv' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `moneta-${activeMonth}.csv`; link.click(); URL.revokeObjectURL(link.href); showToast('CSV exported'); };

  useEffect(() => { const context = (document as Document & { modelContext?: ModelContext }).modelContext; if (!context?.registerTool) return; const lifecycle = new AbortController(); const register = context.registerTool({ name: 'add_expense', title: 'Add expense', description: 'Add one expense to the currently selected Moneta month and update the dashboard.', inputSchema: { type: 'object', properties: { name: { type: 'string' }, amount: { type: 'number', exclusiveMinimum: 0 }, category: { type: 'string', enum: categories }, date: { type: 'string', description: `ISO date within ${activeMonth}` } }, required: ['name', 'amount', 'category', 'date'], additionalProperties: false }, annotations: { readOnlyHint: false, untrustedContentHint: false }, execute: (input: unknown) => { const transaction = addExpense(input as { name: string; amount: number; category: string; date: string }); return { id: transaction.id, status: 'added', month: activeMonth }; } }, { signal: lifecycle.signal }); Promise.resolve(register).catch(() => undefined); return () => lifecycle.abort(); }, [activeMonth, addExpense]);
  const chartPath = useMemo(() => { const totals = Array.from({ length: daysInMonth }, (_, index) => month.transactions.filter((item) => Number(item.date.slice(-2)) <= index + 1).reduce((sum, item) => sum + item.amount, 0)); const max = Math.max(month.budget, ...totals, 1); const points = totals.map((value, index) => `${(index / Math.max(daysInMonth - 1, 1)) * 600},${170 - (value / max) * 145}`); return `M${points.join(' L')}`; }, [month.transactions, month.budget, daysInMonth]);

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark"><CircleDollarSign /></span><span>MONETA</span></div>
        <nav aria-label="Primary navigation"><Button className="nav-item active" variant="ghost" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}><LayoutDashboard />Overview</Button><Button className="nav-item" variant="ghost" onClick={() => document.querySelector('.transactions')?.scrollIntoView({ behavior: 'smooth' })}><WalletCards />Transactions</Button><Button className="nav-item" variant="ghost" onClick={() => document.querySelector('.insights-grid')?.scrollIntoView({ behavior: 'smooth' })}><Sparkles />Insights<span className="new-pill">LIVE</span></Button></nav>
        <div className="side-meter"><div className="meter-copy"><span>Monthly budget</span><strong>{budgetUse.toFixed(0)}%</strong></div><Progress value={budgetUse} /><p>{money(spent)} of {money(month.budget)}</p></div>
        <Button className="nav-item settings" variant="ghost" onClick={() => { const next = prompt('Monthly spending budget', String(month.budget)); if (next && Number(next) > 0) updateMonth((current) => ({ ...current, budget: Number(next) })); }}><Settings2 />Budget settings</Button>
        <div className="profile"><span>GS</span><div><strong>Gaurav</strong><small>Private on this device</small></div></div>
      </aside>

      <section className="workspace">
        <header className="topbar"><div><div className="month-switch"><Button variant="ghost" size="icon-sm" onClick={() => navigateMonth(-1)} aria-label="Previous month"><ArrowLeft /></Button><p className="eyebrow">{monthLabel(activeMonth).toUpperCase()}</p><Button variant="ghost" size="icon-sm" onClick={() => navigateMonth(1)} aria-label="Next month"><ArrowRight /></Button></div><h1>Money, under control.</h1></div><div className="top-actions"><Button variant="outline" size="icon" aria-label="Search transactions" onClick={() => document.querySelector<HTMLInputElement>('.search-field')?.focus()}><Search /></Button><Button variant="outline" size="icon" aria-label="Export transactions" onClick={exportCsv}><Download /></Button><Button className="add-button" onClick={() => nameRef.current?.focus()}><Plus /> Add expense</Button></div></header>

        <div className="dashboard-grid">
          <section className="hero-card"><div className="orb orb-one" /><div className="orb orb-two" /><p>SAFE TO SPEND</p><h2 className={balance < 0 ? 'negative' : ''}>{money(balance)}<span>.00</span></h2><div className="hero-meta">{editingSalary ? <span className="salary-editor"><Input autoFocus type="number" value={salaryDraft} onChange={(event) => setSalaryDraft(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && saveSalary()} /><Button size="icon-xs" onClick={saveSalary} aria-label="Save salary"><Check /></Button><Button size="icon-xs" variant="ghost" onClick={() => setEditingSalary(false)} aria-label="Cancel"><X /></Button></span> : <button className="salary-chip" onClick={() => { setSalaryDraft(String(month.salary)); setEditingSalary(true); }}><ArrowUpRight /> {money(month.salary)} salary <Pencil /></button>}<span><ArrowDownRight /> {money(spent)} spent</span></div><div className="hero-footer"><span>Projected month-end savings <strong className={projectedSavings < 0 ? 'negative' : ''}>{money(projectedSavings)}</strong></span><span className="pulse-dot">LIVE</span></div></section>

          <form className="quick-card" onSubmit={submitExpense}><div className="card-heading"><div><p className="eyebrow">QUICK CAPTURE</p><h3>Log a transaction</h3></div><span className="shortcut">⌘ K</span></div><label>What did you spend on?<Input ref={nameRef} value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Dinner with friends" /></label><div className="amount-row"><label>Amount<div className="money-input"><span>₹</span><Input value={amount} onChange={(event) => setAmount(event.target.value)} type="number" min="0" step="0.01" placeholder="0" /></div></label><label>Category<select value={category} onChange={(event) => setCategory(event.target.value)}>{categories.map((item) => <option key={item}>{item}</option>)}</select></label></div><label className="date-field">Transaction date<Input type="date" min={`${activeMonth}-01`} max={`${activeMonth}-${daysInMonth}`} value={date} onChange={(event) => setDate(event.target.value)} /></label><Button className="save-expense" type="submit"><Plus /> Save expense</Button></form>

          <section className="metric-strip"><article><p>SPENT THIS MONTH</p><strong>{money(spent)}</strong><span className={paceDelta > 0 ? 'negative' : 'positive'}>{Math.abs(paceDelta).toFixed(1)}% {paceDelta > 0 ? 'over' : 'under'} pace</span></article><article><p>SAVINGS RATE</p><strong>{savingsRate.toFixed(1)}%</strong><span className={savingsRate >= 30 ? 'positive' : 'negative'}>{savingsRate >= 50 ? 'Elite' : savingsRate >= 30 ? 'Healthy' : 'Needs attention'}</span></article><article><p>DAILY BURN</p><strong>{money(dailyBurn)}</strong><span>{elapsed} day{elapsed === 1 ? '' : 's'} elapsed</span></article><article><p>CASH RUNWAY</p><strong>{runway.toFixed(1)} days</strong><span>At current burn</span></article></section>

          <section className="spend-card panel"><div className="card-heading"><div><p className="eyebrow">SPENDING VELOCITY</p><h3>{monthLabel(activeMonth).split(' ')[0]} pulse</h3></div><span className={paceDelta > 0 ? 'negative' : 'positive'}>{Math.abs(paceDelta).toFixed(0)}% {paceDelta > 0 ? 'over' : 'under'} pace</span></div><div className="chart-wrap"><div className="chart-labels"><span>{money(month.budget)}</span><span>75%</span><span>50%</span><span>25%</span><span>₹0</span></div><div className="chart-stage"><svg viewBox="0 0 600 180" role="img" aria-label="Cumulative spending chart"><defs><linearGradient id="fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#8b5cf6" stopOpacity=".38"/><stop offset="1" stopColor="#8b5cf6" stopOpacity="0"/></linearGradient></defs><path className="target-line" d="M0 170 L600 25"/><path className="area" d={`${chartPath} L600 180 L0 180 Z`}/><path className="actual-line" d={chartPath}/></svg><div className="x-labels"><span>1</span><span>8</span><span>15</span><span>22</span><span>{daysInMonth}</span></div></div></div></section>

          <section className="category-card panel"><div className="card-heading"><div><p className="eyebrow">ALLOCATION</p><h3>Category mix</h3></div><Target /></div><div className="donut-wrap"><div className="donut" style={{ background: breakdown.length ? `conic-gradient(${donut})` : '#25252d' }}><div><strong>{breakdown.length}</strong><span>categories</span></div></div><div className="legend">{breakdown.slice(0, 5).map((item) => <div key={item.name}><i style={{ background: categoryColors[item.name] }} /><span>{item.name}</span><b>{((item.amount / Math.max(spent, 1)) * 100).toFixed(0)}%</b></div>)}</div></div></section>

          <section className="transactions panel"><div className="card-heading"><div><p className="eyebrow">ACTIVITY</p><h3>Transactions <span>{month.transactions.length}</span></h3></div><Button variant="ghost" onClick={exportCsv}><Download /> Export CSV</Button></div><div className="transaction-tools"><div className="search-box"><Search /><Input className="search-field" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search expenses" /></div><select value={filter} onChange={(event) => setFilter(event.target.value)}><option>All</option>{categories.map((item) => <option key={item}>{item}</option>)}</select></div><div className="transaction-list">{visibleTransactions.length ? visibleTransactions.map((transaction) => <div className="transaction" key={transaction.id}><span className="transaction-icon" style={{ color: categoryColors[transaction.category], background: `${categoryColors[transaction.category]}20` }}>{transaction.name.charAt(0).toUpperCase()}</span><div><strong>{transaction.name}</strong><small>{transaction.category} · {new Date(`${transaction.date}T12:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</small></div><b>-{money(transaction.amount)}</b><Button variant="ghost" size="icon-sm" aria-label={`Delete ${transaction.name}`} onClick={() => removeTransaction(transaction.id)}><Trash2 /></Button></div>) : <div className="empty-state"><WalletCards /><strong>No transactions found</strong><span>Add an expense or change your filters.</span></div>}</div></section>

          <section className="insights-grid"><article className="insight featured"><Sparkles /><p className="eyebrow">FORECAST</p><h3>{projectedSavings >= month.savingsGoal ? 'You’re set to beat your savings goal.' : 'Your current pace misses the savings goal.'}</h3><p>Projected spend is <strong>{money(projectedSpend)}</strong>, leaving <strong>{money(projectedSavings)}</strong> by month end.</p></article><article className="insight"><CalendarDays /><p className="eyebrow">NO-SPEND SIGNAL</p><h3>{Math.max(0, elapsed - new Set(month.transactions.map((item) => item.date)).size)} quiet day(s)</h3><p>Days without a recorded transaction this month.</p></article><article className="insight"><Bell /><p className="eyebrow">TOP PRESSURE</p><h3>{breakdown[0]?.name ?? 'All clear'}</h3><p>{breakdown[0] ? `${money(breakdown[0].amount)} · ${((breakdown[0].amount / Math.max(spent, 1)) * 100).toFixed(0)}% of spending` : 'Add expenses to reveal the pattern.'}</p></article></section>
        </div>
      </section>
      {toast && <output className="toast" aria-live="polite"><Check />{toast}</output>}
    </main>
  );
}
