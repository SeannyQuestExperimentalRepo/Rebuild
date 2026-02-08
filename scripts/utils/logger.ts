/**
 * Structured logging utility for data pipeline scripts.
 */

type LogLevel = "info" | "warn" | "error" | "debug";

function timestamp(): string {
  return new Date().toISOString();
}

function log(level: LogLevel, context: string, message: string, data?: Record<string, unknown>) {
  const entry = {
    timestamp: timestamp(),
    level,
    context,
    message,
    ...(data ? { data } : {}),
  };

  if (level === "error") {
    console.error(JSON.stringify(entry));
  } else if (level === "warn") {
    console.warn(JSON.stringify(entry));
  } else {
    console.log(JSON.stringify(entry));
  }
}

export function createLogger(context: string) {
  return {
    info: (message: string, data?: Record<string, unknown>) => log("info", context, message, data),
    warn: (message: string, data?: Record<string, unknown>) => log("warn", context, message, data),
    error: (message: string, data?: Record<string, unknown>) => log("error", context, message, data),
    debug: (message: string, data?: Record<string, unknown>) => {
      if (process.env.DEBUG) log("debug", context, message, data);
    },
  };
}
