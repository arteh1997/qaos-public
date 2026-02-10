import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email'
import { getLowStockAlertEmailHtml, getCriticalStockAlertEmailHtml, getMissingCountAlertEmailHtml } from '@/lib/email-alerts'
import type { AlertType } from '@/types'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

interface LowStockItemData {
  item_name: string
  category: string | null
  current_quantity: number
  par_level: number
  shortage: number
  unit_of_measure: string
}

interface AlertResult {
  store_id: string
  store_name: string
  user_id: string
  user_email: string
  alert_type: AlertType
  items_count: number
  success: boolean
  error?: string
}

/**
 * Process all pending alerts for stores.
 * Called by the cron endpoint to send scheduled alerts.
 */
export async function processScheduledAlerts(currentHourUtc: number): Promise<AlertResult[]> {
  const supabase = createAdminClient()
  const results: AlertResult[] = []

  // 1. Get all alert preferences for this hour
  const { data: preferences, error: prefError } = await supabase
    .from('alert_preferences')
    .select(`
      *,
      store:stores(id, name, is_active),
      user:profiles(id, email, full_name)
    `)
    .eq('preferred_hour', currentHourUtc)
    .eq('email_enabled', true)
    .neq('alert_frequency', 'never')

  if (prefError) {
    console.error('[Alerts] Failed to fetch preferences:', prefError)
    return results
  }

  if (!preferences || preferences.length === 0) {
    console.log('[Alerts] No preferences to process for hour:', currentHourUtc)
    return results
  }

  // 2. For weekly alerts, only process on Mondays
  const today = new Date()
  const isMonday = today.getUTCDay() === 1

  for (const pref of preferences) {
    // Skip inactive stores
    if (!pref.store?.is_active) continue

    // Skip weekly alerts on non-Monday
    if (pref.alert_frequency === 'weekly' && !isMonday) continue

    // Skip if no user email
    if (!pref.user?.email) continue

    try {
      // Check if we already sent an alert today for this combo
      const todayStr = today.toISOString().split('T')[0]
      const { data: existingAlert } = await supabase
        .from('alert_history')
        .select('id')
        .eq('store_id', pref.store_id)
        .eq('user_id', pref.user_id)
        .gte('sent_at', `${todayStr}T00:00:00Z`)
        .limit(1)

      if (existingAlert && existingAlert.length > 0) {
        continue // Already sent today
      }

      // Process each alert type
      if (pref.low_stock_enabled || pref.critical_stock_enabled) {
        const alertResult = await processStockAlerts(
          supabase,
          pref,
          pref.store,
          pref.user
        )
        results.push(...alertResult)
      }

      if (pref.missing_count_enabled) {
        const alertResult = await processMissingCountAlert(
          supabase,
          pref,
          pref.store,
          pref.user
        )
        if (alertResult) results.push(alertResult)
      }
    } catch (error) {
      console.error(`[Alerts] Error processing alerts for store ${pref.store_id}:`, error)
      results.push({
        store_id: pref.store_id,
        store_name: pref.store?.name ?? 'Unknown',
        user_id: pref.user_id,
        user_email: pref.user?.email ?? '',
        alert_type: 'digest',
        items_count: 0,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  return results
}

/**
 * Process low stock and critical stock alerts for a store
 */
async function processStockAlerts(
  supabase: ReturnType<typeof createAdminClient>,
  pref: { low_stock_enabled: boolean; critical_stock_enabled: boolean; low_stock_threshold: number; store_id: string; user_id: string },
  store: { id: string; name: string },
  user: { id: string; email: string; full_name: string | null }
): Promise<AlertResult[]> {
  const results: AlertResult[] = []

  // Fetch current inventory with par levels
  const { data: inventory, error } = await supabase
    .from('store_inventory')
    .select('quantity, par_level, inventory_item:inventory_items(name, category, unit_of_measure, is_active)')
    .eq('store_id', store.id)

  if (error || !inventory) return results

  const activeItems = inventory.filter(
    (i) => (i.inventory_item as { is_active: boolean } | null)?.is_active
  )

  // Critical stock items (quantity = 0)
  const criticalItems: LowStockItemData[] = activeItems
    .filter(i => i.quantity === 0 && i.par_level && i.par_level > 0)
    .map(i => {
      const item = i.inventory_item as { name: string; category: string | null; unit_of_measure: string }
      return {
        item_name: item.name,
        category: item.category,
        current_quantity: i.quantity,
        par_level: i.par_level!,
        shortage: i.par_level! - i.quantity,
        unit_of_measure: item.unit_of_measure,
      }
    })

  // Low stock items (below threshold * par_level, but not at 0)
  const lowStockItems: LowStockItemData[] = activeItems
    .filter(i => {
      if (!i.par_level || i.par_level === 0) return false
      if (i.quantity === 0) return false // handled by critical
      const threshold = i.par_level * pref.low_stock_threshold
      return i.quantity < threshold
    })
    .map(i => {
      const item = i.inventory_item as { name: string; category: string | null; unit_of_measure: string }
      return {
        item_name: item.name,
        category: item.category,
        current_quantity: i.quantity,
        par_level: i.par_level!,
        shortage: i.par_level! - i.quantity,
        unit_of_measure: item.unit_of_measure,
      }
    })
    .sort((a, b) => b.shortage - a.shortage)

  // Send critical stock alert
  if (pref.critical_stock_enabled && criticalItems.length > 0) {
    const html = getCriticalStockAlertEmailHtml({
      storeName: store.name,
      items: criticalItems,
      dashboardUrl: `${APP_URL}/stores/${store.id}`,
    })

    const emailResult = await sendEmail({
      to: user.email,
      subject: `CRITICAL: ${criticalItems.length} items out of stock at ${store.name}`,
      html,
    })

    await recordAlert(supabase, {
      store_id: store.id,
      user_id: user.id,
      alert_type: 'critical_stock',
      channel: 'email',
      subject: `CRITICAL: ${criticalItems.length} items out of stock at ${store.name}`,
      item_count: criticalItems.length,
      status: emailResult.success ? 'sent' : 'failed',
      error_message: emailResult.error ?? null,
      metadata: { items: criticalItems.map(i => i.item_name) },
    })

    results.push({
      store_id: store.id,
      store_name: store.name,
      user_id: user.id,
      user_email: user.email,
      alert_type: 'critical_stock',
      items_count: criticalItems.length,
      success: emailResult.success,
      error: emailResult.error,
    })
  }

  // Send low stock alert
  if (pref.low_stock_enabled && lowStockItems.length > 0) {
    const html = getLowStockAlertEmailHtml({
      storeName: store.name,
      items: lowStockItems,
      dashboardUrl: `${APP_URL}/stores/${store.id}`,
      lowStockReportUrl: `${APP_URL}/reports/low-stock`,
    })

    const emailResult = await sendEmail({
      to: user.email,
      subject: `Low Stock Alert: ${lowStockItems.length} items below par at ${store.name}`,
      html,
    })

    await recordAlert(supabase, {
      store_id: store.id,
      user_id: user.id,
      alert_type: 'low_stock',
      channel: 'email',
      subject: `Low Stock Alert: ${lowStockItems.length} items below par at ${store.name}`,
      item_count: lowStockItems.length,
      status: emailResult.success ? 'sent' : 'failed',
      error_message: emailResult.error ?? null,
      metadata: { items: lowStockItems.map(i => i.item_name) },
    })

    results.push({
      store_id: store.id,
      store_name: store.name,
      user_id: user.id,
      user_email: user.email,
      alert_type: 'low_stock',
      items_count: lowStockItems.length,
      success: emailResult.success,
      error: emailResult.error,
    })
  }

  return results
}

/**
 * Process missing daily count alert
 */
async function processMissingCountAlert(
  supabase: ReturnType<typeof createAdminClient>,
  pref: { store_id: string; user_id: string },
  store: { id: string; name: string },
  user: { id: string; email: string; full_name: string | null }
): Promise<AlertResult | null> {
  // Check if yesterday's count was submitted
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().split('T')[0]

  const { data: counts } = await supabase
    .from('daily_counts')
    .select('id')
    .eq('store_id', store.id)
    .eq('count_date', yesterdayStr)
    .limit(1)

  if (counts && counts.length > 0) return null // Count was submitted

  const html = getMissingCountAlertEmailHtml({
    storeName: store.name,
    date: yesterdayStr,
    dashboardUrl: `${APP_URL}/stores/${store.id}`,
  })

  const emailResult = await sendEmail({
    to: user.email,
    subject: `Missing Daily Count: ${store.name} - ${yesterdayStr}`,
    html,
  })

  await recordAlert(supabase, {
    store_id: store.id,
    user_id: user.id,
    alert_type: 'missing_count',
    channel: 'email',
    subject: `Missing Daily Count: ${store.name} - ${yesterdayStr}`,
    item_count: 0,
    status: emailResult.success ? 'sent' : 'failed',
    error_message: emailResult.error ?? null,
    metadata: { date: yesterdayStr },
  })

  return {
    store_id: store.id,
    store_name: store.name,
    user_id: user.id,
    user_email: user.email,
    alert_type: 'missing_count',
    items_count: 0,
    success: emailResult.success,
    error: emailResult.error,
  }
}

/**
 * Record an alert in the alert_history table
 */
async function recordAlert(
  supabase: ReturnType<typeof createAdminClient>,
  alert: {
    store_id: string
    user_id: string
    alert_type: AlertType
    channel: string
    subject: string
    item_count: number
    status: string
    error_message: string | null
    metadata: Record<string, unknown>
  }
): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await supabase.from('alert_history').insert(alert as any)
  } catch (err) {
    console.error('[Alerts] Failed to record alert:', err)
  }
}
