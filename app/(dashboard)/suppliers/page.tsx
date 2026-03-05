"use client";

import { Suspense, useEffect, useState, useCallback, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useSuppliers } from "@/hooks/useSuppliers";
import {
  usePurchaseOrders,
  usePurchaseOrderDetail,
} from "@/hooks/usePurchaseOrders";
import { useStoreInventory } from "@/hooks/useStoreInventory";
import { PageHeader } from "@/components/ui/page-header";
import { PageGuide } from "@/components/help/PageGuide";
import { StatsCard } from "@/components/cards/StatsCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { EmptyState } from "@/components/ui/empty-state";
import { SupplierForm } from "@/components/suppliers/SupplierForm";
import { PurchaseOrderForm } from "@/components/suppliers/PurchaseOrderForm";
import { ReceiveDeliveryDialog } from "@/components/suppliers/ReceiveDeliveryDialog";
import { PortalTokenManager } from "@/components/suppliers/PortalTokenManager";
import {
  Truck,
  Plus,
  Search,
  Pencil,
  Trash2,
  Package,
  ArrowLeft,
  PoundSterling,
  FileText,
  ShoppingCart,
  Clock,
  KeyRound,
} from "lucide-react";
import { toast } from "sonner";
import type { Supplier } from "@/types";
import type { CreateSupplierFormData } from "@/lib/validations/suppliers";

const PO_STATUS_COLORS: Record<string, string> = {
  open: "bg-blue-100 text-blue-800",
  awaiting_delivery: "bg-amber-100 text-amber-400",
  partial: "bg-orange-100 text-orange-800",
  received: "bg-emerald-500/10 text-emerald-400",
  cancelled: "bg-destructive/10 text-destructive/80",
};

const PO_STATUS_LABELS: Record<string, string> = {
  open: "Open",
  awaiting_delivery: "Awaiting Delivery",
  partial: "Partial",
  received: "Received",
  cancelled: "Cancelled",
};

function formatDeliveryDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  const days = Math.ceil(
    (new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );
  if (days < -1) return `${Math.abs(days)} days overdue`;
  if (days === -1) return "Yesterday";
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `${days} days`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function SuppliersPage() {
  const { currentStore, role } = useAuth();
  const storeId = currentStore?.store_id ?? null;

  const {
    suppliers,
    isLoading: loadingSuppliers,
    fetchSuppliers,
    createSupplier,
    updateSupplier,
    deleteSupplier,
    isSubmitting: submittingSupplier,
  } = useSuppliers(storeId);

  const {
    orders,
    isLoading: loadingOrders,
    fetchOrders,
    createOrder,
    isSubmitting: submittingOrder,
  } = usePurchaseOrders(storeId);

  const { inventory } = useStoreInventory(storeId);

  const [showSupplierForm, setShowSupplierForm] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [deletingSupplier, setDeletingSupplier] = useState<Supplier | null>(
    null,
  );
  const [showPOForm, setShowPOForm] = useState(false);
  const [preselectedSupplierId, setPreselectedSupplierId] = useState<
    string | undefined
  >();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // PO detail view
  const [selectedPOId, setSelectedPOId] = useState<string | null>(null);
  const {
    order: selectedOrder,
    isLoading: loadingOrderDetail,
    fetchOrder: fetchOrderDetail,
    updateOrder,
    deleteOrder,
    receiveItems,
    isSubmitting: submittingReceive,
  } = usePurchaseOrderDetail(storeId, selectedPOId);
  const [showReceiveDialog, setShowReceiveDialog] = useState(false);
  const [portalSupplier, setPortalSupplier] = useState<Supplier | null>(null);

  useEffect(() => {
    if (storeId) {
      fetchSuppliers();
      fetchOrders();
    }
  }, [storeId, fetchSuppliers, fetchOrders]);

  useEffect(() => {
    if (selectedPOId) fetchOrderDetail();
  }, [selectedPOId, fetchOrderDetail]);

  const handleSearch = useCallback(
    (value: string) => {
      setSearchQuery(value);
      fetchSuppliers({ search: value || undefined });
    },
    [fetchSuppliers],
  );

  // --- Computed stats ---
  const activeOrders = useMemo(
    () => orders.filter((o) => !["cancelled", "received"].includes(o.status)),
    [orders],
  );
  const pendingDeliveries = useMemo(
    () =>
      orders.filter((o) => ["awaiting_delivery", "partial"].includes(o.status)),
    [orders],
  );
  const openOrderValue = useMemo(
    () => activeOrders.reduce((sum, o) => sum + o.total_amount, 0),
    [activeOrders],
  );
  const ordersBySupplier = useMemo(() => {
    const map = new Map<string, number>();
    activeOrders.forEach((o) => {
      map.set(o.supplier_id, (map.get(o.supplier_id) ?? 0) + 1);
    });
    return map;
  }, [activeOrders]);

  if (role !== "Owner" && role !== "Manager") {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Suppliers & Orders"
          description="This feature is only available to Owners and Managers."
        >
          <PageGuide pageKey="suppliers" />
        </PageHeader>
      </div>
    );
  }

  if (!storeId) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Suppliers & Orders"
          description="Select a store to manage suppliers."
        >
          <PageGuide pageKey="suppliers" />
        </PageHeader>
      </div>
    );
  }

  const handleCreateSupplier = async (data: CreateSupplierFormData) => {
    try {
      await createSupplier(data);
      toast.success("Supplier created successfully");
      fetchSuppliers();
    } catch {
      toast.error("Failed to create supplier");
    }
  };

  const handleUpdateSupplier = async (data: CreateSupplierFormData) => {
    if (!editingSupplier) return;
    try {
      await updateSupplier(editingSupplier.id, data);
      toast.success("Supplier updated successfully");
      setEditingSupplier(null);
      fetchSuppliers();
    } catch {
      toast.error("Failed to update supplier");
    }
  };

  const handleDeleteSupplier = async () => {
    if (!deletingSupplier) return;
    try {
      await deleteSupplier(deletingSupplier.id);
      toast.success("Supplier deleted");
      setDeletingSupplier(null);
      fetchSuppliers();
    } catch {
      toast.error("Failed to delete supplier");
    }
  };

  const handleCreateOrder = async (data: Parameters<typeof createOrder>[0]) => {
    try {
      await createOrder(data);
      toast.success("Purchase order created");
      fetchOrders();
    } catch {
      toast.error("Failed to create purchase order");
    }
  };

  const handleReceive = async (data: Parameters<typeof receiveItems>[0]) => {
    try {
      await receiveItems(data);
      toast.success("Delivery received successfully");
      setShowReceiveDialog(false);
      setSelectedPOId(null);
      fetchOrders();
    } catch {
      toast.error("Failed to record delivery");
    }
  };

  const handleStatusChange = async (status: string) => {
    try {
      await updateOrder({
        status: status as Parameters<typeof updateOrder>[0]["status"],
      });
      toast.success(`Order updated to ${PO_STATUS_LABELS[status] ?? status}`);
      fetchOrderDetail();
      fetchOrders();
    } catch {
      toast.error("Failed to update order status");
    }
  };

  const handleDeleteOrder = async () => {
    try {
      await deleteOrder();
      toast.success("Purchase order deleted");
      setSelectedPOId(null);
      fetchOrders();
    } catch {
      toast.error("Failed to delete purchase order");
    }
  };

  const handleQuickOrder = (supplierId: string) => {
    setPreselectedSupplierId(supplierId);
    setShowPOForm(true);
  };

  const filteredOrders =
    statusFilter === "all"
      ? orders
      : orders.filter((o) => o.status === statusFilter);

  const inventoryOptions = inventory
    .filter((i) => i.inventory_item)
    .map((i) => ({
      id: i.inventory_item_id,
      name: i.inventory_item!.name,
      unit_of_measure: i.inventory_item!.unit_of_measure,
      current_quantity: i.quantity,
    }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Suppliers & Orders"
        description="Manage your suppliers and track purchase orders"
      >
        <PageGuide pageKey="suppliers" />
      </PageHeader>

      {/* Summary Stats */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        <StatsCard
          title="Suppliers"
          value={suppliers.length}
          description={`${suppliers.filter((s) => s.is_active).length} active`}
          icon={<Truck className="h-4 w-4" />}
        />
        <StatsCard
          title="Open Orders"
          value={activeOrders.length}
          description={
            activeOrders.length > 0
              ? `${orders.filter((o) => o.status === "open").length} open`
              : "No active orders"
          }
          icon={<FileText className="h-4 w-4" />}
        />
        <StatsCard
          title="Open Order Value"
          value={`£${openOrderValue.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
          description={`Across ${activeOrders.length} order${activeOrders.length !== 1 ? "s" : ""}`}
          icon={<PoundSterling className="h-4 w-4" />}
        />
        <StatsCard
          title="Awaiting Delivery"
          value={pendingDeliveries.length}
          description={
            pendingDeliveries.length > 0
              ? "In transit or partial"
              : "All delivered"
          }
          icon={<Package className="h-4 w-4" />}
          variant={pendingDeliveries.length > 0 ? "warning" : "default"}
        />
      </div>

      <Tabs defaultValue="suppliers">
        <TabsList>
          <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
          <TabsTrigger value="orders">Purchase Orders</TabsTrigger>
        </TabsList>

        {/* ===== SUPPLIERS TAB ===== */}
        <TabsContent value="suppliers" className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search suppliers..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button onClick={() => setShowSupplierForm(true)}>
              <Plus className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Add Supplier</span>
            </Button>
          </div>

          {loadingSuppliers ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : suppliers.length === 0 ? (
            <EmptyState
              icon={Truck}
              title="No suppliers yet"
              description="Add your first supplier to start creating purchase orders."
              action={{
                label: "Add Supplier",
                onClick: () => setShowSupplierForm(true),
                icon: Plus,
              }}
            />
          ) : (
            <>
              {/* Mobile card view */}
              <div className="sm:hidden space-y-2">
                {suppliers.map((supplier) => {
                  const activeCount = ordersBySupplier.get(supplier.id) ?? 0;
                  return (
                    <div
                      key={supplier.id}
                      className="border rounded-lg p-3 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium truncate">
                            {supplier.name}
                          </p>
                          {supplier.email && (
                            <p className="text-xs text-muted-foreground truncate">
                              {supplier.email}
                            </p>
                          )}
                        </div>
                        {activeCount > 0 && (
                          <Badge
                            variant="secondary"
                            className="bg-blue-500/10 text-blue-400 shrink-0"
                          >
                            {activeCount} order{activeCount !== 1 ? "s" : ""}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => handleQuickOrder(supplier.id)}
                        >
                          <ShoppingCart className="h-3.5 w-3.5 mr-1" />
                          Order
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setPortalSupplier(supplier)}
                          title="Portal Access"
                        >
                          <KeyRound className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setEditingSupplier(supplier)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setDeletingSupplier(supplier)}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop table view */}
              <Card className="hidden sm:block rounded-lg border shadow-sm overflow-hidden">
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Supplier</TableHead>
                        <TableHead className="hidden sm:table-cell">
                          Contact
                        </TableHead>
                        <TableHead className="text-center">
                          Active Orders
                        </TableHead>
                        <TableHead className="hidden md:table-cell">
                          Payment Terms
                        </TableHead>
                        <TableHead className="w-[200px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {suppliers.map((supplier) => {
                        const activeCount =
                          ordersBySupplier.get(supplier.id) ?? 0;
                        return (
                          <TableRow
                            key={supplier.id}
                            className="hover:bg-muted/30 transition-colors"
                          >
                            <TableCell>
                              <div>
                                <p className="font-medium">{supplier.name}</p>
                                {supplier.email && (
                                  <p className="text-xs text-muted-foreground">
                                    {supplier.email}
                                  </p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="hidden sm:table-cell">
                              <div>
                                {supplier.contact_person && (
                                  <p className="text-sm">
                                    {supplier.contact_person}
                                  </p>
                                )}
                                {supplier.phone && (
                                  <p className="text-xs text-muted-foreground">
                                    {supplier.phone}
                                  </p>
                                )}
                                {!supplier.contact_person &&
                                  !supplier.phone && (
                                    <span className="text-sm text-muted-foreground">
                                      -
                                    </span>
                                  )}
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              {activeCount > 0 ? (
                                <Badge
                                  variant="secondary"
                                  className="bg-blue-500/10 text-blue-400"
                                >
                                  {activeCount}
                                </Badge>
                              ) : (
                                <span className="text-sm text-muted-foreground">
                                  -
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                              <span className="text-sm">
                                {supplier.payment_terms || "-"}
                              </span>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleQuickOrder(supplier.id)}
                                >
                                  <ShoppingCart className="h-3.5 w-3.5 mr-1" />
                                  Order
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => setPortalSupplier(supplier)}
                                  title="Portal Access"
                                >
                                  <KeyRound className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => setEditingSupplier(supplier)}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => setDeletingSupplier(supplier)}
                                >
                                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* ===== PURCHASE ORDERS TAB ===== */}
        <TabsContent value="orders" className="space-y-4">
          {/* PO Detail View */}
          {selectedPOId && selectedOrder ? (
            <PODetailView
              order={selectedOrder}
              loading={loadingOrderDetail}
              onBack={() => setSelectedPOId(null)}
              onReceive={() => setShowReceiveDialog(true)}
              onStatusChange={handleStatusChange}
              onDelete={handleDeleteOrder}
              isSubmitting={submittingReceive}
            />
          ) : (
            <>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-36 sm:w-44">
                      <SelectValue placeholder="All Statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="awaiting_delivery">
                        Awaiting Delivery
                      </SelectItem>
                      <SelectItem value="partial">Partial</SelectItem>
                      <SelectItem value="received">Received</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                  <span className="hidden sm:inline text-sm text-muted-foreground">
                    {filteredOrders.length} order
                    {filteredOrders.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <Button
                  onClick={() => {
                    setPreselectedSupplierId(undefined);
                    setShowPOForm(true);
                  }}
                >
                  <Plus className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Create Order</span>
                </Button>
              </div>

              {loadingOrders ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-14 w-full" />
                  ))}
                </div>
              ) : filteredOrders.length === 0 ? (
                <EmptyState
                  icon={Package}
                  title="No purchase orders"
                  description={
                    statusFilter === "all"
                      ? "Create your first purchase order to track supplier deliveries."
                      : `No orders with status "${statusFilter}".`
                  }
                  action={
                    statusFilter === "all"
                      ? {
                          label: "Create Order",
                          onClick: () => {
                            setPreselectedSupplierId(undefined);
                            setShowPOForm(true);
                          },
                          icon: Plus,
                        }
                      : undefined
                  }
                />
              ) : (
                <>
                  {/* Mobile card view */}
                  <div className="sm:hidden space-y-2">
                    {filteredOrders.map((order) => {
                      const deliveryText = formatDeliveryDate(
                        order.expected_delivery_date,
                      );
                      const isOverdue = deliveryText.includes("overdue");
                      return (
                        <div
                          key={order.id}
                          className="border rounded-lg p-3 space-y-2 cursor-pointer active:bg-muted/50 transition-colors"
                          onClick={() => setSelectedPOId(order.id)}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-sm">
                              {order.po_number}
                            </span>
                            <Badge className={PO_STATUS_COLORS[order.status]}>
                              {PO_STATUS_LABELS[order.status] ?? order.status}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {order.supplier?.name ?? "-"}
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-semibold">
                              £{order.total_amount.toFixed(2)}
                            </span>
                            <span
                              className={
                                isOverdue
                                  ? "text-destructive text-xs font-medium"
                                  : "text-xs text-muted-foreground"
                              }
                            >
                              {deliveryText}
                            </span>
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
                            <TableHead>PO #</TableHead>
                            <TableHead>Supplier</TableHead>
                            <TableHead className="hidden md:table-cell">
                              Order Date
                            </TableHead>
                            <TableHead className="hidden lg:table-cell">
                              Expected
                            </TableHead>
                            <TableHead className="text-right">Total</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredOrders.map((order) => {
                            const deliveryText = formatDeliveryDate(
                              order.expected_delivery_date,
                            );
                            const isOverdue = deliveryText.includes("overdue");
                            return (
                              <TableRow
                                key={order.id}
                                className="cursor-pointer hover:bg-muted/30 transition-colors"
                                onClick={() => setSelectedPOId(order.id)}
                              >
                                <TableCell className="font-medium">
                                  {order.po_number}
                                </TableCell>
                                <TableCell>
                                  {order.supplier?.name ?? "-"}
                                </TableCell>
                                <TableCell className="hidden md:table-cell">
                                  {formatDate(order.order_date)}
                                </TableCell>
                                <TableCell className="hidden lg:table-cell">
                                  <span
                                    className={
                                      isOverdue
                                        ? "text-destructive font-medium"
                                        : ""
                                    }
                                  >
                                    {deliveryText}
                                  </span>
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                  £{order.total_amount.toFixed(2)}
                                </TableCell>
                                <TableCell>
                                  <Badge
                                    className={PO_STATUS_COLORS[order.status]}
                                  >
                                    {PO_STATUS_LABELS[order.status] ??
                                      order.status}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* ===== DIALOGS ===== */}
      <SupplierForm
        open={showSupplierForm}
        onOpenChange={setShowSupplierForm}
        onSubmit={handleCreateSupplier}
        isSubmitting={submittingSupplier}
      />

      {editingSupplier && (
        <SupplierForm
          open={!!editingSupplier}
          onOpenChange={(open) => {
            if (!open) setEditingSupplier(null);
          }}
          onSubmit={handleUpdateSupplier}
          isSubmitting={submittingSupplier}
          supplier={editingSupplier}
        />
      )}

      <AlertDialog
        open={!!deletingSupplier}
        onOpenChange={(open) => {
          if (!open) setDeletingSupplier(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Supplier</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {deletingSupplier?.name}? This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSupplier}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <PurchaseOrderForm
        open={showPOForm}
        onOpenChange={(open) => {
          setShowPOForm(open);
          if (!open) setPreselectedSupplierId(undefined);
        }}
        onSubmit={handleCreateOrder}
        isSubmitting={submittingOrder}
        suppliers={suppliers}
        inventoryItems={inventoryOptions}
        defaultSupplierId={preselectedSupplierId}
      />

      {selectedOrder && showReceiveDialog && (
        <ReceiveDeliveryDialog
          open={showReceiveDialog}
          onOpenChange={setShowReceiveDialog}
          order={selectedOrder}
          onReceive={handleReceive}
          isSubmitting={submittingReceive}
        />
      )}

      {portalSupplier && (
        <PortalTokenManager
          open={!!portalSupplier}
          onOpenChange={(open) => {
            if (!open) setPortalSupplier(null);
          }}
          supplierId={portalSupplier.id}
          supplierName={portalSupplier.name}
        />
      )}
    </div>
  );
}

// ============================================================
// PO Detail View Component
// ============================================================

import type { PurchaseOrder } from "@/types";

function PODetailView({
  order,
  loading,
  onBack,
  onReceive,
  onStatusChange,
  onDelete,
  isSubmitting,
}: {
  order: PurchaseOrder;
  loading: boolean;
  onBack: () => void;
  onReceive: () => void;
  onStatusChange: (status: string) => Promise<void>;
  onDelete: () => Promise<void>;
  isSubmitting: boolean;
}) {
  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="space-y-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-32" />
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
            </div>
            <Skeleton className="h-48" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalOrdered =
    order.items?.reduce((sum, i) => sum + i.quantity_ordered, 0) ?? 0;
  const totalReceived =
    order.items?.reduce((sum, i) => sum + (i.quantity_received ?? 0), 0) ?? 0;
  const receiveProgress =
    totalOrdered > 0 ? Math.round((totalReceived / totalOrdered) * 100) : 0;
  const canReceive = ["open", "awaiting_delivery", "partial"].includes(
    order.status,
  );
  const isTerminal = ["received", "cancelled"].includes(order.status);

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={onBack}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <CardTitle className="text-lg">PO #{order.po_number}</CardTitle>
              <p className="text-sm text-muted-foreground mt-0.5">
                {order.supplier?.name ?? "Unknown supplier"}
              </p>
            </div>
          </div>
          <Badge className={PO_STATUS_COLORS[order.status]}>
            {PO_STATUS_LABELS[order.status] ?? order.status}
          </Badge>
        </div>

        {/* Action buttons — status transitions */}
        {!isTerminal && (
          <div className="flex flex-wrap items-center gap-2 pt-3 border-t mt-4">
            {order.status === "open" && (
              <Button
                size="sm"
                variant="outline"
                disabled={isSubmitting}
                onClick={() => onStatusChange("awaiting_delivery")}
              >
                <Truck className="h-4 w-4 mr-1" />
                Mark Sent to Supplier
              </Button>
            )}
            {canReceive && (
              <Button size="sm" onClick={onReceive} disabled={isSubmitting}>
                <Package className="h-4 w-4 mr-1" />
                Receive Delivery
              </Button>
            )}
            <div className="flex-1" />
            {order.status === "open" && (
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                disabled={isSubmitting}
                onClick={onDelete}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Delete
              </Button>
            )}
            {order.status !== "open" && (
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                disabled={isSubmitting}
                onClick={() => onStatusChange("cancelled")}
              >
                Cancel Order
              </Button>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Order Date</p>
            <p className="text-sm font-medium mt-0.5">
              {formatDate(order.order_date)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Expected Delivery</p>
            <p className="text-sm font-medium mt-0.5">
              {formatDate(order.expected_delivery_date)}
              {order.expected_delivery_date && !isTerminal && (
                <span
                  className={`ml-1 text-xs ${formatDeliveryDate(order.expected_delivery_date).includes("overdue") ? "text-destructive" : "text-muted-foreground"}`}
                >
                  ({formatDeliveryDate(order.expected_delivery_date)})
                </span>
              )}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Items</p>
            <p className="text-sm font-medium mt-0.5">
              {order.items?.length ?? 0} line items
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Order Total</p>
            <p className="text-lg font-semibold tracking-tight mt-0.5">
              £{order.total_amount.toFixed(2)}
            </p>
          </div>
        </div>

        {/* Progress bar */}
        {order.status !== "cancelled" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Delivery Progress</span>
              <span className="font-medium">
                {totalReceived} / {totalOrdered} units received (
                {receiveProgress}%)
              </span>
            </div>
            <Progress value={receiveProgress} className="h-2" />
          </div>
        )}

        {/* Line items table */}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead className="text-right">Qty Ordered</TableHead>
                <TableHead className="text-right">Received</TableHead>
                <TableHead className="text-right">Line Total</TableHead>
                <TableHead className="text-right hidden sm:table-cell">
                  Per Unit
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {order.items?.map((item) => {
                const lineTotal = item.quantity_ordered * item.unit_price;
                const fullyReceived =
                  (item.quantity_received ?? 0) >= item.quantity_ordered;
                return (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">
                      {item.inventory_item?.name ?? item.inventory_item_id}
                    </TableCell>
                    <TableCell className="text-right">
                      {item.quantity_ordered}
                      {item.inventory_item?.unit_of_measure && (
                        <span className="text-xs text-muted-foreground ml-1">
                          {item.inventory_item.unit_of_measure}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <span
                        className={
                          fullyReceived ? "text-emerald-400 font-medium" : ""
                        }
                      >
                        {item.quantity_received ?? 0}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      £{lineTotal.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground text-sm hidden sm:table-cell">
                      £{item.unit_price.toFixed(2)}/
                      {item.inventory_item?.unit_of_measure ?? "unit"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* Notes */}
        {order.notes && (
          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground mb-1">Notes</p>
            <p className="text-sm">{order.notes}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
