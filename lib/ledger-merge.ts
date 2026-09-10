// Ledger union-merge — the anti-wipe helper.
//
// Never let a fresh/empty copy destroy a full one in either direction:
//   - server row missing/auto-created as {} (DB reset, memory-mode wipe on
//     Workers without TURSO_*, re-signup with the same User ID)
//   - device cache empty (new phone / cleared browser)
// The merged transaction set only ever GROWS. Same-id conflicts resolve to
// the NEWEST copy by updatedAt (server wins exact ties), so a category you
// corrected on this device can never be reverted by a stale copy from another
// browser/tab — and deletes propagate via tombstones instead of resurrecting.

type TxLike = { id: string; updatedAt?: number };
type MonthLike<T extends TxLike> = {
  salary: number;
  budget: number;
  savingsGoal: number;
  transactions: T[];
  deleted?: Record<string, number>; // txId -> deletedAt (tombstones)
};
type LedgerLike<T extends TxLike> = Record<string, MonthLike<T>>;

function asLedger<T extends TxLike>(v: unknown): LedgerLike<T> | undefined {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return undefined;
  return v as LedgerLike<T>;
}

function txList<T extends TxLike>(m: MonthLike<T> | undefined): T[] {
  const t = m?.transactions;
  return Array.isArray(t) ? t.filter((x): x is T => !!x && typeof x === 'object' && typeof (x as TxLike).id === 'string') : [];
}

// Both nonzero and different -> server wins. Otherwise nonzero wins,
// so a fresh {} row heals from the other side instead of wiping it.
function pickNum(server: unknown, local: unknown): number {
  const s = typeof server === 'number' && Number.isFinite(server) ? server : 0;
  const l = typeof local === 'number' && Number.isFinite(local) ? local : 0;
  if (s && l) return s;
  return s || l;
}

function tombstones(m: MonthLike<TxLike> | undefined): Record<string, number> {
  const d = (m as { deleted?: unknown } | undefined)?.deleted;
  if (!d || typeof d !== 'object' || Array.isArray(d)) return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(d as Record<string, unknown>)) {
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) out[k] = v;
  }
  return out;
}

export function mergeLedgers<T extends TxLike>(
  server: LedgerLike<T> | null | undefined,
  local: LedgerLike<T> | null | undefined,
): LedgerLike<T> {
  const s = asLedger<T>(server) ?? {};
  const l = asLedger<T>(local) ?? {};
  const keys = new Set([...Object.keys(s), ...Object.keys(l)]);
  const out: LedgerLike<T> = {};
  for (const k of keys) {
    const sm = s[k];
    const lm = l[k];
    // Newest copy of each transaction wins (server wins exact ties).
    const byId = new Map<string, T>();
    for (const t of txList(lm)) byId.set(t.id, t);
    for (const t of txList(sm)) {
      const cur = byId.get(t.id);
      if (!cur) byId.set(t.id, t);
      else byId.set(t.id, (t.updatedAt ?? 0) >= (cur.updatedAt ?? 0) ? t : cur);
    }
    // Tombstones: newest delete per id wins, then drop anything deleted
    // after its last edit (prevents deleted rows resurrecting from stale copies).
    const sDel = tombstones(sm);
    const lDel = tombstones(lm);
    const del: Record<string, number> = { ...lDel };
    for (const [id, at] of Object.entries(sDel)) del[id] = Math.max(del[id] ?? 0, at);
    const transactions = [...byId.values()].filter((t) => (del[t.id] ?? 0) <= (t.updatedAt ?? 0));
    out[k] = {
      salary: pickNum(sm?.salary, lm?.salary),
      budget: pickNum(sm?.budget, lm?.budget) || 50000,
      savingsGoal: pickNum(sm?.savingsGoal, lm?.savingsGoal),
      transactions,
      ...(Object.keys(del).length ? { deleted: del } : {}),
    };
  }
  return out;
}

export function countTransactions<T extends TxLike>(ledger: LedgerLike<T> | null | undefined): number {
  const l = asLedger<T>(ledger);
  if (!l) return 0;
  return Object.values(l).reduce((n, m) => n + txList(m).length, 0);
}
