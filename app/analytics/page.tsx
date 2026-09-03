'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, BarChart3, TrendingUp, CalendarDays, GitCommitVertical, Sigma, Wallet, LogOut, CircleDollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { mean, median, stddev, cv, pearson, linearRegression } from '@/lib/analyticsMath';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ScatterChart, Scatter, LineChart, Line } from 'recharts';

type Transaction = { id: string; name: string; category: string; amount: number; date: string };
type MonthData = { salary: number; budget: number; savingsGoal: number; transactions: Transaction[] };
type Ledger = Record<string, MonthData>;

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
const BUDGET_KEY = (month: string) => `money-tees-budget-${month}`;
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

const money = (v: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v);
const monthLabel = (k: string) => new Date(`${k}-01T12:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
const shiftMonth = (k: string, d: number) => {
  const dt = new Date(`${k}-01T12:00:00`);
  dt.setMonth(dt.getMonth() + d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
};

export default function AnalyticsPage() {
  const [ledger, setLedger] = useState<Ledger>({ [initialMonth]: { salary: 80000, budget: 50000, savingsGoal: 32400, transactions: demoTransactions } });
  const [activeMonth, setActiveMonth] = useState(initialMonth);
  const [todayKey, setTodayKey] = useState(bootstrapToday);
  const [hydrated, setHydrated] = useState(false);
  const [catBudgets, setCatBudgets] = useState<Record<string, number>>({});

  useEffect(() => {
    const frame = window.requestAnimationFrame(async () => {
      const now = new Date();
      const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const m = key.slice(0, 7);
      let local: Ledger | null = null;
      try {
        const s = localStorage.getItem(STORAGE_KEY);
        if (s) local = JSON.parse(s);
      } catch {}
      let server: Ledger | null = null;
      try {
        const r = await fetch('/api/ledger', { cache: 'no-store' });
        if (r.ok) {
          const j = (await r.json()) as { ledger: Ledger | null };
          if (j.ledger) server = j.ledger;
        }
      } catch {}
      if (server && Object.keys(server).length) setLedger(server);
      else if (local && Object.keys(local).length) setLedger(local);
      // budgets
      try {
        const b = localStorage.getItem(BUDGET_KEY(m));
        if (b) setCatBudgets(JSON.parse(b));
        else {
          const def: Record<string, number> = {};
          categories.forEach((c) => (def[c] = Math.round(50000 / categories.length)));
          setCatBudgets(def);
        }
      } catch {}
      setTodayKey(key);
      setActiveMonth(m);
      setHydrated(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(BUDGET_KEY(activeMonth), JSON.stringify(catBudgets));
    } catch {}
  }, [catBudgets, activeMonth, hydrated]);

  useEffect(() => {
    fetch('/api/auth', { cache: 'no-store' })
      .then((r) => {
        if (!r.ok) window.location.href = `/login?next=${encodeURIComponent('/analytics')}`;
      })
      .catch(() => {});
  }, []);

  const month = ledger[activeMonth] ?? { salary: 0, budget: 50000, savingsGoal: 20000, transactions: [] as Transaction[] };
  const spent = month.transactions.reduce((a, t) => a + t.amount, 0);
  const daysInMonth = new Date(Number(activeMonth.slice(0, 4)), Number(activeMonth.slice(5, 7)), 0).getDate();
  const elapsed = activeMonth === todayKey.slice(0, 7) ? Math.max(1, Number(todayKey.slice(-2))) : daysInMonth;

  const dailyAmounts = useMemo(() => {
    return Array.from({ length: daysInMonth }, (_, i) => {
      const ds = `${activeMonth}-${String(i + 1).padStart(2, '0')}`;
      return month.transactions.filter((t) => t.date === ds).reduce((a, t) => a + t.amount, 0);
    });
  }, [month.transactions, activeMonth, daysInMonth]);

  const elapsedDaily = useMemo(() => dailyAmounts.slice(0, elapsed), [dailyAmounts, elapsed]);
  const avgBurn = mean(elapsedDaily);
  const medBurn = median(elapsedDaily.filter((v) => v > 0).length ? elapsedDaily : elapsedDaily); // median of all, but show zero-aware
  const sd = stddev(elapsedDaily);
  const vol = cv(elapsedDaily);

  // last month volatility
  const lastMonthKey = shiftMonth(activeMonth, -1);
  const lastMonth = ledger[lastMonthKey];
  const lastDaily = useMemo(() => {
    if (!lastMonth) return [] as number[];
    const d = new Date(Number(lastMonthKey.slice(0, 4)), Number(lastMonthKey.slice(5, 7)), 0).getDate();
    return Array.from({ length: d }, (_, i) => {
      const ds = `${lastMonthKey}-${String(i + 1).padStart(2, '0')}`;
      return lastMonth.transactions.filter((t) => t.date === ds).reduce((a, t) => a + t.amount, 0);
    });
  }, [lastMonth, lastMonthKey]);
  const lastVol = lastDaily.length ? cv(lastDaily) : 0;
  const volRatio = lastVol > 0 ? vol / lastVol : vol > 0 ? 9.9 : 0;

  // Weekday heatmap 0=Sun..6=Sat
  const weekdayTotals = useMemo(() => {
    const w = Array(7).fill(0) as number[];
    const counts = Array(7).fill(0) as number[];
    month.transactions.forEach((t) => {
      const d = new Date(`${t.date}T12:00:00`);
      const wd = d.getDay();
      w[wd] += t.amount;
      counts[wd] += 1;
    });
    const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return labels.map((label, i) => ({ label, day: i, amount: w[i], count: counts[i] }));
  }, [month.transactions]);

  const maxWeekday = Math.max(...weekdayTotals.map((w) => w.amount), 1);

  // Category correlation: Fun vs days since payday (1st)
  const funPoints = useMemo(() => {
    return month.transactions
      .filter((t) => t.category === 'Fun')
      .map((t) => ({ day: Number(t.date.slice(-2)), amount: t.amount }));
  }, [month.transactions]);
  const funCorr = useMemo(() => {
    if (funPoints.length < 2) return 0;
    const xs = funPoints.map((p) => p.day);
    const ys = funPoints.map((p) => p.amount);
    return pearson(xs, ys);
  }, [funPoints]);

  const funByWeek = useMemo(() => {
    const buckets = [0, 0, 0, 0];
    funPoints.forEach((p) => {
      const b = Math.min(3, Math.floor((p.day - 1) / 7));
      buckets[b] += p.amount;
    });
    return buckets.map((amount, i) => ({ bucket: `W${i + 1}`, amount, label: `${i * 7 + 1}-${Math.min((i + 1) * 7, daysInMonth)}` }));
  }, [funPoints, daysInMonth]);

  // Forecast via linear regression on cumulative
  const cumulative = useMemo(() => {
    let c = 0;
    return dailyAmounts.map((a, i) => {
      c += a;
      return c;
    });
  }, [dailyAmounts]);
  const regression = useMemo(() => {
    // only use elapsed points for regression (real data)
    const xs = Array.from({ length: elapsed }, (_, i) => i + 1);
    const ys = cumulative.slice(0, elapsed);
    return linearRegression(xs, ys);
  }, [cumulative, elapsed]);
  const regressForecast = Math.max(0, Math.round(regression.predict(daysInMonth)));
  const naiveForecast = Math.round(avgBurn * daysInMonth);
  const actualSpent = spent;

  // Zero-based diff
  const catActual = useMemo(() => {
    const m: Record<string, number> = {};
    categories.forEach((c) => (m[c] = 0));
    month.transactions.forEach((t) => (m[t.category] = (m[t.category] ?? 0) + t.amount));
    return m;
  }, [month.transactions]);

  const zeroRows = useMemo(
    () =>
      (categories as readonly string[]).map((c) => {
        const budgeted = catBudgets[c] ?? 0;
        const actual = catActual[c] ?? 0;
        const diff = budgeted - actual;
        const pct = budgeted > 0 ? (actual / budgeted) * 100 : actual > 0 ? 999 : 0;
        return { category: c, budgeted, actual, diff, pct, color: categoryColors[c] };
      }),
    [catBudgets, catActual],
  );
  const zeroTotalBudgeted = zeroRows.reduce((a, r) => a + r.budgeted, 0);
  const zeroTotalActual = zeroRows.reduce((a, r) => a + r.actual, 0);

  if (!hydrated) return <div style={{ padding: '4rem', color: 'var(--paper-dim)' }}>Loading Money Tees analytics…</div>;

  return (
    <main className="site-root" style={{ width: 'min(100% - 2.25rem, 92rem)', margin: '0 auto', padding: '1.2rem 0 3rem' }}>
      <nav className="nav-shell" aria-label="Primary navigation" style={{ marginBottom: '1.2rem', width: '100%' }}>
        <Link href="/" className="wordmark" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.6rem', color: 'var(--paper)', textDecoration: 'none', fontWeight: 700, letterSpacing: '0.22em' }}>
          <CircleDollarSign style={{ width: '1.2rem', height: '1.2rem', color: 'var(--accent)' }} /> MONEY TEES
        </Link>
        <div className="nav-links">
          <Link href="/" style={{ color: 'var(--paper-dim)', fontSize: '0.82rem', textDecoration: 'none' }}>
            Home
          </Link>
          <Link href="/analytics" style={{ color: 'var(--accent)', fontSize: '0.82rem', fontWeight: 700, textDecoration: 'none', border: '1px solid rgba(201,255,74,0.22)', padding: '0.3rem 0.65rem', borderRadius: '999px', background: 'rgba(201,255,74,0.09)' }}>
            Math Lab
          </Link>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div className="nav-month">
            <Button variant="ghost" size="icon-sm" onClick={() => setActiveMonth(shiftMonth(activeMonth, -1))}>
              <ArrowLeft />
            </Button>
            <span>{monthLabel(activeMonth)}</span>
            <Button variant="ghost" size="icon-sm" onClick={() => setActiveMonth(shiftMonth(activeMonth, 1))}>
              <ArrowLeft style={{ transform: 'rotate(180deg)' }} />
            </Button>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={async () => {
              await fetch('/api/auth', { method: 'DELETE' });
              window.location.href = '/login';
            }}
            aria-label="Logout"
            title="Logout"
            style={{ color: 'var(--paper-faint)' }}
          >
            <LogOut />
          </Button>
        </div>
      </nav>

      <div className="analytics-header" style={{ marginBottom: '1.5rem' }}>
        <div>
          <div className="analytics-kicker">
            <BarChart3 style={{ width: '0.9rem', height: '0.9rem' }} /> Math-nerd analytics
          </div>
          <h1 style={{ margin: '0.45rem 0 0', fontSize: 'clamp(2rem,4vw,3rem)', letterSpacing: '-0.05em', lineHeight: 1 }}>Numbers that explain the noise.</h1>
          <p style={{ maxWidth: '42rem', color: 'var(--paper-dim)', marginTop: '0.6rem' }}>
            Volatility, median vs mean, weekday rhythm, category timing, regression forecast and zero-based variance — on one page.
          </p>
        </div>
        <div className="analytics-summary">
          <span>
            {month.transactions.length} tx · {money(spent)} spent
          </span>
          <span>
            Elapsed {elapsed}/{daysInMonth}d
          </span>
        </div>
      </div>

      <div className="analytics-grid">
        {/* 1 Volatility */}
        <article className="analytics-card" style={{ gridColumn: 'span 6' }}>
          <div className="analytics-card-head">
            <h3>
              <Sigma style={{ width: '0.9rem', height: '0.9rem', display: 'inline', marginRight: '0.4rem' }} />
              Volatility score
            </h3>
            <span className="analytics-card-sub">Std dev of daily spend (elapsed {elapsed}d)</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.9rem' }}>
            <div style={{ padding: '0.9rem', borderRadius: '0.9rem', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--line)' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--paper-faint)' }}>STD DEV / DAY</div>
              <strong style={{ fontSize: '1.6rem' }}>{money(Math.round(sd))}</strong>
              <div style={{ fontSize: '0.76rem', color: 'var(--paper-dim)' }}>CV {vol.toFixed(2)} · mean {money(Math.round(avgBurn))}</div>
            </div>
            <div style={{ padding: '0.9rem', borderRadius: '0.9rem', background: volRatio > 1.2 ? 'rgba(255,109,89,0.12)' : 'rgba(201,255,74,0.14)', border: '1px solid var(--line)' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--paper-faint)' }}>VS LAST MONTH</div>
              <strong style={{ fontSize: '1.25rem', color: volRatio > 1.5 ? 'var(--danger)' : volRatio < 0.8 ? 'var(--accent)' : 'var(--paper)' }}>
                {lastDaily.length ? `${volRatio.toFixed(1)}× ${volRatio > 1 ? 'more' : 'less'} volatile` : 'No prior month'}
              </strong>
              <div style={{ fontSize: '0.76rem', color: 'var(--paper-dim)' }}>Last CV {lastVol.toFixed(2)} → now {vol.toFixed(2)}</div>
            </div>
          </div>
          <div className="analytics-chart" style={{ height: 180, marginTop: '0.9rem' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={Array.from({ length: elapsed }, (_, i) => ({ day: `${i + 1}`, amount: elapsedDaily[i] }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="day" tick={{ fill: '#7c7b76', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#7c7b76', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v: any) => `₹${(v / 1000).toFixed(0)}k`} width={52} />
                <Tooltip contentStyle={{ background: '#1a1d1a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12 }} formatter={(v: any) => [money(v as number), 'Spent']} />
                <Bar dataKey="amount" radius={[6, 6, 6, 6]} fill="#c9ff4a" />
                {/* mean line via reference? use Line */}
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--paper-faint)', marginTop: '0.5rem' }}>
            Rent outlier check: one {money(Math.max(...elapsedDaily))} day inflates mean → compare median below.
          </div>
        </article>

        {/* 2 Median vs Mean */}
        <article className="analytics-card" style={{ gridColumn: 'span 6' }}>
          <div className="analytics-card-head">
            <h3>Median vs mean burn</h3>
            <span className="analytics-card-sub">Outlier-proof daily pace</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.9rem' }}>
            <div style={{ padding: '0.9rem', borderRadius: '0.9rem', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--line)' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--paper-faint)' }}>MEAN / DAY</div>
              <strong style={{ fontSize: '1.5rem' }}>{money(Math.round(avgBurn))}</strong>
              <div style={{ fontSize: '0.76rem', color: 'var(--paper-dim)' }}>Sensitive to rent spike</div>
            </div>
            <div style={{ padding: '0.9rem', borderRadius: '0.9rem', background: 'var(--accent)', border: '1px solid rgba(201,255,74,0.35)' }}>
              <div style={{ fontSize: '0.72rem', color: 'rgba(0,0,0,0.6)' }}>MEDIAN / DAY</div>
              <strong style={{ fontSize: '1.5rem', color: '#0F1110' }}>{money(Math.round(medBurn))}</strong>
              <div style={{ fontSize: '0.76rem', color: 'rgba(0,0,0,0.6)' }}>Robust, ignores 1-2 big tx</div>
            </div>
          </div>
          <div style={{ marginTop: '0.9rem', padding: '0.75rem', borderRadius: '0.75rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--line)', fontSize: '0.86rem', color: 'var(--paper-dim)', lineHeight: 1.5 }}>
            {Math.abs(avgBurn - medBurn) > 800 ? (
              <>
                Mean is <strong style={{ color: 'var(--accent)' }}>{Math.abs(avgBurn - medBurn) > 0 ? `${((Math.abs(avgBurn - medBurn) / Math.max(medBurn, 1)) * 100).toFixed(0)}%` : '0%'} higher</strong> than median — rent/outlier on day{' '}
                {dailyAmounts.indexOf(Math.max(...dailyAmounts)) + 1} ({money(Math.max(...dailyAmounts))}) skews burn/day. Use median for quiet-day planning.
              </>
            ) : (
              <>Mean ≈ median — spending is even, no single outlier dominates.</>
            )}
          </div>
          <div style={{ marginTop: '0.9rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.74rem', color: 'var(--paper-faint)' }}>Daily amounts (elapsed):</span>
            <span style={{ fontSize: '0.78rem', color: 'var(--paper)' }}>{elapsedDaily.map((v) => `₹${(v / 1000).toFixed(v ? 1 : 0)}k`).join(' · ')}</span>
          </div>
        </article>

        {/* 3 Weekday heatmap */}
        <article className="analytics-card" style={{ gridColumn: 'span 6' }}>
          <div className="analytics-card-head">
            <h3>
              <CalendarDays style={{ width: '0.9rem', height: '0.9rem', display: 'inline', marginRight: '0.4rem' }} />
              Weekday heatmap
            </h3>
            <span className="analytics-card-sub">GitHub-style spend rhythm</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.45rem', marginTop: '0.9rem' }}>
            {weekdayTotals.map((w) => {
              const intensity = w.amount / maxWeekday;
              return (
                <div key={w.label} style={{ textAlign: 'center' }}>
                  <div
                    style={{
                      height: '4.5rem',
                      borderRadius: '0.7rem',
                      background: `rgba(201,255,74,${0.08 + intensity * 0.85})`,
                      border: '1px solid var(--line)',
                      display: 'grid',
                      placeItems: 'center',
                      color: intensity > 0.5 ? '#0F1110' : 'var(--paper)',
                      fontWeight: 700,
                      fontSize: '0.82rem',
                    }}
                  >
                    {w.amount ? `₹${(w.amount / 1000).toFixed(0)}k` : '—'}
                  </div>
                  <div style={{ marginTop: '0.35rem', fontSize: '0.72rem', color: 'var(--paper-faint)', fontWeight: 600 }}>{w.label}</div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--paper-dim)' }}>{w.count} tx</div>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: '0.75rem', fontSize: '0.78rem', color: 'var(--paper-dim)' }}>
            Top: <strong style={{ color: 'var(--paper)' }}>{weekdayTotals.reduce((a, b) => (a.amount > b.amount ? a : b)).label}</strong> · You spend most on{' '}
            {weekdayTotals.filter((w) => w.amount > 0).sort((a, b) => b.amount - a.amount).slice(0, 2).map((w) => w.label).join(' & ') || '—'}.
          </div>
        </article>

        {/* 4 Correlation Fun after payday */}
        <article className="analytics-card" style={{ gridColumn: 'span 6' }}>
          <div className="analytics-card-head">
            <h3>Category correlation — Fun after payday?</h3>
            <span className="analytics-card-sub">Payday = day 1 · Fun transactions vs day offset</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.9rem' }}>
            <div style={{ padding: '0.9rem', borderRadius: '0.9rem', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--line)' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--paper-faint)' }}>PEARSON r (Fun vs day)</div>
              <strong style={{ fontSize: '1.6rem', color: Math.abs(funCorr) > 0.5 ? 'var(--accent)' : 'var(--paper)' }}>{funCorr.toFixed(2)}</strong>
              <div style={{ fontSize: '0.76rem', color: 'var(--paper-dim)' }}>{funCorr > 0.3 ? 'Later in month → more Fun' : funCorr < -0.3 ? 'Early month Fun spike' : 'No timing pattern'} ({funPoints.length} Fun tx)</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0.4rem' }}>
              {funByWeek.map((b) => (
                <div key={b.bucket} style={{ padding: '0.6rem', borderRadius: '0.7rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--line)', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.68rem', color: 'var(--paper-faint)' }}>{b.bucket}</div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 700 }}>{b.amount ? money(b.amount) : '—'}</div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--paper-dim)' }}>{b.label}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="analytics-chart" style={{ height: 160, marginTop: '0.9rem' }}>
            {funPoints.length >= 2 ? (
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis type="number" dataKey="day" domain={[1, daysInMonth]} tick={{ fill: '#7c7b76', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#7c7b76', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v: any) => `₹${(v / 1000).toFixed(0)}k`} width={52} />
                  <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ background: '#1a1d1a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12 }} formatter={(v: any) => [money(v as number), 'Fun']} />
                  <Scatter data={funPoints} fill="#fbbf24" />
                </ScatterChart>
              </ResponsiveContainer>
            ) : (
              <div className="analytics-empty" style={{ minHeight: 160 }}>
                <GitCommitVertical style={{ opacity: 0.35 }} />
                <p>Need 2+ Fun transactions to compute correlation.</p>
              </div>
            )}
          </div>
        </article>

        {/* 5 Regression forecast */}
        <article className="analytics-card" style={{ gridColumn: 'span 6' }}>
          <div className="analytics-card-head">
            <h3>
              <TrendingUp style={{ width: '0.9rem', height: '0.9rem', display: 'inline', marginRight: '0.4rem' }} />
              Forecast — regression vs naive
            </h3>
            <span className="analytics-card-sub">Linear regression on cumulative (R² {regression.r2.toFixed(2)}) smooths rent outlier</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginTop: '0.9rem' }}>
            <div style={{ padding: '0.7rem', borderRadius: '0.7rem', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--line)', textAlign: 'center' }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--paper-faint)' }}>NAIVE (burn×days)</div>
              <strong>{money(naiveForecast)}</strong>
            </div>
            <div style={{ padding: '0.7rem', borderRadius: '0.7rem', background: 'var(--accent)', border: '1px solid rgba(201,255,74,0.4)', textAlign: 'center' }}>
              <div style={{ fontSize: '0.68rem', color: 'rgba(0,0,0,0.6)' }}>REGRESSION</div>
              <strong style={{ color: '#0F1110' }}>{money(regressForecast)}</strong>
            </div>
            <div style={{ padding: '0.7rem', borderRadius: '0.7rem', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--line)', textAlign: 'center' }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--paper-faint)' }}>ACTUAL SO FAR</div>
              <strong>{money(actualSpent)}</strong>
            </div>
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--paper-dim)', marginTop: '0.6rem', lineHeight: 1.5 }}>
            Slope {regression.slope.toFixed(0)} ₹/day · Intercept {money(Math.round(regression.intercept))} · Diff vs naive{' '}
            <strong style={{ color: Math.abs(regressForecast - naiveForecast) > 2000 ? 'var(--accent)' : 'var(--paper)' }}>{money(Math.abs(regressForecast - naiveForecast))}</strong> {regressForecast < naiveForecast ? 'lower' : 'higher'} — regression dampens rent spike.
          </div>
          <div className="analytics-chart" style={{ height: 180, marginTop: '0.9rem' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={Array.from({ length: daysInMonth }, (_, i) => ({ day: i + 1, actual: i < elapsed ? cumulative[i] : null, regress: Math.round(regression.predict(i + 1)) }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="day" tick={{ fill: '#7c7b76', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#7c7b76', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v: any) => `₹${(v / 1000).toFixed(0)}k`} width={52} />
                <Tooltip contentStyle={{ background: '#1a1d1a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12 }} formatter={(v: any) => [money(v as number), '']} />
                <Line type="monotone" dataKey="actual" stroke="#c9ff4a" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="regress" stroke="rgba(255,255,255,0.35)" strokeWidth={1.6} strokeDasharray="6 6" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </article>

        {/* 6 Zero-based budget diff */}
        <article className="analytics-card" style={{ gridColumn: 'span 6' }}>
          <div className="analytics-card-head">
            <h3>
              <Wallet style={{ width: '0.9rem', height: '0.9rem', display: 'inline', marginRight: '0.4rem' }} />
              Zero-based budget
            </h3>
            <span className="analytics-card-sub">Set per-category budget → variance = budgeted − actual</span>
          </div>
          <div style={{ display: 'grid', gap: '0.45rem', marginTop: '0.9rem', maxHeight: '14.5rem', overflow: 'auto', paddingRight: '0.2rem' }}>
            {zeroRows.map((r) => (
              <div key={r.category} style={{ display: 'grid', gridTemplateColumns: '1fr 88px 88px 72px', gap: '0.4rem', alignItems: 'center', padding: '0.5rem 0.6rem', borderRadius: '0.6rem', background: r.diff < 0 ? 'rgba(255,109,89,0.08)' : 'rgba(255,255,255,0.03)', border: `1px solid ${r.diff < 0 ? 'rgba(255,109,89,0.18)' : 'var(--line)'}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.84rem', fontWeight: 600 }}>
                  <i style={{ width: 8, height: 8, borderRadius: '50%', background: r.color, display: 'inline-block' }} />
                  {r.category}
                </div>
                <input
                  type="number"
                  value={catBudgets[r.category] ?? 0}
                  onChange={(e) => setCatBudgets((c) => ({ ...c, [r.category]: Number(e.target.value) }))}
                  style={{ minHeight: '1.9rem', borderRadius: '0.5rem', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.06)', color: 'var(--paper)', padding: '0 0.5rem', fontSize: '0.82rem' }}
                />
                <span style={{ fontSize: '0.82rem', textAlign: 'right', color: 'var(--paper)' }}>{money(r.actual)}</span>
                <span style={{ fontSize: '0.78rem', textAlign: 'right', fontWeight: 700, color: r.diff < 0 ? 'var(--danger)' : r.diff > 0 ? 'var(--accent)' : 'var(--paper-dim)' }}>
                  {r.diff === 0 ? '—' : `${r.diff > 0 ? '+' : ''}${money(r.diff)}`}
                </span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--line)', fontSize: '0.82rem' }}>
            <span style={{ color: 'var(--paper-dim)' }}>
              Total budgeted <strong style={{ color: 'var(--paper)' }}>{money(zeroTotalBudgeted)}</strong>
            </span>
            <span style={{ color: zeroTotalActual > zeroTotalBudgeted ? 'var(--danger)' : 'var(--accent)', fontWeight: 700 }}>
              {zeroTotalBudgeted - zeroTotalActual >= 0 ? 'Under' : 'Over'} {money(Math.abs(zeroTotalBudgeted - zeroTotalActual))}
            </span>
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--paper-faint)', marginTop: '0.4rem' }}>Budgets saved per-month in `localStorage` + DB (`BUDGET_KEY`). Edits apply instantly to ledger math.</div>
        </article>
      </div>
    </main>
  );
}
