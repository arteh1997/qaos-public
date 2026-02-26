'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { ConfirmDialog } from '@/components/dialogs/ConfirmDialog'
import { useCSRF } from '@/hooks/useCSRF'
import { Loader2, Plus, Pencil, Trash2, X, Check, Truck, Phone, Mail, User } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface SuppliersSetupStepProps {
  storeId: string
  isComplete: boolean
  onComplete: () => void
}

interface Supplier {
  id: string
  name: string
  email: string | null
  phone: string | null
  contact_person: string | null
}

export function SuppliersSetupStep({ storeId, isComplete, onComplete }: SuppliersSetupStepProps) {
  const { csrfFetch } = useCSRF()
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Add form state
  const [showAddForm, setShowAddForm] = useState(false)
  const [name, setName] = useState('')
  const [contactPerson, setContactPerson] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editContactPerson, setEditContactPerson] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [isSavingEdit, setIsSavingEdit] = useState(false)

  // Delete state
  const [deleteSupplier, setDeleteSupplier] = useState<Supplier | null>(null)

  // Fetch existing suppliers
  const fetchSuppliers = useCallback(async () => {
    try {
      const response = await fetch(`/api/stores/${storeId}/suppliers?active=true`)
      if (!response.ok) throw new Error('Failed to fetch suppliers')
      const result = await response.json()
      setSuppliers(result.data || [])
    } catch (err) {
      console.error('Failed to fetch suppliers:', err)
    } finally {
      setIsLoading(false)
    }
  }, [storeId])

  useEffect(() => {
    fetchSuppliers()
  }, [fetchSuppliers])

  // Auto-show add form if no suppliers exist yet
  useEffect(() => {
    if (!isLoading && suppliers.length === 0) {
      setShowAddForm(true)
    }
  }, [isLoading, suppliers.length])

  const resetAddForm = () => {
    setName('')
    setContactPerson('')
    setPhone('')
    setEmail('')
  }

  const handleAddSupplier = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      toast.error('Supplier name is required')
      return
    }

    setIsSubmitting(true)
    try {
      const response = await csrfFetch(`/api/stores/${storeId}/suppliers`, {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          contact_person: contactPerson.trim() || undefined,
          phone: phone.trim() || undefined,
          email: email.trim() || undefined,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message || 'Failed to add supplier')
      }

      toast.success(`${name.trim()} added`)
      resetAddForm()
      setShowAddForm(false)
      await fetchSuppliers()
      onComplete()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add supplier')
    } finally {
      setIsSubmitting(false)
    }
  }

  const startEdit = (supplier: Supplier) => {
    setEditingId(supplier.id)
    setEditName(supplier.name)
    setEditContactPerson(supplier.contact_person || '')
    setEditPhone(supplier.phone || '')
    setEditEmail(supplier.email || '')
  }

  const cancelEdit = () => {
    setEditingId(null)
  }

  const handleSaveEdit = async () => {
    if (!editingId || !editName.trim()) return

    setIsSavingEdit(true)
    try {
      const response = await csrfFetch(`/api/stores/${storeId}/suppliers/${editingId}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: editName.trim(),
          contact_person: editContactPerson.trim() || null,
          phone: editPhone.trim() || null,
          email: editEmail.trim() || null,
        }),
      })

      if (!response.ok) {
        const result = await response.json().catch(() => ({}))
        throw new Error(result.message || 'Failed to update supplier')
      }

      toast.success('Supplier updated')
      setEditingId(null)
      await fetchSuppliers()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update supplier')
    } finally {
      setIsSavingEdit(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteSupplier) return

    try {
      const response = await csrfFetch(`/api/stores/${storeId}/suppliers/${deleteSupplier.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const result = await response.json().catch(() => ({}))
        throw new Error(result.message || 'Failed to delete supplier')
      }

      toast.success(`${deleteSupplier.name} removed`)
      setDeleteSupplier(null)
      await fetchSuppliers()
      onComplete() // Re-check completion status
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete supplier')
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-4 w-64" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Add the suppliers you order from. You can always add more later from the Suppliers page.
      </p>

      {/* Existing suppliers list */}
      {suppliers.length > 0 && (
        <div className="space-y-2">
          {suppliers.map((supplier) => {
            const isEditing = editingId === supplier.id

            if (isEditing) {
              return (
                <div key={supplier.id} className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-3">
                  <div>
                    <Label className="text-xs">Supplier Name *</Label>
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="mt-1 h-8 text-sm"
                      autoFocus
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <Label className="text-xs">Contact Person</Label>
                      <Input
                        value={editContactPerson}
                        onChange={(e) => setEditContactPerson(e.target.value)}
                        placeholder="Optional"
                        className="mt-1 h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Phone</Label>
                      <Input
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                        placeholder="Optional"
                        className="mt-1 h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Email</Label>
                      <Input
                        type="email"
                        value={editEmail}
                        onChange={(e) => setEditEmail(e.target.value)}
                        placeholder="Optional"
                        className="mt-1 h-8 text-sm"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="h-7 text-xs"
                      onClick={handleSaveEdit}
                      disabled={isSavingEdit || !editName.trim()}
                    >
                      {isSavingEdit ? (
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      ) : (
                        <Check className="h-3 w-3 mr-1" />
                      )}
                      Save
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={cancelEdit}
                      disabled={isSavingEdit}
                    >
                      <X className="h-3 w-3 mr-1" />
                      Cancel
                    </Button>
                  </div>
                </div>
              )
            }

            // Display mode
            return (
              <div
                key={supplier.id}
                className="group flex items-start justify-between rounded-lg border p-3 transition-colors hover:bg-muted/30"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Truck className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-sm font-medium truncate">{supplier.name}</span>
                  </div>
                  {(supplier.contact_person || supplier.phone || supplier.email) && (
                    <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {supplier.contact_person && (
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {supplier.contact_person}
                        </span>
                      )}
                      {supplier.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {supplier.phone}
                        </span>
                      )}
                      {supplier.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {supplier.email}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0 ml-2 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => startEdit(supplier)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    <span className="sr-only">Edit</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => setDeleteSupplier(supplier)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span className="sr-only">Delete</span>
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add form */}
      {showAddForm ? (
        <form onSubmit={handleAddSupplier} className={cn(
          'rounded-lg border border-dashed p-3 space-y-3',
          suppliers.length === 0 ? 'border-primary/30' : 'border-muted-foreground/30'
        )}>
          <div>
            <Label htmlFor="supplier-name" className="text-xs">Supplier Name *</Label>
            <Input
              id="supplier-name"
              placeholder="e.g., Fresh Foods Ltd"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 h-8 text-sm"
              autoFocus={suppliers.length > 0}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <Label htmlFor="supplier-contact" className="text-xs">Contact Person</Label>
              <Input
                id="supplier-contact"
                placeholder="John Smith"
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                className="mt-1 h-8 text-sm"
              />
            </div>
            <div>
              <Label htmlFor="supplier-phone" className="text-xs">Phone</Label>
              <Input
                id="supplier-phone"
                placeholder="07700 900000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-1 h-8 text-sm"
              />
            </div>
            <div>
              <Label htmlFor="supplier-email" className="text-xs">Email</Label>
              <Input
                id="supplier-email"
                type="email"
                placeholder="orders@supplier.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 h-8 text-sm"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button type="submit" size="sm" className="h-7 text-xs" disabled={isSubmitting || !name.trim()}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="h-3 w-3 mr-1" />
                  Add Supplier
                </>
              )}
            </Button>
            {suppliers.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => { setShowAddForm(false); resetAddForm() }}
              >
                Cancel
              </Button>
            )}
          </div>
        </form>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="w-full border-dashed"
          onClick={() => setShowAddForm(true)}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Another Supplier
        </Button>
      )}

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleteSupplier}
        onOpenChange={() => setDeleteSupplier(null)}
        title="Delete supplier"
        description={`Are you sure you want to remove "${deleteSupplier?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  )
}
