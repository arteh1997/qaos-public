'use client'

import { useState, use } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Label } from '@/components/ui/label'
import {
  AlertCircle,
  Download,
  CreditCard,
  CalendarDays,
  Loader2,
  FileSpreadsheet,
  Store,
  Users,
  Package,
  Clock,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/useAuth'
import { BILLING_CONFIG, getMonthlyPriceDisplay } from '@/lib/stripe/billing-config'
import Link from 'next/link'

interface PageProps {
  params: Promise<{ storeId: string }>
}

export default function SubscriptionExpiredPage({ params }: PageProps) {
  const { storeId } = use(params)
  const { stores } = useAuth()
  const [isExporting, setIsExporting] = useState(false)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const store = stores?.find(s => s.store_id === storeId)
  const monthlyPrice = getMonthlyPriceDisplay()

  const handleExport = async (useRange: boolean) => {
    setIsExporting(true)

    try {
      let url = `/api/stores/${storeId}/export`
      if (useRange && startDate && endDate) {
        url += `?start_date=${startDate}&end_date=${endDate}`
      }

      const response = await fetch(url)

      if (!response.ok) {
        throw new Error('Failed to export data')
      }

      // Get the filename from the response headers
      const contentDisposition = response.headers.get('Content-Disposition')
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/)
      const filename = filenameMatch ? filenameMatch[1] : `store_export_${new Date().toISOString().split('T')[0]}.xlsx`

      // Download the file
      const blob = await response.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(downloadUrl)

      toast.success('Data exported successfully')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to export data')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
      <div className="max-w-2xl w-full space-y-6">
        {/* Main Message */}
        <Card className="border-destructive/50">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
            <CardTitle className="text-2xl">Subscription Expired</CardTitle>
            <CardDescription className="text-base">
              Your subscription for <span className="font-semibold">{store?.store?.name || 'this store'}</span> has expired
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              Your data is safe and will be preserved. Reactivate your subscription anytime to continue managing your store.
            </p>

            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link href={`/billing/subscribe/${storeId}`}>
                <CreditCard className="mr-2 h-4 w-4" />
                Reactivate Subscription - {monthlyPrice}/month
              </Link>
            </Button>

            <p className="text-sm text-muted-foreground">
              Start with a {BILLING_CONFIG.TRIAL_DAYS}-day free trial if you haven&apos;t had one
            </p>
          </CardContent>
        </Card>

        {/* Data Export Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Download Your Data
            </CardTitle>
            <CardDescription>
              Export your store records for legal, tax, or personal use
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* What's included */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>Shift records & clock times</span>
              </div>
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-muted-foreground" />
                <span>Stock history & counts</span>
              </div>
              <div className="flex items-center gap-2">
                <Store className="h-4 w-4 text-muted-foreground" />
                <span>Inventory items</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span>User records</span>
              </div>
            </div>

            {/* Export All */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => handleExport(false)}
                disabled={isExporting}
              >
                {isExporting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                )}
                Export All Data
              </Button>
            </div>

            {/* Date Range Export */}
            <div className="border-t pt-4">
              <p className="text-sm font-medium mb-3">Or export a specific date range:</p>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="space-y-1">
                  <Label className="text-xs">Start Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className={`w-full justify-start text-left font-normal ${!startDate ? 'text-muted-foreground' : ''}`}
                      >
                        <CalendarDays className="mr-2 h-4 w-4" />
                        {startDate ? format(parseISO(startDate), 'MMM d, yyyy') : 'Pick date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={startDate ? parseISO(startDate) : undefined}
                        onSelect={(date) => date && setStartDate(format(date, 'yyyy-MM-dd'))}
                        weekStartsOn={1}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">End Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className={`w-full justify-start text-left font-normal ${!endDate ? 'text-muted-foreground' : ''}`}
                      >
                        <CalendarDays className="mr-2 h-4 w-4" />
                        {endDate ? format(parseISO(endDate), 'MMM d, yyyy') : 'Pick date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={endDate ? parseISO(endDate) : undefined}
                        onSelect={(date) => date && setEndDate(format(date, 'yyyy-MM-dd'))}
                        weekStartsOn={1}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => handleExport(true)}
                disabled={isExporting || !startDate || !endDate}
              >
                {isExporting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CalendarDays className="mr-2 h-4 w-4" />
                )}
                Export Date Range
              </Button>
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Your data is exported as an Excel file with separate sheets for shifts, stock history, inventory, and users.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {/* Back to Dashboard */}
        <div className="text-center">
          <Button variant="ghost" asChild>
            <Link href="/">
              Back to Dashboard
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
