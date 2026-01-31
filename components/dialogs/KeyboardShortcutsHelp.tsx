'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatKeyCombo, usePlatform } from '@/hooks/useKeyboardShortcuts'
import { Keyboard } from 'lucide-react'

interface ShortcutItem {
  key: string
  description: string
}

interface ShortcutGroup {
  title: string
  shortcuts: ShortcutItem[]
}

interface KeyboardShortcutsHelpProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  groups: ShortcutGroup[]
}

function ShortcutKey({ combo }: { combo: string }) {
  const platform = usePlatform()
  const formatted = formatKeyCombo(combo, platform)

  return (
    <kbd className="px-2 py-1 text-xs font-semibold bg-muted border rounded">
      {formatted}
    </kbd>
  )
}

export function KeyboardShortcutsHelp({
  open,
  onOpenChange,
  groups,
}: KeyboardShortcutsHelpProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            Keyboard Shortcuts
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-6 py-4">
          {groups.map((group) => (
            <div key={group.title}>
              <h4 className="text-sm font-medium text-muted-foreground mb-3">
                {group.title}
              </h4>
              <div className="space-y-2">
                {group.shortcuts.map((shortcut) => (
                  <div
                    key={shortcut.key}
                    className="flex items-center justify-between"
                  >
                    <span className="text-sm">{shortcut.description}</span>
                    <ShortcutKey combo={shortcut.key} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground text-center">
          Press <ShortcutKey combo="?" /> to toggle this help
        </p>
      </DialogContent>
    </Dialog>
  )
}
