'use client'

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface InventoryHealthChartProps {
  data: { total: number; outOfStock: number; lowStock: number; healthy: number }
  completionRate: { completed: number; total: number; rate: number }
}

export function InventoryHealthChart({ data, completionRate }: InventoryHealthChartProps) {
  const healthData = [
    { name: 'Healthy', value: data.healthy, color: '#10b981' },
    { name: 'Low Stock', value: data.lowStock, color: '#f59e0b' },
    { name: 'Out of Stock', value: data.outOfStock, color: '#ef4444' },
  ].filter(d => d.value > 0)

  const healthPercent = data.total > 0 ? Math.round((data.healthy / data.total) * 100) : 0

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Inventory Health</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-6">
          {/* Donut Chart */}
          <div className="relative w-[120px] h-[120px] shrink-0">
            {data.total === 0 ? (
              <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
                No items
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={healthData}
                      cx="50%"
                      cy="50%"
                      innerRadius={35}
                      outerRadius={55}
                      paddingAngle={2}
                      dataKey="value"
                      startAngle={90}
                      endAngle={-270}
                    >
                      {healthData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-xl font-bold">{healthPercent}%</div>
                    <div className="text-[10px] text-muted-foreground">Healthy</div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Metrics */}
          <div className="flex-1 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                <span className="text-sm">Healthy</span>
              </div>
              <span className="text-sm font-semibold">{data.healthy}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                <span className="text-sm">Low Stock</span>
              </div>
              <span className="text-sm font-semibold">{data.lowStock}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                <span className="text-sm">Out of Stock</span>
              </div>
              <span className="text-sm font-semibold">{data.outOfStock}</span>
            </div>
            <div className="pt-2 border-t">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Count completion ({completionRate.total}d)</span>
                <span className="text-sm font-semibold">{completionRate.rate}%</span>
              </div>
              <div className="mt-1 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-foreground transition-all"
                  style={{ width: `${completionRate.rate}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
