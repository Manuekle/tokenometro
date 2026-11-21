/**
 * Number formatting. Fixed en-US locale on purpose: server and client must
 * render identical strings (no hydration mismatch) and prices are USD.
 */
const int = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const dec1 = new Intl.NumberFormat("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export const formatInt = (n: number) => int.format(Math.round(n));

/** USD with precision that adapts to magnitude: $12,480 · $41.50 · $0.0072 · $0.00042 */
export function formatUSD(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (n === 0) return "$0";
  const abs = Math.abs(n);
  if (abs >= 1000) return `$${int.format(Math.round(n))}`;
  if (abs >= 1) return `$${n.toFixed(2)}`;
  if (abs >= 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toPrecision(2)}`;
}

/** Price per million tokens: $8 · $0.20 · $0.075 */
export function formatPerM(n: number | undefined): string {
  if (n === undefined) return "—";
  if (n === 0) return "$0";
  if (n >= 100) return `$${int.format(Math.round(n))}`;
  if (n >= 1) return `$${Number(n.toFixed(2))}`;
  return `$${Number(n.toPrecision(2))}`;
}

/** 128000 -> 128K · 1048576 -> 1M */
export function formatContext(n: number): string {
  if (n >= 1_000_000) return `${Number((n / 1_000_000).toFixed(1))}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

export function formatTokens(n: number | null | undefined): string {
  return n === null || n === undefined || !Number.isFinite(n) ? "—" : int.format(Math.round(n));
}

/** Axis tick: $0.50 · $2 · $50 · $1K · $2.5M */
export function formatAxisUSD(n: number): string {
  if (n >= 1_000_000) return `$${Number((n / 1_000_000).toFixed(1))}M`;
  if (n >= 1_000) return `$${Number((n / 1_000).toFixed(1))}K`;
  if (n >= 1) return `$${Number(n.toFixed(2))}`;
  return `$${Number(n.toPrecision(2))}`;
}

/** 27_000_000 -> "27 MB" (decimal, like download sizes are quoted). */
export function formatMB(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "?";
  const mb = bytes / 1_000_000;
  return mb < 10 ? `${Number(mb.toFixed(1))} MB` : `${Math.round(mb)} MB`;
}

export const formatIndex = (n: number | null) => (n === null ? "—" : dec1.format(n));

export function formatMultiple(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (n < 1.05) return "1×";
  return n >= 10 ? `${Math.round(n)}×` : `${n.toFixed(1)}×`;
}

/** "hace 5 min" style relative time, in Spanish. */
export function timeAgo(iso: string, now = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (seconds < 60) return "hace un momento";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `hace ${hours} h`;
  return `hace ${Math.round(hours / 24)} días`;
}
