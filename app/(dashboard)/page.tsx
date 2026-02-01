'use client'

import { useAuth } from '@/hooks/useAuth'
import { OwnerDashboard } from '@/components/dashboard/OwnerDashboard'
import { DriverDashboard } from '@/components/dashboard/DriverDashboard'
import { StaffDashboard } from '@/components/dashboard/StaffDashboard'
import { Skeleton } from '@/components/ui/skeleton'

export default function DashboardPage() {
  const { role, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    )
  }

  // If role is not yet loaded but we're not in loading state,
  // default to Owner dashboard for authenticated users
  const effectiveRole = role || 'Owner'

  switch (effectiveRole) {
    case 'Owner':
    case 'Manager':
      return <OwnerDashboard />
    case 'Driver':
      return <DriverDashboard />
    case 'Staff':
      return <StaffDashboard />
    default:
      return <OwnerDashboard />
  }
}
