// Bank statement parsing — 100% client-side, no uploads.
// Supports CSV exports (HDFC / SBI / ICICI / Axis) and raw text lines
// extracted from PDFs (including password-protected ones unlocked in-browser).

export type StatementDirection = 'in' | 'out';

export type ParsedStatementEntry = {
  date: string; // YYYY-MM-DD
  description: string;
  amount: number; // always positive
  direction: StatementDirection;
  category: string;
};

const MONTHS: Record<string, string> = {
  jan: '01',
  feb: '02',
  mar: '03',
  apr: '04',
  may: '05',
  jun: '06',
  jul: '07',
  aug: '08',
  sep: '09',
  sept: '09',
  oct: '10',
  nov: '11',
  dec: '12',
};

/** Flexible date parser for Indian bank statements. Returns YYYY-MM-DD or null. */
export function parseDateFlexible(raw: string): string | null {
  const s = raw.trim().replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
  if (!s) return null;

  // YYYY-MM-DD or YYYY/MM/DD
  let m = s.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})/);
  if (m) {
    const y = m[1];
    const mo = m[2].padStart(2, '0');
    const d = m[3].padStart(2, '0');
    if (validDate(y, mo, d)) return `${y}-${mo}-${d}`;
    return null;
  }

  // DD-MM-YYYY / DD/MM/YYYY / DD.MM.YYYY / DD-MM-YY
  m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/);
  if (m) {
    const d = m[1].padStart(2, '0');
    const mo = m[2].padStart(2, '0');
    let y = m[3];
    if (y.length === 2) y = expandYear(y);
    if (validDate(y, mo, d)) return `${y}-${mo}-${d}`;
    return null;
  }

  // DD Mon YYYY / DD-Mon-YY / DD Mon YY  (01 Jan 2026, 01-Jan-26)
  m = s.match(/^(\d{1,2})[.\s/-]*([A-Za-z]{3,9})[.\s,/-]*(\d{2,4})/);
  if (m) {
    const d = m[1].padStart(2, '0');
    const mo = MONTHS[m[2].toLowerCase().slice(0, 4)] ?? MONTHS[m[2].toLowerCase().slice(0, 3)];
    if (!mo) return null;
    let y = m[3];
    if (y.length === 2) y = expandYear(y);
    if (validDate(y, mo, d)) return `${y}-${mo}-${d}`;
    return null;
  }

  return null;
}

function expandYear(yy: string): string {
  const n = Number(yy);
  if (!Number.isFinite(n)) return `20${yy}`;
  return n <= 40 ? `20${yy.padStart(2, '0')}` : n < 70 ? `20${yy.padStart(2, '0')}` : `19${yy.padStart(2, '0')}`;
}

function validDate(y: string, mo: string, d: string): boolean {
  const yi = Number(y);
  const mi = Number(mo);
  const di = Number(d);
  if (!Number.isFinite(yi) || !Number.isFinite(mi) || !Number.isFinite(di)) return false;
  if (yi < 1990 || yi > 2100 || mi < 1 || mi > 12 || di < 1 || di > 31) return false;
  return true;
}

/** Parse an amount cell. Handles ₹, commas, "1,200.00 Cr/Dr", "(1,200.00)". */
export function parseAmountFlexible(raw: string): number | null {
  if (raw == null) return null;
  let s = String(raw).trim();
  if (!s || s === '-' || s === '--' || s.toLowerCase() === 'nil') return null;
  const negativeParen = /^\(.*\)$/.test(s);
  s = s
    .replace(/[₹Rs.\s]/gi, (tok) => (/\d/.test(tok) ? tok : ' '))
    .replace(/INR/gi, ' ')
    .trim();
  // strip Cr/Dr markers for numeric parse (direction handled separately)
  s = s.replace(/\b(cr|dr|credit|debit)\b\.?/gi, ' ').trim();
  s = s.replace(/[^0-9.,()-]/g, '').trim();
  if (!s || s === '-' || s === '.' || s === ',') return null;
  const num = Number(s.replace(/,/g, ''));
  if (!Number.isFinite(num) || num === 0) return num === 0 ? 0 : null;
  void negativeParen;
  return Math.abs(num);
}

function directionFromMarkers(raw: string): StatementDirection | null {
  const s = ` ${raw.toLowerCase()} `;
  if (/\bcr\b|credit|received|deposit|\bin\b/.test(s) && !/\bdr\b|debit|withdrawal|paid|\bout\b/.test(s)) {
    // pure credit signal — but "credit card ... debit" handled by exclusion above
    if (/\bcr\b|credit|salary|refund|cashback|interest|dividend|neft|imps|upi/.test(s)) return 'in';
  }
  if (/\bdr\b|debit|withdrawal/.test(s)) return 'out';
  return null;
}

const CREDIT_HINTS = [
  'salary',
  'credit',
  'neft cr',
  'imps cr',
  'upi cr',
  'refund',
  'cashback',
  'interest',
  'dividend',
  'maturity',
  'reversal',
];

export function inferDirection(description: string, markerText = ''): StatementDirection {
  const marked = directionFromMarkers(markerText);
  if (marked) return marked;
  const d = description.toLowerCase();
  if (CREDIT_HINTS.some((k) => d.includes(k))) return 'in';
  if (/\bcr\b/.test(d) && !/\bdr\b/.test(d)) return 'in';
  return 'out';
}

/** Auto-suggest a Money Tees category from a narration line. */
export function guessCategory(description: string, direction: StatementDirection): string {
  if (direction === 'in') return 'Income';
  const d = description.toLowerCase();
  const has = (...keys: string[]) => keys.some((k) => d.includes(k));
  if (has('swiggy', 'zomato', 'coffee', 'restaurant', 'food', 'dinner', 'lunch', 'cafe', 'bakery', 'pizza', 'burger', 'grocery', 'groceries', 'bigbasket', 'blinkit', 'zepto', 'kirana', 'dhaba')) return 'Food';
  if (has('uber', 'ola', 'metro', 'petrol', 'diesel', 'fuel', 'irctc', 'railway', 'flight', 'indigo', 'toll', 'parking', 'bus', 'cab', 'rapido', 'fastag')) return 'Transport';
  if (has('rent', 'electricity', 'water', 'gas', 'maintenance', 'broadband', 'wifi', 'landlord', 'housing', 'society', 'bescom', 'bwssb')) return 'Housing';
  if (has('amazon', 'flipkart', 'myntra', 'ajio', 'shopping', 'decathlon', 'ikea', 'reliance', 'dmart')) return 'Shopping';
  if (has('netflix', 'spotify', 'prime', 'hotstar', 'youtube', 'figma', 'icloud', 'subscription', 'recharge', 'jio', 'airtel', 'vi ')) return 'Subscriptions';
  if (has('pharmacy', 'apollo', 'hospital', 'doctor', 'clinic', 'medical', 'health', 'gym', 'cult', 'diagnostic')) return 'Health';
  if (has('movie', 'pvr', 'inox', 'bookmyshow', 'game', 'concert', 'trip', 'travel', 'hotel', 'oyo', 'makemytrip')) return 'Fun';
  return 'Other';
}

function cleanDescription(raw: string): string {
  let s = String(raw ?? '')
    .replace(/["“”]/g, ' ')
    .replace(/[|•·]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[-–—:;,. ]+/, '')
    .replace(/[-–—:;,. ]+$/, '')
    .trim();
  s = s.replace(/\s{2,}/g, ' ').trim();
  if (!s) return 'Bank transaction';
  return s.length > 90 ? `${s.slice(0, 90).trim()}…` : s;
}

function splitRow(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      out.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out.map((c) => c.replace(/^"|"$/g, '').trim());
}

function detectDelimiter(sample: string[]): string {
  const candidates = [',', ';', '\t', '|'];
  let best = ',';
  let bestScore = -1;
  for (const d of candidates) {
    const score = sample.slice(0, 5).reduce((acc, line) => acc + line.split(d).length, 0);
    if (score > bestScore) {
      bestScore = score;
      best = d;
    }
  }
  return best;
}

function findCol(headers: string[], ...needles: RegExp[]): number {
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    if (needles.some((re) => re.test(h))) return i;
  }
  return -1;
}

/** Parse CSV / TSV text exported from a bank. */
export function parseStatementCSV(text: string): ParsedStatementEntry[] {
  const rawLines = String(text ?? '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.trimEnd())
    .filter((l) => l.trim().length > 0);
  if (!rawLines.length) return [];

  const delimiter = detectDelimiter(rawLines);
  const rows = rawLines.map((l) => splitRow(l, delimiter));
  if (!rows.length) return [];

  const headerCells = rows[0].map((c) => c.toLowerCase());
  const looksLikeHeader = headerCells.some((c) =>
    /date|narration|description|particular|debit|credit|amount|withdrawal|deposit|balance|remarks|details|transaction|payee|ref/.test(c),
  );
  const headers = looksLikeHeader ? headerCells : [];
  const dataRows = looksLikeHeader ? rows.slice(1) : rows;

  let dateIdx = headers.length ? findCol(headers, /date|value\s*dt|txn\s*date/) : 0;
  let descIdx = headers.length
    ? findCol(headers, /narration|description|particular|remarks|details|transaction.*detail|payee|purpose/)
    : 1;
  let debitIdx = headers.length ? findCol(headers, /debit|withdrawal|paid|money\s*out|^dr$/) : -1;
  let creditIdx = headers.length ? findCol(headers, /credit|deposit|received|money\s*in|^cr$/) : -1;
  let amountIdx = headers.length ? findCol(headers, /^amount$|amt\b|transaction.*amount/) : -1;
  let typeIdx = headers.length ? findCol(headers, /type|dr\s*\/\s*cr|drcr|flow|inflow|outflow/) : -1;

  // No-header fallback: [date, description, debit, credit, balance] or [date, description, amount]
  if (!headers.length) {
    const width = Math.max(...dataRows.map((r) => r.length));
    dateIdx = 0;
    if (width >= 5) {
      descIdx = 1;
      debitIdx = 2;
      creditIdx = 3;
    } else if (width === 4) {
      descIdx = 1;
      amountIdx = 2;
    } else if (width === 3) {
      descIdx = 1;
      amountIdx = 2;
    } else {
      descIdx = 1;
    }
  }
  if (descIdx < 0) descIdx = dateIdx === 0 ? 1 : 0;

  const entries: ParsedStatementEntry[] = [];
  for (const row of dataRows) {
    const dateRaw = (row[dateIdx] ?? '').trim();
    const date = parseDateFlexible(dateRaw);
    if (!date) continue;

    const descRaw =
      descIdx >= 0 && row[descIdx]
        ? row.slice(descIdx, descIdx + 2).join(' ').trim()
        : row.filter((_, i) => i !== dateIdx).join(' ').trim();
    if (/^(opening|closing)\s+balance/i.test(descRaw)) continue;

    let amount = 0;
    let direction: StatementDirection = 'out';
    let markerText = '';

    if (debitIdx >= 0 || creditIdx >= 0) {
      const d = debitIdx >= 0 ? (parseAmountFlexible(row[debitIdx] ?? '') ?? 0) : 0;
      const c = creditIdx >= 0 ? (parseAmountFlexible(row[creditIdx] ?? '') ?? 0) : 0;
      if (d > 0 && c > 0) {
        // Ambiguous — take the larger leg and let the user flip it in review.
        if (c > d) {
          amount = c;
          direction = 'in';
        } else {
          amount = d;
          direction = 'out';
        }
      } else if (d > 0) {
        amount = d;
        direction = 'out';
      } else if (c > 0) {
        amount = c;
        direction = 'in';
      } else {
        continue;
      }
    } else if (amountIdx >= 0) {
      const cell = (row[amountIdx] ?? '').trim();
      const parsed = parseAmountFlexible(cell);
      if (parsed == null || parsed === 0) continue;
      amount = parsed;
      markerText = `${cell} ${(typeIdx >= 0 ? row[typeIdx] : '') ?? ''}`;
      const t = (typeIdx >= 0 ? String(row[typeIdx]).toLowerCase() : '').trim();
      if (/\bcr\b|credit|inflow|\bin\b/.test(t) || /\bcr\b/i.test(cell)) direction = 'in';
      else if (/\bdr\b|debit|outflow|\bout\b/.test(t) || /\bdr\b/i.test(cell)) direction = 'out';
      else if (/^\(.*\)$/.test(cell) || /^-\s*[\d,]/.test(cell)) direction = 'out';
      else direction = inferDirection(descRaw, markerText);
    } else {
      continue;
    }

    if (!Number.isFinite(amount) || amount <= 0) continue;
    const description = cleanDescription(descRaw);
    entries.push({ date, description, amount: Math.round(amount * 100) / 100, direction, category: guessCategory(description, direction) });
  }

  return entries.sort((a, b) => a.date.localeCompare(b.date));
}

const DATE_AT_START =
  /(\d{4}[./-]\d{1,2}[./-]\d{1,2}|\d{1,2}[./-]\d{1,2}[./-]\d{2,4}|\d{1,2}\s+[A-Za-z]{3,9}\s+\d{2,4}|\d{1,2}-[A-Za-z]{3,9}-\d{2,4})/;
const AMOUNT_TOKEN = /\(?[\d,]+\.\d{1,2}\)?/g;
const FOOTER_HINT = /opening balance|closing balance|balance b\/f|carried forward|brought forward|statement of account|account statement|page \d+|total\s*credit|total\s*debit/i;

/** Parse plain-text lines (PDF text layer or pasted statement text). */
export function parseStatementLines(lines: string[]): ParsedStatementEntry[] {
  const entries: ParsedStatementEntry[] = [];

  for (const rawLine of lines) {
    const line = String(rawLine ?? '').replace(/\s+/g, ' ').trim();
    if (!line || line.length < 8) continue;
    if (FOOTER_HINT.test(line) && !DATE_AT_START.test(line)) continue;
    if (/^(date|txn date|value date).*description.*(debit|credit|amount|balance)/i.test(line)) continue;

    const dateMatch = line.match(DATE_AT_START);
    if (!dateMatch || dateMatch.index == null) {
      // Possible narration continuation from a wrapped PDF row.
      const prev = entries[entries.length - 1];
      if (prev && line.length > 3 && !FOOTER_HINT.test(line) && !/^\d+$/.test(line)) {
        const extra = cleanDescription(line);
        if (extra && extra !== 'Bank transaction') {
          const merged = `${prev.description} ${extra}`.slice(0, 90);
          prev.description = merged;
          prev.category = guessCategory(merged, prev.direction);
        }
      }
      continue;
    }

    const date = parseDateFlexible(dateMatch[0]);
    if (!date) continue;

    let rest = `${line.slice(0, dateMatch.index)} ${line.slice(dateMatch.index + dateMatch[0].length)}`.replace(/\s+/g, ' ').trim();
    if (/^(opening|closing)\s+balance/i.test(rest)) continue;

    const markerText = rest;
    const hasCr = /\bcr\b/i.test(rest);
    const hasDr = /\bdr\b/i.test(rest);

    let tokens = rest.match(AMOUNT_TOKEN) ?? [];
    if (!tokens.length) {
      // Fallback for whole-rupee lines without paise ("UPI COFFEE 420").
      const ints = rest.match(/[\d,]{3,}/g) ?? [];
      tokens = ints.filter((t) => {
        const n = Number(t.replace(/,/g, ''));
        return Number.isFinite(n) && n > 0 && n < 100_000_000 && !/^\d{4}$/.test(t.replace(/,/g, ''));
      });
    }
    if (!tokens.length) continue;

    let amount = 0;
    let balanceDropped = false;
    if (tokens.length === 1) {
      amount = parseAmountFlexible(tokens[0]) ?? 0;
    } else {
      // Last numeric token is almost always the running balance — drop it.
      const legs = tokens.slice(0, -1);
      balanceDropped = true;
      const values = legs.map((t) => parseAmountFlexible(t) ?? 0).filter((v) => v > 0);
      if (!values.length) continue;
      if (values.length === 1) {
        amount = values[0];
      } else {
        // Two legs (debit + credit columns) — one should dominate.
        const sorted = [...values].sort((a, b) => b - a);
        amount = sorted[0];
      }
    }
    if (!Number.isFinite(amount) || amount <= 0) continue;

    // Strip amounts + balance + Dr/Cr markers to isolate the narration.
    let narration = rest;
    for (const t of tokens) narration = narration.replace(t, ' ');
    narration = narration.replace(/\b[CD]r\b\.?/gi, ' ');
    narration = narration.replace(/\b(balance|bal)[:.]?$/i, ' ');
    void balanceDropped;
    const description = cleanDescription(narration);

    let direction: StatementDirection;
    if (hasCr && !hasDr) direction = 'in';
    else if (hasDr && !hasCr) direction = 'out';
    else direction = inferDirection(description, markerText);

    entries.push({
      date,
      description,
      amount: Math.round(amount * 100) / 100,
      direction,
      category: guessCategory(description, direction),
    });
  }

  return entries.sort((a, b) => a.date.localeCompare(b.date));
}

/** Decide whether pasted/file text looks like a bank statement at all. */
export function looksLikeStatement(text: string): boolean {
  const t = text.toLowerCase();
  let score = 0;
  if (/date|txn|narration|description|particular/.test(t)) score++;
  if (/debit|credit|withdrawal|deposit|balance/.test(t)) score++;
  if (/upi|neft|imps|ach|pos|atm/.test(t)) score++;
  if (DATE_AT_START.test(text)) score += 2;
  if ((text.match(AMOUNT_TOKEN) ?? []).length >= 2) score++;
  return score >= 3;
}
