"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useInvoices } from "@/hooks/useInvoices";
import { PageHeader } from "@/components/ui/page-header";
import { PageGuide } from "@/components/help/PageGuide";
import { StatsCard } from "@/components/cards/StatsCard";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { InvoiceUploadForm } from "@/components/invoices/InvoiceUploadForm";
import {
  FileText,
  Upload,
  Clock,
  CheckCircle2,
  Eye,
  ScanLine,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useRouter } from "next/navigation";
import type { InvoiceStatus } from "@/types";

const STATUS_CONFIG: Record<
  InvoiceStatus,
  {
    label: string;
    classes: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  pending: {
    label: "Pending",
    classes: "bg-muted text-muted-foreground",
    icon: Clock,
  },
  processing: {
    label: "Processing",
    classes: "bg-blue-500/10 text-blue-400",
    icon: ScanLine,
  },
  review: {
    label: "Needs Review",
    classes: "bg-amber-500/10 text-amber-400",
    icon: Eye,
  },
  approved: {
    label: "Approved",
    classes: "bg-emerald-500/10 text-emerald-400",
    icon: CheckCircle2,
  },
  applied: {
    label: "Applied",
    classes: "bg-emerald-500/10 text-emerald-400",
    icon: CheckCircle2,
  },
  rejected: {
    label: "Rejected",
    classes: "bg-destructive/10 text-destructive",
    icon: AlertCircle,
  },
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatRelativeDate(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return formatDate(dateStr);
}

export default function InvoicesPage() {
  const { currentStore, role } = useAuth();
  const storeId = currentStore?.store_id;
  const router = useRouter();

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [showUpload, setShowUpload] = useState(false);

  const { invoices, pagination, isLoading, refetch } = useInvoices({
    storeId,
    status: statusFilter !== "all" ? statusFilter : undefined,
    page,
    pageSize: 20,
  });

  if (role !== "Owner" && role !== "Manager") {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Invoices"
          description="This feature is only available to Owners and Managers."
        >
          <PageGuide pageKey="invoices" />
        </PageHeader>
      </div>
    );
  }

  if (!storeId) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Invoices"
          description="Select a store to manage invoices."
        >
          <PageGuide pageKey="invoices" />
        </PageHeader>
      </div>
    );
  }

  // Compute stats from current page (in a real app these would come from a summary endpoint)
  const needsReview = invoices.filter((i) => i.status === "review").length;
  const processing = invoices.filter((i) =>
    ["pending", "processing"].includes(i.status),
  ).length;
  const applied = invoices.filter((i) => i.status === "applied").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoices"
        description="Upload supplier invoices, extract line items with OCR, and apply to inventory"
      >
        <Button onClick={() => setShowUpload(true)}>
          <Upload className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">Upload Invoice</span>
        </Button>
        <PageGuide pageKey="invoices" />
      </PageHeader>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        <StatsCard
          title="Total Invoices"
          value={pagination?.totalItems ?? invoices.length}
          description="All time"
          icon={<FileText className="h-4 w-4" />}
        />
        <StatsCard
          title="Processing"
          value={processing}
          description={processing > 0 ? "OCR in progress" : "None queued"}
          icon={<ScanLine className="h-4 w-4" />}
        />
        <StatsCard
          title="Needs Review"
          value={needsReview}
          description={needsReview > 0 ? "Ready to check" : "All reviewed"}
          icon={<Eye className="h-4 w-4" />}
          variant={needsReview > 0 ? "warning" : "default"}
        />
        <StatsCard
          title="Applied"
          value={applied}
          description="Added to inventory"
          icon={<CheckCircle2 className="h-4 w-4" />}
        />
      </div>

      {/* Filter bar */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Select
            value={statusFilter}
            onValueChange={(v) => {
              setStatusFilter(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-40 sm:w-48">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="review">Needs Review</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="applied">Applied</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
          <span className="hidden sm:inline text-sm text-muted-foreground">
            {pagination?.totalItems ?? invoices.length} invoice
            {(pagination?.totalItems ?? invoices.length) !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Invoice list */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : invoices.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No invoices yet"
          description={
            statusFilter !== "all"
              ? `No invoices with status "${STATUS_CONFIG[statusFilter as InvoiceStatus]?.label ?? statusFilter}".`
              : "Upload your first supplier invoice to start extracting line items automatically."
          }
          action={
            statusFilter === "all"
              ? {
                  label: "Upload Invoice",
                  onClick: () => setShowUpload(true),
                  icon: Upload,
                }
              : undefined
          }
        />
      ) : (
        <>
          {/* Mobile card view */}
          <div className="sm:hidden space-y-2">
            {invoices.map((invoice) => {
              const config =
                STATUS_CONFIG[invoice.status as InvoiceStatus] ??
                STATUS_CONFIG.pending;
              return (
                <div
                  key={invoice.id}
                  className="border rounded-lg p-3 space-y-2 cursor-pointer active:bg-muted/50 transition-colors"
                  onClick={() => router.push(`/invoices/${invoice.id}`)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">
                        {invoice.invoice_number || invoice.file_name}
                      </p>
                      {invoice.supplier_id && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          Supplier ID: {invoice.supplier_id.slice(0, 8)}...
                        </p>
                      )}
                    </div>
                    <Badge className={config.classes}>{config.label}</Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground text-xs">
                      {formatRelativeDate(invoice.created_at)}
                    </span>
                    {invoice.total_amount != null && (
                      <span className="font-semibold">
                        £{invoice.total_amount.toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop table */}
          <Card className="hidden sm:block rounded-lg border shadow-sm overflow-hidden">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice</TableHead>
                    <TableHead className="hidden md:table-cell">Date</TableHead>
                    <TableHead className="hidden lg:table-cell">
                      Supplier
                    </TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden md:table-cell">
                      Uploaded
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((invoice) => {
                    const config =
                      STATUS_CONFIG[invoice.status as InvoiceStatus] ??
                      STATUS_CONFIG.pending;
                    return (
                      <TableRow
                        key={invoice.id}
                        className="cursor-pointer hover:bg-muted/30 transition-colors"
                        onClick={() => router.push(`/invoices/${invoice.id}`)}
                      >
                        <TableCell>
                          <div>
                            <p className="font-medium">
                              {invoice.invoice_number || "No number"}
                            </p>
                            <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                              {invoice.file_name}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {formatDate(invoice.invoice_date)}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {invoice.supplier_id
                            ? invoice.supplier_id.slice(0, 8) + "..."
                            : "-"}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {invoice.total_amount != null
                            ? `£${invoice.total_amount.toFixed(2)}`
                            : "-"}
                        </TableCell>
                        <TableCell>
                          <Badge className={config.classes}>
                            {config.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                          {formatRelativeDate(invoice.created_at)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Page {pagination.page} of {pagination.totalPages}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Upload dialog */}
      <InvoiceUploadForm
        open={showUpload}
        onOpenChange={setShowUpload}
        onSuccess={() => refetch()}
      />
    </div>
  );
}
