'use client'

import { useMemo } from 'react'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { DayForecast } from '@/lib/forecasting/engine'

interface ForecastChartProps {
  itemName: string
  forecast: DayForecast[]
  currentQuantity: number
  parLevel: number | null
  unitOfMeasure: string
}

export function ForecastChart({
  itemName,
  forecast,
  currentQuantity,
  parLevel,
  unitOfMeasure,
}: ForecastChartProps) {
  const chartData = useMemo(() => {
    let runningQuantity = currentQuantity

    return forecast.map(f => {
      runningQuantity = Math.max(0, runningQuantity - f.predicted)
      return {
        date: new Date(f.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        predicted: f.predicted,
        lowerBound: f.lowerBound,
        upperBound: f.upperBound,
        projectedStock: Math.round(runningQuantity * 100) / 100,
      }
    })
  }, [forecast, currentQuantity])

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">{itemName} - Forecast</CardTitle>
        <p className="text-sm text-muted-foreground">
          Projected daily consumption ({unitOfMeasure}) with confidence interval
        </p>
      </CardHeader>
      <CardContent>
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="date" fontSize={12} className="fill-muted-foreground" />
              <YAxis fontSize={12} className="fill-muted-foreground" />
              <Tooltip
                formatter={(value: unknown) => [Number(value).toFixed(1), '']}
                labelClassName="font-semibold"
              />
              <Area
                type="monotone"
                dataKey="upperBound"
                stackId="confidence"
                stroke="none"
                fill="hsl(var(--primary))"
                fillOpacity={0.1}
                name="Upper Bound"
              />
              <Area
                type="monotone"
                dataKey="lowerBound"
                stackId="confidence"
                stroke="none"
                fill="white"
                fillOpacity={1}
                name="Lower Bound"
              />
              <Area
                type="monotone"
                dataKey="predicted"
                stroke="hsl(var(--primary))"
                fill="hsl(var(--primary))"
                fillOpacity={0.2}
                strokeWidth={2}
                name="Predicted Consumption"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

interface StockProjectionChartProps {
  itemName: string
  forecast: DayForecast[]
  currentQuantity: number
  parLevel: number | null
  unitOfMeasure: string
}

export function StockProjectionChart({
  itemName,
  forecast,
  currentQuantity,
  parLevel,
  unitOfMeasure,
}: StockProjectionChartProps) {
  const chartData = useMemo(() => {
    let runningQuantity = currentQuantity

    return [
      {
        date: 'Today',
        stock: currentQuantity,
      },
      ...forecast.map(f => {
        runningQuantity = Math.max(0, runningQuantity - f.predicted)
        return {
          date: new Date(f.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          stock: Math.round(runningQuantity * 100) / 100,
        }
      }),
    ]
  }, [forecast, currentQuantity])

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">{itemName} - Stock Projection</CardTitle>
        <p className="text-sm text-muted-foreground">
          Projected remaining stock ({unitOfMeasure})
        </p>
      </CardHeader>
      <CardContent>
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="date" fontSize={12} className="fill-muted-foreground" />
              <YAxis fontSize={12} className="fill-muted-foreground" />
              <Tooltip
                formatter={(value: unknown) => [`${Number(value).toFixed(1)} ${unitOfMeasure}`, 'Stock']}
                labelClassName="font-semibold"
              />
              {parLevel && (
                <ReferenceLine
                  y={parLevel}
                  stroke="hsl(var(--destructive))"
                  strokeDasharray="5 5"
                  label={{ value: 'PAR Level', position: 'right', fontSize: 11 }}
                />
              )}
              <Area
                type="monotone"
                dataKey="stock"
                stroke="hsl(var(--primary))"
                fill="hsl(var(--primary))"
                fillOpacity={0.15}
                strokeWidth={2}
                name="Projected Stock"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

interface WeekdayPatternChartProps {
  itemName: string
  weekdayPattern: number[]
  unitOfMeasure: string
}

export function WeekdayPatternChart({ itemName, weekdayPattern, unitOfMeasure }: WeekdayPatternChartProps) {
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  const chartData = dayNames.map((day, i) => ({
    day,
    consumption: weekdayPattern[i],
  }))

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">{itemName} - Weekly Pattern</CardTitle>
        <p className="text-sm text-muted-foreground">
          Average daily consumption by day of week ({unitOfMeasure})
        </p>
      </CardHeader>
      <CardContent>
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="day" fontSize={12} className="fill-muted-foreground" />
              <YAxis fontSize={12} className="fill-muted-foreground" />
              <Tooltip
                formatter={(value: unknown) => [`${Number(value).toFixed(1)} ${unitOfMeasure}`, 'Avg Consumption']}
                labelClassName="font-semibold"
              />
              <Bar dataKey="consumption" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
