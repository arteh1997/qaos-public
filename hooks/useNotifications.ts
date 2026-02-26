'use client'

import { useMemo } from 'react'
import { useLowStockReport, useMissingCounts } from './useReports'
import { useAuth } from './useAuth'

export interface Notification {
  id: string
  type: 'critical' | 'warning' | 'info'
  title: string
  description: string
  href: string
  timestamp: Date
}

export function useNotifications() {
  const { storeId } = useAuth()
  const { data: lowStock } = useLowStockReport(storeId)
  const { data: missingStores } = useMissingCounts(storeId)

  const notifications = useMemo(() => {
    const items: Notification[] = []
    const now = new Date()

    const outOfStock = (lowStock ?? []).filter(i => i.current_quantity === 0)
    const runningLow = (lowStock ?? []).filter(i => i.current_quantity > 0)

    if (outOfStock.length > 0) {
      items.push({
        id: 'out-of-stock',
        type: 'critical',
        title: `${outOfStock.length} item${outOfStock.length !== 1 ? 's' : ''} out of stock`,
        description: outOfStock.slice(0, 3).map(i => i.item_name).join(', ') +
          (outOfStock.length > 3 ? ` +${outOfStock.length - 3} more` : ''),
        href: '/low-stock',
        timestamp: now,
      })
    }

    if (runningLow.length > 0) {
      items.push({
        id: 'running-low',
        type: 'warning',
        title: `${runningLow.length} item${runningLow.length !== 1 ? 's' : ''} running low`,
        description: 'Below PAR level but still available',
        href: '/low-stock',
        timestamp: now,
      })
    }

    if ((missingStores ?? []).length > 0) {
      items.push({
        id: 'missing-count',
        type: 'warning',
        title: "Today's stock count pending",
        description: 'Complete the daily stock count to keep records accurate',
        href: '/stock-count',
        timestamp: now,
      })
    }

    return items
  }, [lowStock, missingStores, storeId])

  const criticalCount = notifications.filter(n => n.type === 'critical').length
  const totalCount = notifications.length

  return { notifications, criticalCount, totalCount }
}
