'use client'

import { useState } from 'react'
import { useTags, useDeleteTag, type Tag } from '@/hooks/useTags'
import { TagForm } from './TagForm'
import { TagBadge } from './TagBadge'
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
import { Plus, Edit, Trash2, Loader2, AlertCircle, Tag as TagIcon } from 'lucide-react'
import { useAuth } from '@/components/providers/AuthProvider'
import { toast } from 'sonner'

interface TagListProps {
  storeId: string
}

export function TagList({ storeId }: TagListProps) {
  const { user, profile } = useAuth()
  const { data: tags, isLoading, error } = useTags(storeId)
  const [formOpen, setFormOpen] = useState(false)
  const [selectedTag, setSelectedTag] = useState<Tag | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [tagToDelete, setTagToDelete] = useState<Tag | null>(null)

  const deleteMutation = useDeleteTag(storeId, tagToDelete?.id || '')

  // Check if user is Owner
  const isOwner = profile?.role === 'Owner'

  const handleEdit = (tag: Tag) => {
    setSelectedTag(tag)
    setFormOpen(true)
  }

  const handleDelete = (tag: Tag) => {
    setTagToDelete(tag)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (!tagToDelete) return

    try {
      await deleteMutation.mutateAsync()
      toast.success('Tag deleted successfully')
      setDeleteDialogOpen(false)
      setTagToDelete(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete tag')
    }
  }

  const handleFormClose = () => {
    setFormOpen(false)
    setSelectedTag(null)
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
            <p>Failed to load tags. Please try again.</p>
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
          <h2 className="text-2xl font-bold tracking-tight">Tags</h2>
          <p className="text-muted-foreground">
            Add flexible labels to your inventory items
          </p>
        </div>
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="mr-2 size-4" />
          New Tag
        </Button>
      </div>

      {/* Tags List */}
      {!tags || tags.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="rounded-full bg-muted p-4 mb-4">
              <TagIcon className="size-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No tags yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Create tags to add flexible labels to your items
            </p>
            <Button onClick={() => setFormOpen(true)}>
              <Plus className="mr-2 size-4" />
              Create Tag
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {tags.map((tag) => (
            <Card key={tag.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <TagBadge name={tag.name} color={tag.color} />
                    <CardDescription className="mt-2 text-xs">
                      {tag.description || 'No description'}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    Used {tag.usage_count || 0} time{tag.usage_count !== 1 ? 's' : ''}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(tag)}
                    >
                      <Edit className="size-4" />
                    </Button>
                    {isOwner && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(tag)}
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
      <TagForm
        storeId={storeId}
        tag={selectedTag}
        open={formOpen}
        onOpenChange={handleFormClose}
        onSuccess={handleFormClose}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Tag</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{tagToDelete?.name}</strong>?
              {(tagToDelete?.usage_count || 0) > 0 && (
                <span className="block mt-2 text-amber-600 font-medium">
                  This tag is currently used on {tagToDelete?.usage_count} item(s). Deleting it will remove the tag from all items.
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
