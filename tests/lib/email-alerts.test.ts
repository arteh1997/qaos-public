import { describe, it, expect } from 'vitest'
import {
  getLowStockAlertEmailHtml,
  getCriticalStockAlertEmailHtml,
  getMissingCountAlertEmailHtml,
} from '@/lib/email-alerts'

describe('Email Alert Templates', () => {
  describe('getLowStockAlertEmailHtml', () => {
    it('should generate low stock alert email with items', () => {
      const html = getLowStockAlertEmailHtml({
        storeName: 'Test Kitchen',
        items: [
          { item_name: 'Tomatoes', category: 'Produce', current_quantity: 3, par_level: 10, shortage: 7, unit_of_measure: 'kg' },
          { item_name: 'Olive Oil', category: 'Dry Goods', current_quantity: 1, par_level: 5, shortage: 4, unit_of_measure: 'L' },
        ],
        dashboardUrl: 'http://localhost:3000/stores/store-1',
        lowStockReportUrl: 'http://localhost:3000/reports/low-stock',
      })

      expect(html).toContain('Test Kitchen')
      expect(html).toContain('Tomatoes')
      expect(html).toContain('Olive Oil')
      expect(html).toContain('2 items below par level')
      expect(html).toContain('View Full Report')
      expect(html).toContain('Produce')
      expect(html).toContain('-7')
      expect(html).toContain('-4')
    })

    it('should truncate to 20 items and show more count', () => {
      const items = Array.from({ length: 25 }, (_, i) => ({
        item_name: `Item ${i + 1}`,
        category: 'Category',
        current_quantity: 1,
        par_level: 10,
        shortage: 9,
        unit_of_measure: 'ea',
      }))

      const html = getLowStockAlertEmailHtml({
        storeName: 'Test Store',
        items,
        dashboardUrl: 'http://localhost:3000',
        lowStockReportUrl: 'http://localhost:3000/reports/low-stock',
      })

      expect(html).toContain('Item 1')
      expect(html).toContain('Item 20')
      expect(html).not.toContain('Item 21')
      expect(html).toContain('5 more items')
    })

    it('should use singular form for 1 item', () => {
      const html = getLowStockAlertEmailHtml({
        storeName: 'Test Store',
        items: [{ item_name: 'Single Item', category: null, current_quantity: 1, par_level: 5, shortage: 4, unit_of_measure: 'ea' }],
        dashboardUrl: 'http://localhost:3000',
        lowStockReportUrl: 'http://localhost:3000/reports/low-stock',
      })

      expect(html).toContain('1 item below par level')
    })
  })

  describe('getCriticalStockAlertEmailHtml', () => {
    it('should generate critical stock alert email', () => {
      const html = getCriticalStockAlertEmailHtml({
        storeName: 'Test Kitchen',
        items: [
          { item_name: 'Milk', category: 'Dairy', current_quantity: 0, par_level: 5, shortage: 5, unit_of_measure: 'L' },
        ],
        dashboardUrl: 'http://localhost:3000/stores/store-1',
      })

      expect(html).toContain('Test Kitchen')
      expect(html).toContain('Milk')
      expect(html).toContain('CRITICAL')
      expect(html).toContain('completely out of stock')
      expect(html).toContain('0 L')
      expect(html).toContain('5 L')
    })

    it('should handle multiple critical items', () => {
      const html = getCriticalStockAlertEmailHtml({
        storeName: 'Store',
        items: [
          { item_name: 'Item A', category: null, current_quantity: 0, par_level: 10, shortage: 10, unit_of_measure: 'ea' },
          { item_name: 'Item B', category: null, current_quantity: 0, par_level: 5, shortage: 5, unit_of_measure: 'ea' },
        ],
        dashboardUrl: 'http://localhost:3000',
      })

      expect(html).toContain('2 items completely out of stock')
    })
  })

  describe('getMissingCountAlertEmailHtml', () => {
    it('should generate missing count alert email', () => {
      const html = getMissingCountAlertEmailHtml({
        storeName: 'Test Kitchen',
        date: '2026-02-09',
        dashboardUrl: 'http://localhost:3000/stores/store-1',
      })

      expect(html).toContain('Test Kitchen')
      expect(html).toContain('Missing Count')
      expect(html).toContain('February')
      expect(html).toContain('2026')
      expect(html).toContain('Submit Count Now')
    })
  })
})
