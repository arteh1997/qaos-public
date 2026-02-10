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
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface TopMovingItemsChartProps {
  data: { name: string; category: string | null; totalChange: number; changeCount: number }[]
}

export function TopMovingItemsChart({ data }: TopMovingItemsChartProps) {
  const chartData = useMemo(() => {
    return data.slice(0, 8).map(d => ({
      name: d.name.length > 15 ? d.name.slice(0, 14) + '...' : d.name,
      fullName: d.name,
      quantity: d.totalChange,
      changes: d.changeCount,
    }))
  }, [data])

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Most Active Items</CardTitle>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">
            No item activity yet
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
              <YAxis
                dataKey="name"
                type="category"
                width={100}
                tick={{ fontSize: 11 }}
              />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
                formatter={(value, _name, props) => {
                  const v = Number(value) || 0
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const p = (props as any)?.payload
                  return `${v} units (${p?.changes ?? 0} changes)`
                }}
              />
              <Bar dataKey="quantity" name="Total Movement" fill="#404040" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
