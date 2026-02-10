'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { StoreAnalytics } from '@/hooks/useBenchmark'

interface StoreComparisonChartProps {
  stores: StoreAnalytics[]
  metric: 'healthScore' | 'countCompletionRate' | 'totalActivity' | 'totalValue' | 'totalUnits'
  title: string
  unit?: string
  color?: string
}

function getMetricValue(store: StoreAnalytics, metric: StoreComparisonChartProps['metric']): number {
  switch (metric) {
    case 'healthScore':
      return store.inventoryHealth.healthScore
    case 'countCompletionRate':
      return store.countCompletionRate
    case 'totalActivity':
      return store.activity.totalActivity
    case 'totalValue':
      return store.inventory.totalValue
    case 'totalUnits':
      return store.inventory.totalUnits
  }
}

export function StoreComparisonChart({ stores, metric, title, unit = '', color = '#303030' }: StoreComparisonChartProps) {
  const data = stores.map(store => ({
    name: store.storeName.length > 15 ? store.storeName.slice(0, 15) + '...' : store.storeName,
    fullName: store.storeName,
    value: getMetricValue(store, metric),
  }))

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ left: 10, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tickFormatter={(v) => `${v}${unit}`} />
              <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(value: unknown) => [`${Number(value).toLocaleString()}${unit}`, title]}
                labelFormatter={(label: unknown) => {
                  const labelStr = String(label)
                  const item = data.find(d => d.name === labelStr)
                  return item?.fullName || labelStr
                }}
              />
              <Bar dataKey="value" fill={color} radius={[0, 4, 4, 0]} maxBarSize={32} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

interface StoreActivityTrendChartProps {
  stores: StoreAnalytics[]
}

const STORE_COLORS = [
  '#303030', '#2563eb', '#16a34a', '#ea580c', '#9333ea',
  '#0891b2', '#c026d3', '#65a30d', '#dc2626', '#0d9488',
]

export function StoreActivityTrendChart({ stores }: StoreActivityTrendChartProps) {
  if (stores.length === 0) return null

  // Build merged data: each entry has { date, Store1: count, Store2: count, ... }
  const dates = stores[0].activityTrend.map(t => t.date)
  const data = dates.map(date => {
    const entry: Record<string, string | number> = { date: date.slice(5) } // MM-DD format
    stores.forEach(store => {
      const trend = store.activityTrend.find(t => t.date === date)
      entry[store.storeName] = trend?.count ?? 0
    })
    return entry
  })

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Activity Trend (14 Days)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              {stores.map((store, i) => (
                <Bar
                  key={store.storeId}
                  dataKey={store.storeName}
                  fill={STORE_COLORS[i % STORE_COLORS.length]}
                  radius={[2, 2, 0, 0]}
                  maxBarSize={20}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
