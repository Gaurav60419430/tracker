# Money Tees — Monthly Expense Tracker

> **Know what your money is doing.** Salary in. Expenses logged. The full month becomes legible — pace, pressure and what's actually safe to spend.

An aesthetic, private, on-device expense tracker built for **many-year** use. Now branded as **Money Tees** (`MONEY TEES` wordmark, Ben Franklin hero) — dark editorial UI, lime `#C9FF4A` accent, fully responsive, with durable DB sync.

**Live:** `https://tracker.gg220962.workers.dev` (Cloudflare) · **Repo:** `https://github.com/Gaurav60419431/tracker` · **Local:** `http://localhost:3001`

![Money Tees Hero](public/ben-franklin-aesthetic.jpg)

---

## Features

**Core (present):**
- **Capture rail** (`⌘K`) — Description / Amount `₹` / Category / Date → `Record` with `localStorage` + DB sync
- **Bento** — Safe to spend, Salary (inline edit), Daily burn, Spending velocity (`budget%` sparkline)
- **Analytics** (4 `recharts` 3.8) — Category donut (`PieChart` 62/88), Daily bars (`BarChart` 30-day), Cumulative vs budget (`AreaChart` lime gradient), 6-month trend (`BarChart` salary vs spent)
- **Story** — GSAP `ScrollTrigger` scrub `opacity 0.12→1` on `·story-word`
- **Where it goes** — `picsum.photos` accordion with `Hover flex:1→2.2`
- **Signals** — 3 auto-rotating (`6s`) insights (pace, pressure, quiet days)
- **Transactions** — `Search` + `filter-pills` (`All` + 8 categories) → horizontal `transaction-rail` with category color `var(--cat)`

**Brand:**
- **Ben Franklin** hero (`public/ben-franklin-aesthetic.jpg` 1200×1500, Duclos 1778 PD, `contrast 1.12` + lime `4.5%` tint, quote “An investment in knowledge pays the best interest.”)
- **Icon set** — `favicon.svg` (32), `favicon.ico`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png` (180), `money-tees-icon.svg` (tee + `$` + `MONEY TEES` wordmark), `site.webmanifest`

**Many-year durability (new):**
- `Drizzle` `0.44.5` + `@libsql/client` `0.15.10` → `lib/db/schema.ts` `ledgers(id PK, data JSON, updated_at)`
- `TURSO_DATABASE_URL`/`TURSO_AUTH_TOKEN` (libSQL `libsql://`) or `DATABASE_URL` or local `file:./data/money-tees.db`. Without env, falls back to `localStorage` (device-only).
- `app/api/ledger/route.ts` `GET`/`PUT` `runtime=nodejs` `force-dynamic` + `ensureLedgerTable()` + `onConflictDoUpdate`
- Client `app/page.tsx:105` hydrate prefers server `ledger` over `localStorage`, debounced `700ms` `PUT`.

---

## Tech

`Next.js 15.4.5` (`app/` router, `next/font` `Geist`), `React 19.2.6`, `TypeScript 5.9`, `Tailwind 4.2`, `Vite 8.0.13` via `vinext 1.0.0-beta.5` (RSC), `GSAP 3.15 + ScrollTrigger + @gsap/react 2.1`, `recharts 3.8`, `@base-ui/react`, `lucide-react`, `Drizzle` + `libSQL`, `wrangler 4.92`.

**Scripts** (`package.json:8`):
```bash
npm run dev              # vinext dev → http://localhost:3001 (HMR, cloudflare workerd)
npm run build            # vinext build → dist/client + dist/server (Cloudflare)
npm run build:vercel     # next build → .next (Vercel Next.js)
npm run build:cloudflare # vinext build
npm run start            # wrangler dev --config dist/server/wrangler.json
npm run start:vercel     # next start
npm run db:push          # drizzle-kit push → creates ledgers table
```

---

## Quick Start (Local, no keys — works immediately)

```bash
git clone https://github.com/Gaurav60419431/tracker.git
cd tracker
# Node >=22.13 required (package.json:6)
export PATH="/opt/homebrew/bin:$PATH" # or your node 22 bin
npm install
npm run dev # → http://localhost:3001
```

Data stays in `localStorage` (`moneta-ledger-v1`) + `./data/money-tees.db` (gitignored) until you add Turso.

---

## Many-Year Setup (Turso — 3 min)

Turso is SQLite over HTTPS that works on **both** Cloudflare Workers (via `fetch`) and Vercel Node.

```bash
curl -sSf https://get.tur.so/install.sh | bash
turso auth login
turso db create money-tees --location auto
turso db show money-tees --url           # libsql://money-tees-xxx.turso.io
turso db tokens create money-tees        # eyJ...
echo "TURSO_DATABASE_URL=libsql://..." >> .env.local
echo "TURSO_AUTH_TOKEN=eyJ..." >> .env.local
npm run db:push                          # creates ledgers table
npm run dev
```

**Cloudflare Workers:**
```bash
npx wrangler secret put TURSO_DATABASE_URL --config dist/server/wrangler.json
npx wrangler secret put TURSO_AUTH_TOKEN
npm run build && npx wrangler deploy --name tracker --config dist/server/wrangler.json
# Dashboard → tracker → Settings → Triggers → enable *.workers.dev → tracker.gg220962.workers.dev
```

**Vercel:**
Dashboard → `Gaurav60419431/tracker` → Settings → Environment Variables → add `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN` → Redeploy. Build command is `npm run build:vercel` (`vercel.json:3`), output `.next`.

Fallbacks: `DATABASE_URL=file:./data/money-tees.db` for local file, or no env → `localStorage` only (device-only, not many-year).

---

## Deploy

| Target | Build | Output | Route fix if `No active routes` |
|---|---|---|---|
| **Cloudflare** | `npm run build` | `dist/server/wrangler.json` (`assets.directory:../client`) | Dashboard `tracker` → `Triggers` → enable `*.workers.dev` or `Add Route` `tracker.gg220962.workers.dev/*` |
| **Vercel** | `npm run build:vercel` | `.next` (`vercel.json:4` `framework:nextjs`) | Auto — `https://tracker-xxx.vercel.app` |

`vite.config.ts:45` skips `@cloudflare/vite-plugin` + `@openai/sites-vite-plugin` when `VERCEL=1`.

---

## Structure

```
app/
  layout.tsx          # metadata title Money Tees, icons, manifest, Geist
  page.tsx            # 'use client' ledger, bento, analytics (4 charts), story scrub, accordion, stack, carousel
  globals.css         # --ink #0F1110 --accent #C9FF4A, nav blur, hero 68dvh, analytics-grid 12-col
  api/ledger/route.ts # GET/PUT ledger blob, ensureLedgerTable
lib/db/
  schema.ts           # ledgers table
  index.ts            # getClient() Turso|DATABASE_URL|file: + getDb() drizzle
public/
  ben-franklin-aesthetic.jpg  # Duclos 1778 hero
  money-tees-icon.svg / favicon.svg / icon-*.png / apple-touch-icon.png / site.webmanifest
  og.png
drizzle.config.ts     # sqlite dialect, file:./data/money-tees.db
vercel.json           # nextjs build
```

---

## Roadmap (you said “ok do” — next up)

- **Yearly archive** `ledger_months` per-month rows + FY dashboard (instead of single `ledgers.id='default'` blob)
- **R2 nightly backup** `money-tees-backup-YYYY-MM-DD.json` via cron
- **Auth** `userId` → per-user ledgers (currently single-tenant)
- **Recurring** detector + `Upcoming bills` calendar, **Receipt OCR** (`@cloudflare/ai`), **Bank CSV import**, **PWA** offline, **PDF** tax report

Open an issue or say `do yearly` / `do backup` and I’ll ship it.

---

## Author

Built by **Gaurav60419431** (`Gg220962@gmail.com`) — `NIVARA → Money Tees` rebrand, Franklin portrait PD (Joseph-Siffred Duplessis 1778, `CC PDM 1.0`). MIT. Issues & PRs: `https://github.com/Gaurav60419431/tracker`.
