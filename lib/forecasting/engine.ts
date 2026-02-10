/**
 * Demand Forecasting Engine
 *
 * Uses multiple statistical methods to predict future inventory consumption:
 * 1. Simple Moving Average (SMA) - baseline
 * 2. Weighted Moving Average (WMA) - recent-data-biased
 * 3. Exponential Smoothing (ETS) - adaptive smoothing
 *
 * The engine aggregates stock_history data into daily consumption, applies
 * day-of-week seasonality, and generates forward-looking predictions with
 * confidence intervals.
 */

export interface DailyConsumption {
  date: string // YYYY-MM-DD
  quantity: number
  dayOfWeek: number // 0=Sun, 6=Sat
}

export interface ForecastResult {
  itemId: string
  itemName: string
  category: string | null
  unitOfMeasure: string
  currentQuantity: number
  parLevel: number | null
  unitCost: number

  // Historical metrics
  avgDailyConsumption: number
  maxDailyConsumption: number
  totalConsumption: number
  daysWithData: number
  consumptionTrend: 'increasing' | 'decreasing' | 'stable'
  trendPercentage: number // positive = increasing

  // Day-of-week patterns (average consumption per day)
  weekdayPattern: number[] // [Sun, Mon, Tue, Wed, Thu, Fri, Sat]

  // Forecast (next N days)
  forecast: DayForecast[]

  // Recommendations
  daysUntilStockout: number | null
  suggestedOrderQuantity: number
  suggestedOrderDate: string | null
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
}

export interface DayForecast {
  date: string
  predicted: number
  lowerBound: number
  upperBound: number
}

/**
 * Compute daily consumption from stock history entries
 * Consumption = negative quantity changes from Count/Adjustment/Sale/Waste
 */
export function computeDailyConsumption(
  history: Array<{
    action_type: string
    quantity_change: number | null
    created_at: string
  }>,
  startDate: Date,
  endDate: Date
): DailyConsumption[] {
  // Group consumption by date
  const dailyMap = new Map<string, number>()

  // Initialize all dates to 0
  const current = new Date(startDate)
  while (current <= endDate) {
    const dateStr = current.toISOString().split('T')[0]
    dailyMap.set(dateStr, 0)
    current.setDate(current.getDate() + 1)
  }

  // Sum up consumption (negative changes = consumption)
  for (const entry of history) {
    if (entry.quantity_change === null) continue
    const dateStr = new Date(entry.created_at).toISOString().split('T')[0]
    if (!dailyMap.has(dateStr)) continue

    // For consumption tracking, we want negative changes as positive consumption
    // Count: if quantity went down, that's consumption
    // Waste: always consumption
    // Sale: always consumption
    const consumption = entry.quantity_change < 0 ? Math.abs(entry.quantity_change) : 0
    dailyMap.set(dateStr, (dailyMap.get(dateStr) ?? 0) + consumption)
  }

  return Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, quantity]) => ({
      date,
      quantity,
      dayOfWeek: new Date(date + 'T12:00:00Z').getUTCDay(),
    }))
}

/**
 * Simple Moving Average
 */
export function simpleMovingAverage(values: number[], window: number): number {
  if (values.length === 0) return 0
  const slice = values.slice(-window)
  return slice.reduce((sum, v) => sum + v, 0) / slice.length
}

/**
 * Weighted Moving Average (more weight on recent data)
 */
export function weightedMovingAverage(values: number[], window: number): number {
  if (values.length === 0) return 0
  const slice = values.slice(-window)
  let weightedSum = 0
  let totalWeight = 0

  for (let i = 0; i < slice.length; i++) {
    const weight = i + 1 // Linear weights: 1, 2, 3, ...
    weightedSum += slice[i] * weight
    totalWeight += weight
  }

  return totalWeight > 0 ? weightedSum / totalWeight : 0
}

/**
 * Exponential Smoothing (Holt's double exponential for trend)
 * Alpha: smoothing factor for level (0-1)
 * Beta: smoothing factor for trend (0-1)
 */
export function exponentialSmoothing(
  values: number[],
  alpha: number = 0.3,
  beta: number = 0.1
): { level: number; trend: number } {
  if (values.length === 0) return { level: 0, trend: 0 }
  if (values.length === 1) return { level: values[0], trend: 0 }

  // Initialize
  let level = values[0]
  let trend = values[1] - values[0]

  for (let i = 1; i < values.length; i++) {
    const prevLevel = level
    level = alpha * values[i] + (1 - alpha) * (prevLevel + trend)
    trend = beta * (level - prevLevel) + (1 - beta) * trend
  }

  return { level, trend }
}

/**
 * Compute day-of-week seasonality indices
 * Returns array [Sun..Sat] where 1.0 = average
 */
export function computeSeasonality(dailyData: DailyConsumption[]): number[] {
  const dayTotals = [0, 0, 0, 0, 0, 0, 0]
  const dayCounts = [0, 0, 0, 0, 0, 0, 0]

  for (const d of dailyData) {
    dayTotals[d.dayOfWeek] += d.quantity
    dayCounts[d.dayOfWeek]++
  }

  const dayAverages = dayTotals.map((total, i) =>
    dayCounts[i] > 0 ? total / dayCounts[i] : 0
  )

  const overallAvg = dayAverages.reduce((a, b) => a + b, 0) / 7

  if (overallAvg === 0) return [1, 1, 1, 1, 1, 1, 1]

  return dayAverages.map(avg => avg / overallAvg)
}

/**
 * Detect consumption trend direction and magnitude
 */
export function detectTrend(
  values: number[]
): { direction: 'increasing' | 'decreasing' | 'stable'; percentage: number } {
  if (values.length < 7) return { direction: 'stable', percentage: 0 }

  // Compare first half vs second half averages
  const mid = Math.floor(values.length / 2)
  const firstHalf = values.slice(0, mid)
  const secondHalf = values.slice(mid)

  const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length
  const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length

  if (firstAvg === 0 && secondAvg === 0) return { direction: 'stable', percentage: 0 }
  if (firstAvg === 0) return { direction: 'increasing', percentage: 100 }

  const changePercent = ((secondAvg - firstAvg) / firstAvg) * 100

  if (changePercent > 10) return { direction: 'increasing', percentage: Math.round(changePercent) }
  if (changePercent < -10) return { direction: 'decreasing', percentage: Math.round(changePercent) }
  return { direction: 'stable', percentage: Math.round(changePercent) }
}

/**
 * Generate N-day forecast with confidence intervals
 */
export function generateForecast(
  dailyData: DailyConsumption[],
  forecastDays: number = 14
): DayForecast[] {
  const values = dailyData.map(d => d.quantity)
  if (values.length === 0) {
    return Array.from({ length: forecastDays }, (_, i) => {
      const date = new Date()
      date.setDate(date.getDate() + i + 1)
      return {
        date: date.toISOString().split('T')[0],
        predicted: 0,
        lowerBound: 0,
        upperBound: 0,
      }
    })
  }

  // Compute base forecast using exponential smoothing
  const { level, trend } = exponentialSmoothing(values, 0.3, 0.1)

  // Compute seasonality
  const seasonality = computeSeasonality(dailyData)

  // Compute standard deviation for confidence interval
  const sma = simpleMovingAverage(values, 7)
  const residuals = values.slice(-7).map(v => v - sma)
  const stdDev = Math.sqrt(
    residuals.reduce((sum, r) => sum + r * r, 0) / Math.max(residuals.length, 1)
  )

  const forecasts: DayForecast[] = []

  for (let i = 1; i <= forecastDays; i++) {
    const forecastDate = new Date()
    forecastDate.setDate(forecastDate.getDate() + i)
    const dayOfWeek = forecastDate.getUTCDay()

    // Base prediction = level + trend * steps, adjusted by seasonality
    const basePrediction = Math.max(0, (level + trend * i) * seasonality[dayOfWeek])

    // Widen confidence interval as we go further out
    const widthFactor = 1.96 * stdDev * Math.sqrt(i / 7)
    const lower = Math.max(0, basePrediction - widthFactor)
    const upper = basePrediction + widthFactor

    forecasts.push({
      date: forecastDate.toISOString().split('T')[0],
      predicted: Math.round(basePrediction * 100) / 100,
      lowerBound: Math.round(lower * 100) / 100,
      upperBound: Math.round(upper * 100) / 100,
    })
  }

  return forecasts
}

/**
 * Compute days until stockout based on forecasted consumption
 */
export function computeStockoutDays(
  currentQuantity: number,
  forecast: DayForecast[]
): number | null {
  if (currentQuantity <= 0) return 0

  let remaining = currentQuantity
  for (let i = 0; i < forecast.length; i++) {
    remaining -= forecast[i].predicted
    if (remaining <= 0) return i + 1
  }

  // If we still have stock after the forecast period, estimate linearly
  if (forecast.length === 0) return null
  const avgDaily = forecast.reduce((sum, f) => sum + f.predicted, 0) / forecast.length
  if (avgDaily <= 0) return null

  return Math.ceil(currentQuantity / avgDaily)
}

/**
 * Determine risk level based on stockout prediction and par level
 */
export function assessRiskLevel(
  currentQuantity: number,
  parLevel: number | null,
  daysUntilStockout: number | null
): 'low' | 'medium' | 'high' | 'critical' {
  // Already out of stock
  if (currentQuantity <= 0) return 'critical'

  // Will run out within 2 days
  if (daysUntilStockout !== null && daysUntilStockout <= 2) return 'critical'

  // Will run out within 5 days
  if (daysUntilStockout !== null && daysUntilStockout <= 5) return 'high'

  // Below par level
  if (parLevel !== null && currentQuantity < parLevel) return 'medium'

  // Will run out within 10 days
  if (daysUntilStockout !== null && daysUntilStockout <= 10) return 'medium'

  return 'low'
}

/**
 * Suggest order quantity to reach par level with buffer
 */
export function suggestOrderQuantity(
  currentQuantity: number,
  parLevel: number | null,
  avgDailyConsumption: number,
  leadTimeDays: number = 3
): number {
  // Default target: 7 days of stock
  const targetDays = 7
  const target = parLevel ?? avgDailyConsumption * targetDays

  // Need enough to cover lead time + target buffer
  const neededQuantity = target + (avgDailyConsumption * leadTimeDays) - currentQuantity

  return Math.max(0, Math.ceil(neededQuantity))
}

/**
 * Full forecast for a single item
 */
export function forecastItem(params: {
  itemId: string
  itemName: string
  category: string | null
  unitOfMeasure: string
  currentQuantity: number
  parLevel: number | null
  unitCost: number
  history: Array<{
    action_type: string
    quantity_change: number | null
    created_at: string
  }>
  historyDays: number
  forecastDays: number
}): ForecastResult {
  const {
    itemId, itemName, category, unitOfMeasure,
    currentQuantity, parLevel, unitCost,
    history, historyDays, forecastDays,
  } = params

  const endDate = new Date()
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - historyDays)

  const dailyData = computeDailyConsumption(history, startDate, endDate)
  const values = dailyData.map(d => d.quantity)

  const totalConsumption = values.reduce((a, b) => a + b, 0)
  const daysWithData = values.filter(v => v > 0).length
  const avgDailyConsumption = values.length > 0
    ? totalConsumption / values.length
    : 0
  const maxDailyConsumption = Math.max(0, ...values)

  const trend = detectTrend(values)
  const weekdayPattern = computeSeasonality(dailyData).map(v =>
    Math.round(v * avgDailyConsumption * 100) / 100
  )

  const forecast = generateForecast(dailyData, forecastDays)
  const daysUntilStockout = computeStockoutDays(currentQuantity, forecast)
  const riskLevel = assessRiskLevel(currentQuantity, parLevel, daysUntilStockout)
  const suggestedOrderQuantity = suggestOrderQuantity(
    currentQuantity, parLevel, avgDailyConsumption
  )

  // Suggest order date: leadTimeDays before stockout
  let suggestedOrderDate: string | null = null
  if (daysUntilStockout !== null && daysUntilStockout > 3) {
    const orderDate = new Date()
    orderDate.setDate(orderDate.getDate() + daysUntilStockout - 3)
    suggestedOrderDate = orderDate.toISOString().split('T')[0]
  } else if (daysUntilStockout !== null && daysUntilStockout <= 3) {
    suggestedOrderDate = new Date().toISOString().split('T')[0] // Order today!
  }

  return {
    itemId,
    itemName,
    category,
    unitOfMeasure,
    currentQuantity,
    parLevel,
    unitCost,
    avgDailyConsumption: Math.round(avgDailyConsumption * 100) / 100,
    maxDailyConsumption,
    totalConsumption,
    daysWithData,
    consumptionTrend: trend.direction,
    trendPercentage: trend.percentage,
    weekdayPattern,
    forecast,
    daysUntilStockout,
    suggestedOrderQuantity,
    suggestedOrderDate,
    riskLevel,
  }
}
