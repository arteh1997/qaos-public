"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PortalLayout } from "@/components/supplier-portal/PortalLayout";
import { usePortalOrderDetail } from "@/hooks/useSupplierPortal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, CheckCircle, Truck } from "lucide-react";
import { toast } from "sonner";

const STATUS_COLORS: Record<string, string> = {
  open: "bg-blue-100 text-blue-800",
  awaiting_delivery: "bg-amber-100 text-amber-400",
  partial: "bg-orange-100 text-orange-800",
  received: "bg-emerald-500/10 text-emerald-400",
  cancelled: "bg-destructive/10 text-destructive/80",
};

const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  awaiting_delivery: "Awaiting Delivery",
  partial: "Partial",
  received: "Received",
  cancelled: "Cancelled",
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function PortalOrderDetailPage() {
  const { poId } = useParams<{ poId: string }>();
  const router = useRouter();
  const { order, isLoading, fetchOrder, updateStatus } = usePortalOrderDetail();
  const [showConfirm, setShowConfirm] = useState<
    "acknowledged" | "shipped" | null
  >(null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (poId) fetchOrder(poId);
  }, [poId, fetchOrder]);

  const handleStatusUpdate = async () => {
    if (!showConfirm || !poId) return;
    setUpdating(true);
    try {
      const res = await updateStatus(poId, { status: showConfirm });
      if (res.success) {
        toast.success(
          showConfirm === "acknowledged"
            ? "Order acknowledged"
            : "Marked as shipped",
        );
        fetchOrder(poId);
      } else {
        toast.error(res.message || "Failed to update");
      }
    } catch {
      toast.error("Failed to update order");
    } finally {
      setUpdating(false);
      setShowConfirm(null);
    }
  };

  if (isLoading || !order) {
    return (
      <PortalLayout>
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 rounded-lg" />
        </div>
      </PortalLayout>
    );
  }

  const o = order as Record<string, unknown>;
  const status = o.status as string;
  const items = (o.purchase_order_items || []) as Record<string, unknown>[];
  const totalOrdered = items.reduce(
    (sum, i) => sum + ((i.quantity_ordered as number) || 0),
    0,
  );
  const totalReceived = items.reduce(
    (sum, i) => sum + ((i.quantity_received as number) || 0),
    0,
  );
  const progress =
    totalOrdered > 0 ? Math.round((totalReceived / totalOrdered) * 100) : 0;

  const canAcknowledge = status === "open" || status === "awaiting_delivery";
  const canMarkShipped = status === "open" || status === "awaiting_delivery";
  const isTerminal = status === "received" || status === "cancelled";

  return (
    <PortalLayout>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.push("/portal/orders")}
        className="mb-4"
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back to Orders
      </Button>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-lg">
                PO #{o.po_number as string}
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-0.5">
                Ordered {formatDate(o.order_date as string)}
                {(o.expected_delivery_date as string)
                  ? ` — Due ${formatDate(o.expected_delivery_date as string)}`
                  : ""}
              </p>
            </div>
            <Badge
              className={
                STATUS_COLORS[status] || "bg-muted text-muted-foreground"
              }
            >
              {STATUS_LABELS[status] || status}
            </Badge>
          </div>

          {!isTerminal && (
            <div className="flex flex-wrap items-center gap-2 pt-3 border-t mt-4">
              {canAcknowledge && status === "open" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowConfirm("acknowledged")}
                >
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Acknowledge Order
                </Button>
              )}
              {canMarkShipped && (
                <Button size="sm" onClick={() => setShowConfirm("shipped")}>
                  <Truck className="h-4 w-4 mr-1" />
                  Mark as Shipped
                </Button>
              )}
            </div>
          )}
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Total Value</p>
              <p className="text-lg font-semibold mt-0.5">
                £{(o.total_amount as number)?.toFixed(2) || "0.00"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Line Items</p>
              <p className="text-sm font-medium mt-0.5">{items.length}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Currency</p>
              <p className="text-sm font-medium mt-0.5">
                {(o.currency as string) || "GBP"}
              </p>
            </div>
          </div>

          {/* Progress */}
          {status !== "cancelled" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Delivery Progress</span>
                <span className="font-medium">
                  {totalReceived} / {totalOrdered} units ({progress}%)
                </span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          {/* Line Items */}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Ordered</TableHead>
                  <TableHead className="text-right">Received</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead className="text-right">Line Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => {
                  const inv = item.inventory_items as Record<
                    string,
                    unknown
                  > | null;
                  const qtyOrdered = item.quantity_ordered as number;
                  const qtyReceived = (item.quantity_received as number) || 0;
                  const unitPrice = item.unit_price as number;
                  const lineTotal = qtyOrdered * unitPrice;
                  const fullyReceived = qtyReceived >= qtyOrdered;

                  return (
                    <TableRow key={item.id as string}>
                      <TableCell className="font-medium">
                        {(inv?.name as string) || "Unknown Item"}
                        {(inv?.unit_of_measure as string) ? (
                          <span className="text-xs text-muted-foreground ml-1">
                            ({inv!.unit_of_measure as string})
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-right">{qtyOrdered}</TableCell>
                      <TableCell className="text-right">
                        <span
                          className={
                            fullyReceived ? "text-emerald-400 font-medium" : ""
                          }
                        >
                          {qtyReceived}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        £{unitPrice.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        £{lineTotal.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Notes */}
          {(o.notes as string) ? (
            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground mb-1">Notes</p>
              <p className="text-sm">{o.notes as string}</p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Confirm dialog */}
      <AlertDialog
        open={!!showConfirm}
        onOpenChange={(open) => {
          if (!open) setShowConfirm(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {showConfirm === "acknowledged"
                ? "Acknowledge Order?"
                : "Mark as Shipped?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {showConfirm === "acknowledged"
                ? "This confirms you have received and are processing this purchase order."
                : "This marks the order as shipped and on its way to the customer."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={updating}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleStatusUpdate} disabled={updating}>
              {updating ? "Updating..." : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PortalLayout>
  );
}
