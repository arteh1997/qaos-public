/**
 * Structured JSON logger for production observability.
 *
 * Outputs one JSON object per log line so Vercel Log Drains, Datadog,
 * and other log aggregators can parse, filter, and alert on fields.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

function normalizeContext(context: unknown): Record<string, unknown> {
  if (!context) return {}
  if (context instanceof Error) {
    return { error: { message: context.message, name: context.name } }
  }
  if (typeof context === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(context as Record<string, unknown>)) {
      result[key] = value instanceof Error ? { message: value.message, name: value.name } : value
    }
    return result
  }
  return { value: context }
}

function emit(level: LogLevel, message: string, context?: unknown) {
  const entry: Record<string, unknown> = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...normalizeContext(context),
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
  error(message: string, context?: unknown) {
    emit('error', message, context)
  },
  warn(message: string, context?: unknown) {
    emit('warn', message, context)
  },
  info(message: string, context?: unknown) {
    emit('info', message, context)
  },
  debug(message: string, context?: unknown) {
    emit('debug', message, context)
  },
}
