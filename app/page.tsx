'use client';

import { SyntheticEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useGSAP } from '@gsap/react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Check,
  CircleDollarSign,
  Download,
  LogOut,
  LayoutDashboard,
  Pencil,
  PieChart as PieIcon,
  Plus,
  Search,
  Sparkles,
  Trash2,
  TrendingUp,
  Wallet,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { billsDueInMonth, billsTotal, detectRecurringBills } from '@/lib/recurring';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

gsap.registerPlugin(ScrollTrigger);

type Transaction = { id: string; name: string; category: string; amount: number; date: string };
type MonthData = { salary: number; budget: number; savingsGoal: number; transactions: Transaction[] };
type Ledger = Record<string, MonthData>;
type ModelContext = { registerTool: (tool: Record<string, unknown>, options?: { signal?: AbortSignal }) => void | Promise<void> };

const categories = ['Food', 'Transport', 'Housing', 'Shopping', 'Subscriptions', 'Health', 'Fun', 'Other'] as const;
const categoryColors: Record<string, string> = {
  Food: '#ff7a3d',
  Transport: '#5cc8ff',
  Housing: '#c9ff4a',
  Shopping: '#ff5c8a',
  Subscriptions: '#a78bfa',
  Health: '#34d399',
  Fun: '#fbbf24',
  Other: '#9ca3af',
};
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
const moneyCompact = (value: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', notation: 'compact', maximumFractionDigits: 1 }).format(value);
const monthLabel = (key: string) => new Date(`${key}-01T12:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
const shiftMonth = (key: string, delta: number) => {
  const d = new Date(`${key}-01T12:00:00`);
  d.setMonth(d.getMonth() + delta);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

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
  const syncRef = useRef<number | null>(null);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [editName, setEditName] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editCategory, setEditCategory] = useState('Food');
  const [editDate, setEditDate] = useState('');
  const [currentUser, setCurrentUser] = useState('');

  useEffect(() => {
    let cancelled = false;
    const frame = window.requestAnimationFrame(async () => {
      const localToday = new Date();
      const localKey = `${localToday.getFullYear()}-${String(localToday.getMonth() + 1).padStart(2, '0')}-${String(localToday.getDate()).padStart(2, '0')}`;
      const localMonth = localKey.slice(0, 7);

      // 0) Who am I? per-user isolation — only their data ever loads
      let username = '';
      try {
        const me = await fetch('/api/auth', { cache: 'no-store' });
        if (me.ok) {
          const mj = (await me.json()) as { user?: string; username?: string };
          username = (mj.username ?? mj.user ?? '').toString().toLowerCase();
          if (!cancelled && mj.user) setCurrentUser(mj.user as string);
        }
      } catch {}

      const userKey = username ? `${STORAGE_KEY}:${username}` : STORAGE_KEY;
      // 1) Try per-user localStorage cache
      let localLedger: Ledger | null = null;
      try {
        const saved = localStorage.getItem(userKey);
        if (saved) localLedger = JSON.parse(saved) as Ledger;
        // migrate legacy shared key once
        if (!saved) {
          const legacy = localStorage.getItem(STORAGE_KEY);
          if (legacy && username) {
            localLedger = JSON.parse(legacy) as Ledger;
            try { localStorage.setItem(userKey, legacy); } catch {}
          }
        }
      } catch {}

      // 2) Try per-user DB via API (free Turso / file DB) — durable for years, isolated by user id
      let serverLedger: Ledger | null | undefined = undefined; // undefined = fetch failed
      try {
        const res = await fetch('/api/ledger', { cache: 'no-store' });
        if (res.ok) {
          const data = (await res.json()) as { ledger: Ledger | null };
          // null = unauthenticated/db down; {} = new account (0/0) — use as-is, do NOT fallback to demo
          serverLedger = data.ledger;
        }
      } catch {}

      if (cancelled) return;
      if (serverLedger !== undefined && serverLedger !== null) {
        // Authenticated server truth wins — even {} for brand-new accounts (salary 0 / expenses 0)
        setLedger(serverLedger);
      } else if (serverLedger === null) {
        // unauthenticated — middleware/client guard will redirect; keep local to avoid flash
        if (localLedger && Object.keys(localLedger).length) setLedger(localLedger);
      } else {
        // DB unreachable — fallback to per-user cache
        if (localLedger && Object.keys(localLedger).length) setLedger(localLedger);
        else if (localMonth !== initialMonth) setLedger((c) => ({ ...c, [localMonth]: emptyMonth() }));
      }

      setTodayKey(localKey);
      setActiveMonth(localMonth);
      setDate(localKey);
      setHydrated(true);
    });
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    // Per-user offline cache + debounced per-user DB sync
    const writeCache = async () => {
      let username = '';
      try {
        const me = await fetch('/api/auth', { cache: 'no-store' });
        if (me.ok) {
          const mj = (await me.json()) as { username?: string; user?: string };
          username = (mj.username ?? mj.user ?? '').toString().toLowerCase();
        }
      } catch {}
      const userKey = username ? `${STORAGE_KEY}:${username}` : STORAGE_KEY;
      try {
        localStorage.setItem(userKey, JSON.stringify(ledger));
      } catch {}
    };
    writeCache();
    if (syncRef.current) window.clearTimeout(syncRef.current);
    syncRef.current = window.setTimeout(async () => {
      try {
        await fetch('/api/ledger', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ledger }),
        });
      } catch {}
    }, 700);
    return () => {
      if (syncRef.current) window.clearTimeout(syncRef.current);
    };
  }, [ledger, hydrated]);

  useEffect(() => {
    // Guard for vinext dev where Next middleware not run — also works on Vercel as fallback
    fetch('/api/auth', { cache: 'no-store' })
      .then((r) => {
        if (!r.ok) {
          const nxt = encodeURIComponent(window.location.pathname + window.location.search);
          window.location.href = `/login?next=${nxt}`;
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        nameRef.current?.focus();
      }
      if (e.key === 'Escape') setEditingSalary(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // auto-rotate signals every 6s
  useEffect(() => {
    const id = window.setInterval(() => setSignalIndex((i) => (i + 1) % 3), 6000);
    return () => window.clearInterval(id);
  }, []);

  const month = ledger[activeMonth] ?? emptyMonth();
  const spent = month.transactions.reduce((s, t) => s + t.amount, 0);
  const balance = month.salary - spent;
  const savingsRate = month.salary > 0 ? Math.max(0, (balance / month.salary) * 100) : 0;
  const daysInMonth = new Date(Number(activeMonth.slice(0, 4)), Number(activeMonth.slice(5, 7)), 0).getDate();
  const elapsed = activeMonth === todayKey.slice(0, 7) ? Math.max(1, Number(todayKey.slice(-2))) : daysInMonth;
  const dailyBurn = spent / elapsed;
  const projectedSpend = dailyBurn * daysInMonth;
  const projectedSavings = month.salary - projectedSpend;
  const runway = dailyBurn > 0 ? Math.max(0, balance / dailyBurn) : 0;
  const paceDelta = month.budget > 0 ? ((spent / month.budget) - elapsed / daysInMonth) * 100 : 0;
  const budgetPct = month.budget > 0 ? Math.min(100, (spent / month.budget) * 100) : 0;

  const breakdown = useMemo(
    () =>
      categories
        .map((c) => ({
          name: c,
          amount: month.transactions.filter((t) => t.category === c).reduce((s, t) => s + t.amount, 0),
          color: categoryColors[c],
        }))
        .filter((i) => i.amount > 0)
        .sort((a, b) => b.amount - a.amount),
    [month.transactions],
  );

  const visibleTransactions = useMemo(
    () =>
      month.transactions
        .filter((t) => (filter === 'All' || t.category === filter) && t.name.toLowerCase().includes(search.toLowerCase()))
        .sort((a, b) => b.date.localeCompare(a.date)),
    [month.transactions, filter, search],
  );

  const quietDays = Math.max(0, elapsed - new Set(month.transactions.map((t) => t.date)).size);
  const topCategories = [...breakdown, ...categories.filter((c) => !breakdown.some((b) => b.name === c)).map((c) => ({ name: c, amount: 0, color: categoryColors[c] }))].slice(0, 4);

  const showToast = (m: string) => {
    setToast(m);
    window.setTimeout(() => setToast(''), 2200);
  };
  const ensureMonth = useCallback((k: string) => setLedger((c) => (c[k] ? c : { ...c, [k]: emptyMonth() })), []);
  const updateMonth = useCallback((fn: (c: MonthData) => MonthData) => setLedger((c) => ({ ...c, [activeMonth]: fn(c[activeMonth] ?? emptyMonth()) })), [activeMonth]);
  const navigateMonth = (delta: number) => {
    const k = shiftMonth(activeMonth, delta);
    ensureMonth(k);
    setActiveMonth(k);
    setDate(`${k}-01`);
    setEditingSalary(false);
  };
  const addExpense = useCallback(
    (expense: { name: string; amount: number; category: string; date: string }) => {
      if (!expense.name.trim() || !Number.isFinite(expense.amount) || expense.amount <= 0 || !categories.includes(expense.category as never) || !expense.date.startsWith(activeMonth))
        throw new Error('Enter a valid name, positive amount, category, and date in this month.');
      const tx: Transaction = { ...expense, name: expense.name.trim(), id: crypto.randomUUID() };
      setLedger((c) => ({ ...c, [activeMonth]: { ...(c[activeMonth] ?? emptyMonth()), transactions: [...(c[activeMonth]?.transactions ?? []), tx] } }));
      return tx;
    },
    [activeMonth],
  );
  const submitExpense = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      addExpense({ name, amount: Number(amount), category, date });
      setName('');
      setAmount('');
      showToast('Expense captured');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not add expense');
    }
  };
  const saveSalary = () => {
    const n = Number(salaryDraft);
    if (!Number.isFinite(n) || n < 0) return showToast('Enter a valid salary');
    updateMonth((c) => ({ ...c, salary: n }));
    setEditingSalary(false);
    showToast('Salary updated');
  };
  const removeTransaction = (id: string) => {
    updateMonth((c) => ({ ...c, transactions: c.transactions.filter((t) => t.id !== id) }));
    showToast('Transaction removed');
  };
  const startEdit = (tx: Transaction) => {
    setEditingTx(tx);
    setEditName(tx.name);
    setEditAmount(String(tx.amount));
    setEditCategory(tx.category);
    setEditDate(tx.date);
  };
  const cancelEdit = () => setEditingTx(null);
  const saveEdit = () => {
    if (!editingTx) return;
    const amt = Number(editAmount);
    if (!editName.trim() || !Number.isFinite(amt) || amt <= 0 || !categories.includes(editCategory as never) || !editDate.startsWith(activeMonth)) {
      showToast('Enter valid name, positive amount, category and date in this month');
      return;
    }
    updateMonth((c) => ({
      ...c,
      transactions: c.transactions.map((t) => (t.id === editingTx.id ? { ...t, name: editName.trim(), amount: amt, category: editCategory, date: editDate } : t)),
    }));
    setEditingTx(null);
    showToast('Transaction updated');
  };
  const exportCsv = () => {
    const rows = [['Date', 'Description', 'Category', 'Amount'], ...month.transactions.map((t) => [t.date, t.name, t.category, String(t.amount)])];
    const blob = new Blob([rows.map((r) => r.map((c) => `"${c.replaceAll('"', '""')}"`).join(',')).join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `nivara-${activeMonth}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    showToast('CSV exported');
  };

  useEffect(() => {
    const ctx = (document as Document & { modelContext?: ModelContext }).modelContext;
    if (!ctx?.registerTool) return;
    const ctrl = new AbortController();
    const p = ctx.registerTool(
      {
        name: 'add_expense',
        title: 'Add expense',
        description: 'Add one expense to the selected Money Tees month and update the dashboard.',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            amount: { type: 'number', exclusiveMinimum: 0 },
            category: { type: 'string', enum: [...categories] },
            date: { type: 'string', description: `ISO date within ${activeMonth}` },
          },
          required: ['name', 'amount', 'category', 'date'],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute: (input: unknown) => {
          const tx = addExpense(input as { name: string; amount: number; category: string; date: string });
          return { id: tx.id, status: 'added', month: activeMonth };
        },
      },
      { signal: ctrl.signal },
    );
    Promise.resolve(p).catch(() => undefined);
    return () => ctrl.abort();
  }, [activeMonth, addExpense]);

  const chartPath = useMemo(() => {
    const totals = Array.from({ length: daysInMonth }, (_, i) => month.transactions.filter((t) => Number(t.date.slice(-2)) <= i + 1).reduce((s, t) => s + t.amount, 0));
    const max = Math.max(month.budget, ...totals, 1);
    return `M${totals.map((v, i) => `${(i / Math.max(daysInMonth - 1, 1)) * 600},${170 - (v / max) * 145}`).join(' L')}`;
  }, [month.transactions, month.budget, daysInMonth]);

  const dailySpendData = useMemo(() => {
    return Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      const ds = `${activeMonth}-${String(day).padStart(2, '0')}`;
      const amount = month.transactions.filter((t) => t.date === ds).reduce((s, t) => s + t.amount, 0);
      return { day: String(day), amount, label: `${day}`, full: ds };
    });
  }, [month.transactions, activeMonth, daysInMonth]);

  const cumulativeData = useMemo(() => {
    let cum = 0;
    return dailySpendData.map((d, i) => {
      cum += d.amount;
      const budgetCum = Math.round((month.budget / daysInMonth) * (i + 1));
      return { day: d.day, spent: cum, budget: budgetCum, ideal: budgetCum };
    });
  }, [dailySpendData, month.budget, daysInMonth]);

  const monthlyTrend = useMemo(() => {
    const keys = Object.keys(ledger).sort();
    const last6 = keys.slice(-6);
    return last6.map((k) => {
      const m = ledger[k]!;
      const s = m.transactions.reduce((acc, t) => acc + t.amount, 0);
      const bal = m.salary - s;
      return {
        month: new Date(`${k}-01T12:00:00`).toLocaleDateString('en-IN', { month: 'short' }),
        key: k,
        spent: s,
        salary: m.salary,
        saved: bal > 0 ? bal : 0,
      };
    });
  }, [ledger]);

  const maxDaily = useMemo(() => Math.max(...dailySpendData.map((d) => d.amount), 1), [dailySpendData]);
  const avgDaily = useMemo(() => (spent / Math.max(elapsed, 1)).toFixed(0), [spent, elapsed]);

  const yearlyData = useMemo(() => {
    const year = activeMonth.slice(0, 4);
    const yMonths = Object.keys(ledger).filter((k) => k.startsWith(year)).sort();
    let ySpent = 0, ySalary = 0;
    yMonths.forEach((k) => {
      const m = ledger[k]!;
      const s = m.transactions.reduce((acc, t) => acc + t.amount, 0);
      ySpent += s;
      ySalary += m.salary;
    });
    const ySaved = Math.max(0, ySalary - ySpent);
    return { year, count: yMonths.length, spent: ySpent, salary: ySalary, saved: ySaved, avg: yMonths.length ? Math.round(ySpent / yMonths.length) : 0 };
  }, [ledger, activeMonth]);

  const recurringBills = useMemo(() => detectRecurringBills(ledger), [ledger]);
  const billsThisMonth = useMemo(() => billsDueInMonth(recurringBills, activeMonth), [recurringBills, activeMonth]);
  const billsTotalThisMonth = billsTotal(billsThisMonth);

  const signals = [
    { title: projectedSavings >= month.savingsGoal ? 'Your savings target is holding.' : 'The current pace misses your target.', body: `Month-end projection: ${money(projectedSavings)} saved after ${money(projectedSpend)} of spending.` },
    {
      title: `${breakdown[0]?.name ?? 'No category'} carries the most pressure.`,
      body: breakdown[0] ? `${money(breakdown[0].amount)} sits in this category, ${((breakdown[0].amount / Math.max(spent, 1)) * 100).toFixed(0)}% of total spending.` : 'Add a few expenses to reveal the strongest pattern.',
    },
    {
      title: `${quietDays} quiet day${quietDays === 1 ? '' : 's'} this month.`,
      body: quietDays ? 'No recorded spending on those days. Keep the pattern if it supports your plan.' : 'Every elapsed day contains at least one recorded expense.',
    },
    {
      title: billsThisMonth.length ? `${billsThisMonth.length} recurring bill${billsThisMonth.length === 1 ? '' : 's'} due this month.` : 'No recurring bills detected yet.',
      body: billsThisMonth.length ? `${billsThisMonth.map((b) => b.name).join(', ')} — about ${money(billsTotalThisMonth)} committed.` : 'Log the same expense in two months and it will be tracked here.',
    },
  ];
  const story = 'Every transaction changes the shape of the month. Money Tees turns that movement into a clear pace, a realistic forecast, and one next decision.'.split(' ');

  useGSAP(
    () => {
      if (!hydrated || !rootRef.current) return;
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      gsap.from('.hero-reveal', { opacity: 0, y: 20, duration: 0.8, stagger: 0.08, ease: 'power3.out' });
      gsap.fromTo('.story-word', { opacity: 0.12 }, { opacity: 1, stagger: 0.06, ease: 'none', scrollTrigger: { trigger: '.story-copy', start: 'top 78%', end: 'bottom 42%', scrub: 1 } });
      const cards = gsap.utils.toArray<HTMLElement>('.stack-card', rootRef.current);
      cards.forEach((card) => {
        gsap.from(card, { y: 18, opacity: 0, duration: 0.55, ease: 'power3.out', scrollTrigger: { trigger: card, start: 'top 88%', toggleActions: 'play none none reverse' } });
      });
      return () => {
        ScrollTrigger.getAll().forEach((t) => t.kill());
        ScrollTrigger.clearScrollMemory();
      };
    },
    { scope: rootRef, dependencies: [hydrated] },
  );

  return (
    <main ref={rootRef} className="site-root">
      <nav className="nav-shell" aria-label="Primary navigation">
        <button className="wordmark" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          <CircleDollarSign />
          MONEY TEES
        </button>
        <div className="nav-links">
          <button onClick={() => document.querySelector('.bento-section')?.scrollIntoView({ behavior: 'smooth' })}>Overview</button>
          <button onClick={() => document.querySelector('.analytics-section')?.scrollIntoView({ behavior: 'smooth' })}>Analytics</button>
          <a href="/analytics" style={{ color: 'var(--accent)', fontSize: '0.82rem', fontWeight: 700, textDecoration: 'none', border: '1px solid rgba(201,255,74,0.22)', padding: '0.3rem 0.65rem', borderRadius: '999px', background: 'rgba(201,255,74,0.09)' }}>
            Math Lab ↗
          </a>
          <button onClick={() => document.querySelector('.transaction-section')?.scrollIntoView({ behavior: 'smooth' })}>Transactions</button>
          <button onClick={() => document.querySelector('.stack-section')?.scrollIntoView({ behavior: 'smooth' })}>Signals</button>
        </div>
        <div className="nav-month">
          <Button variant="ghost" size="icon-sm" onClick={() => navigateMonth(-1)} aria-label="Previous month">
            <ArrowLeft />
          </Button>
          <span>{monthLabel(activeMonth)}</span>
          <Button variant="ghost" size="icon-sm" onClick={() => navigateMonth(1)} aria-label="Next month">
            <ArrowRight />
          </Button>
        </div>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.76rem', color: 'var(--paper-dim)', border: '1px solid var(--line)', borderRadius: '999px', padding: '0.3rem 0.65rem', background: 'rgba(255,255,255,0.04)' }} title={currentUser ? `Signed in as ${currentUser}` : 'Signed in'}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block' }} />
          {currentUser || 'Vault'}
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={async () => {
            await fetch('/api/auth', { method: 'DELETE' });
            try {
              localStorage.removeItem('mt_ok');
            } catch {}
            window.location.href = '/login';
          }}
          aria-label="Logout"
          title={currentUser ? `Logout ${currentUser}` : 'Logout'}
          style={{ color: 'var(--paper-faint)' }}
        >
          <LogOut />
        </Button>
      </nav>

      <header className="attention-section">
        <div className="hero-copy hero-reveal">
          <div className="hero-kicker">Private · On-device · No tracking</div>
          <h1>
            Know what your <em>money</em> is doing.
          </h1>
          <p>Salary in. Expenses logged. The full month becomes legible — pace, pressure and what&apos;s actually safe to spend.</p>
          <dl className="hero-stats" aria-label="Month snapshot">
            <div className="hero-stat">
              <dt>Recorded</dt>
              <dd>{month.transactions.length} <span>expenses</span></dd>
            </div>
            <div className="hero-stat">
              <dt>Savings rate</dt>
              <dd>{savingsRate.toFixed(0)}<span>%</span></dd>
            </div>
            <div className="hero-stat">
              <dt>Safe to spend</dt>
              <dd>{moneyCompact(balance)}</dd>
            </div>
          </dl>
          <div className="hero-actions">
            <Button onClick={() => nameRef.current?.focus()}>
              <Plus />
              Add expense
            </Button>
            <Button variant="outline" onClick={exportCsv}>
              <Download />
              Export CSV
            </Button>
          </div>
        </div>

        <figure className="hero-media hero-reveal">
          <Image
            src="/images/ben-franklin-aesthetic.jpg"
            alt="Benjamin Franklin portrait — money, legacy and timeless value"
            fill
            priority
            sizes="(max-width: 900px) 100vw, 46vw"
            style={{ objectPosition: '50% 18%' }}
          />
          <div className="hero-media-vignette" aria-hidden />
          <figcaption className="hero-media-badge">
            <span>
              Burn <em>{money(dailyBurn)}/day</em>
            </span>
            <span style={{ opacity: 0.35 }}>·</span>
            <span>{runway.toFixed(1)} days runway</span>
          </figcaption>
          <span className="hero-media-quote">“An investment in knowledge pays the best interest.” — Franklin</span>
        </figure>

        <form className="capture-rail hero-reveal" onSubmit={submitExpense} aria-label="Add expense">
          <div className="capture-rail-header">
            <span>Capture</span>
            <small>Press ⌘K to focus · {activeMonth}</small>
          </div>
          <label htmlFor="expense-name">
            Description
            <Input id="expense-name" ref={nameRef} value={name} onChange={(e) => setName(e.target.value)} placeholder="Dinner with friends" autoComplete="off" />
          </label>
          <label htmlFor="expense-amount">
            Amount
            <div className="money-field">
              <span>₹</span>
              <Input id="expense-amount" value={amount} onChange={(e) => setAmount(e.target.value)} type="number" min="0" step="0.01" placeholder="0" />
            </div>
          </label>
          <label htmlFor="expense-category">
            Category
            <select id="expense-category" value={category} onChange={(e) => setCategory(e.target.value)}>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label htmlFor="expense-date">
            Date
            <Input id="expense-date" type="date" min={`${activeMonth}-01`} max={`${activeMonth}-${String(daysInMonth).padStart(2, '0')}`} value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <Button type="submit">
            <ArrowDownRight />
            Record
          </Button>
        </form>
      </header>

      <section className="marquee" aria-label="Category totals">
        <div className="marquee-track">
          {[...breakdown, ...breakdown].map((item, i) => (
            <span key={`${item.name}-${i}`}>
              {item.name} <strong>{money(item.amount)}</strong>
            </span>
          ))}
          {!breakdown.length && (
            <span>
              No spending yet <strong>{money(0)}</strong>
            </span>
          )}
        </div>
      </section>

      <section className="bento-section">
        <div className="bento-kicker">Measured in real time</div>
        <h2>The month, without the noise.</h2>
        <p className="bento-sub">Four lenses on the same ledger — what&apos;s left, what powers it, how fast you&apos;re moving, and where you&apos;ll end.</p>
        <div className="bento-grid">
          <article className="bento-cell balance-cell">
            <span>Safe to spend</span>
            <div className="bento-icon">
              <Wallet />
            </div>
            <strong className={balance < 0 ? 'loss' : ''}>{money(balance)}</strong>
            <p>
              {money(spent)} spent from {money(month.salary)} · {balance < 0 ? 'Over budget' : `${savingsRate.toFixed(1)}% held back`}
            </p>
            <div className="bento-progress" aria-hidden>
              <i style={{ width: `${budgetPct}%`, background: balance < 0 ? 'var(--danger)' : budgetPct > 85 ? '#f59e0b' : 'var(--accent)' }} />
            </div>
          </article>

          <article className="bento-cell salary-cell">
            <span>Monthly salary</span>
            <div className="bento-icon">
              <TrendingUp />
            </div>
            {editingSalary ? (
              <div className="salary-edit">
                <Input type="number" value={salaryDraft} onChange={(e) => setSalaryDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && saveSalary()} placeholder="0" autoFocus />
                <Button size="icon" onClick={saveSalary} aria-label="Save salary">
                  <Check />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => setEditingSalary(false)} aria-label="Cancel">
                  <X />
                </Button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setSalaryDraft(String(month.salary));
                  setEditingSalary(true);
                }}
              >
                <strong>{money(month.salary)}</strong>
                <Pencil style={{ width: '1rem', height: '1rem', opacity: 0.6 }} />
              </button>
            )}
            <p>Click the figure to edit. Saved locally on this device.</p>
          </article>

          <article className="bento-cell pace-cell">
            <span>Daily burn</span>
            <div className="bento-icon">
              <Sparkles />
            </div>
            <strong>{money(dailyBurn)}</strong>
            <p>
              <span style={{ color: paceDelta > 4 ? 'var(--danger)' : paceDelta < -4 ? 'var(--accent)' : 'inherit', fontWeight: 600 }}>
                {Math.abs(paceDelta).toFixed(1)}% {paceDelta > 0 ? 'over' : 'under'}
              </span>{' '}
              budget pace · day {elapsed} of {daysInMonth}
            </p>
            <div className="bento-progress" aria-hidden>
              <i style={{ width: `${Math.min(100, (elapsed / daysInMonth) * 100)}%`, background: 'rgba(255,255,255,0.22)' }} />
            </div>
          </article>

          <article className="bento-cell chart-cell">
            <div>
              <span>Spending velocity</span>
              <strong>{savingsRate.toFixed(1)}% saved</strong>
              <p>{runway.toFixed(1)} days of cash at the current burn.</p>
              <div className="chart-meta">
                <span>
                  <i style={{ background: 'var(--accent)' }} /> Actual
                </span>
                <span>
                  <i style={{ background: 'rgba(255,255,255,0.25)' }} /> Ideal
                </span>
              </div>
            </div>
            <svg viewBox="0 0 600 180" aria-hidden="true">
              <path className="target-line" d="M0 170 L600 25" />
              <path className="actual-line" d={chartPath} />
            </svg>
          </article>
        </div>
      </section>

      <section className="analytics-section">
        <div className="analytics-header">
          <div>
            <div className="analytics-kicker">
              <BarChart3 style={{ width: '0.9rem', height: '0.9rem' }} /> Analytics
            </div>
            <h2>Charts that actually explain the month.</h2>
            <p>Not dashboards for decoration — four views that connect daily rhythm, category weight, trajectory and history.</p>
          </div>
          <div className="analytics-summary">
            <span>
              Avg <strong>{money(Number(avgDaily))}/day</strong>
            </span>
            <span>
              Peak <strong>{money(maxDaily)}</strong>
            </span>
            <span>
              Days <strong>{elapsed}/{daysInMonth}</strong>
            </span>
          </div>
        </div>

        <div className="analytics-grid">
          {!hydrated ? (
            <div style={{ gridColumn: 'span 12', minHeight: '18rem', display: 'grid', placeItems: 'center', color: 'var(--paper-faint)', border: '1px dashed var(--line)', borderRadius: '1.25rem' }}>
              Loading analytics…
            </div>
          ) : (
            <>
              {/* Category Donut */}
              <article className="analytics-card analytics-donut">
            <div className="analytics-card-head">
              <h3>Category split</h3>
              <span className="analytics-card-sub">
                {breakdown.length ? `${breakdown.length} active · ${money(spent)} total` : 'No spend yet'}
              </span>
            </div>
            <div className="analytics-chart" style={{ height: 260 }}>
              {breakdown.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={breakdown} dataKey="amount" nameKey="name" innerRadius={62} outerRadius={88} paddingAngle={3} stroke="rgba(0,0,0,0)" strokeWidth={0}>
                      {breakdown.map((e) => (
                        <Cell key={e.name} fill={e.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: '#1a1d1a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, color: '#f0efe8' }}
                      formatter={(value: any, name: any) => [money(value as number), name as string]}
                    />
                    <Legend
                      verticalAlign="bottom"
                      height={36}
                      wrapperStyle={{ fontSize: '0.78rem', color: '#a8a7a0', paddingTop: 12 }}
                      iconType="circle"
                      formatter={(value: string) => <span style={{ color: '#f0efe8' }}>{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="analytics-empty">
                  <PieIcon style={{ opacity: 0.35 }} />
                  <p>Log expenses to see distribution.</p>
                </div>
              )}
            </div>
            <ul className="analytics-legend">
              {breakdown.slice(0, 4).map((c) => (
                <li key={c.name}>
                  <i style={{ background: c.color }} />
                  <span>{c.name}</span>
                  <strong>{money(c.amount)}</strong>
                  <em>{((c.amount / Math.max(spent, 1)) * 100).toFixed(0)}%</em>
                </li>
              ))}
            </ul>
          </article>

          {/* Daily Bars */}
          <article className="analytics-card analytics-bars">
            <div className="analytics-card-head">
              <h3>Daily spend</h3>
              <span className="analytics-card-sub">Per-day bars · tap to see date</span>
            </div>
            <div className="analytics-chart" style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailySpendData} barCategoryGap="22%">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis dataKey="day" tick={{ fill: '#7c7b76', fontSize: 11 }} axisLine={false} tickLine={false} interval={Math.ceil(daysInMonth / 12)} />
                  <YAxis tick={{ fill: '#7c7b76', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `₹${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k`} width={52} />
                  <Tooltip
                    cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                    contentStyle={{ background: '#1a1d1a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, color: '#f0efe8' }}
                    formatter={(value: any) => [money(value as number), 'Spent']}
                    labelFormatter={(l: any) => `Day ${l} · ${activeMonth}-${String(l).padStart(2, '0')}`}
                  />
                  <Bar dataKey="amount" radius={[8, 8, 8, 8]}>
                    {dailySpendData.map((d, i) => (
                      <Cell key={i} fill={d.amount === 0 ? 'rgba(255,255,255,0.08)' : d.amount === maxDaily ? categoryColors.Fun : 'rgba(201,255,74,0.9)'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="analytics-foot">
              <span>Heaviest day</span>
              <strong>
                {dailySpendData.find((d) => d.amount === maxDaily)?.full ?? '—'} · {money(maxDaily)}
              </strong>
            </div>
          </article>

          {/* Cumulative Trajectory */}
          <article className="analytics-card analytics-area">
            <div className="analytics-card-head">
              <h3>Cumulative vs. budget</h3>
              <span className="analytics-card-sub">Ideal (dashed) vs actual (lime) — scrub to see divergence</span>
            </div>
            <div className="analytics-chart" style={{ height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={cumulativeData} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradSpent" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#c9ff4a" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#c9ff4a" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis dataKey="day" tick={{ fill: '#7c7b76', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#7c7b76', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `₹${(v / 1000).toFixed(0)}k`} width={52} />
                  <Tooltip
                    contentStyle={{ background: '#1a1d1a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, color: '#f0efe8' }}
                    formatter={(value: any, name: any) => [money(value as number), (name as string) === 'spent' ? 'Spent' : 'Budget']}
                  />
                  <Area type="monotone" dataKey="budget" stroke="rgba(255,255,255,0.28)" strokeDasharray="6 6" strokeWidth={1.6} dot={false} fill="transparent" />
                  <Area type="monotone" dataKey="spent" stroke="#c9ff4a" strokeWidth={2.6} dot={false} fill="url(#gradSpent)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="analytics-meta">
              <span>
                <i style={{ background: '#c9ff4a' }} /> Actual
              </span>
              <span>
                <i style={{ border: '1.5px dashed rgba(255,255,255,0.28)', background: 'transparent' }} /> Ideal
              </span>
              <span className={paceDelta > 4 ? 'warn' : paceDelta < -4 ? 'good' : ''}>
                {paceDelta > 0 ? `+${paceDelta.toFixed(1)}% over` : `${Math.abs(paceDelta).toFixed(1)}% under`} pace
              </span>
            </div>
          </article>

          {/* Monthly Trend */}
          <article className="analytics-card analytics-trend">
            <div className="analytics-card-head">
              <h3>6-month trend</h3>
              <span className="analytics-card-sub">Spent vs salary · last 6 ledgers</span>
            </div>
            <div className="analytics-chart" style={{ height: 260 }}>
              {monthlyTrend.length > 1 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyTrend} barGap={8}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <XAxis dataKey="month" tick={{ fill: '#a8a7a0', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#7c7b76', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `₹${(v / 1000).toFixed(0)}k`} width={52} />
                    <Tooltip
                      contentStyle={{ background: '#1a1d1a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, color: '#f0efe8' }}
                      formatter={(value: any, name: any) => [money(value as number), (name as string) === 'spent' ? 'Spent' : (name as string) === 'salary' ? 'Salary' : 'Saved']}
                    />
                    <Legend wrapperStyle={{ fontSize: '0.78rem', color: '#a8a7a0', paddingTop: 8 }} iconType="circle" />
                    <Bar dataKey="salary" name="Salary" fill="rgba(255,255,255,0.09)" stroke="rgba(255,255,255,0.14)" radius={[8, 8, 8, 8]} />
                    <Bar dataKey="spent" name="Spent" fill="#c9ff4a" radius={[8, 8, 8, 8]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="analytics-empty">
                  <TrendingUp style={{ opacity: 0.35 }} />
                  <p>More months will appear as you navigate.</p>
                </div>
              )}
            </div>
            <div className="analytics-foot">
              <span>{activeMonth} saved</span>
              <strong className={balance < 0 ? 'loss' : ''}>{money(balance)}</strong>
            </div>
          </article>

          {/* Yearly Archive — many-year view */}
          <article className="analytics-card" style={{ gridColumn: 'span 12' }}>
            <div className="analytics-card-head">
              <h3>FY {yearlyData.year} — yearly archive</h3>
              <span className="analytics-card-sub">
                {yearlyData.count} months stored · durable DB ensures many-year history
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: '0.75rem', marginTop: '0.9rem' }}>
              <div style={{ padding: '0.9rem', borderRadius: '0.9rem', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--line)' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--paper-faint)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Year Salary</div>
                <strong style={{ fontSize: '1.35rem', color: 'var(--paper)' }}>{money(yearlyData.salary)}</strong>
              </div>
              <div style={{ padding: '0.9rem', borderRadius: '0.9rem', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--line)' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--paper-faint)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Year Spent</div>
                <strong style={{ fontSize: '1.35rem', color: 'var(--paper)' }}>{money(yearlyData.spent)}</strong>
                <div style={{ fontSize: '0.76rem', color: 'var(--paper-dim)' }}>Avg {money(yearlyData.avg)}/mo</div>
              </div>
              <div style={{ padding: '0.9rem', borderRadius: '0.9rem', background: 'var(--accent)', border: '1px solid rgba(201,255,74,0.35)' }}>
                <div style={{ fontSize: '0.72rem', color: 'rgba(15,17,16,0.6)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Year Saved</div>
                <strong style={{ fontSize: '1.35rem', color: 'var(--ink)' }}>{money(yearlyData.saved)}</strong>
                <div style={{ fontSize: '0.76rem', color: 'rgba(15,17,16,0.62)' }}>{yearlyData.salary ? ((yearlyData.saved / yearlyData.salary) * 100).toFixed(1) : '0.0'}% rate</div>
              </div>
              <div style={{ padding: '0.9rem', borderRadius: '0.9rem', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--line)', display: 'grid', placeItems: 'center' }}>
                <Button
                  variant="outline"
                  onClick={() => {
                    const blob = new Blob([JSON.stringify(ledger, null, 2)], { type: 'application/json' });
                    const a = document.createElement('a');
                    a.href = URL.createObjectURL(blob);
                    a.download = `money-tees-${yearlyData.year}.json`;
                    a.click();
                    URL.revokeObjectURL(a.href);
                  }}
                >
                  <Download /> Backup JSON
                </Button>
              </div>
            </div>
          </article>

          {/* Upcoming bills — recurring detector over the whole ledger */}
          <article className="analytics-card" style={{ gridColumn: 'span 12' }}>
            <div className="analytics-card-head">
              <h3>Upcoming bills</h3>
              <span className="analytics-card-sub">
                {billsThisMonth.length
                  ? `${billsThisMonth.length} recurring bill${billsThisMonth.length === 1 ? '' : 's'} due in ${monthLabel(activeMonth)} · ${money(billsTotalThisMonth)} committed`
                  : 'Recurring expenses detected from your history'}
              </span>
            </div>
            {billsThisMonth.length ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: '0.75rem', marginTop: '0.9rem' }}>
                {billsThisMonth.map((b) => (
                  <div key={`${b.name}-${b.amount}`} style={{ padding: '0.9rem', borderRadius: '0.9rem', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--line)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                      <strong style={{ fontSize: '0.95rem', color: 'var(--paper)' }}>{b.name}</strong>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: categoryColors[b.category] ?? '#9ca3af', flexShrink: 0 }} />
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--paper-dim)', marginTop: '0.35rem' }}>
                      Due {new Date(`${b.nextDate}T12:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · {money(b.amount)}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--paper-faint)', marginTop: '0.3rem' }}>
                      Seen {b.streak} month{b.streak === 1 ? '' : 's'} in a row
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="analytics-empty" style={{ marginTop: '0.9rem' }}>
                <Wallet style={{ opacity: 0.35 }} />
                <p>Log the same expense in two months — it will show up here as a recurring bill.</p>
              </div>
            )}
          </article>
            </>
          )}
        </div>
      </section>

      <section className="story-section">
        <p className="story-copy">
          <span className="story-kicker">Why Nivara exists</span>
          {story.map((word, i) => (
            <span className="story-word" key={`${word}-${i}`}>
              {word}{' '}
            </span>
          ))}
        </p>
      </section>

      <section className="accordion-section">
        <div className="accordion-kicker">Where it goes</div>
        <h2>Where the month expands.</h2>
        <p className="accordion-sub">Hover to inspect each category. The strip keeps you honest about distribution without a single pie chart.</p>
        <div className="horizontal-accordion">
          {topCategories.map((item, idx) => (
            <article
              key={item.name}
              style={{
                backgroundImage: `linear-gradient(180deg, rgba(15,17,16,.08), rgba(15,17,16,.88)), url(https://picsum.photos/seed/nivara-${item.name.toLowerCase()}/800/1100)`,
              }}
            >
              <div className="accordion-badge">{idx + 1}</div>
              <div>
                <h3>{item.name}</h3>
                <p>
                  {money(item.amount)}
                  <span>{spent ? `${((item.amount / spent) * 100).toFixed(0)}% of spending` : 'No spend yet'}</span>
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="stack-section">
        <div className="stack-intro">
          <span>
            <LayoutDashboard style={{ width: '0.9rem', height: '0.9rem' }} /> Signals
          </span>
          <h2>Three signals worth acting on.</h2>
          <p>Each one updates as the ledger changes. No red alarms — just plain language about pace, pressure and quiet days.</p>
        </div>
        <div className="stack-track">
          {signals.map((signal, index) => (
            <article className="stack-card" key={index}>
              <div className="stack-card-badge">
                <i>{index + 1}</i> Signal {index + 1} of {signals.length}
              </div>
              <h3>{signal.title}</h3>
              <p>{signal.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="signal-carousel" aria-label="Monthly signal carousel">
        <div className="carousel-copy">
          <span>Current signal</span>
          <h2>{signals[signalIndex].title}</h2>
          <p>{signals[signalIndex].body}</p>
          <div className="carousel-dots" style={{ marginTop: '1.15rem' }}>
            {signals.map((_, i) => (
              <i key={i} className={i === signalIndex ? 'active' : ''} />
            ))}
          </div>
        </div>
        <div className="carousel-controls">
          <div>
            <Button variant="outline" size="icon" onClick={() => setSignalIndex((signalIndex + signals.length - 1) % signals.length)} aria-label="Previous signal">
              <ArrowLeft />
            </Button>
            <span>
              {signalIndex + 1} of {signals.length}
            </span>
            <Button variant="outline" size="icon" onClick={() => setSignalIndex((signalIndex + 1) % signals.length)} aria-label="Next signal">
              <ArrowRight />
            </Button>
          </div>
          <small style={{ color: 'var(--paper-faint)', fontSize: '0.74rem' }}>Auto-rotates every 6s</small>
        </div>
      </section>

      <section className="transaction-section">
        <div className="section-heading">
          <div>
            <div className="transaction-kicker">{visibleTransactions.length} {visibleTransactions.length === 1 ? 'expense' : 'expenses'} · {monthLabel(activeMonth)}</div>
            <h2>Every expense, still within reach.</h2>
          </div>
          <Button variant="outline" onClick={exportCsv}>
            <Download /> Export CSV
          </Button>
        </div>

        <div className="transaction-tools">
          <label className="transaction-search" aria-label="Search expenses">
            <Search />
            <Input className="search-field" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search expenses" />
          </label>
          <div className="filter-pills" role="group" aria-label="Filter by category">
            {['All', ...categories].map((c) => (
              <button key={c} className={`filter-pill ${filter === c ? 'active' : ''}`} onClick={() => setFilter(c)}>
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="transaction-rail">
          {visibleTransactions.length ? (
            visibleTransactions.map((tx) => (
              <article key={tx.id} className="transaction-card" style={{ ['--cat' as never]: categoryColors[tx.category] }}>
                <div>
                  <span>{tx.category}</span>
                  <time>{new Date(`${tx.date}T12:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</time>
                </div>
                <h3>{tx.name}</h3>
                <strong>-{money(tx.amount)}</strong>
                <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end' }}>
                  <Button variant="ghost" size="icon-sm" aria-label={`Edit ${tx.name}`} onClick={() => startEdit(tx)}>
                    <Pencil style={{ width: '1rem', height: '1rem' }} />
                  </Button>
                  <Button variant="ghost" size="icon-sm" aria-label={`Delete ${tx.name}`} onClick={() => removeTransaction(tx.id)}>
                    <Trash2 />
                  </Button>
                </div>
              </article>
            ))
          ) : (
            <div className="empty-state">
              <div style={{ width: '2.4rem', height: '2.4rem', display: 'grid', placeItems: 'center', borderRadius: '50%', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--line)' }}>
                <Search style={{ width: '1rem', height: '1rem', opacity: 0.6 }} />
              </div>
              <h3>No transactions found.</h3>
              <p>Add an expense or change the filters.</p>
            </div>
          )}
        </div>
      </section>

      <footer className="action-footer">
        <div>
          <span>
            <CircleDollarSign style={{ width: '1rem', height: '1rem', color: 'var(--accent)' }} /> MONEY TEES
          </span>
          <h2>Keep the month honest.</h2>
          <p>Private on this device. No account, no cloud sync — just your numbers, made legible enough to act on tomorrow.</p>
          <small>Built for India · INR · {new Date().getFullYear()} Nivara</small>
        </div>
        <div>
          <Button onClick={() => nameRef.current?.focus()}>
            <Plus /> Add expense
          </Button>
          <p>Press ⌘K anywhere to jump to the capture bar. Your ledger is stored in localStorage.</p>
        </div>
      </footer>

      {editingTx && (
        <div className="edit-overlay" role="dialog" aria-modal="true" aria-label={`Edit ${editingTx.name}`} onClick={(e) => e.target === e.currentTarget && cancelEdit()}>
          <div className="edit-modal">
            <div className="edit-modal-head">
              <h3>Edit transaction</h3>
              <Button variant="ghost" size="icon-sm" onClick={cancelEdit} aria-label="Close">
                <X />
              </Button>
            </div>
            <label>
              Description
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Dinner with friends" />
            </label>
            <label>
              Amount
              <div className="money-field">
                <span>₹</span>
                <Input value={editAmount} onChange={(e) => setEditAmount(e.target.value)} type="number" min="0" step="0.01" placeholder="0" />
              </div>
            </label>
            <label>
              Category
              <select value={editCategory} onChange={(e) => setEditCategory(e.target.value)}>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Date
              <Input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} min={`${activeMonth}-01`} max={`${activeMonth}-${String(daysInMonth).padStart(2, '0')}`} />
            </label>
            <div className="edit-modal-actions">
              <Button variant="outline" onClick={cancelEdit}>
                Cancel
              </Button>
              <Button onClick={saveEdit}>
                <Check /> Save changes
              </Button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <output className="toast" aria-live="polite">
          <Check />
          {toast}
        </output>
      )}
    </main>
  );
}
