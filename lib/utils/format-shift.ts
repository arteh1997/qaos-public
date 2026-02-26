/**
 * Utility for formatting shift times for email notifications
 */

export function formatShiftDate(isoDate: string): { date: string; dayOfWeek: string } {
  const d = new Date(isoDate)
  const dayOfWeek = d.toLocaleDateString('en-GB', { weekday: 'long' })
  const date = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  return { date, dayOfWeek }
}

export function formatShiftTime(isoDate: string): string {
  return new Date(isoDate).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

export function calculateDuration(startIso: string, endIso: string): string {
  const diffMs = new Date(endIso).getTime() - new Date(startIso).getTime()
  const hours = Math.floor(diffMs / (1000 * 60 * 60))
  const minutes = Math.round((diffMs % (1000 * 60 * 60)) / (1000 * 60))
  if (minutes === 0) return `${hours} hours`
  return `${hours}h ${minutes}m`
}
