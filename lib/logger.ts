/**
 * Structured JSON logger for production observability.
 *
 * Outputs one JSON object per log line so Vercel Log Drains, Datadog,
 * and other log aggregators can parse, filter, and alert on fields.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LogContext = Record<string, any>

function emit(level: LogLevel, message: string, context?: LogContext) {
  const entry: Record<string, unknown> = {
    level,
    message,
    timestamp: new Date().toISOString(),
  }
  if (context) {
    for (const [key, value] of Object.entries(context)) {
      entry[key] = value instanceof Error ? { message: value.message, name: value.name } : value
    }
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
