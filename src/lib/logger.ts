type LogLevel = "info" | "warn" | "error";

export interface LeadLogContext {
  leadId?: number;
  stage: string;
  status: "ok" | "skip" | "fail" | "start";
  durationMs?: number;
  message?: string;
  errorCount?: number;
}

function emit(level: LogLevel, ctx: LeadLogContext): void {
  // Structured JSON log line — never include secrets like DATABASE_URL
  const entry = {
    level,
    ts: new Date().toISOString(),
    ...ctx,
  };
  const line = JSON.stringify(entry);
  if (level === "error" || level === "warn") {
    // eslint-disable-next-line no-console
    console.error(line);
  } else {
    // eslint-disable-next-line no-console
    console.log(line);
  }
}

export const logger = {
  info: (ctx: LeadLogContext) => emit("info", ctx),
  warn: (ctx: LeadLogContext) => emit("warn", ctx),
  error: (ctx: LeadLogContext) => emit("error", ctx),
};
