'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useNotifications, Notification } from '@/hooks/useNotifications'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Bell, AlertTriangle, XCircle, Info, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

const TYPE_CONFIG: Record<Notification['type'], { icon: typeof XCircle; color: string; bg: string }> = {
  critical: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-50' },
  warning: { icon: AlertTriangle, color: 'text-yellow-600', bg: 'bg-yellow-50' },
  info: { icon: Info, color: 'text-blue-600', bg: 'bg-blue-50' },
}

export function NotificationBell() {
  const { notifications, criticalCount, totalCount } = useNotifications()
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 text-white/70 hover:text-white hover:bg-white/10"
          aria-label={`${totalCount} notification${totalCount !== 1 ? 's' : ''}`}
        >
          <Bell className="h-4 w-4" />
          {totalCount > 0 && (
            <span
              className={cn(
                'absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white',
                criticalCount > 0 ? 'bg-red-500' : 'bg-yellow-500'
              )}
            >
              {totalCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 p-0"
        align="end"
        sideOffset={8}
      >
        <div className="border-b px-4 py-3">
          <h3 className="text-sm font-semibold">Notifications</h3>
          {totalCount === 0 && (
            <p className="text-xs text-muted-foreground mt-0.5">You&apos;re all caught up</p>
          )}
        </div>

        {totalCount === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Bell className="h-8 w-8 text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">No notifications</p>
            <p className="text-xs text-muted-foreground/70 mt-1">Everything looks good</p>
          </div>
        ) : (
          <div className="max-h-80 overflow-y-auto">
            {notifications.map((notification) => {
              const config = TYPE_CONFIG[notification.type]
              const Icon = config.icon

              return (
                <Link
                  key={notification.id}
                  href={notification.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    'flex items-start gap-3 px-4 py-3 border-b last:border-0 transition-colors hover:bg-muted/50',
                    config.bg
                  )}
                >
                  <div className={cn('mt-0.5 shrink-0', config.color)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium leading-tight">{notification.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {notification.description}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/50 mt-0.5 shrink-0" />
                </Link>
              )
            })}
          </div>
        )}

        {totalCount > 0 && (
          <div className="border-t px-4 py-2">
            <Link href="/activity" onClick={() => setOpen(false)}>
              <Button variant="ghost" size="sm" className="w-full text-xs h-8">
                View Activity Log
                <ChevronRight className="h-3 w-3 ml-1" />
              </Button>
            </Link>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
