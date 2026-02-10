'use client'

import { useState, useRef, useEffect } from 'react'
import { useTags, type Tag } from '@/hooks/useTags'
import { TagBadge } from './TagBadge'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Loader2, ChevronsUpDown, Search } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TagSelectProps {
  storeId: string
  selectedTagIds: string[]
  onChange: (tagIds: string[]) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function TagSelect({
  storeId,
  selectedTagIds,
  onChange,
  placeholder = 'Select tags...',
  disabled = false,
  className,
}: TagSelectProps) {
  const { data: tags, isLoading } = useTags(storeId)
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)

  // Focus search input when popover opens
  useEffect(() => {
    if (open) {
      setTimeout(() => searchRef.current?.focus(), 0)
    } else {
      setSearch('')
    }
  }, [open])

  const filteredTags = tags?.filter((tag) =>
    tag.name.toLowerCase().includes(search.toLowerCase())
  )

  const selectedTags = tags?.filter((tag) => selectedTagIds.includes(tag.id)) || []

  const toggleTag = (tagId: string) => {
    if (selectedTagIds.includes(tagId)) {
      onChange(selectedTagIds.filter((id) => id !== tagId))
    } else {
      onChange([...selectedTagIds, tagId])
    }
  }

  const removeTag = (tagId: string) => {
    onChange(selectedTagIds.filter((id) => id !== tagId))
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 h-10 px-3 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading tags...
      </div>
    )
  }

  return (
    <div className={cn('space-y-2', className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal"
            disabled={disabled}
          >
            <span className="text-muted-foreground">
              {selectedTagIds.length === 0
                ? placeholder
                : `${selectedTagIds.length} tag${selectedTagIds.length !== 1 ? 's' : ''} selected`}
            </span>
            <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0" align="start">
          {/* Search */}
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 size-4 shrink-0 opacity-50" />
            <Input
              ref={searchRef}
              placeholder="Search tags..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          </div>

          {/* Tag List */}
          <div className="max-h-[200px] overflow-y-auto p-1">
            {!filteredTags || filteredTags.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {search ? 'No tags match your search.' : 'No tags available.'}
              </p>
            ) : (
              filteredTags.map((tag) => {
                const isSelected = selectedTagIds.includes(tag.id)
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleTag(tag.id)}
                    className={cn(
                      'flex items-center gap-3 w-full px-2 py-1.5 text-sm rounded-sm hover:bg-accent transition-colors',
                      isSelected && 'bg-accent'
                    )}
                  >
                    <Checkbox
                      checked={isSelected}
                      className="pointer-events-none"
                    />
                    <div className="flex items-center gap-2">
                      {tag.color && (
                        <div
                          className="size-3 rounded-full"
                          style={{ backgroundColor: tag.color }}
                        />
                      )}
                      <span>{tag.name}</span>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* Selected Tags Display */}
      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedTags.map((tag) => (
            <TagBadge
              key={tag.id}
              name={tag.name}
              color={tag.color}
              removable
              onRemove={() => removeTag(tag.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
