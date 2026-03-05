"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PortalLayout } from "@/components/supplier-portal/PortalLayout";
import { usePortalOrders } from "@/hooks/useSupplierPortal";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Package } from "lucide-react";

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

export default function PortalOrdersPage() {
  const router = useRouter();
  const { orders, isLoading, fetchOrders } = usePortalOrders();
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    fetchOrders(statusFilter !== "all" ? { status: statusFilter } : undefined);
  }, [fetchOrders, statusFilter]);

  return (
    <PortalLayout title="Purchase Orders">
      <div className="flex items-center gap-3 mb-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="awaiting_delivery">Awaiting Delivery</SelectItem>
            <SelectItem value="partial">Partial</SelectItem>
            <SelectItem value="received">Received</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">
          {orders.length} order{orders.length !== 1 ? "s" : ""}
        </span>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No orders found"
          description={
            statusFilter === "all"
              ? "You don't have any purchase orders yet."
              : `No orders with status "${STATUS_LABELS[statusFilter] || statusFilter}".`
          }
        />
      ) : (
        <div className="space-y-2">
          {orders.map((order) => {
            const o = order as Record<string, unknown>;
            const status = o.status as string;
            const total = o.total_amount as number;
            return (
              <Card
                key={o.id as string}
                className="cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => router.push(`/portal/orders/${o.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm">
                          PO #{o.po_number as string}
                        </span>
                        <Badge
                          className={
                            STATUS_COLORS[status] ||
                            "bg-muted text-muted-foreground"
                          }
                        >
                          {STATUS_LABELS[status] || status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>
                          Ordered {formatDate(o.order_date as string)}
                        </span>
                        {(o.expected_delivery_date as string) ? (
                          <span>
                            Due {formatDate(o.expected_delivery_date as string)}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <span className="text-sm font-semibold whitespace-nowrap">
                      £{total?.toFixed(2) || "0.00"}
                    </span>
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
