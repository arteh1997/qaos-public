'use client'

import { useReportWebVitals } from 'next/web-vitals'

export function WebVitals() {
  useReportWebVitals((metric) => {
    // Send to analytics endpoint or console in dev
    if (process.env.NODE_ENV === 'development') {
      console.log(metric.name, Math.round(metric.value), 'ms')
    }

    // Send to Vercel Analytics (auto-captured by @vercel/speed-insights)
    // Additional custom reporting can be added here
  })

  return null
}
