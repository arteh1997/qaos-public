'use client'

import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { LogOut, User, Shield, Truck, UserCircle } from 'lucide-react'

export function UserNav() {
  const { profile, role, signOut } = useAuth()

  const initials = profile?.full_name
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || profile?.email?.[0]?.toUpperCase() || '?'

  const roleConfig = {
    Admin: {
      icon: Shield,
      color: 'text-red-500',
      bg: 'bg-red-500/10',
      label: 'Administrator',
    },
    Driver: {
      icon: Truck,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10',
      label: 'Driver',
    },
    Staff: {
      icon: UserCircle,
      color: 'text-emerald-500',
      bg: 'bg-emerald-500/10',
      label: 'Staff Member',
    },
  }

  const currentRole = role ? roleConfig[role] : null
  const RoleIcon = currentRole?.icon

  return (
    <div className="flex items-center gap-2">
      <ThemeToggle />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="relative h-10 w-10 rounded-full ring-2 ring-transparent hover:ring-primary/20 transition-all"
            aria-label={`User menu for ${profile?.full_name || profile?.email || 'User'}`}
          >
            <Avatar className="h-10 w-10">
              <AvatarFallback
                className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground font-semibold"
                aria-hidden="true"
              >
                {initials}
              </AvatarFallback>
            </Avatar>
            {role && (
              <span
                className={`absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-2 border-background ${
                  role === 'Admin' ? 'bg-red-500' : role === 'Driver' ? 'bg-blue-500' : 'bg-emerald-500'
                }`}
                aria-hidden="true"
              />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-72" align="end" forceMount>
          <DropdownMenuLabel className="font-normal p-4">
            <div className="flex items-start gap-3">
              <Avatar className="h-12 w-12">
                <AvatarFallback
                  className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground font-semibold text-lg"
                >
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col gap-1 min-w-0">
                <p className="text-sm font-semibold leading-none truncate">
                  {profile?.full_name || 'User'}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {profile?.email}
                </p>
                {currentRole && RoleIcon && (
                  <div className={`inline-flex items-center gap-1.5 mt-1 px-2 py-0.5 rounded-full text-xs font-medium w-fit ${currentRole.bg} ${currentRole.color}`}>
                    <RoleIcon className="h-3 w-3" />
                    {currentRole.label}
                  </div>
                )}
              </div>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <div className="p-1">
            <DropdownMenuItem asChild className="cursor-pointer">
              <Link href="/profile" className="flex items-center gap-2 px-2 py-2">
                <User className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <span>My Profile</span>
              </Link>
            </DropdownMenuItem>
          </div>
          <DropdownMenuSeparator />
          <div className="p-1">
            <DropdownMenuItem
              onSelect={() => signOut()}
              className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/50"
            >
              <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
              Log out
            </DropdownMenuItem>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
