import crypto from 'crypto';

export interface LogContext {
  requestId?: string;
  userId?: string;
  branchId?: string;
  route?: string;
  method?: string;
  statusCode?: number;
  durationMs?: number;
  orderId?: string;
  [key: string]: any;
}

export function generateRequestId(request?: Request): string {
  const existing = request?.headers.get('x-request-id');
  if (existing) return existing;
  return `req-${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`;
}

function emitStructuredLog(level: 'info' | 'warn' | 'error', message: string, context: LogContext = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    service: 'foodiescafe-api',
    message,
    ...context,
  };
  const json = JSON.stringify(entry);
  if (level === 'error') {
    console.error(json);
  } else if (level === 'warn') {
    console.warn(json);
  } else {
    console.log(json);
  }
}

export const logger = {
  info: (message: string, context?: LogContext) => emitStructuredLog('info', message, context),
  warn: (message: string, context?: LogContext) => emitStructuredLog('warn', message, context),
  error: (message: string, context?: LogContext) => emitStructuredLog('error', message, context),
};

