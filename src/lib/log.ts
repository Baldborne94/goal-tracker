// Lightweight structured logging. Emits single-line JSON to stdout/stderr so
// the hosting platform (Vercel) captures and indexes it. If a Sentry DSN is
// configured later, this is the single choke-point to forward errors to it.

type LogContext = Record<string, unknown>;

function emit(level: "info" | "warn" | "error", event: string, ctx?: LogContext) {
  const line = JSON.stringify({
    level,
    event,
    ts: new Date().toISOString(),
    ...ctx,
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export function logInfo(event: string, ctx?: LogContext) {
  emit("info", event, ctx);
}

export function logWarn(event: string, ctx?: LogContext) {
  emit("warn", event, ctx);
}

/**
 * Log an error with context. Never throws — safe to call from a catch block
 * or a `.catch()` handler. Use instead of silent `.catch(() => {})`.
 */
export function logError(event: string, error: unknown, ctx?: LogContext) {
  const err =
    error instanceof Error
      ? { message: error.message, name: error.name, stack: error.stack }
      : { message: String(error) };
  emit("error", event, { ...ctx, error: err });
}
