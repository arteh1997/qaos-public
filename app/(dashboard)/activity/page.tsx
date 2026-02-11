'use client'

import { useState, useMemo } from 'react'
import { useAuth } from '@/hooks/useAuth'
import {
  useAuditLogs,
  ACTION_LABELS,
  CATEGORY_LABELS,
  CATEGORY_COLORS,
  AuditLogFilters,
} from '@/hooks/useAuditLogs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  Filter,
  Clock,
  User,
  Printer,
} from 'lucide-react'
import { format, subDays } from 'date-fns'

const CATEGORIES = [
  'all',
  'auth',
  'user',
  'store',
  'stock',
  'inventory',
  'shift',
  'settings',
  'report',
  'supplier',
] as const

const PAGE_SIZE = 50

export default function ActivityPage() {
  const { storeId, currentStore, role } = useAuth()

  const [category, setCategory] = useState<string>('all')
  const [dateRange, setDateRange] = useState<string>('7')
  const [page, setPage] = useState(0)

  const filters = useMemo<AuditLogFilters>(() => ({
    storeId: storeId || undefined,
    category: category !== 'all' ? category : undefined,
    startDate: subDays(new Date(), parseInt(dateRange)).toISOString(),
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  }), [storeId, category, dateRange, page])

  const { data, isLoading } = useAuditLogs(filters)

  if (role !== 'Owner' && role !== 'Manager') {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Activity className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <h2 className="text-lg font-semibold mb-2">Access Restricted</h2>
          <p className="text-sm text-muted-foreground">Only Owners and Managers can view the activity log.</p>
        </CardContent>
      </Card>
    )
  }

  if (!storeId) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Activity className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <h2 className="text-lg font-semibold mb-2">No Store Selected</h2>
          <p className="text-sm text-muted-foreground">Select a store from the sidebar to view activity.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="h-6 w-6" />
            Activity Log
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {currentStore?.store?.name} &middot; Everything that happened in your store
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.print()}
          className="print:hidden"
        >
          <Printer className="h-4 w-4 mr-2" />
          Print
        </Button>
      </div>

      {/* Filters */}
      <Card className="print:hidden">
        <CardContent className="py-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filters</span>
            </div>
            <Select value={category} onValueChange={v => { setCategory(v); setPage(0) }}>
              <SelectTrigger className="w-44 h-8 text-xs">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {CATEGORIES.filter(c => c !== 'all').map(c => (
                  <SelectItem key={c} value={c}>
                    {CATEGORY_LABELS[c] || c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={dateRange} onValueChange={v => { setDateRange(v); setPage(0) }}>
              <SelectTrigger className="w-36 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Last 24 hours</SelectItem>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
            {data?.pagination && (
              <span className="text-xs text-muted-foreground ml-auto">
                {data.pagination.total} event{data.pagination.total !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Activity timeline */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-16" />)}
        </div>
      ) : !data?.logs || data.logs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Activity className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h2 className="text-lg font-semibold mb-2">No Activity Found</h2>
            <p className="text-sm text-muted-foreground">
              No events match your filters. Try expanding the date range or removing category filters.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-4">
            <div className="space-y-0">
              {data.logs.map((log, idx) => {
                const actionLabel = ACTION_LABELS[log.action] || log.action
                const categoryColor = CATEGORY_COLORS[log.action_category] || 'bg-gray-100 text-gray-800'
                const userName = log.user_email || 'System'
                const isLastItem = idx === data.logs.length - 1

                // Show date separator
                const prevLog = idx > 0 ? data.logs[idx - 1] : null
                const currentDate = format(new Date(log.created_at), 'EEEE, MMM d')
                const prevDate = prevLog ? format(new Date(prevLog.created_at), 'EEEE, MMM d') : null
                const showDateSeparator = currentDate !== prevDate

                return (
                  <div key={log.id}>
                    {showDateSeparator && (
                      <div className="flex items-center gap-3 py-3">
                        <div className="h-px flex-1 bg-border" />
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          {currentDate}
                        </span>
                        <div className="h-px flex-1 bg-border" />
                      </div>
                    )}
                    <div className={`flex items-start gap-3 py-3 ${!isLastItem ? 'border-b border-border/50' : ''}`}>
                      {/* Timeline dot */}
                      <div className="mt-1.5 shrink-0">
                        <div className="h-2 w-2 rounded-full bg-primary/60" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm">
                              <span className="font-medium">{userName}</span>
                              {' '}
                              <span className="text-muted-foreground">{actionLabel.toLowerCase()}</span>
                            </p>
                            {log.details && Object.keys(log.details).length > 0 && (
                              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                                {formatDetails(log.details)}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge className={`text-[10px] px-1.5 py-0 ${categoryColor}`}>
                              {CATEGORY_LABELS[log.action_category] || log.action_category}
                            </Badge>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {format(new Date(log.created_at), 'h:mm a')}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Pagination */}
            {data.pagination && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t print:hidden">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>
                <span className="text-xs text-muted-foreground">
                  Page {page + 1} of {Math.max(1, Math.ceil(data.pagination.total / PAGE_SIZE))}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => p + 1)}
                  disabled={!data.pagination.hasMore}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function formatDetails(details: Record<string, unknown>): string {
  const parts: string[] = []
  if (details.email) parts.push(`Email: ${details.email}`)
  if (details.role) parts.push(`Role: ${details.role}`)
  if (details.itemName) parts.push(`Item: ${details.itemName}`)
  if (details.item_name) parts.push(`Item: ${details.item_name}`)
  if (details.quantity) parts.push(`Qty: ${details.quantity}`)
  if (details.reason) parts.push(`Reason: ${details.reason}`)
  if (details.storeName) parts.push(`Store: ${details.storeName}`)
  if (details.store_name) parts.push(`Store: ${details.store_name}`)
  if (parts.length === 0) {
    // Generic: show first 2 key-value pairs
    const entries = Object.entries(details).slice(0, 2)
    for (const [key, value] of entries) {
      if (value !== null && value !== undefined && typeof value !== 'object') {
        parts.push(`${key.replace(/_/g, ' ')}: ${value}`)
      }
    }
  }
  return parts.join(' · ')
}
