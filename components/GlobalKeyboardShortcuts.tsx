'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { KeyboardShortcutsHelp } from '@/components/dialogs/KeyboardShortcutsHelp'
import { AppRole } from '@/types'
import { canManageInventoryItems, canManageUsers, canViewReports } from '@/lib/auth'

interface GlobalKeyboardShortcutsProps {
  role: AppRole | null
}

export function GlobalKeyboardShortcuts({ role }: GlobalKeyboardShortcutsProps) {
  const router = useRouter()
  const [showHelp, setShowHelp] = useState(false)

  // Navigation shortcuts
  useKeyboardShortcuts([
    // Navigation - Alt+number for quick access
    {
      key: 'alt+1',
      handler: () => router.push('/'),
      description: 'Go to Dashboard',
    },
    {
      key: 'alt+2',
      handler: () => router.push('/stores'),
      description: 'Go to Stores',
    },
    {
      key: 'alt+3',
      handler: () => {
        if (canManageInventoryItems(role)) {
          router.push('/inventory')
        }
      },
      description: 'Go to Inventory',
    },
    {
      key: 'alt+4',
      handler: () => {
        if (canManageUsers(role)) {
          router.push('/users')
        }
      },
      description: 'Go to Users',
    },
    {
      key: 'alt+5',
      handler: () => {
        if (canViewReports(role)) {
          router.push('/reports')
        }
      },
      description: 'Go to Reports',
    },
    {
      key: 'alt+6',
      handler: () => router.push('/shifts'),
      description: 'Go to Shifts',
    },
    // Help toggle
    {
      key: 'shift+?',
      handler: () => setShowHelp(prev => !prev),
      description: 'Toggle keyboard shortcuts help',
    },
    {
      key: 'escape',
      handler: () => setShowHelp(false),
      description: 'Close dialogs',
    },
  ])

  // Build help groups based on role
  const navigationShortcuts = [
    { key: 'alt+1', description: 'Dashboard' },
    { key: 'alt+2', description: 'Stores' },
  ]

  if (canManageInventoryItems(role)) {
    navigationShortcuts.push({ key: 'alt+3', description: 'Inventory' })
  }

  if (canManageUsers(role)) {
    navigationShortcuts.push({ key: 'alt+4', description: 'Users' })
  }

  if (canViewReports(role)) {
    navigationShortcuts.push({ key: 'alt+5', description: 'Reports' })
  }

  navigationShortcuts.push({ key: 'alt+6', description: 'Shifts' })

  const helpGroups = [
    {
      title: 'Navigation',
      shortcuts: navigationShortcuts,
    },
    {
      title: 'General',
      shortcuts: [
        { key: 'shift+?', description: 'Show keyboard shortcuts' },
        { key: 'escape', description: 'Close dialogs' },
      ],
    },
  ]

  return (
    <KeyboardShortcutsHelp
      open={showHelp}
      onOpenChange={setShowHelp}
      groups={helpGroups}
    />
  )
}
