'use client'

import { useMemo } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface StockActivityChartProps {
  data: { date: string; counts: number; receptions: number }[]
}

export function StockActivityChart({ data }: StockActivityChartProps) {
  // Only show last 14 days for readability, or fewer if less data
  const chartData = useMemo(() => {
    const recent = data.slice(-14)
    return recent.map(d => ({
      ...d,
      date: new Date(d.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    }))
  }, [data])

  const totalCounts = data.reduce((s, d) => s + d.counts, 0)
  const totalReceptions = data.reduce((s, d) => s + d.receptions, 0)

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">Stock Activity</CardTitle>
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span>{totalCounts} counts</span>
            <span>{totalReceptions} receptions</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {totalCounts === 0 && totalReceptions === 0 ? (
          <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">
            No stock activity recorded yet
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} className="text-muted-foreground" />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} className="text-muted-foreground" />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
                labelStyle={{ fontWeight: 600 }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="counts" name="Counts" fill="#404040" radius={[2, 2, 0, 0]} />
              <Bar dataKey="receptions" name="Receptions" fill="#94a3b8" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
