'use client'

import { Suspense, useState, useMemo } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useForecast, type ForecastData } from '@/hooks/useForecast'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import dynamic from 'next/dynamic'

const ForecastChart = dynamic(
  () => import('@/components/charts/ForecastChart').then(mod => ({ default: mod.ForecastChart })),
  { loading: () => <Skeleton className="h-64 w-full" /> }
)
const StockProjectionChart = dynamic(
  () => import('@/components/charts/ForecastChart').then(mod => ({ default: mod.StockProjectionChart })),
  { loading: () => <Skeleton className="h-64 w-full" /> }
)
const WeekdayPatternChart = dynamic(
  () => import('@/components/charts/ForecastChart').then(mod => ({ default: mod.WeekdayPatternChart })),
  { loading: () => <Skeleton className="h-64 w-full" /> }
)
import {
  Brain,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  ShoppingCart,
  ArrowLeft,
  Clock,
  Package,
  Sparkles,
} from 'lucide-react'
import Link from 'next/link'
import type { ForecastResult } from '@/lib/forecasting/engine'
import { PageGuide } from '@/components/help/PageGuide'

/* ─── Design system risk badge classes ─── */

const RISK_BADGE: Record<string, string> = {
  critical: 'bg-destructive/10 text-destructive',
  high: 'bg-amber-50 text-amber-700',
  medium: 'bg-muted text-muted-foreground',
  low: 'bg-emerald-50 text-emerald-700',
}

/* ─── Helpers ─── */

function TrendIcon({ direction }: { direction: string }) {
  if (direction === 'increasing') return <TrendingUp className="size-4 text-amber-500" />
  if (direction === 'decreasing') return <TrendingDown className="size-4 text-emerald-600" />
  return <Minus className="size-4 text-muted-foreground" />
}

function formatCurrency(value: number): string {
  if (value === 0) return '£0.00'
  return `£${value.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/* ─── Executive Summary — the morning briefing ─── */

function ExecutiveSummary({ data, days }: { data: ForecastData; days: number }) {
  const orderValue = data.forecasts.reduce(
    (sum, f) => sum + f.suggestedOrderQuantity * f.unitCost,
    0
  )
  const urgentOrderValue = data.forecasts
    .filter(f => f.riskLevel === 'critical' || f.riskLevel === 'high')
    .reduce((sum, f) => sum + f.suggestedOrderQuantity * f.unitCost, 0)

  const urgent = data.summary.critical + data.summary.high

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start gap-4">
          <div className="rounded-lg p-2.5 bg-emerald-50 shrink-0">
            <Brain className="size-5 text-emerald-700" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-foreground leading-relaxed">
              Analysing <span className="font-semibold">{data.summary.total} items</span> across{' '}
              <span className="font-semibold">{days} days</span> of history.
              {urgent > 0 ? (
                <>
                  {' '}
                  {data.summary.critical > 0 && (
                    <>
                      <span className="font-semibold text-destructive">
                        {data.summary.critical}
                      </span>{' '}
                      {data.summary.critical === 1 ? 'item needs' : 'items need'} orders placed
                      today
                    </>
                  )}
                  {data.summary.critical > 0 && data.summary.high > 0 && ', and '}
                  {data.summary.high > 0 && (
                    <>
                      <span className="font-semibold text-amber-600">
                        {data.summary.high} more
                      </span>{' '}
                      should be ordered this week
                    </>
                  )}
                  .
                </>
              ) : (
                <> All items are well-stocked. No urgent orders needed.</>
              )}
            </p>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-4">
              {data.summary.critical > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-destructive" />
                  <span className="text-xs font-medium text-destructive">
                    {data.summary.critical} critical
                  </span>
                </div>
              )}
              {data.summary.high > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-amber-500" />
                  <span className="text-xs font-medium text-amber-600">
                    {data.summary.high} high
                  </span>
                </div>
              )}
              {data.summary.medium > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-muted-foreground/40" />
                  <span className="text-xs text-muted-foreground">
                    {data.summary.medium} medium
                  </span>
                </div>
              )}
              {data.summary.low > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-emerald-500" />
                  <span className="text-xs text-muted-foreground">
                    {data.summary.low} on track
                  </span>
                </div>
              )}
            </div>

            {orderValue > 0 && (
              <div className="flex items-center gap-6 mt-4 pt-4 border-t border-border">
                <div>
                  <p className="text-xs text-muted-foreground">Estimated reorder cost</p>
                  <p className="text-lg font-semibold">{formatCurrency(orderValue)}</p>
                </div>
                {urgentOrderValue > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground">Urgent (order today)</p>
                    <p className="text-lg font-semibold text-destructive">
                      {formatCurrency(urgentOrderValue)}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

/* ─── Urgent Orders — critical + high risk items ─── */

function UrgentOrders({
  items,
  onSelect,
}: {
  items: ForecastResult[]
  onSelect: (id: string) => void
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <AlertTriangle className="size-4 text-destructive" />
        <h2 className="text-base font-semibold">Action Required</h2>
        <Badge variant="secondary" className="bg-destructive/10 text-destructive">
          {items.length}
        </Badge>
      </div>

      <div className="space-y-2">
        {items.map(item => (
          <Card
            key={item.itemId}
            className="border-destructive/20 cursor-pointer transition-colors hover:border-destructive/40"
            onClick={() => onSelect(item.itemId)}
          >
            <CardContent className="py-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold truncate">{item.itemName}</h3>
                    <Badge variant="secondary" className={RISK_BADGE[item.riskLevel]}>
                      {item.riskLevel}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Package className="size-3.5" />
                      {item.currentQuantity} {item.unitOfMeasure} left
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Clock className="size-3.5" />
                      {item.daysUntilStockout === 0
                        ? 'Out of stock'
                        : item.daysUntilStockout !== null
                          ? `Runs out in ${item.daysUntilStockout} ${item.daysUntilStockout === 1 ? 'day' : 'days'}`
                          : 'N/A'}
                    </span>
                  </div>
                </div>

                {item.suggestedOrderQuantity > 0 && (
                  <div className="text-right shrink-0">
                    <p className="text-sm font-medium">
                      Order {item.suggestedOrderQuantity} {item.unitOfMeasure}
                    </p>
                    {item.unitCost > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Est. {formatCurrency(item.suggestedOrderQuantity * item.unitCost)}
                      </p>
                    )}
                    {item.suggestedOrderDate && (
                      <p className="text-xs text-destructive font-medium mt-0.5">
                        {new Date(item.suggestedOrderDate + 'T12:00:00').toDateString() ===
                        new Date().toDateString()
                          ? 'Order today'
                          : `By ${new Date(item.suggestedOrderDate + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}`}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

/* ─── Item Card — monitoring list (medium + low) ─── */

function ForecastItemCard({
  item,
  onSelect,
}: {
  item: ForecastResult
  onSelect: (id: string) => void
}) {
  return (
    <Card
      className="cursor-pointer transition-colors hover:border-primary/30"
      onClick={() => onSelect(item.itemId)}
    >
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-medium truncate">{item.itemName}</h3>
              <Badge variant="secondary" className={RISK_BADGE[item.riskLevel]}>
                {item.riskLevel}
              </Badge>
            </div>
            {item.category && (
              <p className="text-xs text-muted-foreground mt-0.5">{item.category}</p>
            )}
          </div>
          <div className="text-right shrink-0 ml-3">
            <p className="text-lg font-semibold">
              {item.currentQuantity}
              <span className="text-xs font-normal text-muted-foreground ml-1">
                {item.unitOfMeasure}
              </span>
            </p>
            {item.parLevel && (
              <p className="text-xs text-muted-foreground">PAR: {item.parLevel}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mt-3 pt-3 border-t border-border">
          <div>
            <p className="text-xs text-muted-foreground">Avg Daily</p>
            <p className="text-sm font-medium">{item.avgDailyConsumption}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Trend</p>
            <div className="flex items-center gap-1">
              <TrendIcon direction={item.consumptionTrend} />
              <p className="text-sm font-medium">
                {item.trendPercentage > 0 ? '+' : ''}
                {item.trendPercentage}%
              </p>
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Stockout</p>
            <p
              className={`text-sm font-medium ${
                item.daysUntilStockout !== null && item.daysUntilStockout <= 5
                  ? 'text-destructive'
                  : ''
              }`}
            >
              {item.daysUntilStockout !== null
                ? item.daysUntilStockout === 0
                  ? 'Now!'
                  : `${item.daysUntilStockout}d`
                : '—'}
            </p>
          </div>
        </div>

        {item.suggestedOrderQuantity > 0 && (
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-border text-sm">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <ShoppingCart className="size-3.5" />
              <span>
                Order{' '}
                <span className="font-medium text-foreground">
                  {item.suggestedOrderQuantity} {item.unitOfMeasure}
                </span>
              </span>
            </div>
            {item.unitCost > 0 && (
              <span className="text-xs text-muted-foreground">
                {formatCurrency(item.suggestedOrderQuantity * item.unitCost)}
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/* ─── Item Detail View — deep dive into a single item ─── */

function ItemDetailView({
  item,
  onBack,
}: {
  item: ForecastResult
  onBack: () => void
}) {
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

  const maxDayIdx = item.weekdayPattern.reduce(
    (iMax, x, i, arr) => (x > arr[iMax] ? i : iMax),
    0
  )
  const minDayIdx = item.weekdayPattern.reduce(
    (iMin, x, i, arr) => (x < arr[iMin] && x > 0 ? i : iMin),
    0
  )
  const avgPattern = item.weekdayPattern.reduce((a, b) => a + b, 0) / 7
  const maxRatio = avgPattern > 0 ? (item.weekdayPattern[maxDayIdx] / avgPattern).toFixed(1) : '0'
  const minRatio = avgPattern > 0 ? (item.weekdayPattern[minDayIdx] / avgPattern).toFixed(1) : '0'

  const orderCost = item.suggestedOrderQuantity * item.unitCost
  const parPercent = item.parLevel
    ? Math.round((item.currentQuantity / item.parLevel) * 100)
    : null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="size-3.5 mr-1.5" />
            All items
          </Button>
          <h2 className="text-lg font-semibold">{item.itemName}</h2>
          <Badge variant="secondary" className={RISK_BADGE[item.riskLevel]}>
            {item.riskLevel} risk
          </Badge>
        </div>
      </div>

      {/* Key Insights */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 mb-5">
            <Sparkles className="size-4 text-emerald-600" />
            <h3 className="text-base font-semibold">Key Insights</h3>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Current Stock</p>
              <p className="text-xl font-bold">
                {item.currentQuantity}{' '}
                <span className="text-sm font-normal text-muted-foreground">
                  {item.unitOfMeasure}
                </span>
              </p>
              {parPercent !== null && (
                <p
                  className={`text-xs font-medium ${
                    parPercent < 50
                      ? 'text-destructive'
                      : parPercent < 100
                        ? 'text-amber-600'
                        : 'text-emerald-600'
                  }`}
                >
                  {parPercent}% of PAR level
                </p>
              )}
            </div>

            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Runs Out In</p>
              <p
                className={`text-xl font-bold ${
                  item.daysUntilStockout !== null && item.daysUntilStockout <= 5
                    ? 'text-destructive'
                    : ''
                }`}
              >
                {item.daysUntilStockout === 0
                  ? 'Now'
                  : item.daysUntilStockout !== null
                    ? `${item.daysUntilStockout} days`
                    : '—'}
              </p>
              <p className="text-xs text-muted-foreground">at current rate</p>
            </div>

            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Consumption Trend</p>
              <div className="flex items-center gap-1.5">
                <TrendIcon direction={item.consumptionTrend} />
                <p className="text-xl font-bold">
                  {item.trendPercentage > 0 ? '+' : ''}
                  {item.trendPercentage}%
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                {item.consumptionTrend === 'increasing'
                  ? 'Demand is rising'
                  : item.consumptionTrend === 'decreasing'
                    ? 'Demand is falling'
                    : 'Demand is steady'}
              </p>
            </div>

            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Suggested Order</p>
              {item.suggestedOrderQuantity > 0 ? (
                <>
                  <p className="text-xl font-bold">
                    {item.suggestedOrderQuantity}{' '}
                    <span className="text-sm font-normal text-muted-foreground">
                      {item.unitOfMeasure}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {orderCost > 0 && <>{formatCurrency(orderCost)} · </>}
                    {item.suggestedOrderDate &&
                      `by ${new Date(item.suggestedOrderDate + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}`}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-xl font-bold text-emerald-600">None</p>
                  <p className="text-xs text-muted-foreground">Stock levels healthy</p>
                </>
              )}
            </div>
          </div>

          {avgPattern > 0 && (
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1 mt-5 pt-5 border-t border-border text-sm text-muted-foreground">
              <span>
                Peak demand:{' '}
                <span className="font-medium text-foreground">{dayNames[maxDayIdx]}</span>
                <span className="text-xs ml-1">({maxRatio}× avg)</span>
              </span>
              <span>
                Lowest demand:{' '}
                <span className="font-medium text-foreground">{dayNames[minDayIdx]}</span>
                <span className="text-xs ml-1">({minRatio}× avg)</span>
              </span>
              <span>
                Based on{' '}
                <span className="font-medium text-foreground">
                  {item.daysWithData} active days
                </span>{' '}
                of data
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ForecastChart
          itemName={item.itemName}
          forecast={item.forecast}
          currentQuantity={item.currentQuantity}
          parLevel={item.parLevel}
          unitOfMeasure={item.unitOfMeasure}
        />
        <StockProjectionChart
          itemName={item.itemName}
          forecast={item.forecast}
          currentQuantity={item.currentQuantity}
          parLevel={item.parLevel}
          unitOfMeasure={item.unitOfMeasure}
        />
      </div>

      <WeekdayPatternChart
        itemName={item.itemName}
        weekdayPattern={item.weekdayPattern}
        unitOfMeasure={item.unitOfMeasure}
      />
    </div>
  )
}

/* ─── Loading Skeleton ─── */

function ForecastSkeleton() {
  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <Skeleton className="size-10 rounded-lg shrink-0" />
            <div className="flex-1 space-y-3">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <div className="flex gap-4 pt-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-4 pb-4">
              <div className="flex justify-between">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-8 w-16" />
              </div>
              <div className="grid grid-cols-3 gap-3 mt-3 pt-3 border-t">
                <Skeleton className="h-8" />
                <Skeleton className="h-8" />
                <Skeleton className="h-8" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

/* ─── Main Page ─── */

export default function ForecastPage() {
  const { currentStore, role } = useAuth()
  const [days, setDays] = useState('30')
  const [forecastDays, setForecastDays] = useState('14')
  const [riskFilter, setRiskFilter] = useState('all')
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)

  const storeId = currentStore?.store_id ?? null

  const { data, isLoading, error } = useForecast({
    storeId,
    days: parseInt(days),
    forecastDays: parseInt(forecastDays),
    riskFilter: riskFilter !== 'all' ? riskFilter : undefined,
  })

  const selectedItem = useMemo(() => {
    if (!selectedItemId || !data) return null
    return data.forecasts.find(f => f.itemId === selectedItemId) ?? null
  }, [selectedItemId, data])

  const { urgentItems, monitoringItems } = useMemo(() => {
    if (!data) return { urgentItems: [], monitoringItems: [] }
    return {
      urgentItems: data.forecasts.filter(
        f => f.riskLevel === 'critical' || f.riskLevel === 'high'
      ),
      monitoringItems: data.forecasts.filter(
        f => f.riskLevel !== 'critical' && f.riskLevel !== 'high'
      ),
    }
  }, [data])

  if (role !== 'Owner' && role !== 'Manager') {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">AI Demand Forecast</h1>
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            This feature is only available to Owners and Managers.
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/reports">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">AI Demand Forecast</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Predictive analytics for {currentStore?.store?.name ?? 'your store'}
          </p>
        </div>
        <PageGuide pageKey="ai-forecast" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger className="w-[130px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">7 day history</SelectItem>
            <SelectItem value="14">14 day history</SelectItem>
            <SelectItem value="30">30 day history</SelectItem>
            <SelectItem value="60">60 day history</SelectItem>
            <SelectItem value="90">90 day history</SelectItem>
          </SelectContent>
        </Select>

        <Select value={forecastDays} onValueChange={setForecastDays}>
          <SelectTrigger className="w-[140px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">7 day forecast</SelectItem>
            <SelectItem value="14">14 day forecast</SelectItem>
            <SelectItem value="21">21 day forecast</SelectItem>
            <SelectItem value="30">30 day forecast</SelectItem>
          </SelectContent>
        </Select>

        <Select value={riskFilter} onValueChange={setRiskFilter}>
          <SelectTrigger className="w-[120px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Risks</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Loading */}
      {isLoading && <ForecastSkeleton />}

      {/* Error */}
      {error && (
        <Card>
          <CardContent className="pt-6 text-center text-destructive">
            Failed to load forecast data. Please try again.
          </CardContent>
        </Card>
      )}

      {/* Main content — list view */}
      {data && !selectedItem && (
        <>
          <ExecutiveSummary data={data} days={parseInt(days)} />

          {urgentItems.length > 0 && (
            <UrgentOrders items={urgentItems} onSelect={setSelectedItemId} />
          )}

          {monitoringItems.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-base font-semibold">
                {urgentItems.length > 0
                  ? 'Monitoring'
                  : riskFilter !== 'all'
                    ? `${riskFilter.charAt(0).toUpperCase() + riskFilter.slice(1)} Risk Items`
                    : 'All Items'}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {monitoringItems.map(item => (
                  <ForecastItemCard
                    key={item.itemId}
                    item={item}
                    onSelect={setSelectedItemId}
                  />
                ))}
              </div>
            </div>
          )}

          {data.forecasts.length === 0 && (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                No items found. Add inventory items and record stock activity to see demand
                forecasts.
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Detail view — single item deep dive */}
      {data && selectedItem && (
        <ItemDetailView item={selectedItem} onBack={() => setSelectedItemId(null)} />
      )}
    </div>
  )
}
