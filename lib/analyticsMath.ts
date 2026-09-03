// Math helpers for nerdy analytics — pure, testable
export function mean(arr: number[]): number {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

export function median(arr: number[]): number {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}

export function stddev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  const v = arr.reduce((a, b) => a + (b - m) ** 2, 0) / arr.length;
  return Math.sqrt(v);
}

// coefficient of variation = std / mean
export function cv(arr: number[]): number {
  const m = mean(arr);
  if (m === 0) return 0;
  return stddev(arr) / m;
}

// Pearson correlation between two equal-length arrays
export function pearson(xs: number[], ys: number[]): number {
  if (xs.length !== ys.length || xs.length < 2) return 0;
  const mx = mean(xs);
  const my = mean(ys);
  let num = 0, dx2 = 0, dy2 = 0;
  for (let i = 0; i < xs.length; i++) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    num += dx * dy;
    dx2 += dx * dx;
    dy2 += dy * dy;
  }
  const den = Math.sqrt(dx2 * dy2);
  return den === 0 ? 0 : num / den;
}

// Simple linear regression on points (x,y) -> {slope, intercept, r2}
// forecast at x = targetX
export function linearRegression(xs: number[], ys: number[]): { slope: number; intercept: number; r2: number; predict: (x: number) => number } {
  if (xs.length < 2) return { slope: 0, intercept: ys[0] ?? 0, r2: 0, predict: () => ys[0] ?? 0 };
  const n = xs.length;
  const mx = mean(xs);
  const my = mean(ys);
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  const intercept = my - slope * mx;
  // r2
  let ssTot = 0, ssRes = 0;
  for (let i = 0; i < n; i++) {
    const yPred = slope * xs[i] + intercept;
    ssTot += (ys[i] - my) ** 2;
    ssRes += (ys[i] - yPred) ** 2;
  }
  const r2 = ssTot === 0 ? 0 : 1 - ssRes / ssTot;
  return { slope, intercept, r2, predict: (x: number) => slope * x + intercept };
}
