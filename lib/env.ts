/**
 * Environment Variable Validation
 *
 * Validates all required environment variables at build time using Zod.
 * Import this module in next.config.ts to fail fast if vars are missing.
 *
 * Server-side variables are validated lazily (on first access) to avoid
 * breaking client-side builds that don't have access to server secrets.
 * Client-side (NEXT_PUBLIC_*) variables are validated eagerly.
 */

import { z } from 'zod'

// --- Client-side env (available in browser) ---

const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url('NEXT_PUBLIC_SUPABASE_URL must be a valid URL'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, 'NEXT_PUBLIC_SUPABASE_ANON_KEY is required'),
})

function validateClientEnv() {
  // Skip validation during tests
  if (process.env.VITEST || process.env.NODE_ENV === 'test') {
    return {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'test-anon-key',
    }
  }

  const parsed = clientSchema.safeParse(process.env)
  if (!parsed.success) {
    const errors = parsed.error.issues.map(i => `  - ${i.path.join('.')}: ${i.message}`).join('\n')
    throw new Error(`Missing or invalid client environment variables:\n${errors}`)
  }
  return parsed.data
}

export const clientEnv = validateClientEnv()

// --- Server-side env (only available on server) ---

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required'),
  STRIPE_SECRET_KEY: z.string().startsWith('sk_', 'STRIPE_SECRET_KEY must start with sk_').optional().or(z.literal('')),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith('whsec_', 'STRIPE_WEBHOOK_SECRET must start with whsec_').optional().or(z.literal('')),
  RESEND_API_KEY: z.string().optional().or(z.literal('')),
  UPSTASH_REDIS_REST_URL: z.string().url('UPSTASH_REDIS_REST_URL must be a valid URL').optional().or(z.literal('')),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional().or(z.literal('')),
  CRON_SECRET: z.string().min(16, 'CRON_SECRET must be at least 16 characters').optional().or(z.literal('')),
  SENTRY_DSN: z.string().url('SENTRY_DSN must be a valid URL').optional().or(z.literal('')),
})

let _serverEnv: z.infer<typeof serverSchema> | null = null

export function getServerEnv() {
  if (_serverEnv) return _serverEnv

  // Skip validation during tests
  if (process.env.VITEST || process.env.NODE_ENV === 'test') {
    _serverEnv = {
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key',
      STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || '',
      STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || '',
      RESEND_API_KEY: process.env.RESEND_API_KEY || '',
      UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL || '',
      UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN || '',
      CRON_SECRET: process.env.CRON_SECRET || '',
      SENTRY_DSN: process.env.SENTRY_DSN || '',
    }
    return _serverEnv
  }

  // Skip server validation on client-side bundles
  if (typeof window !== 'undefined') {
    return {} as z.infer<typeof serverSchema>
  }

  const parsed = serverSchema.safeParse(process.env)
  if (!parsed.success) {
    const errors = parsed.error.issues.map(i => `  - ${i.path.join('.')}: ${i.message}`).join('\n')
    throw new Error(`Missing or invalid server environment variables:\n${errors}`)
  }
  _serverEnv = parsed.data
  return _serverEnv
}
