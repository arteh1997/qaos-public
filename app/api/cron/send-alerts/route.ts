import { NextRequest } from 'next/server'
import { processScheduledAlerts } from '@/lib/services/alertService'
import { apiSuccess, apiError, apiUnauthorized } from '@/lib/api/response'
import { logger } from '@/lib/logger'

/**
 * POST /api/cron/send-alerts
 *
 * Scheduled endpoint for processing and sending inventory alerts.
 * Should be called by a cron job (e.g., Vercel Cron) every hour.
 *
 * Authentication: Requires CRON_SECRET header to prevent unauthorized access.
 */
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret) {
      logger.warn('[Cron/Alerts] CRON_SECRET not configured')
      return apiError('Cron not configured', { status: 503 })
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      return apiUnauthorized()
    }

    const currentHourUtc = new Date().getUTCHours()

    console.log(`[Cron/Alerts] Processing alerts for hour ${currentHourUtc} UTC`)

    const results = await processScheduledAlerts(currentHourUtc)

    const sent = results.filter(r => r.success).length
    const failed = results.filter(r => !r.success).length

    console.log(`[Cron/Alerts] Complete: ${sent} sent, ${failed} failed`)

    return apiSuccess({
      processed: results.length,
      sent,
      failed,
      results: results.map(r => ({
        store: r.store_name,
        type: r.alert_type,
        success: r.success,
        error: r.error,
      })),
    })
  } catch (error) {
    logger.error('[Cron/Alerts] Error:', { error: error })
    return apiError(error instanceof Error ? error.message : 'Failed to process alerts')
  }
}
