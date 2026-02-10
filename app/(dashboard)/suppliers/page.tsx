'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useSuppliers } from '@/hooks/useSuppliers'
import { usePurchaseOrders, usePurchaseOrderDetail } from '@/hooks/usePurchaseOrders'
import { useStoreInventory } from '@/hooks/useStoreInventory'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
import { EmptyState } from '@/components/ui/empty-state'
import { SupplierForm } from '@/components/suppliers/SupplierForm'
import { PurchaseOrderForm } from '@/components/suppliers/PurchaseOrderForm'
import { ReceiveDeliveryDialog } from '@/components/suppliers/ReceiveDeliveryDialog'
import {
  Truck, Plus, Search, Pencil, Trash2, Package, Eye,
} from 'lucide-react'
import { toast } from 'sonner'
import type { Supplier, PurchaseOrder } from '@/types'
import type { CreateSupplierFormData } from '@/lib/validations/suppliers'

const PO_STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800',
  submitted: 'bg-blue-100 text-blue-800',
  acknowledged: 'bg-indigo-100 text-indigo-800',
  shipped: 'bg-yellow-100 text-yellow-800',
  partial: 'bg-orange-100 text-orange-800',
  received: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
}

export default function SuppliersPage() {
  const { currentStore, role } = useAuth()
  const storeId = currentStore?.store_id ?? null

  const {
    suppliers, isLoading: loadingSuppliers, fetchSuppliers,
    createSupplier, updateSupplier, deleteSupplier, isSubmitting: submittingSupplier,
  } = useSuppliers(storeId)

  const {
    orders, isLoading: loadingOrders, fetchOrders,
    createOrder, isSubmitting: submittingOrder,
  } = usePurchaseOrders(storeId)

  const { inventory } = useStoreInventory(storeId)

  const [showSupplierForm, setShowSupplierForm] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)
  const [deletingSupplier, setDeletingSupplier] = useState<Supplier | null>(null)
  const [showPOForm, setShowPOForm] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  // PO detail view
  const [selectedPOId, setSelectedPOId] = useState<string | null>(null)
  const {
    order: selectedOrder, isLoading: loadingOrderDetail,
    fetchOrder: fetchOrderDetail, receiveItems, isSubmitting: submittingReceive,
  } = usePurchaseOrderDetail(storeId, selectedPOId)
  const [showReceiveDialog, setShowReceiveDialog] = useState(false)

  useEffect(() => {
    if (storeId) {
      fetchSuppliers()
      fetchOrders()
    }
  }, [storeId, fetchSuppliers, fetchOrders])

  useEffect(() => {
    if (selectedPOId) fetchOrderDetail()
  }, [selectedPOId, fetchOrderDetail])

  const handleSearch = useCallback((value: string) => {
    setSearchQuery(value)
    fetchSuppliers({ search: value || undefined })
  }, [fetchSuppliers])

  if (role !== 'Owner' && role !== 'Manager') {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Suppliers & Purchase Orders</h1>
        <Card><CardContent className="pt-6 text-center text-muted-foreground">This feature is only available to Owners and Managers.</CardContent></Card>
      </div>
    )
  }

  if (!storeId) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Suppliers & Purchase Orders</h1>
        <Card><CardContent className="pt-6 text-center text-muted-foreground">Select a store to manage suppliers.</CardContent></Card>
      </div>
    )
  }

  const handleCreateSupplier = async (data: CreateSupplierFormData) => {
    try {
      await createSupplier(data)
      toast.success('Supplier created successfully')
      fetchSuppliers()
    } catch {
      toast.error('Failed to create supplier')
    }
  }

  const handleUpdateSupplier = async (data: CreateSupplierFormData) => {
    if (!editingSupplier) return
    try {
      await updateSupplier(editingSupplier.id, data)
      toast.success('Supplier updated successfully')
      setEditingSupplier(null)
      fetchSuppliers()
    } catch {
      toast.error('Failed to update supplier')
    }
  }

  const handleDeleteSupplier = async () => {
    if (!deletingSupplier) return
    try {
      await deleteSupplier(deletingSupplier.id)
      toast.success('Supplier deleted')
      setDeletingSupplier(null)
      fetchSuppliers()
    } catch {
      toast.error('Failed to delete supplier')
    }
  }

  const handleCreateOrder = async (data: Parameters<typeof createOrder>[0]) => {
    try {
      await createOrder(data)
      toast.success('Purchase order created')
      fetchOrders()
    } catch {
      toast.error('Failed to create purchase order')
    }
  }

  const handleReceive = async (data: Parameters<typeof receiveItems>[0]) => {
    try {
      await receiveItems(data)
      toast.success('Delivery received successfully')
      setShowReceiveDialog(false)
      setSelectedPOId(null)
      fetchOrders()
    } catch {
      toast.error('Failed to record delivery')
    }
  }

  const filteredOrders = statusFilter === 'all'
    ? orders
    : orders.filter(o => o.status === statusFilter)

  const inventoryOptions = inventory
    .filter(i => i.inventory_item)
    .map(i => ({ id: i.inventory_item_id, name: i.inventory_item!.name, unit_of_measure: i.inventory_item!.unit_of_measure }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Truck className="h-6 w-6" />
            Suppliers & Purchase Orders
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage suppliers and track purchase orders for {currentStore?.store?.name ?? 'your store'}
          </p>
        </div>
      </div>

      <Tabs defaultValue="suppliers">
        <TabsList>
          <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
          <TabsTrigger value="orders">Purchase Orders</TabsTrigger>
        </TabsList>

        {/* Suppliers Tab */}
        <TabsContent value="suppliers" className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search suppliers..."
                value={searchQuery}
                onChange={e => handleSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button onClick={() => setShowSupplierForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Supplier
            </Button>
          </div>

          {loadingSuppliers ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : suppliers.length === 0 ? (
            <EmptyState
              icon={Truck}
              title="No suppliers yet"
              description="Add your first supplier to start managing purchase orders."
              action={{ label: 'Add Supplier', onClick: () => setShowSupplierForm(true), icon: Plus }}
            />
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Payment Terms</TableHead>
                      <TableHead className="w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {suppliers.map(supplier => (
                      <TableRow key={supplier.id}>
                        <TableCell className="font-medium">{supplier.name}</TableCell>
                        <TableCell>{supplier.contact_person ?? '-'}</TableCell>
                        <TableCell>{supplier.email ?? '-'}</TableCell>
                        <TableCell>{supplier.phone ?? '-'}</TableCell>
                        <TableCell>{supplier.payment_terms ?? '-'}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" onClick={() => setEditingSupplier(supplier)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => setDeletingSupplier(supplier)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Purchase Orders Tab */}
        <TabsContent value="orders" className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 flex-wrap">
              {['all', 'draft', 'submitted', 'acknowledged', 'shipped', 'partial', 'received', 'cancelled'].map(status => (
                <Button
                  key={status}
                  variant={statusFilter === status ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setStatusFilter(status)}
                >
                  {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
                </Button>
              ))}
            </div>
            <Button onClick={() => setShowPOForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Order
            </Button>
          </div>

          {/* PO Detail View */}
          {selectedPOId && selectedOrder ? (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>PO #{selectedOrder.po_number}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {selectedOrder.supplier?.name ?? 'Unknown supplier'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={PO_STATUS_COLORS[selectedOrder.status]}>{selectedOrder.status}</Badge>
                    {['submitted', 'acknowledged', 'shipped', 'partial'].includes(selectedOrder.status) && (
                      <Button size="sm" onClick={() => setShowReceiveDialog(true)}>
                        <Package className="h-4 w-4 mr-1" />
                        Receive
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => setSelectedPOId(null)}>Back</Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Order Date</p>
                    <p className="text-sm font-medium">{selectedOrder.order_date ? new Date(selectedOrder.order_date).toLocaleDateString() : '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Expected Delivery</p>
                    <p className="text-sm font-medium">{selectedOrder.expected_delivery_date ? new Date(selectedOrder.expected_delivery_date).toLocaleDateString() : '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Total</p>
                    <p className="text-sm font-bold">${selectedOrder.total_amount.toFixed(2)}</p>
                  </div>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead className="text-right">Qty Ordered</TableHead>
                      <TableHead className="text-right">Qty Received</TableHead>
                      <TableHead className="text-right">Unit Price</TableHead>
                      <TableHead className="text-right">Line Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedOrder.items?.map(item => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.inventory_item?.name ?? item.inventory_item_id}</TableCell>
                        <TableCell className="text-right">{item.quantity_ordered}</TableCell>
                        <TableCell className="text-right">{item.quantity_received ?? 0}</TableCell>
                        <TableCell className="text-right">${item.unit_price.toFixed(2)}</TableCell>
                        <TableCell className="text-right">${(item.quantity_ordered * item.unit_price).toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : loadingOrders ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : filteredOrders.length === 0 ? (
            <EmptyState
              icon={Package}
              title="No purchase orders"
              description="Create your first purchase order to track supplier deliveries."
              action={{ label: 'Create Order', onClick: () => setShowPOForm(true), icon: Plus }}
            />
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>PO #</TableHead>
                      <TableHead>Supplier</TableHead>
                      <TableHead>Order Date</TableHead>
                      <TableHead>Expected Delivery</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[80px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.map(order => (
                      <TableRow key={order.id} className="cursor-pointer" onClick={() => setSelectedPOId(order.id)}>
                        <TableCell className="font-medium">{order.po_number}</TableCell>
                        <TableCell>{order.supplier?.name ?? '-'}</TableCell>
                        <TableCell>{order.order_date ? new Date(order.order_date).toLocaleDateString() : '-'}</TableCell>
                        <TableCell>{order.expected_delivery_date ? new Date(order.expected_delivery_date).toLocaleDateString() : '-'}</TableCell>
                        <TableCell className="text-right font-medium">${order.total_amount.toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge className={PO_STATUS_COLORS[order.status]}>{order.status}</Badge>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={e => { e.stopPropagation(); setSelectedPOId(order.id) }}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <SupplierForm
        open={showSupplierForm}
        onOpenChange={setShowSupplierForm}
        onSubmit={handleCreateSupplier}
        isSubmitting={submittingSupplier}
      />

      {editingSupplier && (
        <SupplierForm
          open={!!editingSupplier}
          onOpenChange={open => { if (!open) setEditingSupplier(null) }}
          onSubmit={handleUpdateSupplier}
          isSubmitting={submittingSupplier}
          supplier={editingSupplier}
        />
      )}

      <AlertDialog open={!!deletingSupplier} onOpenChange={open => { if (!open) setDeletingSupplier(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Supplier</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {deletingSupplier?.name}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteSupplier} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <PurchaseOrderForm
        open={showPOForm}
        onOpenChange={setShowPOForm}
        onSubmit={handleCreateOrder}
        isSubmitting={submittingOrder}
        suppliers={suppliers}
        inventoryItems={inventoryOptions}
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
    </div>
  )
}
