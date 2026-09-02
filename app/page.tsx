'use client';

import { SyntheticEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { useGSAP } from '@gsap/react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ArrowDownRight, ArrowLeft, ArrowRight, Check, CircleDollarSign, Download, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

gsap.registerPlugin(ScrollTrigger, useGSAP);

type Transaction = { id: string; name: string; category: string; amount: number; date: string };
type MonthData = { salary: number; budget: number; savingsGoal: number; transactions: Transaction[] };
type Ledger = Record<string, MonthData>;
type ModelContext = { registerTool: (tool: Record<string, unknown>, options?: { signal?: AbortSignal }) => void | Promise<void> };

const categories = ['Food', 'Transport', 'Housing', 'Shopping', 'Subscriptions', 'Health', 'Fun', 'Other'];
const STORAGE_KEY = 'moneta-ledger-v1';
const bootstrapToday = '2026-09-03';
const initialMonth = bootstrapToday.slice(0, 7);
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
  const rootRef = useRef<HTMLElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const [ledger, setLedger] = useState<Ledger>({ [initialMonth]: { salary: 80000, budget: 50000, savingsGoal: 32400, transactions: demoTransactions } });
  const [activeMonth, setActiveMonth] = useState(initialMonth);
  const [todayKey, setTodayKey] = useState(bootstrapToday);
  const [hydrated, setHydrated] = useState(false);
  const [editingSalary, setEditingSalary] = useState(false);
  const [salaryDraft, setSalaryDraft] = useState('');
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Food');
  const [date, setDate] = useState(bootstrapToday);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const [toast, setToast] = useState('');
  const [signalIndex, setSignalIndex] = useState(0);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const localToday = new Date();
      const localKey = `${localToday.getFullYear()}-${String(localToday.getMonth() + 1).padStart(2, '0')}-${String(localToday.getDate()).padStart(2, '0')}`;
      const localMonth = localKey.slice(0, 7);
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) setLedger(JSON.parse(saved) as Ledger);
        else if (localMonth !== initialMonth) setLedger((current) => ({ ...current, [localMonth]: emptyMonth() }));
      } catch { /* Preserve the starter ledger when local data is unavailable. */ }
      setTodayKey(localKey);
      setActiveMonth(localMonth);
      setDate(localKey);
      setHydrated(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => { if (hydrated) localStorage.setItem(STORAGE_KEY, JSON.stringify(ledger)); }, [ledger, hydrated]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); nameRef.current?.focus(); }
      if (event.key === 'Escape') setEditingSalary(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const month = ledger[activeMonth] ?? emptyMonth();
  const spent = month.transactions.reduce((sum, item) => sum + item.amount, 0);
  const balance = month.salary - spent;
  const savingsRate = month.salary > 0 ? Math.max(0, (balance / month.salary) * 100) : 0;
  const daysInMonth = new Date(Number(activeMonth.slice(0, 4)), Number(activeMonth.slice(5, 7)), 0).getDate();
  const elapsed = activeMonth === todayKey.slice(0, 7) ? Math.max(1, Number(todayKey.slice(-2))) : daysInMonth;
  const dailyBurn = spent / elapsed;
  const projectedSpend = dailyBurn * daysInMonth;
  const projectedSavings = month.salary - projectedSpend;
  const runway = dailyBurn > 0 ? Math.max(0, balance / dailyBurn) : 0;
  const paceDelta = month.budget > 0 ? ((spent / month.budget) - (elapsed / daysInMonth)) * 100 : 0;
  const breakdown = useMemo(() => categories.map((item) => ({ name: item, amount: month.transactions.filter((transaction) => transaction.category === item).reduce((sum, transaction) => sum + transaction.amount, 0) })).filter((item) => item.amount > 0).sort((a, b) => b.amount - a.amount), [month.transactions]);
  const visibleTransactions = useMemo(() => month.transactions.filter((item) => (filter === 'All' || item.category === filter) && item.name.toLowerCase().includes(search.toLowerCase())).sort((a, b) => b.date.localeCompare(a.date)), [month.transactions, filter, search]);
  const quietDays = Math.max(0, elapsed - new Set(month.transactions.map((item) => item.date)).size);
  const topCategories = [...breakdown, ...categories.filter((item) => !breakdown.some((entry) => entry.name === item)).map((item) => ({ name: item, amount: 0 }))].slice(0, 4);

  const showToast = (message: string) => { setToast(message); window.setTimeout(() => setToast(''), 2200); };
  const ensureMonth = useCallback((key: string) => setLedger((current) => current[key] ? current : { ...current, [key]: emptyMonth() }), []);
  const updateMonth = useCallback((fn: (current: MonthData) => MonthData) => setLedger((current) => ({ ...current, [activeMonth]: fn(current[activeMonth] ?? emptyMonth()) })), [activeMonth]);
  const navigateMonth = (delta: number) => { const key = shiftMonth(activeMonth, delta); ensureMonth(key); setActiveMonth(key); setDate(`${key}-01`); setEditingSalary(false); };
  const addExpense = useCallback((expense: { name: string; amount: number; category: string; date: string }) => {
    if (!expense.name.trim() || !Number.isFinite(expense.amount) || expense.amount <= 0 || !categories.includes(expense.category) || !expense.date.startsWith(activeMonth)) throw new Error('Enter a valid name, positive amount, category, and date in this month.');
    const transaction: Transaction = { ...expense, name: expense.name.trim(), id: crypto.randomUUID() };
    setLedger((current) => ({ ...current, [activeMonth]: { ...(current[activeMonth] ?? emptyMonth()), transactions: [...(current[activeMonth]?.transactions ?? []), transaction] } }));
    return transaction;
  }, [activeMonth]);
  const submitExpense = (event: SyntheticEvent<HTMLFormElement>) => { event.preventDefault(); try { addExpense({ name, amount: Number(amount), category, date }); setName(''); setAmount(''); showToast('Expense captured'); } catch (error) { showToast(error instanceof Error ? error.message : 'Could not add expense'); } };
  const saveSalary = () => { const next = Number(salaryDraft); if (!Number.isFinite(next) || next < 0) return showToast('Enter a valid salary'); updateMonth((current) => ({ ...current, salary: next })); setEditingSalary(false); showToast('Salary updated'); };
  const removeTransaction = (id: string) => { updateMonth((current) => ({ ...current, transactions: current.transactions.filter((item) => item.id !== id) })); showToast('Transaction removed'); };
  const exportCsv = () => { const rows = [['Date', 'Description', 'Category', 'Amount'], ...month.transactions.map((item) => [item.date, item.name, item.category, String(item.amount)])]; const blob = new Blob([rows.map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(',')).join('\n')], { type: 'text/csv' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `nivara-${activeMonth}.csv`; link.click(); URL.revokeObjectURL(link.href); showToast('CSV exported'); };

  useEffect(() => {
    const context = (document as Document & { modelContext?: ModelContext }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const register = context.registerTool({ name: 'add_expense', title: 'Add expense', description: 'Add one expense to the selected NIVARA month and update the dashboard.', inputSchema: { type: 'object', properties: { name: { type: 'string' }, amount: { type: 'number', exclusiveMinimum: 0 }, category: { type: 'string', enum: categories }, date: { type: 'string', description: `ISO date within ${activeMonth}` } }, required: ['name', 'amount', 'category', 'date'], additionalProperties: false }, annotations: { readOnlyHint: false, untrustedContentHint: false }, execute: (input: unknown) => { const transaction = addExpense(input as { name: string; amount: number; category: string; date: string }); return { id: transaction.id, status: 'added', month: activeMonth }; } }, { signal: lifecycle.signal });
    Promise.resolve(register).catch(() => undefined);
    return () => lifecycle.abort();
  }, [activeMonth, addExpense]);

  const chartPath = useMemo(() => {
    const totals = Array.from({ length: daysInMonth }, (_, index) => month.transactions.filter((item) => Number(item.date.slice(-2)) <= index + 1).reduce((sum, item) => sum + item.amount, 0));
    const max = Math.max(month.budget, ...totals, 1);
    return `M${totals.map((value, index) => `${(index / Math.max(daysInMonth - 1, 1)) * 600},${170 - (value / max) * 145}`).join(' L')}`;
  }, [month.transactions, month.budget, daysInMonth]);

  const signals = [
    { title: projectedSavings >= month.savingsGoal ? 'Your savings target is holding.' : 'The current pace misses your target.', body: `Month-end projection: ${money(projectedSavings)} saved after ${money(projectedSpend)} of spending.` },
    { title: `${breakdown[0]?.name ?? 'No category'} carries the most pressure.`, body: breakdown[0] ? `${money(breakdown[0].amount)} sits in this category, ${((breakdown[0].amount / Math.max(spent, 1)) * 100).toFixed(0)}% of total spending.` : 'Add a few expenses to reveal the strongest pattern.' },
    { title: `${quietDays} quiet day${quietDays === 1 ? '' : 's'} this month.`, body: quietDays ? 'No recorded spending on those days. Keep the pattern if it supports your plan.' : 'Every elapsed day contains at least one recorded expense.' },
  ];
  const story = 'Every transaction changes the shape of the month. NIVARA turns that movement into a clear pace, a realistic forecast, and one next decision.'.split(' ');

  useGSAP(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;
    gsap.from('.hero-reveal', { opacity: 0, y: 28, duration: 0.9, stagger: 0.1, ease: 'power3.out' });
    gsap.fromTo('.story-word', { opacity: 0.12 }, { opacity: 1, stagger: 0.08, ease: 'none', scrollTrigger: { trigger: '.story-copy', start: 'top 78%', end: 'bottom 42%', scrub: 1 } });
    const cards = gsap.utils.toArray<HTMLElement>('.stack-card');
    cards.forEach((card, index) => {
      if (index === cards.length - 1) return;
      ScrollTrigger.create({ trigger: card, start: 'top top', endTrigger: cards[cards.length - 1], end: 'top top', pin: true, pinSpacing: false });
      gsap.to(card, { scale: 0.94, opacity: 0.38, ease: 'none', scrollTrigger: { trigger: cards[index + 1], start: 'top bottom', end: 'top top', scrub: true } });
    });
  }, { scope: rootRef, dependencies: [activeMonth], revertOnUpdate: true });

  return (
    <main ref={rootRef} className="site-root">
      <nav className="nav-shell" aria-label="Primary navigation">
        <button className="wordmark" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}><CircleDollarSign />NIVARA</button>
        <div className="nav-links"><button onClick={() => document.querySelector('.bento-section')?.scrollIntoView({ behavior: 'smooth' })}>Overview</button><button onClick={() => document.querySelector('.transaction-section')?.scrollIntoView({ behavior: 'smooth' })}>Transactions</button><button onClick={() => document.querySelector('.stack-section')?.scrollIntoView({ behavior: 'smooth' })}>Signals</button></div>
        <div className="nav-month"><Button variant="ghost" size="icon-sm" onClick={() => navigateMonth(-1)} aria-label="Previous month"><ArrowLeft /></Button><span>{monthLabel(activeMonth)}</span><Button variant="ghost" size="icon-sm" onClick={() => navigateMonth(1)} aria-label="Next month"><ArrowRight /></Button></div>
      </nav>

      <header className="attention-section">
        <div className="hero-copy hero-reveal"><h1>Know what your money is doing.</h1><p>Salary in. Expenses logged. The full month becomes legible.</p><div className="hero-actions"><Button onClick={() => nameRef.current?.focus()}><Plus />Add expense</Button><Button variant="outline" onClick={exportCsv}><Download />Export CSV</Button></div></div>
        <figure className="hero-media hero-reveal"><Image src="/images/nivara-editorial.png" alt="Charcoal forms and a chartreuse ribbon moving upward" fill priority sizes="(max-width: 900px) 100vw, 46vw" /></figure>
        <form className="capture-rail hero-reveal" onSubmit={submitExpense}>
          <label htmlFor="expense-name">Description<Input id="expense-name" ref={nameRef} value={name} onChange={(event) => setName(event.target.value)} placeholder="Dinner with friends" /></label>
          <label htmlFor="expense-amount">Amount<div className="money-field"><span>₹</span><Input id="expense-amount" value={amount} onChange={(event) => setAmount(event.target.value)} type="number" min="0" step="0.01" placeholder="0" /></div></label>
          <label htmlFor="expense-category">Category<select id="expense-category" value={category} onChange={(event) => setCategory(event.target.value)}>{categories.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label htmlFor="expense-date">Date<Input id="expense-date" type="date" min={`${activeMonth}-01`} max={`${activeMonth}-${daysInMonth}`} value={date} onChange={(event) => setDate(event.target.value)} /></label>
          <Button type="submit"><ArrowDownRight />Record</Button>
        </form>
      </header>

      <section className="marquee" aria-label="Category totals"><div className="marquee-track">{[...breakdown, ...breakdown].map((item, index) => <span key={`${item.name}-${index}`}>{item.name}<strong>{money(item.amount)}</strong></span>)}</div></section>

      <section className="bento-section">
        <h2>The month, without the noise.</h2>
        <div className="bento-grid">
          <article className="bento-cell balance-cell"><span>Safe to spend</span><strong className={balance < 0 ? 'loss' : ''}>{money(balance)}</strong><p>{money(spent)} spent from {money(month.salary)}</p></article>
          <article className="bento-cell salary-cell"><span>Monthly salary</span>{editingSalary ? <div className="salary-edit"><Input type="number" value={salaryDraft} onChange={(event) => setSalaryDraft(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && saveSalary()} /><Button size="icon" onClick={saveSalary} aria-label="Save salary"><Check /></Button><Button size="icon" variant="ghost" onClick={() => setEditingSalary(false)} aria-label="Cancel"><X /></Button></div> : <button onClick={() => { setSalaryDraft(String(month.salary)); setEditingSalary(true); }}><strong>{money(month.salary)}</strong><Pencil /></button>}<p>Click the figure to edit it.</p></article>
          <article className="bento-cell pace-cell"><span>Daily burn</span><strong>{money(dailyBurn)}</strong><p>{Math.abs(paceDelta).toFixed(1)}% {paceDelta > 0 ? 'over' : 'under'} budget pace</p></article>
          <article className="bento-cell chart-cell"><div><span>Spending velocity</span><strong>{savingsRate.toFixed(1)}% saved</strong><p>{runway.toFixed(1)} days of cash at the current burn.</p></div><svg viewBox="0 0 600 180" aria-hidden="true"><path className="target-line" d="M0 170 L600 25"/><path className="actual-line" d={chartPath}/></svg></article>
        </div>
      </section>

      <section className="story-section"><p className="story-copy">{story.map((word, index) => <span className="story-word" key={`${word}-${index}`}>{word} </span>)}</p></section>

      <section className="accordion-section"><h2>Where the month expands.</h2><div className="horizontal-accordion">{topCategories.map((item) => <article key={item.name} style={{ backgroundImage: `linear-gradient(180deg, rgba(14,15,13,.08), rgba(14,15,13,.9)), url(https://picsum.photos/seed/nivara-${item.name.toLowerCase()}/800/1100)` }}><div><h3>{item.name}</h3><p>{money(item.amount)}<span>{spent ? `${((item.amount / spent) * 100).toFixed(0)}% of spending` : 'No spend yet'}</span></p></div></article>)}</div></section>

      <section className="stack-section"><div className="stack-intro"><h2>Three signals worth acting on.</h2><p>Each one updates as the ledger changes.</p></div><div className="stack-track">{signals.map((signal) => <article className="stack-card" key={signal.title}><h3>{signal.title}</h3><p>{signal.body}</p></article>)}</div></section>

      <section className="signal-carousel" aria-label="Monthly signal carousel"><div className="carousel-copy"><span>Current signal</span><h2>{signals[signalIndex].title}</h2><p>{signals[signalIndex].body}</p></div><div className="carousel-controls"><Button variant="outline" size="icon" onClick={() => setSignalIndex((signalIndex + signals.length - 1) % signals.length)} aria-label="Previous signal"><ArrowLeft /></Button><span>{signalIndex + 1} of {signals.length}</span><Button variant="outline" size="icon" onClick={() => setSignalIndex((signalIndex + 1) % signals.length)} aria-label="Next signal"><ArrowRight /></Button></div></section>

      <section className="transaction-section"><div className="section-heading"><h2>Every expense, still within reach.</h2><Button variant="outline" onClick={exportCsv}><Download />Export CSV</Button></div><div className="transaction-tools"><div><Search /><Input className="search-field" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search expenses" /></div><select value={filter} onChange={(event) => setFilter(event.target.value)}><option>All</option>{categories.map((item) => <option key={item}>{item}</option>)}</select></div><div className="transaction-rail">{visibleTransactions.length ? visibleTransactions.map((transaction) => <article className="transaction-card" key={transaction.id}><div><span>{transaction.category}</span><time>{new Date(`${transaction.date}T12:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</time></div><h3>{transaction.name}</h3><strong>-{money(transaction.amount)}</strong><Button variant="ghost" size="icon-sm" aria-label={`Delete ${transaction.name}`} onClick={() => removeTransaction(transaction.id)}><Trash2 /></Button></article>) : <div className="empty-state"><h3>No transactions found.</h3><p>Add an expense or change the filters.</p></div>}</div></section>

      <footer className="action-footer"><div><span>NIVARA</span><h2>Keep the month honest.</h2></div><div><Button onClick={() => nameRef.current?.focus()}><Plus />Add expense</Button><p>Private on this device. Built for your own numbers.</p></div></footer>
      {toast && <output className="toast" aria-live="polite"><Check />{toast}</output>}
    </main>
  );
}
