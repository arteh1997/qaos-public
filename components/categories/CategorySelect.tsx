'use client'

import { useCategories, type Category } from '@/hooks/useCategories'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2 } from 'lucide-react'

interface CategorySelectProps {
  storeId: string
  value?: string | null
  onChange: (categoryId: string | null) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function CategorySelect({
  storeId,
  value,
  onChange,
  placeholder = 'Select category',
  disabled = false,
  className,
}: CategorySelectProps) {
  const { data: categories, isLoading } = useCategories(storeId)

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 h-10 px-3 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading...
      </div>
    )
  }

  return (
    <Select
      value={value || '__none__'}
      onValueChange={(v) => onChange(v === '__none__' ? null : v)}
      disabled={disabled}
    >
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__">
          <span className="text-muted-foreground">No category</span>
        </SelectItem>
        {categories?.map((cat) => (
          <SelectItem key={cat.id} value={cat.id}>
            <div className="flex items-center gap-2">
              {cat.color && (
                <div
                  className="size-3 rounded-full"
                  style={{ backgroundColor: cat.color }}
                />
              )}
              <span>{cat.name}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
