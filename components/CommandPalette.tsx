'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useStoreInventory } from '@/hooks/useStoreInventory'
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import {
  Search,
  LayoutDashboard,
  Package,
  Users,
  FileText,
  Clock,
  CreditCard,
  Settings,
  Trash2,
  Truck,
  UtensilsCrossed,
  ClipboardList,
  AlertTriangle,
  Activity,
  DollarSign,
  ArrowRight,
} from 'lucide-react'

interface CommandItem {
  id: string
  label: string
  description?: string
  icon: typeof LayoutDashboard
  href: string
  category: 'navigation' | 'inventory' | 'actions'
  keywords?: string[]
}

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter()
  const { role, storeId } = useAuth()
  const { inventory } = useStoreInventory(storeId)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Build navigation commands based on role
  const navCommands = useMemo<CommandItem[]>(() => {
    const items: CommandItem[] = [
      { id: 'nav-dashboard', label: 'Dashboard', icon: LayoutDashboard, href: '/', category: 'navigation', keywords: ['home', 'main'] },
    ]

    if (role === 'Owner' || role === 'Manager') {
      items.push(
        { id: 'nav-inventory', label: 'Inventory', icon: Package, href: '/inventory', category: 'navigation', keywords: ['items', 'stock', 'products'] },
        { id: 'nav-inventory-value', label: 'Stock Costs', icon: DollarSign, href: '/inventory-value', category: 'navigation', keywords: ['cost', 'money', 'price', 'unit cost', 'purchase'] },
        { id: 'nav-waste', label: 'Waste Tracking', icon: Trash2, href: '/waste', category: 'navigation', keywords: ['spoilage', 'loss', 'expired'] },
        { id: 'nav-suppliers', label: 'Suppliers', icon: Truck, href: '/suppliers', category: 'navigation', keywords: ['vendors', 'purchase', 'orders'] },
        { id: 'nav-recipes', label: 'Menu & Costs', icon: UtensilsCrossed, href: '/recipes', category: 'navigation', keywords: ['menu', 'costing', 'food cost', 'recipes', 'profit', 'ingredients'] },
        { id: 'nav-team', label: 'Team', icon: Users, href: '/users', category: 'navigation', keywords: ['staff', 'employees', 'people'] },
        { id: 'nav-shifts', label: 'Shifts', icon: Clock, href: '/shifts', category: 'navigation', keywords: ['schedule', 'timetable'] },
        { id: 'nav-reports', label: 'Reports', icon: FileText, href: '/reports', category: 'navigation', keywords: ['analytics', 'summary', 'data'] },
        { id: 'nav-activity', label: 'Activity Log', icon: Activity, href: '/activity', category: 'navigation', keywords: ['audit', 'history', 'actions'] },
        { id: 'nav-settings', label: 'Settings', icon: Settings, href: '/settings', category: 'navigation', keywords: ['config', 'preferences', 'api', 'webhooks'] },
      )
    }

    if (role === 'Owner') {
      items.push(
        { id: 'nav-billing', label: 'Billing', icon: CreditCard, href: '/billing', category: 'navigation', keywords: ['subscription', 'payment', 'plan'] },
      )
    }

    if (role === 'Staff') {
      items.push(
        { id: 'nav-stock-count', label: 'Stock Count', icon: ClipboardList, href: '/stock-count', category: 'navigation', keywords: ['count', 'daily'] },
        { id: 'nav-low-stock', label: 'Low Stock', icon: AlertTriangle, href: '/low-stock', category: 'navigation', keywords: ['par', 'reorder'] },
      )
    }

    return items
  }, [role])

  // Build inventory item commands
  const inventoryCommands = useMemo<CommandItem[]>(() => {
    if (!inventory || inventory.length === 0) return []
    return inventory.slice(0, 50).map(item => ({
      id: `inv-${item.inventory_item_id}`,
      label: item.inventory_item?.name || 'Unknown',
      description: `${item.quantity} ${item.inventory_item?.unit_of_measure || 'units'} on hand`,
      icon: Package,
      href: '/inventory',
      category: 'inventory' as const,
      keywords: [item.inventory_item?.category || ''],
    }))
  }, [inventory])

  // Quick actions
  const actionCommands = useMemo<CommandItem[]>(() => {
    const items: CommandItem[] = []
    if (role === 'Owner' || role === 'Manager' || role === 'Staff') {
      if (storeId) {
        items.push(
          { id: 'action-stock-count', label: 'Do Stock Count', description: 'Start a new stock count', icon: ClipboardList, href: '/stock-count', category: 'actions', keywords: ['count'] },
          { id: 'action-delivery', label: 'Record Delivery', description: 'Log a stock reception', icon: Truck, href: '/deliveries', category: 'actions', keywords: ['receive', 'reception'] },
        )
      }
    }
    return items
  }, [role, storeId])

  const allCommands = useMemo(() =>
    [...actionCommands, ...navCommands, ...inventoryCommands],
    [actionCommands, navCommands, inventoryCommands]
  )

  // Filter commands
  const filteredCommands = useMemo(() => {
    if (!query.trim()) return allCommands.slice(0, 15)

    const q = query.toLowerCase()
    return allCommands.filter(cmd => {
      const searchable = [cmd.label, cmd.description, ...(cmd.keywords || [])].join(' ').toLowerCase()
      return searchable.includes(q)
    }).slice(0, 15)
  }, [query, allCommands])

  // Group commands by category
  const grouped = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {}
    for (const cmd of filteredCommands) {
      if (!groups[cmd.category]) groups[cmd.category] = []
      groups[cmd.category].push(cmd)
    }
    return groups
  }, [filteredCommands])

  const categoryLabels: Record<string, string> = {
    actions: 'Quick Actions',
    navigation: 'Navigation',
    inventory: 'Inventory Items',
  }

  // Reset on open
  useEffect(() => {
    if (open) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open])

  // Reset selection on query change
  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  // Scroll selected item into view
  useEffect(() => {
    const list = listRef.current
    if (!list) return
    const selected = list.querySelector('[data-selected="true"]')
    if (selected) {
      selected.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedIndex])

  const handleSelect = useCallback((cmd: CommandItem) => {
    onOpenChange(false)
    router.push(cmd.href)
  }, [router, onOpenChange])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(i => Math.min(i + 1, filteredCommands.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const cmd = filteredCommands[selectedIndex]
      if (cmd) handleSelect(cmd)
    }
  }, [filteredCommands, selectedIndex, handleSelect])

  let flatIndex = -1

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="p-0 gap-0 max-w-lg overflow-hidden"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">Command Palette</DialogTitle>
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-border/60 px-4 py-3">
          <Search className="h-4 w-4 text-muted-foreground/70 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search pages, items, actions..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 min-w-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
          />
          <kbd className="hidden sm:inline-flex h-5 shrink-0 items-center rounded border border-border/60 bg-muted/60 px-1.5 text-[10px] font-medium text-muted-foreground/70">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-72 overflow-y-auto py-1">
          {filteredCommands.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Search className="h-6 w-6 text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">No results found</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Try a different search term</p>
            </div>
          ) : (
            Object.entries(grouped).map(([category, items]) => (
              <div key={category}>
                <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                  {categoryLabels[category] || category}
                </p>
                {items.map(cmd => {
                  flatIndex++
                  const isSelected = flatIndex === selectedIndex
                  const currentIndex = flatIndex

                  return (
                    <button
                      key={cmd.id}
                      data-selected={isSelected}
                      onClick={() => handleSelect(cmd)}
                      onMouseEnter={() => setSelectedIndex(currentIndex)}
                      className={cn(
                        'flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors',
                        isSelected ? 'bg-accent text-accent-foreground' : 'text-foreground hover:bg-accent/50'
                      )}
                    >
                      <cmd.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <span className="font-medium">{cmd.label}</span>
                        {cmd.description && (
                          <span className="ml-2 text-xs text-muted-foreground">{cmd.description}</span>
                        )}
                      </div>
                      {isSelected && (
                        <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                      )}
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-3 py-2 flex items-center justify-between text-[11px] text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="h-4 min-w-4 inline-flex items-center justify-center rounded border bg-muted px-1 text-[10px]">&uarr;</kbd>
              <kbd className="h-4 min-w-4 inline-flex items-center justify-center rounded border bg-muted px-1 text-[10px]">&darr;</kbd>
              navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="h-4 min-w-4 inline-flex items-center justify-center rounded border bg-muted px-1 text-[10px]">&crarr;</kbd>
              select
            </span>
          </div>
          <span className="flex items-center gap-1">
            <kbd className="h-4 min-w-4 inline-flex items-center justify-center rounded border bg-muted px-1 text-[10px]">esc</kbd>
            close
          </span>
        </div>
      </DialogContent>
    </Dialog>
  )
}
