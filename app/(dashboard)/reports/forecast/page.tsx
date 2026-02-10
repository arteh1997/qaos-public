'use client'

import { useState, useMemo } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useForecast } from '@/hooks/useForecast'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import {
  ForecastChart,
  StockProjectionChart,
  WeekdayPatternChart,
} from '@/components/charts/ForecastChart'
import {
  Brain,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  ShoppingCart,
  Calendar,
  Package,
  ArrowLeft,
} from 'lucide-react'
import Link from 'next/link'
import type { ForecastResult } from '@/lib/forecasting/engine'

const RISK_COLORS = {
  critical: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  high: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  low: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
}

function TrendIcon({ direction }: { direction: string }) {
  if (direction === 'increasing') return <TrendingUp className="size-4 text-orange-500" />
  if (direction === 'decreasing') return <TrendingDown className="size-4 text-green-500" />
  return <Minus className="size-4 text-muted-foreground" />
}

function ForecastItemCard({
  item,
  onSelect,
}: {
  item: ForecastResult
  onSelect: (id: string) => void
}) {
  return (
    <Card
      className="cursor-pointer transition-colors hover:border-primary/50"
      onClick={() => onSelect(item.itemId)}
    >
      <CardContent className="pt-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-medium truncate">{item.itemName}</h3>
              <Badge variant="secondary" className={RISK_COLORS[item.riskLevel]}>
                {item.riskLevel}
              </Badge>
            </div>
            {item.category && (
              <p className="text-sm text-muted-foreground mt-0.5">{item.category}</p>
            )}
          </div>
          <div className="text-right shrink-0 ml-4">
            <div className="text-lg font-semibold">
              {item.currentQuantity} <span className="text-xs text-muted-foreground">{item.unitOfMeasure}</span>
            </div>
            {item.parLevel && (
              <p className="text-xs text-muted-foreground">PAR: {item.parLevel}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mt-3 pt-3 border-t">
          <div>
            <p className="text-xs text-muted-foreground">Avg Daily</p>
            <p className="text-sm font-medium">{item.avgDailyConsumption}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Trend</p>
            <div className="flex items-center gap-1">
              <TrendIcon direction={item.consumptionTrend} />
              <p className="text-sm font-medium">
                {item.trendPercentage > 0 ? '+' : ''}{item.trendPercentage}%
              </p>
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Stockout</p>
            <p className="text-sm font-medium">
              {item.daysUntilStockout !== null
                ? item.daysUntilStockout === 0
                  ? 'Now!'
                  : `${item.daysUntilStockout}d`
                : 'N/A'}
            </p>
          </div>
        </div>

        {item.suggestedOrderQuantity > 0 && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t text-sm">
            <ShoppingCart className="size-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">
              Order <span className="font-medium text-foreground">{item.suggestedOrderQuantity} {item.unitOfMeasure}</span>
              {item.suggestedOrderDate && (
                <> by <span className="font-medium text-foreground">{new Date(item.suggestedOrderDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span></>
              )}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default function ForecastPage() {
  const { stores, currentStore, role } = useAuth()
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

  if (role !== 'Owner' && role !== 'Manager') {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">AI Demand Forecast</h1>
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/reports">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="size-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Brain className="size-6" />
              AI Demand Forecast
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Predictive analytics for {currentStore?.store?.name ?? 'your store'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger className="w-[130px]">
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
            <SelectTrigger className="w-[140px]">
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
            <SelectTrigger className="w-[120px]">
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
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-6 w-20 mb-2" />
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <Card>
          <CardContent className="pt-6 text-center text-destructive">
            Failed to load forecast data: {error.message}
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Package className="size-4" />
                  Total Items
                </div>
                <p className="text-2xl font-bold mt-1">{data.summary.total}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-red-600 text-sm">
                  <AlertTriangle className="size-4" />
                  Critical
                </div>
                <p className="text-2xl font-bold mt-1 text-red-600">{data.summary.critical}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-orange-600 text-sm">
                  <AlertTriangle className="size-4" />
                  High Risk
                </div>
                <p className="text-2xl font-bold mt-1 text-orange-600">{data.summary.high}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-yellow-600 text-sm">
                  <Calendar className="size-4" />
                  Medium Risk
                </div>
                <p className="text-2xl font-bold mt-1 text-yellow-600">{data.summary.medium}</p>
              </CardContent>
            </Card>
          </div>

          {/* Selected Item Detail */}
          {selectedItem && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">
                  {selectedItem.itemName} - Detailed Forecast
                </h2>
                <Button variant="ghost" size="sm" onClick={() => setSelectedItemId(null)}>
                  Back to list
                </Button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <ForecastChart
                  itemName={selectedItem.itemName}
                  forecast={selectedItem.forecast}
                  currentQuantity={selectedItem.currentQuantity}
                  parLevel={selectedItem.parLevel}
                  unitOfMeasure={selectedItem.unitOfMeasure}
                />
                <StockProjectionChart
                  itemName={selectedItem.itemName}
                  forecast={selectedItem.forecast}
                  currentQuantity={selectedItem.currentQuantity}
                  parLevel={selectedItem.parLevel}
                  unitOfMeasure={selectedItem.unitOfMeasure}
                />
              </div>

              <WeekdayPatternChart
                itemName={selectedItem.itemName}
                weekdayPattern={selectedItem.weekdayPattern}
                unitOfMeasure={selectedItem.unitOfMeasure}
              />
            </div>
          )}

          {/* Items List */}
          {!selectedItem && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold">
                {riskFilter !== 'all'
                  ? `${riskFilter.charAt(0).toUpperCase() + riskFilter.slice(1)} Risk Items`
                  : 'All Items (sorted by risk)'}
              </h2>

              {data.forecasts.length === 0 ? (
                <Card>
                  <CardContent className="pt-6 text-center text-muted-foreground">
                    No items found. Add inventory items to see demand forecasts.
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {data.forecasts.map(item => (
                    <ForecastItemCard
                      key={item.itemId}
                      item={item}
                      onSelect={setSelectedItemId}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
