'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { CircleDollarSign, User, Lock, ArrowRight, Sparkles, Eye, EyeOff, LogIn, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') || '/';
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [okMsg, setOkMsg] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    setOkMsg('');
    setLoading(true);
    try {
      const endpoint = mode === 'signup' ? '/api/auth/signup' : '/api/auth';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, password }),
      });
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; user?: string };
      if (!res.ok || !j.ok) throw new Error(j.error || (mode === 'signup' ? 'Could not create account' : 'Invalid credentials'));
      try {
        localStorage.setItem('mt_ok', '1');
        // clear any stale per-user cache so new account starts clean (0/0)
        if (mode === 'signup') localStorage.setItem('mt_last_user', (j.user ?? userId).toLowerCase());
      } catch {}
      if (mode === 'signup') setOkMsg(`Welcome, ${j.user ?? userId}! Your vault starts at ₹0 — entering…`);
      setTimeout(() => {
        router.push(next);
        router.refresh();
      }, mode === 'signup' ? 700 : 0);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-root">
      <div className="login-bg" aria-hidden>
        <div className="login-orb login-orb--a" />
        <div className="login-orb login-orb--b" />
        <div className="login-grid" />
      </div>

      <div className="login-shell">
        <section className="login-left">
          <div className="login-brand">
            <span className="login-brand-mark">
              <CircleDollarSign />
              MONEY TEES
            </span>
            <span className="login-brand-sub">Monthly Intelligence</span>
          </div>

          <div className="login-hero">
            <h1>
              Welcome
              <br />
              <em>to Money Tees.</em>
            </h1>
            <p>
              Your private ledger — salary, burn, velocity and the next right move. Every account is isolated: log in from anywhere, see only your data.
            </p>
            <div className="login-stats">
              <span>
                <Sparkles /> Private per account
              </span>
              <span>• Free DB</span>
              <span>• No tracking</span>
            </div>
          </div>

          <figure className="login-figure">
            <Image
              src="/images/ben-franklin-aesthetic.jpg"
              alt="Benjamin Franklin"
              width={1200}
              height={1500}
              priority
              style={{ objectFit: 'cover', objectPosition: '50% 18%' }}
            />
            <figcaption>
              <q>An investment in knowledge pays the best interest.</q>
              <span>— Franklin · $100</span>
            </figcaption>
          </figure>
        </section>

        <section className="login-right">
          <form className="login-card" onSubmit={submit} aria-label="Money Tees login">
            <div className="login-tabs" role="tablist" aria-label="Sign in or create account">
              <button type="button" role="tab" aria-selected={mode === 'signin'} className={mode === 'signin' ? 'active' : ''} onClick={() => { setMode('signin'); setErr(''); }}>
                <LogIn style={{ width: '0.85rem', height: '0.85rem' }} /> Sign in
              </button>
              <button type="button" role="tab" aria-selected={mode === 'signup'} className={mode === 'signup' ? 'active' : ''} onClick={() => { setMode('signup'); setErr(''); }}>
                <UserPlus style={{ width: '0.85rem', height: '0.85rem' }} /> Create account
              </button>
            </div>

            <div className="login-card-head">
              <div className="login-card-kicker">
                <LogIn style={{ width: '0.9rem', height: '0.9rem' }} /> Secure access
              </div>
              <h2>{mode === 'signup' ? 'Create your vault' : 'Sign in to Money Tees'}</h2>
              <p>{mode === 'signup' ? 'Pick a User ID + password. New vaults start at ₹0 salary, ₹0 expenses.' : 'Enter your credentials to continue.'}</p>
            </div>

            <label>
              <span>User ID</span>
              <div className="login-field">
                <User />
                <Input value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="e.g. gaurav_07" autoComplete="username" autoFocus />
              </div>
            </label>

            <label>
              <span>Password</span>
              <div className="login-field">
                <Lock />
                <Input
                  type={show ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'signup' ? 'Min 4 characters' : 'Enter password'}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                />
                <button type="button" className="login-eye" onClick={() => setShow((v) => !v)} aria-label={show ? 'Hide' : 'Show'}>
                  {show ? <EyeOff /> : <Eye />}
                </button>
              </div>
            </label>

            {err && <div className="login-error">{err}</div>}
            {okMsg && <div className="login-ok">{okMsg}</div>}

            <Button type="submit" disabled={loading} style={{ width: '100%', minHeight: '3rem', marginTop: '0.25rem' }}>
              {loading ? (mode === 'signup' ? 'Creating…' : 'Signing in…') : mode === 'signup' ? 'Create account' : 'Enter vault'}
              <ArrowRight />
            </Button>

            <div className="login-switch">
              {mode === 'signin' ? (
                <span>
                  New here? <button type="button" onClick={() => setMode('signup')}>Create an account</button> — free, isolated vault.
                </span>
              ) : (
                <span>
                  Have a vault? <button type="button" onClick={() => setMode('signin')}>Sign in</button>
                </span>
              )}
            </div>
          </form>
        </section>
      </div>

      <style>{`
        .login-root { position:relative; min-height:100dvh; background: var(--ink); overflow:hidden; }
        .login-bg { position:fixed; inset:0; pointer-events:none; }
        .login-orb { position:absolute; border-radius:50%; filter: blur(60px); opacity:0.18; }
        .login-orb--a { width: 720px; height:720px; left:-12%; top:-14%; background: radial-gradient(circle at 30% 30%, #c9ff4a, transparent 62%); }
        .login-orb--b { width: 860px; height:860px; right:-18%; bottom:-22%; background: radial-gradient(circle at 60% 40%, #a78bfa, transparent 58%), radial-gradient(circle at 20% 80%, #5cc8ff, transparent 55%); opacity:0.12; }
        .login-grid { position:absolute; inset:0; background: linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px); background-size: 3rem 3rem; mask: radial-gradient(120% 100% at 50% 20%, black 38%, transparent 82%); }
        .login-shell { position:relative; z-index:1; width:min(100% - 2rem, 76rem); margin:0 auto; min-height:100dvh; display:grid; grid-template-columns: 1.05fr 0.95fr; gap: clamp(1.5rem, 3vw, 2.5rem); align-items: center; padding: clamp(1.2rem, 3vh, 2rem) 0; }
        .login-left { display:grid; gap:1.2rem; align-content:start; }
        .login-brand { display:flex; flex-direction:column; gap:0.2rem; }
        .login-brand-mark { display:inline-flex; align-items:center; gap:0.6rem; font-weight:700; letter-spacing:0.22em; color:var(--paper); }
        .login-brand-mark svg { color:var(--accent); width:1.2rem; height:1.2rem; }
        .login-brand-sub { color:var(--paper-faint); font-size:0.72rem; letter-spacing:0.14em; text-transform:uppercase; }
        .login-hero h1 { margin:0; font-size:clamp(2.6rem,5vw,4.2rem); line-height:0.92; letter-spacing:-0.06em; font-weight:500; }
        .login-hero h1 em { color:var(--accent); font-style:normal; position:relative; }
        .login-hero p { max-width:32rem; color:var(--paper-dim); line-height:1.6; margin:0.7rem 0 0; }
        .login-stats { display:flex; gap:0.5rem; flex-wrap:wrap; margin-top:0.9rem; }
        .login-stats span { display:inline-flex; align-items:center; gap:0.4rem; padding:0.4rem 0.7rem; border-radius:999px; background:rgba(255,255,255,0.05); border:1px solid var(--line); color:var(--paper-dim); font-size:0.76rem; }
        .login-figure { position:relative; margin-top:0.6rem; height: 22rem; border-radius:1.5rem; overflow:hidden; border:1px solid var(--line); background:var(--ink-soft); box-shadow: var(--shadow-soft); }
        .login-figure img { width:100%; height:100%; object-fit:cover; filter: contrast(1.08) saturate(0.82) brightness(0.96); }
        .login-figure::after { content:""; position:absolute; inset:0; background: linear-gradient(180deg, transparent 28%, rgba(0,0,0,0.58) 100%); }
        .login-figure figcaption { position:absolute; z-index:1; left:1rem; right:1rem; bottom:1rem; display:grid; gap:0.15rem; color:var(--paper); }
        .login-figure q { font-size:0.88rem; font-style:italic; line-height:1.4; }
        .login-figure span { font-size:0.72rem; color:var(--paper-dim); letter-spacing:0.08em; }
        .login-right { display:grid; place-items:center; }
        .login-card { width:min(100%, 26rem); display:grid; gap:0.9rem; padding:1.35rem; border-radius:1.35rem; background: linear-gradient(180deg, rgba(26,29,26,0.92), rgba(15,17,16,0.96)); border:1px solid rgba(255,255,255,0.08); backdrop-filter: blur(18px); box-shadow: 0 20px 60px rgba(0,0,0,0.38); }
        .login-tabs { display:grid; grid-template-columns:1fr 1fr; gap:0.35rem; padding:0.3rem; border-radius:0.9rem; background:rgba(255,255,255,0.04); border:1px solid var(--line); }
        .login-tabs button { display:inline-flex; align-items:center; justify-content:center; gap:0.4rem; min-height:2.35rem; border:0; border-radius:0.65rem; background:transparent; color:var(--paper-dim); font-size:0.84rem; font-weight:700; cursor:pointer; }
        .login-tabs button.active { background:var(--accent); color:var(--ink); }
        .login-card-head h2 { margin:0; font-size:1.45rem; letter-spacing:-0.03em; }
        .login-card-head p { margin:0.2rem 0 0; color:var(--paper-dim); font-size:0.88rem; }
        .login-card-kicker { display:inline-flex; align-items:center; gap:0.4rem; color:var(--accent); font-size:0.72rem; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; }
        .login-card label { display:grid; gap:0.4rem; color:var(--paper-faint); font-size:0.72rem; font-weight:600; letter-spacing:0.08em; text-transform:uppercase; }
        .login-field { position:relative; display:flex; align-items:center; }
        .login-field svg:first-child { position:absolute; left:0.9rem; width:1rem; height:1rem; color:var(--paper-faint); pointer-events:none; }
        .login-field input { padding-left:2.6rem !important; padding-right:2.6rem !important; min-height:3rem; border-radius:0.8rem; }
        .login-eye { position:absolute; right:0.5rem; width:2rem; height:2rem; display:grid; place-items:center; border:0; background:transparent; color:var(--paper-faint); cursor:pointer; border-radius:50%; }
        .login-eye:hover { color:var(--paper); background:rgba(255,255,255,0.06); }
        .login-eye svg { width:1rem; height:1rem; }
        .login-error { padding:0.65rem 0.85rem; border-radius:0.7rem; background:rgba(255,109,89,0.12); border:1px solid rgba(255,109,89,0.28); color:#ffd1c8; font-size:0.84rem; }
        .login-ok { padding:0.65rem 0.85rem; border-radius:0.7rem; background:rgba(201,255,74,0.1); border:1px solid rgba(201,255,74,0.24); color:var(--accent); font-size:0.84rem; }
        .login-switch { text-align:center; color:var(--paper-dim); font-size:0.82rem; }
        .login-switch button { border:0; background:transparent; color:var(--accent); font-weight:700; cursor:pointer; padding:0; }
        @media (max-width: 880px) { .login-shell { grid-template-columns:1fr; } .login-figure { height: 18rem; } }
      `}</style>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', background: '#0F1110', color: '#a8a7a0' }}>Loading Money Tees…</div>}>
      <LoginForm />
    </Suspense>
  );
}
