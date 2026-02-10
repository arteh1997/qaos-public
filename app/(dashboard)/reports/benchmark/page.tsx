'use client'

import { useState, useMemo } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useBenchmark } from '@/hooks/useBenchmark'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { StoreComparisonChart, StoreActivityTrendChart } from '@/components/charts/StoreComparisonChart'
import {
  BarChart3,
  TrendingUp,
  Trophy,
  Activity,
  Package,
  ClipboardCheck,
  Heart,
  DollarSign,
  Trash2,
  ArrowLeft,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default function BenchmarkPage() {
  const { stores, role } = useAuth()
  const [days, setDays] = useState<string>('30')

  // Only Owners with multiple stores should see this
  const accessibleStores = useMemo(() => {
    return stores?.filter(s => s.store?.is_active) ?? []
  }, [stores])

  const storeIds = useMemo(() => {
    return accessibleStores.map(s => s.store_id)
  }, [accessibleStores])

  const { data, isLoading, error } = useBenchmark(storeIds, parseInt(days))

  if (role !== 'Owner' && role !== 'Manager') {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Store Benchmarking</h1>
        <p className="text-muted-foreground">Only Owners and Managers can access benchmarking analytics.</p>
      </div>
    )
  }

  if (accessibleStores.length < 2) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/reports">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Store Benchmarking</h1>
            <p className="text-sm text-muted-foreground">Compare performance across your stores</p>
          </div>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <h3 className="text-lg font-medium mb-1">Multi-store comparison requires 2+ stores</h3>
              <p className="text-sm text-muted-foreground">
                Add more stores to your account to unlock benchmarking analytics.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/reports">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Store Benchmarking</h1>
            <p className="text-sm text-muted-foreground">
              Compare performance across {accessibleStores.length} stores
            </p>
          </div>
        </div>
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="14">Last 14 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="60">Last 60 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-red-600">Failed to load benchmark data: {error.message}</p>
          </CardContent>
        </Card>
      )}

      {/* Data loaded */}
      {data && (
        <>
          {/* KPI Summary Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Avg Health Score</CardTitle>
                <Heart className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.averages.healthScore}%</div>
                <p className="text-xs text-muted-foreground">
                  Across {data.stores.length} stores
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Avg Count Completion</CardTitle>
                <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.averages.countCompletionRate}%</div>
                <p className="text-xs text-muted-foreground">
                  Daily count consistency
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Avg Daily Activity</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.averages.avgDailyActivity}</div>
                <p className="text-xs text-muted-foreground">
                  Stock changes/day
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Avg Inventory Value</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ${data.averages.totalValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </div>
                <p className="text-xs text-muted-foreground">
                  Per store average
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Rankings Table */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Trophy className="h-4 w-4" />
                Store Rankings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 pr-4 font-medium">Store</th>
                      <th className="text-center py-2 px-3 font-medium">
                        <div className="flex flex-col items-center">
                          <Heart className="h-3.5 w-3.5 mb-0.5" />
                          <span>Health</span>
                        </div>
                      </th>
                      <th className="text-center py-2 px-3 font-medium">
                        <div className="flex flex-col items-center">
                          <ClipboardCheck className="h-3.5 w-3.5 mb-0.5" />
                          <span>Counts</span>
                        </div>
                      </th>
                      <th className="text-center py-2 px-3 font-medium">
                        <div className="flex flex-col items-center">
                          <Activity className="h-3.5 w-3.5 mb-0.5" />
                          <span>Activity</span>
                        </div>
                      </th>
                      <th className="text-center py-2 px-3 font-medium">
                        <div className="flex flex-col items-center">
                          <Package className="h-3.5 w-3.5 mb-0.5" />
                          <span>Items</span>
                        </div>
                      </th>
                      <th className="text-center py-2 px-3 font-medium">
                        <div className="flex flex-col items-center">
                          <Trash2 className="h-3.5 w-3.5 mb-0.5" />
                          <span>Waste</span>
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.stores.map((store) => {
                      const healthRank = data.rankings.healthScore.find(r => r.storeId === store.storeId)
                      const countRank = data.rankings.countCompletion.find(r => r.storeId === store.storeId)
                      const activityRank = data.rankings.activity.find(r => r.storeId === store.storeId)

                      return (
                        <tr key={store.storeId} className="border-b last:border-0">
                          <td className="py-2.5 pr-4">
                            <span className="font-medium">{store.storeName}</span>
                          </td>
                          <td className="text-center py-2.5 px-3">
                            <div className="flex flex-col items-center">
                              <RankBadge rank={healthRank?.rank ?? 0} total={data.stores.length} />
                              <span className="text-xs text-muted-foreground mt-0.5">{store.inventoryHealth.healthScore}%</span>
                            </div>
                          </td>
                          <td className="text-center py-2.5 px-3">
                            <div className="flex flex-col items-center">
                              <RankBadge rank={countRank?.rank ?? 0} total={data.stores.length} />
                              <span className="text-xs text-muted-foreground mt-0.5">{store.countCompletionRate}%</span>
                            </div>
                          </td>
                          <td className="text-center py-2.5 px-3">
                            <div className="flex flex-col items-center">
                              <RankBadge rank={activityRank?.rank ?? 0} total={data.stores.length} />
                              <span className="text-xs text-muted-foreground mt-0.5">{store.activity.totalActivity}</span>
                            </div>
                          </td>
                          <td className="text-center py-2.5 px-3">
                            <span className="text-sm">{store.inventoryHealth.totalItems}</span>
                          </td>
                          <td className="text-center py-2.5 px-3">
                            <span className="text-sm">{store.waste.totalUnits}</span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Comparison Charts */}
          <div className="grid gap-4 md:grid-cols-2">
            <StoreComparisonChart
              stores={data.stores}
              metric="healthScore"
              title="Inventory Health Score"
              unit="%"
              color="#16a34a"
            />
            <StoreComparisonChart
              stores={data.stores}
              metric="countCompletionRate"
              title="Count Completion Rate"
              unit="%"
              color="#2563eb"
            />
            <StoreComparisonChart
              stores={data.stores}
              metric="totalActivity"
              title="Total Stock Activity"
              color="#303030"
            />
            <StoreComparisonChart
              stores={data.stores}
              metric="totalValue"
              title="Inventory Value"
              unit=""
              color="#ea580c"
            />
          </div>

          {/* Activity Trend */}
          <StoreActivityTrendChart stores={data.stores} />

          {/* Per-Store Detail Cards */}
          <div>
            <h2 className="text-lg font-semibold mb-3">Store Details</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {data.stores.map((store) => (
                <Card key={store.storeId}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">{store.storeName}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">Health Score</p>
                        <p className="font-medium">{store.inventoryHealth.healthScore}%</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Count Rate</p>
                        <p className="font-medium">{store.countCompletionRate}%</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Items</p>
                        <p className="font-medium">{store.inventoryHealth.totalItems}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Out of Stock</p>
                        <p className={`font-medium ${store.inventoryHealth.outOfStock > 0 ? 'text-red-600' : ''}`}>
                          {store.inventoryHealth.outOfStock}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Low Stock</p>
                        <p className={`font-medium ${store.inventoryHealth.lowStock > 0 ? 'text-amber-600' : ''}`}>
                          {store.inventoryHealth.lowStock}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Total Units</p>
                        <p className="font-medium">{store.inventory.totalUnits.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Inventory Value</p>
                        <p className="font-medium">
                          ${store.inventory.totalValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Waste</p>
                        <p className={`font-medium ${store.waste.totalUnits > 0 ? 'text-red-600' : ''}`}>
                          {store.waste.totalUnits} units
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function RankBadge({ rank, total }: { rank: number; total: number }) {
  if (rank === 0) return null

  // Top performer
  if (rank === 1 && total > 1) {
    return (
      <Badge className="bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800 text-[10px] px-1.5">
        #{rank}
      </Badge>
    )
  }

  // Bottom performer
  if (rank === total && total > 1) {
    return (
      <Badge variant="outline" className="text-[10px] px-1.5 text-muted-foreground">
        #{rank}
      </Badge>
    )
  }

  return (
    <Badge variant="secondary" className="text-[10px] px-1.5">
      #{rank}
    </Badge>
  )
}
