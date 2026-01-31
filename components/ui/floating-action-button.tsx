'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Plus, X } from 'lucide-react'

interface FloatingActionItem {
  icon: React.ReactNode
  label: string
  onClick: () => void
}

interface FloatingActionButtonProps {
  items?: FloatingActionItem[]
  onClick?: () => void
  className?: string
}

export function FloatingActionButton({
  items,
  onClick,
  className,
}: FloatingActionButtonProps) {
  const [isOpen, setIsOpen] = React.useState(false)

  // If no items, just render a simple FAB
  if (!items || items.length === 0) {
    return (
      <button
        onClick={onClick}
        className={cn(
          'fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[oklch(0.588_0.213_255.129)] text-white shadow-lg transition-all duration-300 hover:scale-110 hover:shadow-xl hover:shadow-[oklch(0.588_0.213_255.129_/_30%)] active:scale-95',
          className
        )}
        aria-label="Quick action"
      >
        <Plus className="h-6 w-6" />
      </button>
    )
  }

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm transition-opacity duration-200"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Action items */}
      <div
        className={cn(
          'absolute bottom-16 right-0 flex flex-col-reverse gap-3 transition-all duration-300',
          isOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
        )}
      >
        {items.map((item, index) => (
          <button
            key={index}
            onClick={() => {
              item.onClick()
              setIsOpen(false)
            }}
            className="flex items-center gap-3 rounded-full bg-card px-4 py-2.5 shadow-lg transition-all duration-200 hover:scale-105 hover:shadow-xl animate-fade-in-scale"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[oklch(0.588_0.213_255.129)] text-white">
              {item.icon}
            </span>
            <span className="pr-2 font-medium text-foreground">{item.label}</span>
          </button>
        ))}
      </div>

      {/* Main FAB */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'relative flex h-14 w-14 items-center justify-center rounded-full bg-[oklch(0.588_0.213_255.129)] text-white shadow-lg transition-all duration-300 hover:shadow-xl hover:shadow-[oklch(0.588_0.213_255.129_/_30%)]',
          isOpen && 'rotate-45 bg-muted text-muted-foreground',
          className
        )}
        aria-label={isOpen ? 'Close menu' : 'Open quick actions'}
      >
        {isOpen ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
      </button>
    </div>
  )
}
