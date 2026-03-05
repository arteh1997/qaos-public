"use client";

import { useEffect, useState, useCallback } from "react";
import { PortalLayout } from "@/components/supplier-portal/PortalLayout";
import { usePortalFetch } from "@/hooks/useSupplierPortal";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { FileText, Upload } from "lucide-react";
import { toast } from "sonner";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  processing: "bg-blue-100 text-blue-800",
  review: "bg-amber-100 text-amber-400",
  approved: "bg-emerald-500/10 text-emerald-400",
  applied: "bg-emerald-500/10 text-emerald-400",
  rejected: "bg-destructive/10 text-destructive/80",
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function PortalInvoicesPage() {
  const { portalFetch } = usePortalFetch();
  const [invoices, setInvoices] = useState<Record<string, unknown>[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const fetchInvoices = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await portalFetch("/invoices");
      if (res.success) setInvoices(res.data);
    } finally {
      setIsLoading(false);
    }
  }, [portalFetch]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/supplier-portal/invoices", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("supplier_portal_token")}`,
        },
        body: formData,
      });

      const data = await res.json();
      if (data.success) {
        toast.success("Invoice uploaded successfully");
        fetchInvoices();
      } else {
        toast.error(data.message || "Failed to upload invoice");
      }
    } catch {
      toast.error("Failed to upload invoice");
    } finally {
      setUploading(false);
      // Reset file input
      e.target.value = "";
    }
  };

  return (
    <PortalLayout title="Invoices">
      <div className="flex items-center justify-between gap-3 mb-4">
        <p className="text-sm text-muted-foreground">
          {invoices.length} invoice{invoices.length !== 1 ? "s" : ""}
        </p>
        <label>
          <Input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            className="hidden"
            onChange={handleUpload}
            disabled={uploading}
          />
          <Button asChild disabled={uploading}>
            <span>
              <Upload className="h-4 w-4 mr-1.5" />
              {uploading ? "Uploading..." : "Upload Invoice"}
            </span>
          </Button>
        </label>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
      ) : invoices.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No invoices"
          description="Upload your first invoice to get started."
        />
      ) : (
        <div className="space-y-2">
          {invoices.map((inv) => {
            const status = inv.status as string;
            return (
              <Card key={inv.id as string}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="font-medium text-sm truncate">
                          {(inv.invoice_number as string) ||
                            (inv.file_name as string) ||
                            "Untitled"}
                        </span>
                        <Badge
                          className={
                            STATUS_COLORS[status] ||
                            "bg-muted text-muted-foreground"
                          }
                        >
                          {status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground pl-6">
                        {(inv.invoice_date as string) ? (
                          <span>{formatDate(inv.invoice_date as string)}</span>
                        ) : null}
                        {inv.total_amount != null ? (
                          <span className="font-medium text-foreground">
                            £{(inv.total_amount as number).toFixed(2)}
                          </span>
                        ) : null}
                        <span>
                          Uploaded {formatDate(inv.created_at as string)}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </PortalLayout>
  );
}
