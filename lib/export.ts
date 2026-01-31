/**
 * Data export utilities for CSV generation and download
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface ExportColumn<T = any> {
  key: keyof T | string
  header: string
  transform?: (value: unknown, row: T) => string | number
}

/**
 * Convert data array to CSV string
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toCSV<T extends object = any>(
  data: T[],
  columns: ExportColumn<T>[]
): string {
  if (data.length === 0) {
    return columns.map(col => `"${col.header}"`).join(',')
  }

  // Header row
  const headerRow = columns.map(col => `"${escapeCSV(col.header)}"`).join(',')

  // Data rows
  const dataRows = data.map(row => {
    return columns.map(col => {
      let value: unknown

      // Handle nested keys like "store.name"
      if (typeof col.key === 'string' && col.key.includes('.')) {
        const keys = col.key.split('.')
        value = keys.reduce((obj: unknown, key) => {
          if (obj && typeof obj === 'object' && key in obj) {
            return (obj as Record<string, unknown>)[key]
          }
          return undefined
        }, row)
      } else {
        value = (row as Record<string, unknown>)[col.key as string]
      }

      // Apply transform if provided
      if (col.transform) {
        value = col.transform(value, row)
      }

      // Format the value for CSV
      return formatCSVValue(value)
    }).join(',')
  })

  return [headerRow, ...dataRows].join('\n')
}

/**
 * Escape special characters in CSV values
 */
function escapeCSV(value: string): string {
  return value.replace(/"/g, '""')
}

/**
 * Format a value for CSV output
 */
function formatCSVValue(value: unknown): string {
  if (value === null || value === undefined) {
    return ''
  }

  if (typeof value === 'number') {
    return String(value)
  }

  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No'
  }

  if (value instanceof Date) {
    return `"${value.toISOString()}"`
  }

  // String values need quotes and escaping
  const stringValue = String(value)
  return `"${escapeCSV(stringValue)}"`
}

/**
 * Download a CSV file
 */
export function downloadCSV(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.setAttribute('href', url)
  link.setAttribute('download', `${filename}.csv`)
  link.style.visibility = 'hidden'

  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  URL.revokeObjectURL(url)
}

/**
 * Export data to CSV and trigger download
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function exportToCSV<T extends object = any>(
  data: T[],
  columns: ExportColumn<T>[],
  filename: string
): void {
  const csv = toCSV(data, columns)
  downloadCSV(csv, filename)
}

/**
 * Format a date for export (YYYY-MM-DD)
 */
export function formatDateForExport(date: Date | string | null | undefined): string {
  if (!date) return ''
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toISOString().split('T')[0]
}

/**
 * Format a datetime for export (YYYY-MM-DD HH:MM)
 */
export function formatDateTimeForExport(date: Date | string | null | undefined): string {
  if (!date) return ''
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toISOString().replace('T', ' ').slice(0, 16)
}

/**
 * Generate a filename with current date
 */
export function generateExportFilename(prefix: string): string {
  const date = new Date().toISOString().split('T')[0]
  return `${prefix}_${date}`
}
