/**
 * Structured JSON logger for production observability.
 *
 * Outputs one JSON object per log line so Vercel Log Drains, Datadog,
 * and other log aggregators can parse, filter, and alert on fields.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogContext {
  requestId?: string
  storeId?: string
  userId?: string
  [key: string]: unknown
}

function emit(level: LogLevel, message: string, context?: LogContext) {
  const entry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...context,
  }

  switch (level) {
    case 'error':
      console.error(JSON.stringify(entry))
      break
    case 'warn':
      console.warn(JSON.stringify(entry))
      break
    case 'debug':
      if (process.env.NODE_ENV !== 'production') {
        console.debug(JSON.stringify(entry))
      }
      break
    default:
      console.log(JSON.stringify(entry))
  }
}

export const logger = {
  error(message: string, context?: LogContext) {
    emit('error', message, context)
  },
  warn(message: string, context?: LogContext) {
    emit('warn', message, context)
  },
  info(message: string, context?: LogContext) {
    emit('info', message, context)
  },
  debug(message: string, context?: LogContext) {
    emit('debug', message, context)
  },
}
