import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  toCSV,
  formatDateForExport,
  formatDateTimeForExport,
  generateExportFilename,
  ExportColumn,
} from '@/lib/export'

describe('Export Utilities', () => {
  describe('toCSV', () => {
    it('should return only headers when data is empty', () => {
      const columns: ExportColumn[] = [
        { key: 'name', header: 'Name' },
        { key: 'email', header: 'Email' },
      ]

      const result = toCSV([], columns)

      expect(result).toBe('"Name","Email"')
    })

    it('should convert simple data to CSV', () => {
      const data = [
        { name: 'John', email: 'john@example.com' },
        { name: 'Jane', email: 'jane@example.com' },
      ]

      const columns: ExportColumn[] = [
        { key: 'name', header: 'Name' },
        { key: 'email', header: 'Email' },
      ]

      const result = toCSV(data, columns)

      const lines = result.split('\n')
      expect(lines).toHaveLength(3)
      expect(lines[0]).toBe('"Name","Email"')
      expect(lines[1]).toBe('"John","john@example.com"')
      expect(lines[2]).toBe('"Jane","jane@example.com"')
    })

    it('should handle nested keys', () => {
      const data = [
        { user: { name: 'John' }, email: 'john@example.com' },
        { user: { name: 'Jane' }, email: 'jane@example.com' },
      ]

      const columns: ExportColumn[] = [
        { key: 'user.name', header: 'User Name' },
        { key: 'email', header: 'Email' },
      ]

      const result = toCSV(data, columns)

      const lines = result.split('\n')
      expect(lines[1]).toBe('"John","john@example.com"')
    })

    it('should apply transform functions', () => {
      const data = [
        { name: 'john', active: true },
        { name: 'jane', active: false },
      ]

      const columns: ExportColumn[] = [
        { key: 'name', header: 'Name', transform: (v) => String(v).toUpperCase() },
        { key: 'active', header: 'Active' },
      ]

      const result = toCSV(data, columns)

      const lines = result.split('\n')
      expect(lines[1]).toBe('"JOHN",Yes')
      expect(lines[2]).toBe('"JANE",No')
    })

    it('should escape quotes in values', () => {
      const data = [
        { name: 'John "Johnny" Doe', email: 'john@example.com' },
      ]

      const columns: ExportColumn[] = [
        { key: 'name', header: 'Name' },
        { key: 'email', header: 'Email' },
      ]

      const result = toCSV(data, columns)

      const lines = result.split('\n')
      expect(lines[1]).toBe('"John ""Johnny"" Doe","john@example.com"')
    })

    it('should handle null and undefined values', () => {
      const data = [
        { name: null, email: undefined },
      ]

      const columns: ExportColumn[] = [
        { key: 'name', header: 'Name' },
        { key: 'email', header: 'Email' },
      ]

      const result = toCSV(data, columns)

      const lines = result.split('\n')
      expect(lines[1]).toBe(',')
    })

    it('should handle number values', () => {
      const data = [
        { name: 'John', count: 42 },
      ]

      const columns: ExportColumn[] = [
        { key: 'name', header: 'Name' },
        { key: 'count', header: 'Count' },
      ]

      const result = toCSV(data, columns)

      const lines = result.split('\n')
      expect(lines[1]).toBe('"John",42')
    })

    it('should handle boolean values', () => {
      const data = [
        { name: 'John', active: true },
        { name: 'Jane', active: false },
      ]

      const columns: ExportColumn[] = [
        { key: 'name', header: 'Name' },
        { key: 'active', header: 'Active' },
      ]

      const result = toCSV(data, columns)

      const lines = result.split('\n')
      expect(lines[1]).toBe('"John",Yes')
      expect(lines[2]).toBe('"Jane",No')
    })

    it('should handle Date values', () => {
      const date = new Date('2025-01-15T10:30:00.000Z')
      const data = [
        { name: 'John', created: date },
      ]

      const columns: ExportColumn[] = [
        { key: 'name', header: 'Name' },
        { key: 'created', header: 'Created' },
      ]

      const result = toCSV(data, columns)

      const lines = result.split('\n')
      expect(lines[1]).toContain('"John"')
      expect(lines[1]).toContain('2025-01-15T10:30:00.000Z')
    })

    it('should handle missing nested keys gracefully', () => {
      const data = [
        { user: null },
      ]

      const columns: ExportColumn[] = [
        { key: 'user.name', header: 'User Name' },
      ]

      const result = toCSV(data, columns)

      const lines = result.split('\n')
      expect(lines[1]).toBe('')
    })

    it('should escape quotes in header names', () => {
      const columns: ExportColumn[] = [
        { key: 'name', header: 'User "Name"' },
      ]

      // With data, headers are escaped
      const result = toCSV([{ name: 'Test' }], columns)
      const lines = result.split('\n')
      expect(lines[0]).toBe('"User ""Name"""')
    })
  })

  describe('formatDateForExport', () => {
    it('should format Date object to YYYY-MM-DD', () => {
      const date = new Date('2025-01-15T10:30:00.000Z')
      const result = formatDateForExport(date)
      expect(result).toBe('2025-01-15')
    })

    it('should format date string to YYYY-MM-DD', () => {
      const result = formatDateForExport('2025-01-15T10:30:00.000Z')
      expect(result).toBe('2025-01-15')
    })

    it('should return empty string for null', () => {
      const result = formatDateForExport(null)
      expect(result).toBe('')
    })

    it('should return empty string for undefined', () => {
      const result = formatDateForExport(undefined)
      expect(result).toBe('')
    })
  })

  describe('formatDateTimeForExport', () => {
    it('should format Date object to YYYY-MM-DD HH:MM', () => {
      const date = new Date('2025-01-15T10:30:00.000Z')
      const result = formatDateTimeForExport(date)
      expect(result).toBe('2025-01-15 10:30')
    })

    it('should format date string to YYYY-MM-DD HH:MM', () => {
      const result = formatDateTimeForExport('2025-01-15T10:30:00.000Z')
      expect(result).toBe('2025-01-15 10:30')
    })

    it('should return empty string for null', () => {
      const result = formatDateTimeForExport(null)
      expect(result).toBe('')
    })

    it('should return empty string for undefined', () => {
      const result = formatDateTimeForExport(undefined)
      expect(result).toBe('')
    })
  })

  describe('generateExportFilename', () => {
    it('should generate filename with current date', () => {
      const result = generateExportFilename('inventory')

      // Should match pattern: inventory_YYYY-MM-DD
      expect(result).toMatch(/^inventory_\d{4}-\d{2}-\d{2}$/)
    })

    it('should include the prefix', () => {
      const result = generateExportFilename('stock-report')

      expect(result).toContain('stock-report_')
    })

    it('should use current date', () => {
      const today = new Date().toISOString().split('T')[0]
      const result = generateExportFilename('test')

      expect(result).toBe(`test_${today}`)
    })
  })
})

// Note: downloadCSV and exportToCSV use browser APIs (document, Blob, URL)
// and would require a jsdom environment to test properly.
// In a real test environment with jsdom, we would test these as well.
