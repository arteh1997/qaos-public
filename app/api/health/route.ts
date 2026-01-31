import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const startTime = Date.now()
  const results: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    checks: {},
  }

  // Check 1: Supabase Auth
  try {
    const authStart = Date.now()
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    const authDuration = Date.now() - authStart

    results.checks = {
      ...results.checks as object,
      auth: {
        status: error ? 'error' : 'ok',
        duration_ms: authDuration,
        authenticated: !!user,
        error: error?.message || null,
      },
    }
  } catch (error) {
    results.checks = {
      ...results.checks as object,
      auth: {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    }
  }

  // Check 2: Database Query (simple count)
  try {
    const dbStart = Date.now()
    const supabase = await createClient()
    const { count, error } = await supabase
      .from('stores')
      .select('*', { count: 'exact', head: true })
    const dbDuration = Date.now() - dbStart

    results.checks = {
      ...results.checks as object,
      database: {
        status: error ? 'error' : 'ok',
        duration_ms: dbDuration,
        stores_count: count,
        error: error?.message || null,
      },
    }
  } catch (error) {
    results.checks = {
      ...results.checks as object,
      database: {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    }
  }

  // Check 3: Database Write Test (to a test table or just check insert capability)
  try {
    const writeStart = Date.now()
    const supabase = await createClient()

    // Try to read from profiles to test authenticated query
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .limit(1)
    const writeDuration = Date.now() - writeStart

    results.checks = {
      ...results.checks as object,
      authenticated_query: {
        status: error ? 'error' : 'ok',
        duration_ms: writeDuration,
        has_data: !!data && data.length > 0,
        error: error?.message || null,
      },
    }
  } catch (error) {
    results.checks = {
      ...results.checks as object,
      authenticated_query: {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    }
  }

  const totalDuration = Date.now() - startTime
  results.total_duration_ms = totalDuration

  // Determine overall status
  const checks = results.checks as Record<string, { status: string }>
  const allOk = Object.values(checks).every(check => check.status === 'ok')
  results.status = allOk ? 'healthy' : 'unhealthy'

  return NextResponse.json(results, {
    status: allOk ? 200 : 503,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  })
}
