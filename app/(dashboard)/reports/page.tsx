'use client'

import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FileText, AlertTriangle, ArrowRight, BarChart3, Brain } from 'lucide-react'

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Reports</h1>
        <p className="text-sm text-muted-foreground">
          View inventory reports and analytics
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Link href="/reports/benchmark">
          <Card className="hover:bg-accent transition-colors cursor-pointer h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-blue-500" />
                Store Benchmarking
              </CardTitle>
              <CardDescription>
                Compare performance across all your stores
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Side-by-side store comparison</li>
                <li>• Health scores and rankings</li>
                <li>• Activity trends and KPIs</li>
              </ul>
              <Button variant="ghost" className="mt-4 p-0">
                View Report
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </Link>

        <Link href="/reports/daily-summary">
          <Card className="hover:bg-accent transition-colors cursor-pointer h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Daily Summary
              </CardTitle>
              <CardDescription>
                View all stock changes for a specific date
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Stock counts and receptions</li>
                <li>• Who performed each action</li>
                <li>• Filter by store and date</li>
              </ul>
              <Button variant="ghost" className="mt-4 p-0">
                View Report
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </Link>

        <Link href="/reports/forecast">
          <Card className="hover:bg-accent transition-colors cursor-pointer h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-purple-500" />
                AI Demand Forecast
              </CardTitle>
              <CardDescription>
                Predict future consumption and prevent stockouts
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Consumption trend analysis</li>
                <li>• Day-of-week patterns</li>
                <li>• Stockout predictions and order suggestions</li>
              </ul>
              <Button variant="ghost" className="mt-4 p-0">
                View Forecast
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </Link>

        <Link href="/reports/low-stock">
          <Card className="hover:bg-accent transition-colors cursor-pointer h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
                Low Stock Report
              </CardTitle>
              <CardDescription>
                Items below their PAR level across all stores
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Sorted by severity</li>
                <li>• Filter by store</li>
                <li>• Shows shortage amounts</li>
              </ul>
              <Button variant="ghost" className="mt-4 p-0">
                View Report
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  )
}
