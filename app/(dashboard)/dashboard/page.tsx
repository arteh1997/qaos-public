import { redirect } from 'next/navigation'

/**
 * Dashboard Route Redirect
 *
 * This page exists for backward compatibility.
 * The main dashboard is now at / for authenticated users.
 */
export default function DashboardPage() {
  redirect('/')
}
