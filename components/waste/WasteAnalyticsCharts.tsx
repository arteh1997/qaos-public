'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

interface DailyTrend {
  date: string
  quantity: number
  cost: number
  incidents: number
}

interface ByReason {
  reason: string
  count: number
  quantity: number
  estimated_cost: number
  percentage: number
}

interface WasteAnalyticsChartsProps {
  dailyTrend: DailyTrend[]
  byReason: ByReason[]
}

const REASON_COLORS: Record<string, string> = {
  spoilage: '#ef4444',
  expired: '#f97316',
  damaged: '#eab308',
  overproduction: '#3b82f6',
  other: '#6b7280',
}

function formatCurrency(value: number): string {
  return `£${value.toFixed(0)}`
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function WasteAnalyticsCharts({ dailyTrend, byReason }: WasteAnalyticsChartsProps) {
  const trendData = dailyTrend.map(d => ({
    ...d,
    label: formatDate(d.date),
  }))

  const reasonData = byReason.map(r => ({
    ...r,
    label: r.reason.charAt(0).toUpperCase() + r.reason.slice(1),
    fill: REASON_COLORS[r.reason] || '#6b7280',
  }))

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Waste Cost Trend</CardTitle>
        </CardHeader>
        <CardContent>
          {trendData.length === 0 ? (
            <div className="h-[250px] flex items-center justify-center text-sm text-muted-foreground">
              No trend data available yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="wasteCostGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} className="text-muted-foreground" />
                <YAxis tickFormatter={formatCurrency} tick={{ fontSize: 12 }} className="text-muted-foreground" />
                <Tooltip
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={((value: any) => [`$${Number(value).toFixed(2)}`, 'Cost']) as any}
                  contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))' }}
                />
                <Area
                  type="monotone"
                  dataKey="cost"
                  stroke="#ef4444"
                  fill="url(#wasteCostGradient)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Waste by Reason</CardTitle>
        </CardHeader>
        <CardContent>
          {reasonData.length === 0 ? (
            <div className="h-[250px] flex items-center justify-center text-sm text-muted-foreground">
              No reason data available yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={reasonData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} className="text-muted-foreground" />
                <YAxis tickFormatter={formatCurrency} tick={{ fontSize: 12 }} className="text-muted-foreground" />
                <Tooltip
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={((value: any) => [`$${Number(value).toFixed(2)}`, 'Cost']) as any}
                  contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))' }}
                />
                <Bar dataKey="estimated_cost" radius={[4, 4, 0, 0]}>
                  {reasonData.map((entry, index) => (
                    <Cell key={index} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
