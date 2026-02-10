'use client'

import { useMemo } from 'react'
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface CategoryBreakdownChartProps {
  data: { name: string; count: number }[]
}

const COLORS = [
  '#303030', '#6b7280', '#3b82f6', '#10b981', '#f59e0b',
  '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316',
]

export function CategoryBreakdownChart({ data }: CategoryBreakdownChartProps) {
  const chartData = useMemo(() => {
    // Group small categories into "Other" if more than 6 categories
    if (data.length <= 6) return data

    const top5 = data.slice(0, 5)
    const rest = data.slice(5)
    const otherCount = rest.reduce((sum, d) => sum + d.count, 0)

    return [...top5, { name: 'Other', count: otherCount }]
  }, [data])

  const total = chartData.reduce((sum, d) => sum + d.count, 0)

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">Items by Category</CardTitle>
          <span className="text-xs text-muted-foreground">{total} total items</span>
        </div>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">
            No items categorized yet
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={75}
                paddingAngle={2}
                dataKey="count"
                nameKey="name"
              >
                {chartData.map((_entry, index) => (
                  <Cell key={index} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
                formatter={(value) => {
                  const v = Number(value) || 0
                  return `${v} items (${total > 0 ? Math.round((v / total) * 100) : 0}%)`
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: 11 }}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
