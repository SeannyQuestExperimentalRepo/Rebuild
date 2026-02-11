/**
 * Lightweight error tracking with structured logging.
 * Prepares for Sentry integration later — for now, structured console output.
 */

interface ErrorContext {
  route?: string;
  userId?: string;
  sport?: string;
  action?: string;
  [key: string]: unknown;
}

interface TimingContext {
  route: string;
  method: string;
  durationMs: number;
  [key: string]: unknown;
}

/**
 * Log an error with structured context.
 */
export function trackError(error: unknown, context: ErrorContext = {}): void {
  const err = error instanceof Error ? error : new Error(String(error));

  console.error(
    JSON.stringify({
      level: "error",
      message: err.message,
      stack: err.stack?.split("\n").slice(0, 5).join("\n"),
      ...context,
      timestamp: new Date().toISOString(),
    }),
  );
}

/**
 * Log a warning with structured context.
 */
export function trackWarning(message: string, context: ErrorContext = {}): void {
  console.warn(
    JSON.stringify({
      level: "warn",
      message,
      ...context,
      timestamp: new Date().toISOString(),
    }),
  );
}

/**
 * Log API response time. Warns if response is slow (>1s).
 */
export function trackTiming(context: TimingContext): void {
  const level = context.durationMs > 1000 ? "warn" : "info";
  const prefix = context.durationMs > 1000 ? "[SLOW] " : "";

  if (level === "warn") {
    console.warn(
      JSON.stringify({
        level,
        message: `${prefix}${context.method} ${context.route} took ${context.durationMs}ms`,
        ...context,
        timestamp: new Date().toISOString(),
      }),
    );
  }
}

/**
 * Create a timer for measuring route duration.
 * Usage: const end = startTimer(); ... const ms = end();
 */
export function startTimer(): () => number {
  const start = performance.now();
  return () => Math.round(performance.now() - start);
}
