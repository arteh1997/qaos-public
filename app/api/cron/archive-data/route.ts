import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiSuccess, apiError, apiUnauthorized } from '@/lib/api/response'
import { logger } from '@/lib/logger'

const BATCH_SIZE = 5000
const RETENTION_MONTHS = 12

/**
 * POST /api/cron/archive-data
 *
 * Weekly cron (Sundays 3 AM UTC) that moves records older than 12 months
 * from stock_history and audit_logs into their respective archive tables.
 * Processes in batches of 5000 to avoid timeouts.
 *
 * Authentication: Requires CRON_SECRET header.
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret) {
      logger.warn('[Cron/Archive] CRON_SECRET not configured')
      return apiError('Cron not configured', { status: 503 })
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      return apiUnauthorized()
    }

    // Archive tables are not in generated types — cast to any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adminClient = createAdminClient() as any
    const cutoffDate = new Date()
    cutoffDate.setMonth(cutoffDate.getMonth() - RETENTION_MONTHS)
    const cutoff = cutoffDate.toISOString()

    let stockHistoryArchived = 0
    let auditLogsArchived = 0

    // Archive stock_history in batches
    let hasMore = true
    while (hasMore) {
      const { data: rows, error: selectError } = await adminClient
        .from('stock_history')
        .select('id, store_id, inventory_item_id, action_type, quantity_before, quantity_after, quantity_change, performed_by, notes, created_at')
        .lt('created_at', cutoff)
        .limit(BATCH_SIZE)

      if (selectError || !rows || rows.length === 0) {
        hasMore = false
        break
      }

      const archiveRows = rows.map((row: Record<string, unknown>) => ({
        ...row,
        archived_at: new Date().toISOString(),
      }))

      const { error: insertError } = await adminClient
        .from('stock_history_archive')
        .insert(archiveRows)

      if (insertError) {
        logger.error('[Cron/Archive] Failed to insert stock_history_archive batch', { error: insertError })
        break
      }

      const ids = rows.map((row: Record<string, unknown>) => row.id)
      const { error: deleteError } = await adminClient
        .from('stock_history')
        .delete()
        .in('id', ids)

      if (deleteError) {
        logger.error('[Cron/Archive] Failed to delete archived stock_history batch', { error: deleteError })
        break
      }

      stockHistoryArchived += rows.length
      if (rows.length < BATCH_SIZE) hasMore = false
    }

    // Archive audit_logs in batches
    hasMore = true
    while (hasMore) {
      const { data: rows, error: selectError } = await adminClient
        .from('audit_logs')
        .select('id, user_id, store_id, action, details, ip_address, user_agent, created_at')
        .lt('created_at', cutoff)
        .limit(BATCH_SIZE)

      if (selectError || !rows || rows.length === 0) {
        hasMore = false
        break
      }

      const archiveRows = rows.map((row: Record<string, unknown>) => ({
        ...row,
        archived_at: new Date().toISOString(),
      }))

      const { error: insertError } = await adminClient
        .from('audit_logs_archive')
        .insert(archiveRows)

      if (insertError) {
        logger.error('[Cron/Archive] Failed to insert audit_logs_archive batch', { error: insertError })
        break
      }

      const ids = rows.map((row: Record<string, unknown>) => row.id)
      const { error: deleteError } = await adminClient
        .from('audit_logs')
        .delete()
        .in('id', ids)

      if (deleteError) {
        logger.error('[Cron/Archive] Failed to delete archived audit_logs batch', { error: deleteError })
        break
      }

      auditLogsArchived += rows.length
      if (rows.length < BATCH_SIZE) hasMore = false
    }

    logger.info('[Cron/Archive] Archival complete', {
      stockHistoryArchived,
      auditLogsArchived,
      cutoffDate: cutoff,
    })

    return apiSuccess({
      stock_history_archived: stockHistoryArchived,
      audit_logs_archived: auditLogsArchived,
      cutoff_date: cutoff,
    })
  } catch (error) {
    logger.error('[Cron/Archive] Unexpected error', { error })
    return apiError('Archive job failed', { status: 500 })
  }
}
