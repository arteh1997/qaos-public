import { describe, it, expect } from 'vitest'
import {
  computeDailyConsumption,
  simpleMovingAverage,
  weightedMovingAverage,
  exponentialSmoothing,
  computeSeasonality,
  detectTrend,
  generateForecast,
  computeStockoutDays,
  assessRiskLevel,
  suggestOrderQuantity,
  forecastItem,
} from '@/lib/forecasting/engine'

describe('Forecasting Engine', () => {
  describe('computeDailyConsumption', () => {
    it('should aggregate negative quantity changes as consumption', () => {
      const history = [
        { action_type: 'Count', quantity_change: -10, created_at: '2026-02-08T10:00:00Z' },
        { action_type: 'Count', quantity_change: -5, created_at: '2026-02-08T14:00:00Z' },
        { action_type: 'Reception', quantity_change: 20, created_at: '2026-02-08T09:00:00Z' },
      ]
      const start = new Date('2026-02-08')
      const end = new Date('2026-02-08')

      const result = computeDailyConsumption(history, start, end)

      expect(result).toHaveLength(1)
      expect(result[0].date).toBe('2026-02-08')
      expect(result[0].quantity).toBe(15) // 10 + 5 (only negative changes)
    })

    it('should return zero for days with no history', () => {
      const start = new Date('2026-02-01')
      const end = new Date('2026-02-03')

      const result = computeDailyConsumption([], start, end)

      expect(result).toHaveLength(3)
      expect(result.every(d => d.quantity === 0)).toBe(true)
    })

    it('should ignore null quantity changes', () => {
      const history = [
        { action_type: 'Count', quantity_change: null, created_at: '2026-02-08T10:00:00Z' },
      ]
      const start = new Date('2026-02-08')
      const end = new Date('2026-02-08')

      const result = computeDailyConsumption(history, start, end)
      expect(result[0].quantity).toBe(0)
    })

    it('should include day of week', () => {
      const start = new Date('2026-02-08') // Sunday
      const end = new Date('2026-02-08')

      const result = computeDailyConsumption([], start, end)
      expect(result[0].dayOfWeek).toBe(0) // Sunday
    })
  })

  describe('simpleMovingAverage', () => {
    it('should compute average of last N values', () => {
      expect(simpleMovingAverage([2, 4, 6, 8, 10], 3)).toBe(8) // avg of [6, 8, 10]
    })

    it('should handle empty array', () => {
      expect(simpleMovingAverage([], 3)).toBe(0)
    })

    it('should handle window larger than data', () => {
      expect(simpleMovingAverage([4, 6], 5)).toBe(5) // avg of all available
    })
  })

  describe('weightedMovingAverage', () => {
    it('should weight recent values more heavily', () => {
      // [1, 2, 3] with weights [1, 2, 3]
      // = (1*1 + 2*2 + 3*3) / (1+2+3) = (1+4+9)/6 = 14/6 ≈ 2.33
      const result = weightedMovingAverage([1, 2, 3], 3)
      expect(result).toBeCloseTo(14 / 6, 2)
    })

    it('should handle empty array', () => {
      expect(weightedMovingAverage([], 3)).toBe(0)
    })
  })

  describe('exponentialSmoothing', () => {
    it('should return level and trend', () => {
      const result = exponentialSmoothing([10, 12, 14, 16, 18])
      expect(result.level).toBeGreaterThan(0)
      expect(result.trend).toBeGreaterThan(0)
    })

    it('should handle single value', () => {
      const result = exponentialSmoothing([5])
      expect(result.level).toBe(5)
      expect(result.trend).toBe(0)
    })

    it('should handle empty array', () => {
      const result = exponentialSmoothing([])
      expect(result.level).toBe(0)
      expect(result.trend).toBe(0)
    })
  })

  describe('computeSeasonality', () => {
    it('should return 7 seasonality indices', () => {
      const data = [
        { date: '2026-02-02', quantity: 10, dayOfWeek: 1 }, // Mon
        { date: '2026-02-03', quantity: 10, dayOfWeek: 2 }, // Tue
        { date: '2026-02-04', quantity: 20, dayOfWeek: 3 }, // Wed (double)
        { date: '2026-02-05', quantity: 10, dayOfWeek: 4 }, // Thu
        { date: '2026-02-06', quantity: 10, dayOfWeek: 5 }, // Fri
        { date: '2026-02-07', quantity: 10, dayOfWeek: 6 }, // Sat
        { date: '2026-02-08', quantity: 0, dayOfWeek: 0 },  // Sun
      ]

      const result = computeSeasonality(data)
      expect(result).toHaveLength(7)
      // Wednesday should have higher index than other days
      expect(result[3]).toBeGreaterThan(result[1])
    })

    it('should return all 1s for zero data', () => {
      const result = computeSeasonality([])
      expect(result).toEqual([1, 1, 1, 1, 1, 1, 1])
    })
  })

  describe('detectTrend', () => {
    it('should detect increasing trend', () => {
      const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
      const result = detectTrend(values)
      expect(result.direction).toBe('increasing')
      expect(result.percentage).toBeGreaterThan(0)
    })

    it('should detect decreasing trend', () => {
      const values = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1]
      const result = detectTrend(values)
      expect(result.direction).toBe('decreasing')
      expect(result.percentage).toBeLessThan(0)
    })

    it('should detect stable trend', () => {
      const values = [5, 5, 5, 5, 5, 5, 5, 5, 5, 5]
      const result = detectTrend(values)
      expect(result.direction).toBe('stable')
    })

    it('should return stable for insufficient data', () => {
      const result = detectTrend([1, 2, 3])
      expect(result.direction).toBe('stable')
    })
  })

  describe('generateForecast', () => {
    it('should generate correct number of forecast days', () => {
      const dailyData = Array.from({ length: 14 }, (_, i) => ({
        date: `2026-02-${String(i + 1).padStart(2, '0')}`,
        quantity: 10 + Math.random() * 5,
        dayOfWeek: (i + 1) % 7,
      }))

      const result = generateForecast(dailyData, 7)
      expect(result).toHaveLength(7)
    })

    it('should have non-negative predictions', () => {
      const dailyData = Array.from({ length: 14 }, (_, i) => ({
        date: `2026-02-${String(i + 1).padStart(2, '0')}`,
        quantity: 5,
        dayOfWeek: (i + 1) % 7,
      }))

      const result = generateForecast(dailyData, 14)
      expect(result.every(f => f.predicted >= 0)).toBe(true)
      expect(result.every(f => f.lowerBound >= 0)).toBe(true)
    })

    it('should have wider confidence intervals for further-out predictions', () => {
      const dailyData = Array.from({ length: 30 }, (_, i) => ({
        date: `2026-01-${String(i + 1).padStart(2, '0')}`,
        quantity: 10 + (Math.random() - 0.5) * 6, // some variance
        dayOfWeek: (i + 1) % 7,
      }))

      const result = generateForecast(dailyData, 14)
      const firstRange = result[0].upperBound - result[0].lowerBound
      const lastRange = result[13].upperBound - result[13].lowerBound
      expect(lastRange).toBeGreaterThanOrEqual(firstRange)
    })

    it('should return zeros for empty data', () => {
      const result = generateForecast([], 3)
      expect(result).toHaveLength(3)
      expect(result.every(f => f.predicted === 0)).toBe(true)
    })
  })

  describe('computeStockoutDays', () => {
    it('should return 0 when already out of stock', () => {
      expect(computeStockoutDays(0, [])).toBe(0)
    })

    it('should estimate days until stockout', () => {
      const forecast = [
        { date: '2026-02-11', predicted: 10, lowerBound: 8, upperBound: 12 },
        { date: '2026-02-12', predicted: 10, lowerBound: 8, upperBound: 12 },
        { date: '2026-02-13', predicted: 10, lowerBound: 8, upperBound: 12 },
      ]
      const result = computeStockoutDays(25, forecast)
      expect(result).toBe(3) // 25 - 10 - 10 - 10 < 0 on day 3
    })

    it('should return null when stock is sufficient', () => {
      const forecast = [
        { date: '2026-02-11', predicted: 0, lowerBound: 0, upperBound: 0 },
      ]
      const result = computeStockoutDays(100, forecast)
      expect(result).toBeNull()
    })
  })

  describe('assessRiskLevel', () => {
    it('should return critical when out of stock', () => {
      expect(assessRiskLevel(0, 10, null)).toBe('critical')
    })

    it('should return critical when stockout within 2 days', () => {
      expect(assessRiskLevel(5, 10, 1)).toBe('critical')
    })

    it('should return high when stockout within 5 days', () => {
      expect(assessRiskLevel(20, 50, 4)).toBe('high')
    })

    it('should return medium when below par level', () => {
      expect(assessRiskLevel(5, 10, 20)).toBe('medium')
    })

    it('should return low when well-stocked', () => {
      expect(assessRiskLevel(50, 20, 30)).toBe('low')
    })
  })

  describe('suggestOrderQuantity', () => {
    it('should suggest enough to cover par + lead time', () => {
      // par=20, current=5, avg daily=3, lead time=3
      // Need: 20 + (3*3) - 5 = 24
      const result = suggestOrderQuantity(5, 20, 3, 3)
      expect(result).toBe(24)
    })

    it('should return 0 when well-stocked', () => {
      const result = suggestOrderQuantity(100, 20, 3, 3)
      expect(result).toBe(0)
    })

    it('should use 7-day target when no par level', () => {
      // target = 3*7 = 21, need = 21 + (3*3) - 10 = 20
      const result = suggestOrderQuantity(10, null, 3, 3)
      expect(result).toBe(20)
    })
  })

  describe('forecastItem', () => {
    it('should return a complete ForecastResult', () => {
      const history = Array.from({ length: 30 }, (_, i) => ({
        action_type: 'Count',
        quantity_change: -(5 + Math.floor(Math.random() * 5)),
        created_at: new Date(Date.now() - (30 - i) * 86400000).toISOString(),
      }))

      const result = forecastItem({
        itemId: 'item-1',
        itemName: 'Tomatoes',
        category: 'Produce',
        unitOfMeasure: 'kg',
        currentQuantity: 50,
        parLevel: 20,
        unitCost: 3.5,
        history,
        historyDays: 30,
        forecastDays: 14,
      })

      expect(result.itemId).toBe('item-1')
      expect(result.itemName).toBe('Tomatoes')
      expect(result.avgDailyConsumption).toBeGreaterThan(0)
      expect(result.forecast).toHaveLength(14)
      expect(result.weekdayPattern).toHaveLength(7)
      expect(['low', 'medium', 'high', 'critical']).toContain(result.riskLevel)
      expect(result.suggestedOrderQuantity).toBeGreaterThanOrEqual(0)
    })

    it('should handle empty history', () => {
      const result = forecastItem({
        itemId: 'item-2',
        itemName: 'Lettuce',
        category: null,
        unitOfMeasure: 'units',
        currentQuantity: 10,
        parLevel: null,
        unitCost: 2,
        history: [],
        historyDays: 30,
        forecastDays: 7,
      })

      expect(result.avgDailyConsumption).toBe(0)
      expect(result.totalConsumption).toBe(0)
      expect(result.forecast).toHaveLength(7)
    })
  })
})
