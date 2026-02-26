'use client'

import { useState } from 'react'
import { useCategories, useDeleteCategory, type Category } from '@/hooks/useCategories'
import { CategoryForm } from './CategoryForm'
import { CategoryBadge } from './CategoryBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import { Plus, Edit, Trash2, Loader2, AlertCircle } from 'lucide-react'
import { useAuth } from '@/components/providers/AuthProvider'
import { toast } from 'sonner'
import { PageGuide } from '@/components/help/PageGuide'

interface CategoryListProps {
  storeId: string
}

export function CategoryList({ storeId }: CategoryListProps) {
  const { user, profile } = useAuth()
  const { data: categories, isLoading, error } = useCategories(storeId)
  const [formOpen, setFormOpen] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null)

  const deleteMutation = useDeleteCategory(storeId, categoryToDelete?.id || '')

  // Check if user is Owner
  const isOwner = profile?.role === 'Owner'

  const handleEdit = (category: Category) => {
    setSelectedCategory(category)
    setFormOpen(true)
  }

  const handleDelete = (category: Category) => {
    setCategoryToDelete(category)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (!categoryToDelete) return

    try {
      await deleteMutation.mutateAsync()
      toast.success('Category deleted successfully')
      setDeleteDialogOpen(false)
      setCategoryToDelete(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete category')
    }
  }

  const handleFormClose = () => {
    setFormOpen(false)
    setSelectedCategory(null)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="size-5" />
            <p>Failed to load categories. Please try again.</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Categories</h2>
          <p className="text-muted-foreground">
            Organize your inventory into categories
          </p>
        </div>
        <div className="flex items-center gap-1">
          <PageGuide pageKey="categories" />
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="mr-2 size-4" />
            New Category
          </Button>
        </div>
      </div>

      {/* Categories List */}
      {!categories || categories.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="rounded-full bg-muted p-4 mb-4">
              <Plus className="size-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No categories yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Get started by creating your first category
            </p>
            <Button onClick={() => setFormOpen(true)}>
              <Plus className="mr-2 size-4" />
              Create Category
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => (
            <Card key={category.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CategoryBadge name={category.name} color={category.color} />
                    <CardDescription className="mt-2">
                      {category.description || 'No description'}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    {category.item_count || 0} item{category.item_count !== 1 ? 's' : ''}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(category)}
                    >
                      <Edit className="size-4" />
                    </Button>
                    {isOwner && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(category)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Form */}
      <CategoryForm
        storeId={storeId}
        category={selectedCategory}
        open={formOpen}
        onOpenChange={handleFormClose}
        onSuccess={handleFormClose}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Category</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{categoryToDelete?.name}</strong>?
              {(categoryToDelete?.item_count || 0) > 0 && (
                <span className="block mt-2 text-destructive font-medium">
                  This category is assigned to {categoryToDelete?.item_count} item(s). This action cannot be undone.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleteMutation.isPending && (
                <Loader2 className="mr-2 size-4 animate-spin" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
