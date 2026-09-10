// Ledger union-merge — the anti-wipe helper.
//
// Never let a fresh/empty copy destroy a full one in either direction:
//   - server row missing/auto-created as {} (DB reset, memory-mode wipe on
//     Workers without TURSO_*, re-signup with the same User ID)
//   - device cache empty (new phone / cleared browser)
// The merged transaction set only ever GROWS. Same-id conflicts resolve to
// the server copy (synced truth wins); salary/budget/goal take the nonzero
// side, server winning only when both sides are nonzero and differ.

type TxLike = { id: string };
type MonthLike<T extends TxLike> = {
  salary: number;
  budget: number;
  savingsGoal: number;
  transactions: T[];
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
    const byId = new Map<string, T>();
    for (const t of txList(lm)) byId.set(t.id, t);
    for (const t of txList(sm)) byId.set(t.id, t); // server wins same-id ties
    out[k] = {
      salary: pickNum(sm?.salary, lm?.salary),
      budget: pickNum(sm?.budget, lm?.budget) || 50000,
      savingsGoal: pickNum(sm?.savingsGoal, lm?.savingsGoal),
      transactions: [...byId.values()],
    };
  }
  return out;
}

export function countTransactions<T extends TxLike>(ledger: LedgerLike<T> | null | undefined): number {
  const l = asLedger<T>(ledger);
  if (!l) return 0;
  return Object.values(l).reduce((n, m) => n + txList(m).length, 0);
}
