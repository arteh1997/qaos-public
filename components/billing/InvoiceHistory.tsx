'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Download, Receipt } from 'lucide-react'
import { format } from 'date-fns'
import { Invoice } from '@/types/billing'
import { formatPrice } from '@/lib/stripe/billing-config'

const STATUS_STYLES: Record<string, string> = {
  paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  open: 'bg-blue-50 text-blue-700 border-blue-200',
  draft: 'bg-muted/50 text-muted-foreground border-muted',
  void: 'bg-muted/50 text-muted-foreground border-muted',
  uncollectible: 'bg-destructive/5 text-destructive/70 border-red-200',
}

interface InvoiceHistoryProps {
  invoices: Invoice[]
  isLoading: boolean
}

export function InvoiceHistory({ invoices, isLoading }: InvoiceHistoryProps) {
  return (
    <Card>
      <CardContent className="px-4 pt-4 pb-4 sm:px-6 sm:pt-5 sm:pb-5">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Invoice History
        </h3>

        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
        ) : invoices.length === 0 ? (
          <div className="text-center py-8">
            <Receipt className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">No invoices yet</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Invoices will appear here once your first payment is processed
            </p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden sm:block border rounded-md overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Date</TableHead>
                    <TableHead className="text-xs">Store</TableHead>
                    <TableHead className="text-xs">Amount</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs text-right">Invoice</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map(invoice => (
                    <TableRow key={invoice.id}>
                      <TableCell className="text-sm tabular-nums">
                        {format(new Date(invoice.date), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell className="text-sm">
                        {invoice.store_name || '—'}
                      </TableCell>
                      <TableCell className="text-sm font-medium tabular-nums">
                        {formatPrice(invoice.amount_paid || invoice.amount_due)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`${STATUS_STYLES[invoice.status] || STATUS_STYLES.draft} border text-[10px] px-1.5 py-0`}
                        >
                          {invoice.status === 'paid' ? 'Paid' :
                           invoice.status === 'open' ? 'Open' :
                           invoice.status === 'void' ? 'Void' :
                           invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {invoice.invoice_pdf && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7"
                            asChild
                          >
                            <a href={invoice.invoice_pdf} target="_blank" rel="noopener noreferrer">
                              <Download className="h-3.5 w-3.5" />
                            </a>
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile card list */}
            <div className="sm:hidden space-y-2">
              {invoices.map(invoice => (
                <div key={invoice.id} className="rounded-md border px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium tabular-nums">
                        {formatPrice(invoice.amount_paid || invoice.amount_due)}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {format(new Date(invoice.date), 'MMM d, yyyy')}
                        {invoice.store_name && ` · ${invoice.store_name}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge
                        variant="outline"
                        className={`${STATUS_STYLES[invoice.status] || STATUS_STYLES.draft} border text-[10px] px-1.5 py-0`}
                      >
                        {invoice.status === 'paid' ? 'Paid' : invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                      </Badge>
                      {invoice.invoice_pdf && (
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" asChild>
                          <a href={invoice.invoice_pdf} target="_blank" rel="noopener noreferrer">
                            <Download className="h-3.5 w-3.5" />
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
