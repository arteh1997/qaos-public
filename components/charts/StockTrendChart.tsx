'use client'

import { useMemo } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface StockTrendChartProps {
  data: { date: string; totalQuantity: number }[]
}

export function StockTrendChart({ data }: StockTrendChartProps) {
  const chartData = useMemo(() => {
    // Show last 30 data points max for readability
    const recent = data.slice(-30)
    return recent.map(d => ({
      ...d,
      date: new Date(d.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    }))
  }, [data])

  const currentTotal = data.length > 0 ? data[data.length - 1].totalQuantity : 0
  const startTotal = data.length > 1 ? data[0].totalQuantity : currentTotal
  const change = currentTotal - startTotal
  const changePercent = startTotal > 0 ? Math.round((change / startTotal) * 100) : 0

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">Total Stock Trend</CardTitle>
          <div className="text-right">
            <div className="text-lg font-bold">{currentTotal.toLocaleString()}</div>
            <div className={`text-xs ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {change >= 0 ? '+' : ''}{change.toLocaleString()} ({changePercent >= 0 ? '+' : ''}{changePercent}%)
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {data.length <= 1 ? (
          <div className="flex items-center justify-center h-[160px] text-sm text-muted-foreground">
            Need at least 2 days of data for trends
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="stockFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#404040" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#404040" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} className="text-muted-foreground" />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} className="text-muted-foreground" />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
                formatter={(value) => `${Number(value).toLocaleString()} units`}
              />
              <Area
                type="monotone"
                dataKey="totalQuantity"
                stroke="#404040"
                strokeWidth={2}
                fill="url(#stockFill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
