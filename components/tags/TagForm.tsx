'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useCreateTag, useUpdateTag, type Tag } from '@/hooks/useTags'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

const tagSchema = z.object({
  name: z.string().min(1, 'Name is required').max(30, 'Name must be 30 characters or less'),
  description: z.string().max(100, 'Description must be 100 characters or less').optional(),
  color: z.string().regex(/^#[0-9A-F]{6}$/i, 'Invalid hex color').optional(),
})

type TagFormData = z.infer<typeof tagSchema>

interface TagFormProps {
  storeId: string
  tag?: Tag | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

const PRESET_COLORS = [
  '#EF4444', // Red - Urgent/High Priority
  '#F59E0B', // Amber - Warning
  '#10B981', // Green - Approved/Fresh
  '#3B82F6', // Blue - Info
  '#8B5CF6', // Purple - Premium
  '#EC4899', // Pink - Special
  '#6B7280', // Gray - Standard
  '#14B8A6', // Teal - Organic
]

export function TagForm({ storeId, tag, open, onOpenChange, onSuccess }: TagFormProps) {
  const isEdit = !!tag
  const [selectedColor, setSelectedColor] = useState(tag?.color || PRESET_COLORS[0])

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<TagFormData>({
    resolver: zodResolver(tagSchema),
    defaultValues: {
      name: tag?.name || '',
      description: tag?.description || '',
      color: tag?.color || PRESET_COLORS[0],
    },
  })

  const createMutation = useCreateTag(storeId)
  const updateMutation = useUpdateTag(storeId, tag?.id || '')

  const onSubmit = async (data: TagFormData) => {
    try {
      const payload = {
        ...data,
        color: selectedColor,
      }

      if (isEdit) {
        await updateMutation.mutateAsync(payload)
        toast.success('Tag updated successfully')
      } else {
        await createMutation.mutateAsync(payload)
        toast.success('Tag created successfully')
      }

      reset()
      onOpenChange(false)
      onSuccess?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save tag')
    }
  }

  const isSubmitting = createMutation.isPending || updateMutation.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Tag' : 'Create Tag'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Update the tag details below.'
              : 'Create a new tag to add flexible labels to your inventory items.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              placeholder="e.g., Perishable, High-Value, Seasonal"
              {...register('name')}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Optional description for this tag"
              rows={2}
              {...register('description')}
            />
            {errors.description && (
              <p className="text-sm text-destructive">{errors.description.message}</p>
            )}
          </div>

          {/* Color Picker */}
          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex items-center gap-3">
              {/* Preset Colors */}
              <div className="flex gap-2 flex-wrap">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setSelectedColor(color)}
                    className={`size-8 rounded-md border-2 transition-all hover:scale-110 ${
                      selectedColor === color
                        ? 'border-foreground ring-2 ring-offset-2 ring-foreground'
                        : 'border-border'
                    }`}
                    style={{ backgroundColor: color }}
                    aria-label={`Select ${color} color`}
                  />
                ))}
              </div>

              {/* Custom Color Input */}
              <div className="flex items-center gap-2">
                <Input
                  type="color"
                  value={selectedColor}
                  onChange={(e) => setSelectedColor(e.target.value)}
                  className="size-10 p-1 cursor-pointer"
                />
                <Input
                  type="text"
                  value={selectedColor}
                  onChange={(e) => setSelectedColor(e.target.value)}
                  placeholder="#000000"
                  className="w-24 font-mono text-sm"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
              {isEdit ? 'Update' : 'Create'} Tag
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
