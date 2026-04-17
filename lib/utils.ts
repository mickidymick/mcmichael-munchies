export function toggleMulti(arr: string[], val: string): string[] {
  return arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val];
}

/** Escape special PostgREST filter characters to prevent filter injection. */
export function escapePostgrestString(str: string): string {
  return str.replace(/[,()\\%_*]/g, '');
}

/**
 * Scale a recipe ingredient amount string by a factor.
 * Handles: integers (2), decimals (1.5), fractions (1/2, 1/4),
 * mixed numbers (1 1/2), ranges (2-3), and text ("to taste", "pinch").
 */
export function scaleAmount(amount: string, factor: number): string {
  if (!amount || factor === 1) return amount;
  const trimmed = amount.trim();
  if (!trimmed) return trimmed;

  // Range: "2-3" or "2 - 3"
  const rangeMatch = trimmed.match(/^([\d./\s]+)\s*[-–]\s*([\d./\s]+)$/);
  if (rangeMatch) {
    return `${scaleAmount(rangeMatch[1], factor)} - ${scaleAmount(rangeMatch[2], factor)}`;
  }

  // Try to parse as number (possibly with fraction)
  const num = parseAmount(trimmed);
  if (num === null) return trimmed; // "to taste", "pinch", etc.

  const scaled = num * factor;
  return formatAmount(scaled);
}

function parseAmount(s: string): number | null {
  const t = s.trim();

  // Pure fraction: "1/2"
  const fracMatch = t.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (fracMatch) return parseInt(fracMatch[1]) / parseInt(fracMatch[2]);

  // Mixed number: "1 1/2"
  const mixedMatch = t.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/);
  if (mixedMatch) return parseInt(mixedMatch[1]) + parseInt(mixedMatch[2]) / parseInt(mixedMatch[3]);

  // Plain number: "2", "1.5"
  const num = parseFloat(t);
  return isNaN(num) ? null : num;
}

function formatAmount(n: number): string {
  // Common fractions for readability
  const FRACTIONS: [number, string][] = [
    [0.125, '1/8'], [0.25, '1/4'], [0.333, '1/3'], [0.375, '3/8'],
    [0.5, '1/2'], [0.667, '2/3'], [0.75, '3/4'], [0.875, '7/8'],
  ];

  const whole = Math.floor(n);
  const frac = n - whole;

  if (frac < 0.05) return String(whole || n);

  // Find closest common fraction
  const closest = FRACTIONS.reduce((best, [val, str]) =>
    Math.abs(frac - val) < Math.abs(frac - best[0]) ? [val, str] : best,
    [999, ''] as [number, string]
  );

  if (Math.abs(frac - closest[0]) < 0.05) {
    return whole > 0 ? `${whole} ${closest[1]}` : closest[1];
  }

  // Fall back to decimal, rounded nicely
  return n % 1 === 0 ? String(n) : n.toFixed(1).replace(/\.0$/, '');
}
