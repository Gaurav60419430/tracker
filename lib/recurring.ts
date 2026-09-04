// Recurring bills detector — pure, testable. Same name + same amount appearing in 2+ months
// is treated as a recurring bill; the next occurrence is predicted from the latest one.

export type Transaction = { id: string; name: string; category: string; amount: number; date: string };
export type MonthData = { salary: number; budget: number; savingsGoal: number; transactions: Transaction[] };
export type Ledger = Record<string, MonthData>;

export type RecurringBill = {
  name: string;
  category: string;
  amount: number;
  lastDate: string;
  nextDate: string;
  monthsSeen: number;
  streak: number;
  dayOfMonth: number;
};

const shiftMonth = (key: string, delta: number) => {
  const d = new Date(`${key}-01T12:00:00`);
  d.setMonth(d.getMonth() + delta);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const addMonth = (iso: string): string => {
  const [y, m, d] = iso.split('-').map(Number);
  const next = new Date(Date.UTC(y, m, 1)); // m is 1-based, so this is already next month
  const daysInNext = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
  const day = Math.min(d, daysInNext);
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

const consecutiveStreak = (months: string[]): number => {
  const set = new Set(months);
  let streak = 0;
  let cursor = [...months].sort()[months.length - 1];
  while (set.has(cursor)) {
    streak += 1;
    cursor = shiftMonth(cursor, -1);
  }
  return streak;
};

export function detectRecurringBills(ledger: Ledger): RecurringBill[] {
  const byKey = new Map<string, { name: string; category: string; amount: number; months: string[]; dates: string[] }>();
  for (const [month, data] of Object.entries(ledger)) {
    for (const t of data.transactions) {
      const key = `${t.name.trim().toLowerCase()}|${t.amount}`;
      const entry = byKey.get(key) ?? { name: t.name.trim(), category: t.category, amount: t.amount, months: [] as string[], dates: [] as string[] };
      if (!entry.months.includes(month)) entry.months.push(month);
      entry.dates.push(t.date);
      byKey.set(key, entry);
    }
  }

  const bills: RecurringBill[] = [];
  for (const entry of byKey.values()) {
    if (entry.months.length < 2) continue;
    const sorted = [...entry.dates].sort();
    const lastDate = sorted[sorted.length - 1];
    bills.push({
      name: entry.name,
      category: entry.category,
      amount: entry.amount,
      lastDate,
      nextDate: addMonth(lastDate),
      monthsSeen: entry.months.length,
      streak: consecutiveStreak(entry.months),
      dayOfMonth: Number(lastDate.slice(8, 10)),
    });
  }
  return bills.sort((a, b) => a.nextDate.localeCompare(b.nextDate));
}

export function billsDueInMonth(bills: RecurringBill[], month: string): RecurringBill[] {
  return bills.filter((b) => b.nextDate.startsWith(month));
}

export function billsTotal(bills: RecurringBill[]): number {
  return bills.reduce((sum, b) => sum + b.amount, 0);
}
