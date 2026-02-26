import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Supplier Portal',
  description: 'Manage your orders, invoices, and product catalog',
}

export default function SupplierPortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background">
      {children}
    </div>
  )
}
