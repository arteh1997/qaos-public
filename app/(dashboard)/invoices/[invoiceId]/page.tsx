'use client'

import { use, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useInvoiceDetail, useUpdateInvoice, useApplyInvoice } from '@/hooks/useInvoices'
import { useStoreInventory } from '@/hooks/useStoreInventory'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { InvoiceLineItemTable } from '@/components/invoices/InvoiceLineItemTable'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  ArrowLeft, FileText, CheckCircle2, Clock, ScanLine, Eye,
  AlertCircle, Download, Loader2, PackageCheck, XCircle,
} from 'lucide-react'
import type { InvoiceStatus, InvoiceLineItem } from '@/types'

interface PageProps {
  params: Promise<{ invoiceId: string }>
}

const STATUS_CONFIG: Record<InvoiceStatus, { label: string; classes: string; icon: React.ComponentType<{ className?: string }> }> = {
  pending: { label: 'Pending', classes: 'bg-muted text-muted-foreground', icon: Clock },
  processing: { label: 'Processing OCR', classes: 'bg-blue-50 text-blue-700', icon: ScanLine },
  review: { label: 'Needs Review', classes: 'bg-amber-50 text-amber-700', icon: Eye },
  approved: { label: 'Approved', classes: 'bg-emerald-50 text-emerald-700', icon: CheckCircle2 },
  applied: { label: 'Applied to Inventory', classes: 'bg-emerald-50 text-emerald-700', icon: PackageCheck },
  rejected: { label: 'Rejected', classes: 'bg-destructive/10 text-destructive', icon: AlertCircle },
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function InvoiceDetailPage({ params }: PageProps) {
  const { invoiceId } = use(params)
  const router = useRouter()
  const { currentStore, role } = useAuth()
  const storeId = currentStore?.store_id

  const { invoice, isLoading, refetch } = useInvoiceDetail(storeId, invoiceId)
  const updateInvoice = useUpdateInvoice(storeId, invoiceId)
  const applyInvoice = useApplyInvoice(storeId, invoiceId)
  const { inventory } = useStoreInventory(storeId ?? null)

  const [showApplyDialog, setShowApplyDialog] = useState(false)
  const [showRejectDialog, setShowRejectDialog] = useState(false)
  const [applyNotes, setApplyNotes] = useState('')

  const inventoryOptions = useMemo(() =>
    inventory
      .filter(i => i.inventory_item)
      .map(i => ({
        id: i.inventory_item_id,
        name: i.inventory_item!.name,
        unit_of_measure: i.inventory_item!.unit_of_measure,
      })),
    [inventory]
  )

  if (role !== 'Owner' && role !== 'Manager') {
    return (
      <div className="space-y-6">
        <PageHeader title="Invoice" description="This feature is only available to Owners and Managers." />
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    )
  }

  if (!invoice) {
    return (
      <div className="space-y-6">
        <PageHeader title="Invoice Not Found" description="This invoice doesn't exist or you don't have access." />
        <Button variant="outline" onClick={() => router.push('/invoices')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Invoices
        </Button>
      </div>
    )
  }

  const config = STATUS_CONFIG[invoice.status as InvoiceStatus] ?? STATUS_CONFIG.pending
  const isEditable = ['review', 'approved'].includes(invoice.status)
  const canApply = ['review', 'approved'].includes(invoice.status)
  const lineItems: InvoiceLineItem[] = invoice.line_items ?? []
  const matchedCount = lineItems.filter(l => l.inventory_item_id).length
  const fileUrl = invoice.file_url

  const handleUpdateLineItem = (lineItemId: string, updates: Record<string, unknown>) => {
    const updatedLineItems = lineItems.map(li =>
      li.id === lineItemId ? { ...li, ...updates } : li
    )
    updateInvoice.mutate({
      line_items: updatedLineItems.map(li => ({
        id: li.id,
        description: li.description ?? undefined,
        quantity: li.quantity,
        unit_price: li.unit_price,
        total_price: li.total_price,
        unit_of_measure: li.unit_of_measure,
        inventory_item_id: li.inventory_item_id,
        match_status: li.match_status as 'unmatched' | 'auto_matched' | 'manually_matched' | 'skipped',
        sort_order: li.sort_order ?? undefined,
      })),
    }, { onSuccess: () => refetch() })
  }

  const handleApprove = () => {
    updateInvoice.mutate({ status: 'approved' }, { onSuccess: () => refetch() })
  }

  const handleReject = () => {
    updateInvoice.mutate({ status: 'rejected' }, {
      onSuccess: () => { setShowRejectDialog(false); refetch() },
    })
  }

  const handleApply = () => {
    applyInvoice.mutate(applyNotes || undefined, {
      onSuccess: () => {
        setShowApplyDialog(false)
        setApplyNotes('')
        refetch()
      },
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 mt-0.5" onClick={() => router.push('/invoices')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">
                {invoice.invoice_number || 'Invoice'}
              </h1>
              <Badge className={config.classes}>{config.label}</Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5 truncate">{invoice.file_name}</p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {invoice.status === 'review' && (
            <Button variant="outline" size="sm" onClick={handleApprove} disabled={updateInvoice.isPending}>
              <CheckCircle2 className="h-4 w-4 mr-1.5" />
              <span className="hidden sm:inline">Approve</span>
            </Button>
          )}
          {canApply && (
            <Button size="sm" onClick={() => setShowApplyDialog(true)} disabled={matchedCount === 0}>
              <PackageCheck className="h-4 w-4 mr-1.5" />
              <span className="hidden sm:inline">Apply to Inventory</span>
            </Button>
          )}
          {isEditable && (
            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setShowRejectDialog(true)}>
              <XCircle className="h-4 w-4 sm:mr-1.5" />
              <span className="hidden sm:inline">Reject</span>
            </Button>
          )}
        </div>
      </div>

      {/* Content: side-by-side on desktop, stacked on mobile */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: Invoice preview / metadata */}
        <div className="space-y-4">
          {/* Image/PDF preview */}
          {fileUrl && (
            <Card>
              <CardContent className="p-2">
                {invoice.file_type?.startsWith('image/') ? (
                  <img
                    src={fileUrl}
                    alt={`Invoice ${invoice.invoice_number || invoice.file_name}`}
                    className="w-full rounded border object-contain max-h-[600px]"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <FileText className="h-12 w-12 text-muted-foreground mb-3" />
                    <p className="text-sm font-medium">PDF Invoice</p>
                    <p className="text-xs text-muted-foreground mb-4">{invoice.file_name}</p>
                    <a href={fileUrl} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" size="sm">
                        <Download className="h-4 w-4 mr-1.5" />
                        View PDF
                      </Button>
                    </a>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Invoice metadata */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Invoice Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Invoice Number</p>
                  <p className="text-sm font-medium mt-0.5">{invoice.invoice_number || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Invoice Date</p>
                  <p className="text-sm font-medium mt-0.5">{formatDate(invoice.invoice_date)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Due Date</p>
                  <p className="text-sm font-medium mt-0.5">{formatDate(invoice.due_date)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Currency</p>
                  <p className="text-sm font-medium mt-0.5">{invoice.currency}</p>
                </div>
              </div>

              <div className="border-t pt-3 grid grid-cols-3 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Subtotal</p>
                  <p className="text-sm font-medium mt-0.5">
                    {invoice.subtotal != null ? `£${invoice.subtotal.toFixed(2)}` : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Tax</p>
                  <p className="text-sm font-medium mt-0.5">
                    {invoice.tax_amount != null ? `£${invoice.tax_amount.toFixed(2)}` : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="text-base font-semibold mt-0.5">
                    {invoice.total_amount != null ? `£${invoice.total_amount.toFixed(2)}` : '-'}
                  </p>
                </div>
              </div>

              {invoice.ocr_confidence != null && (
                <div className="border-t pt-3">
                  <p className="text-xs text-muted-foreground">OCR Confidence</p>
                  <p className="text-sm font-medium mt-0.5">{invoice.ocr_confidence.toFixed(0)}%</p>
                </div>
              )}

              {invoice.notes && (
                <div className="border-t pt-3">
                  <p className="text-xs text-muted-foreground">Notes</p>
                  <p className="text-sm mt-0.5">{invoice.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: Line items */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Line Items</CardTitle>
                {lineItems.length > 0 && (
                  <span className="text-sm text-muted-foreground">
                    {matchedCount}/{lineItems.length} matched
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {lineItems.length === 0 ? (
                <div className="text-center py-8">
                  {['pending', 'processing'].includes(invoice.status) ? (
                    <>
                      <Loader2 className="h-8 w-8 mx-auto text-muted-foreground animate-spin mb-3" />
                      <p className="text-sm font-medium">Processing invoice...</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        OCR is extracting line items. This usually takes a few seconds.
                      </p>
                    </>
                  ) : (
                    <>
                      <FileText className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
                      <p className="text-sm font-medium">No line items found</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        OCR could not extract any line items from this invoice.
                      </p>
                    </>
                  )}
                </div>
              ) : (
                <InvoiceLineItemTable
                  lineItems={lineItems}
                  inventoryItems={inventoryOptions}
                  editable={isEditable}
                  onUpdateLineItem={handleUpdateLineItem}
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Apply confirmation dialog */}
      <AlertDialog open={showApplyDialog} onOpenChange={setShowApplyDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apply Invoice to Inventory</AlertDialogTitle>
            <AlertDialogDescription>
              This will update inventory quantities for {matchedCount} matched item{matchedCount !== 1 ? 's' : ''}.
              Unmatched and skipped items will be ignored. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <label className="text-sm font-medium">Notes (optional)</label>
            <Textarea
              placeholder="Any notes about this stock reception..."
              value={applyNotes}
              onChange={(e) => setApplyNotes(e.target.value)}
              className="mt-1.5"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleApply} disabled={applyInvoice.isPending}>
              {applyInvoice.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Applying...
                </>
              ) : (
                <>
                  <PackageCheck className="h-4 w-4 mr-2" />
                  Apply to Inventory
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject confirmation dialog */}
      <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Invoice</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to reject this invoice? You can re-review it later if needed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReject}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={updateInvoice.isPending}
            >
              Reject
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
