'use client';

import { useMemo, useRef, useState, type CSSProperties } from 'react';
import { AlertCircle, ArrowLeft, Check, FileText, Lock, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  guessCategory,
  looksLikeStatement,
  parseStatementCSV,
  parseStatementLines,
  type ParsedStatementEntry,
} from '@/lib/statement-parser';

export type StatementImportResult = ParsedStatementEntry[];

const EXPENSE_CATEGORIES = ['Food', 'Transport', 'Housing', 'Shopping', 'Subscriptions', 'Health', 'Fun', 'Other'] as const;

// pdf.js loaded at runtime from CDN so the app needs no extra npm dep.
// The statement file itself is never uploaded anywhere — parsing happens in this tab.
const PDF_JS_URL = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.mjs';
const PDF_WORKER_URL = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs';

type ReviewRow = ParsedStatementEntry & { key: string; selected: boolean };

const money = (v: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v);

async function loadPdfJs(): Promise<any> {
  const dynamicImport = Function('u', 'return import(u)') as (u: string) => Promise<any>;
  const pdfjs = await dynamicImport(PDF_JS_URL);
  try {
    if (pdfjs?.GlobalWorkerOptions) pdfjs.GlobalWorkerOptions.workerSrc = PDF_WORKER_URL;
  } catch {}
  return pdfjs;
}

async function extractPdfLines(data: ArrayBuffer, password?: string): Promise<string[]> {
  const pdfjs = await loadPdfJs();
  const task = pdfjs.getDocument({ data: data.slice(0), password: password || undefined });
  const pdf = await task.promise;
  const lines: string[] = [];
  const maxPages = Math.min(pdf.numPages ?? 0, 80);
  for (let p = 1; p <= maxPages; p++) {
    const page = await pdf.getPage(p);
    const tc = await page.getTextContent();
    let line = '';
    for (const it of (tc.items ?? []) as Array<{ str?: unknown; hasEOL?: boolean }>) {
      const s = String(it.str ?? '');
      if (it.hasEOL) {
        line = `${line} ${s}`.trim();
        if (line) lines.push(line);
        line = '';
      } else {
        line = `${line} ${s}`.trimEnd();
        // Flush very long physical lines so wrapped rows stay parseable.
        if (line.length > 220) {
          lines.push(line.trim());
          line = '';
        }
      }
    }
    if (line.trim()) lines.push(line.trim());
    try {
      await page.cleanup();
    } catch {}
  }
  try {
    await pdf.destroy();
  } catch {}
  return lines;
}

function toRows(entries: ParsedStatementEntry[]): ReviewRow[] {
  return entries.map((e, i) => ({
    ...e,
    key: `${e.date}-${i}-${e.amount}-${e.description.slice(0, 12)}`,
    selected: true,
  }));
}

export function StatementImport({
  open,
  onClose,
  onImport,
}: {
  open: boolean;
  onClose: () => void;
  onImport: (entries: StatementImportResult) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [fileName, setFileName] = useState('');
  const [needsPassword, setNeedsPassword] = useState(false);
  const [pdfPassword, setPdfPassword] = useState('');
  const [pendingPdf, setPendingPdf] = useState<ArrayBuffer | null>(null);
  const [pasted, setPasted] = useState('');
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [debugLines, setDebugLines] = useState<string[]>([]);
  const inReview = rows.length > 0;

  const totals = useMemo(() => {
    const sel = rows.filter((r) => r.selected);
    const inflow = sel.filter((r) => r.direction === 'in').reduce((s, r) => s + r.amount, 0);
    const outflow = sel.filter((r) => r.direction === 'out').reduce((s, r) => s + r.amount, 0);
    return { count: sel.length, inflow, outflow, total: rows.length };
  }, [rows]);

  if (!open) return null;

  const reset = () => {
    setBusy('');
    setError('');
    setFileName('');
    setNeedsPassword(false);
    setPdfPassword('');
    setPendingPdf(null);
    setPasted('');
    setRows([]);
    setDebugLines([]);
    setDragOver(false);
  };

  const close = () => {
    reset();
    onClose();
  };

  const acceptEntries = (entries: ParsedStatementEntry[], label: string) => {
    if (!entries.length) {
      setError(
        `No transactions found in ${label}. For PDFs try the CSV export from your bank, or paste the statement text below.`,
      );
      return;
    }
    // Cap absurd imports — statements are monthly, not lifetime dumps.
    const capped = entries.slice(0, 1000);
    setRows(toRows(capped));
    setError('');
    setNeedsPassword(false);
  };

  const handleTextFile = async (file: File) => {
    setBusy(`Reading ${file.name}…`);
    setError('');
    try {
      const text = await file.text();
      setDebugLines(text.split(/\r?\n/).slice(0, 200));
      if (!looksLikeStatement(text) && text.length < 40) {
        setError('That file does not look like a bank statement. Paste statement text below instead.');
        return;
      }
      const csvParsed = parseStatementCSV(text);
      if (csvParsed.length >= 2) acceptEntries(csvParsed, file.name);
      else acceptEntries(parseStatementLines(text.split(/\r?\n/)), file.name);
    } catch {
      setError('Could not read that file. Try CSV export or paste the text.');
    } finally {
      setBusy('');
    }
  };

  const tryPdf = async (data: ArrayBuffer, password?: string, label = 'statement.pdf') => {
    setBusy(password ? 'Unlocking PDF…' : 'Extracting payments from PDF…');
    setError('');
    try {
      const lines = await extractPdfLines(data, password);
      setDebugLines(lines.slice(0, 200));
      const entries = parseStatementLines(lines);
      if (!entries.length) {
        setError(
          `No transactions found in ${label} (${lines.length} text lines read). Some banks export scanned PDFs — use the CSV download from netbanking instead, or paste the text below.`,
        );
        return;
      }
      acceptEntries(entries, label);
    } catch (e: unknown) {
      const name = (e as { name?: string })?.name ?? '';
      const msg = e instanceof Error ? e.message : String(e ?? '');
      if (name === 'PasswordException' || /password/i.test(msg)) {
        setPendingPdf(data);
        setNeedsPassword(true);
        setError(
          /incorrect|invalid|wrong/i.test(msg)
            ? 'Wrong PDF password. Banks usually use your PAN + DOB, e.g. ABCDE1234F_0101990.'
            : 'This PDF is password-protected. Enter the statement password — it never leaves this device.',
        );
        return;
      }
      setError(
        /failed to fetch|network|cdn/i.test(msg)
          ? 'Could not load the PDF reader (offline?). Export CSV from netbanking or paste the text below.'
          : 'Could not parse that PDF. Export CSV from netbanking or paste the statement text below.',
      );
    } finally {
      setBusy('');
    }
  };

  const handleFile = async (file: File) => {
    setFileName(file.name);
    setRows([]);
    const lower = file.name.toLowerCase();
    if (lower.endsWith('.pdf')) {
      let data: ArrayBuffer;
      try {
        data = await file.arrayBuffer();
      } catch {
        setError('Could not read that PDF.');
        return;
      }
      setPendingPdf(data);
      await tryPdf(data, pdfPassword || undefined, file.name);
    } else if (/\.(csv|txt|tsv|text)$/i.test(lower) || file.type.startsWith('text/')) {
      await handleTextFile(file);
    } else {
      // Unknown extension — sniff content: PDFs start with %PDF.
      try {
        const buf = await file.arrayBuffer();
        const head = new TextDecoder().decode(buf.slice(0, 5));
        if (head === '%PDF-') {
          setPendingPdf(buf);
          await tryPdf(buf, pdfPassword || undefined, file.name);
        } else {
          await handleTextFile(new File([buf], file.name, { type: 'text/plain' }));
        }
      } catch {
        setError('Unsupported file. Use a bank PDF or CSV.');
      }
    }
  };

  const handlePasted = () => {
    setError('');
    const text = pasted.trim();
    setDebugLines(text.split(/\r?\n/).slice(0, 200));
    if (text.length < 20) {
      setError('Paste a few statement lines first (date + description + amount).');
      return;
    }
    const csvParsed = parseStatementCSV(text);
    if (csvParsed.length >= 2) acceptEntries(csvParsed, 'pasted text');
    else acceptEntries(parseStatementLines(text.split(/\r?\n/)), 'pasted text');
  };

  const updateRow = (key: string, patch: Partial<ReviewRow>) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const flipDirection = (row: ReviewRow) => {
    const next: ReviewRow['direction'] = row.direction === 'in' ? 'out' : 'in';
    updateRow(row.key, {
      direction: next,
      category: next === 'in' ? 'Income' : guessCategory(row.description, 'out'),
    });
  };

  const confirm = () => {
    const sel = rows.filter((r) => r.selected && r.amount > 0 && r.date);
    if (!sel.length) {
      setError('Select at least one payment to record.');
      return;
    }
    onImport(
      sel.map((r) => ({
        date: r.date,
        description: r.description.trim() || 'Bank transaction',
        amount: Math.abs(r.amount),
        direction: r.direction,
        category: r.direction === 'in' ? 'Income' : r.category,
      })),
    );
    close();
  };

  const debugBlock = debugLines.length > 0 && (
    <details style={{ border: '1px solid var(--line)', borderRadius: '0.7rem', padding: '0.55rem 0.7rem', fontSize: '0.76rem', color: 'var(--paper-dim)' }}>
      <summary style={{ cursor: 'pointer', fontWeight: 700, color: 'var(--paper-faint)' }}>
        View extracted text ({debugLines.length} lines) — verify what the reader saw
      </summary>
      <pre
        style={{
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          maxHeight: '12rem',
          overflowY: 'auto',
          margin: '0.5rem 0 0',
          fontSize: '0.72rem',
          fontFamily: 'ui-monospace, monospace',
          color: 'var(--paper-dim)',
        }}
      >
        {debugLines.slice(0, 80).join('\n')}
      </pre>
    </details>
  );

  return (
    <div
      className="edit-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Import bank statement"
      onClick={(e) => e.target === e.currentTarget && !busy && close()}
    >
      <div
        className="edit-modal"
        style={{ width: 'min(46rem, 100%)', maxHeight: 'min(90vh, 62rem)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f && !busy) void handleFile(f);
        }}
      >
        <div className="edit-modal-head">
          <div>
            <h3>Import bank statement</h3>
            <div style={{ fontSize: '0.76rem', color: 'var(--paper-faint)', fontWeight: 500, marginTop: '0.15rem' }}>
              Password-protected PDF or CSV · parsed on this device, never uploaded
            </div>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={close} aria-label="Close" disabled={!!busy}>
            <X />
          </Button>
        </div>

        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
            fontSize: '0.76rem',
            color: 'var(--accent)',
            background: 'rgba(201,255,74,0.08)',
            border: '1px solid rgba(201,255,74,0.2)',
            borderRadius: '0.7rem',
            padding: '0.5rem 0.7rem',
          }}
        >
          <Lock style={{ width: '0.85rem', height: '0.85rem' }} />
          Private by design — your file and password stay in this tab.
        </div>

        {!inReview ? (
          <div style={{ display: 'grid', gap: '0.8rem', overflowY: 'auto' }}>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              style={{
                border: `1.5px dashed ${dragOver ? 'var(--accent)' : 'var(--line-strong)'}`,
                borderRadius: '1rem',
                background: dragOver ? 'rgba(201,255,74,0.07)' : 'rgba(255,255,255,0.03)',
                color: 'var(--paper)',
                padding: '1.4rem 1rem',
                cursor: 'pointer',
                display: 'grid',
                gap: '0.4rem',
                placeItems: 'center',
                textAlign: 'center',
              }}
            >
              <Upload style={{ width: '1.4rem', height: '1.4rem', color: 'var(--accent)' }} />
              <strong style={{ fontSize: '0.95rem' }}>{busy || 'Drop your statement here or browse'}</strong>
              <span style={{ fontSize: '0.78rem', color: 'var(--paper-dim)' }}>
                .pdf (even with a password) · .csv / .txt — HDFC, SBI, ICICI, Axis
              </span>
              {fileName && <span style={{ fontSize: '0.76rem', color: 'var(--paper-faint)' }}>{fileName}</span>}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.csv,.txt,.tsv,.text,text/plain,application/pdf"
              style={{ display: 'none' }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) void handleFile(f);
              }}
            />

            {needsPassword && (
              <div style={{ display: 'grid', gap: '0.5rem', border: '1px solid rgba(201,255,74,0.25)', borderRadius: '0.9rem', padding: '0.8rem' }}>
                <label style={{ display: 'grid', gap: '0.4rem', fontSize: '0.72rem', color: 'var(--paper-faint)', fontWeight: 700, letterSpacing: '0.08em' }}>
                  PDF PASSWORD
                  <Input
                    type="password"
                    value={pdfPassword}
                    onChange={(e) => setPdfPassword(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && pendingPdf) void tryPdf(pendingPdf, pdfPassword, fileName || 'statement.pdf');
                    }}
                    placeholder="Statement password"
                    autoComplete="off"
                  />
                </label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <Button
                    disabled={!pendingPdf || !pdfPassword || !!busy}
                    onClick={() => pendingPdf && void tryPdf(pendingPdf, pdfPassword, fileName || 'statement.pdf')}
                  >
                    <Check /> Unlock & extract
                  </Button>
                </div>
                <small style={{ color: 'var(--paper-faint)', fontSize: '0.74rem' }}>
                  Hint: many banks set it as PAN + DOB or account + DOB. It is used only to unlock the PDF in your browser.
                </small>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--paper-faint)', fontSize: '0.74rem' }}>
              <span style={{ flex: 1, height: 1, background: 'var(--line)' }} />
              or paste statement text
              <span style={{ flex: 1, height: 1, background: 'var(--line)' }} />
            </div>
            <textarea
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              placeholder={'01/09/2026 UPI-GAURAV COFFEE 420.00\n02/09/2026 NEFT SALARY ACME 80000.00 Cr'}
              rows={4}
              style={{
                width: '100%',
                borderRadius: '0.8rem',
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.05)',
                color: 'var(--paper)',
                padding: '0.7rem 0.8rem',
                fontSize: '0.82rem',
                fontFamily: 'ui-monospace, monospace',
                resize: 'vertical',
              }}
            />
            <div>
              <Button variant="outline" onClick={handlePasted} disabled={!!busy}>
                <FileText /> Parse pasted text
              </Button>
            </div>

            {error && (
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', color: '#ffb4a2', fontSize: '0.82rem', lineHeight: 1.5 }}>
                <AlertCircle style={{ width: '1rem', height: '1rem', flexShrink: 0, marginTop: '0.15rem' }} />
                <span>{error}</span>
              </div>
            )}
            {debugBlock}
            <div className="edit-modal-actions">
              <Button variant="outline" onClick={close} disabled={!!busy}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem', minHeight: 0 }}>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.5rem',
                alignItems: 'center',
                fontSize: '0.8rem',
                color: 'var(--paper-dim)',
              }}
            >
              <strong style={{ color: 'var(--paper)' }}>{totals.total} payments found</strong>
              <span>·</span>
              <span style={{ color: 'var(--accent)', fontWeight: 700 }}>+{money(totals.inflow)} in</span>
              <span>·</span>
              <span style={{ fontWeight: 700 }}>−{money(totals.outflow)} out</span>
              <span style={{ flex: 1 }} />
              <button
                type="button"
                onClick={() => setRows((p) => p.map((r) => ({ ...r, selected: true })))}
                style={linkBtn}
              >
                Select all
              </button>
              <button
                type="button"
                onClick={() => setRows((p) => p.map((r) => ({ ...r, selected: false })))}
                style={linkBtn}
              >
                Clear
              </button>
              <button type="button" onClick={() => setRows([])} style={linkBtn}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                  <ArrowLeft style={{ width: '0.8rem', height: '0.8rem' }} /> Another file
                </span>
              </button>
            </div>

            {debugBlock}

            <div style={{ overflowY: 'auto', display: 'grid', gap: '0.5rem', paddingRight: '0.15rem', minHeight: 0 }}>
              {rows.map((r) => (
                <div
                  key={r.key}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'auto 1fr auto',
                    gap: '0.6rem',
                    alignItems: 'start',
                    padding: '0.65rem',
                    borderRadius: '0.85rem',
                    border: '1px solid var(--line)',
                    background: r.selected ? 'rgba(255,255,255,0.045)' : 'rgba(255,255,255,0.015)',
                    opacity: r.selected ? 1 : 0.62,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={r.selected}
                    onChange={(e) => updateRow(r.key, { selected: e.target.checked })}
                    aria-label={`Select ${r.description}`}
                    style={{ width: '1.05rem', height: '1.05rem', marginTop: '0.35rem', accentColor: '#c9ff4a' }}
                  />
                  <div style={{ display: 'grid', gap: '0.45rem', minWidth: 0 }}>
                    <input
                      value={r.description}
                      onChange={(e) => {
                        const v = e.target.value;
                        updateRow(r.key, {
                          description: v,
                          category: r.direction === 'in' ? 'Income' : guessCategory(v, 'out'),
                        });
                      }}
                      placeholder="Payment description"
                      aria-label="Payment description"
                      style={field}
                    />
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem', alignItems: 'center' }}>
                      <input
                        type="date"
                        value={r.date}
                        onChange={(e) => updateRow(r.key, { date: e.target.value })}
                        aria-label="Payment date"
                        style={{ ...field, width: 'auto', fontSize: '0.78rem' }}
                      />
                      {r.direction === 'out' ? (
                        <select
                          value={r.category}
                          onChange={(e) => updateRow(r.key, { category: e.target.value })}
                          aria-label="Category"
                          style={{ ...field, width: 'auto', fontSize: '0.78rem' }}
                        >
                          {EXPENSE_CATEGORIES.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            letterSpacing: '0.06em',
                            color: 'var(--accent)',
                            border: '1px solid rgba(201,255,74,0.3)',
                            borderRadius: '999px',
                            padding: '0.3rem 0.6rem',
                          }}
                        >
                          INCOME
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'grid', gap: '0.4rem', justifyItems: 'end' }}>
                    <strong style={{ color: r.direction === 'in' ? 'var(--accent)' : 'var(--paper)', fontSize: '0.95rem' }}>
                      {r.direction === 'in' ? '+' : '−'}
                      {money(r.amount)}
                    </strong>
                    <div
                      role="group"
                      aria-label="Payment direction"
                      style={{ display: 'flex', border: '1px solid var(--line-strong)', borderRadius: '999px', overflow: 'hidden' }}
                    >
                      {(['out', 'in'] as const).map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => r.direction !== d && flipDirection(r)}
                          style={{
                            border: 0,
                            cursor: 'pointer',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            padding: '0.3rem 0.6rem',
                            background: r.direction === d ? (d === 'in' ? 'var(--accent)' : 'var(--paper)') : 'transparent',
                            color: r.direction === d ? 'var(--ink)' : 'var(--paper-dim)',
                          }}
                        >
                          {d === 'in' ? 'In' : 'Out'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {error && (
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', color: '#ffb4a2', fontSize: '0.82rem' }}>
                <AlertCircle style={{ width: '1rem', height: '1rem', flexShrink: 0, marginTop: '0.15rem' }} />
                <span>{error}</span>
              </div>
            )}

            <div className="edit-modal-actions" style={{ alignItems: 'center' }}>
              <small style={{ marginRight: 'auto', color: 'var(--paper-faint)', fontSize: '0.74rem' }}>
                Outflows → expenses · Inflows → income, each in its own month.
              </small>
              <Button variant="outline" onClick={() => setRows([])}>
                Back
              </Button>
              <Button onClick={confirm}>
                <Check /> Record {totals.count} payment{totals.count === 1 ? '' : 's'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const field: CSSProperties = {
  width: '100%',
  minWidth: 0,
  minHeight: '2.4rem',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '0.65rem',
  background: 'rgba(255,255,255,0.06)',
  color: 'var(--paper)',
  padding: '0 0.7rem',
  fontSize: '0.86rem',
};

const linkBtn: CSSProperties = {
  border: 0,
  background: 'transparent',
  color: 'var(--paper-dim)',
  fontSize: '0.76rem',
  fontWeight: 600,
  cursor: 'pointer',
  textDecoration: 'underline',
  textUnderlineOffset: '3px',
};
