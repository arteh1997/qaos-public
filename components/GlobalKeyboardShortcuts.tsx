'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { KeyboardShortcutsHelp } from '@/components/dialogs/KeyboardShortcutsHelp'
import { AppRole } from '@/types'
import { canManageInventoryItems, canManageUsers, canViewReports } from '@/lib/auth'

interface GlobalKeyboardShortcutsProps {
  role: AppRole | null
  onOpenCommandPalette?: () => void
}

export function GlobalKeyboardShortcuts({ role, onOpenCommandPalette }: GlobalKeyboardShortcutsProps) {
  const router = useRouter()
  const [showHelp, setShowHelp] = useState(false)

  // Cmd+K / Ctrl+K for command palette
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        onOpenCommandPalette?.()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onOpenCommandPalette])

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
      handler: () => {
        if (canManageInventoryItems(role)) {
          router.push('/inventory')
        }
      },
      description: 'Go to Inventory',
    },
    {
      key: 'alt+3',
      handler: () => {
        if (canManageUsers(role)) {
          router.push('/users')
        }
      },
      description: 'Go to Users',
    },
    {
      key: 'alt+4',
      handler: () => {
        if (canViewReports(role)) {
          router.push('/reports')
        }
      },
      description: 'Go to Reports',
    },
    {
      key: 'alt+5',
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
  ]

  if (canManageInventoryItems(role)) {
    navigationShortcuts.push({ key: 'alt+2', description: 'Inventory' })
  }

  if (canManageUsers(role)) {
    navigationShortcuts.push({ key: 'alt+3', description: 'Users' })
  }

  if (canViewReports(role)) {
    navigationShortcuts.push({ key: 'alt+4', description: 'Reports' })
  }

  navigationShortcuts.push({ key: 'alt+5', description: 'Shifts' })

  const helpGroups = [
    {
      title: 'Navigation',
      shortcuts: navigationShortcuts,
    },
    {
      title: 'General',
      shortcuts: [
        { key: '⌘K', description: 'Open command palette' },
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
