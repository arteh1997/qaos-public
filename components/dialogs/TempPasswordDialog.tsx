'use client'

import { useState } from 'react'
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
import { Copy, Eye, EyeOff, Check, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'

interface TempPasswordDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  email: string
  tempPassword: string
}

export function TempPasswordDialog({
  open,
  onOpenChange,
  email,
  tempPassword,
}: TempPasswordDialogProps) {
  const [showPassword, setShowPassword] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(tempPassword)
      setCopied(true)
      toast.success('Password copied to clipboard')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Failed to copy password')
    }
  }

  const handleClose = () => {
    setShowPassword(false)
    setCopied(false)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            User Created Successfully
          </DialogTitle>
          <DialogDescription>
            A temporary password has been generated for <strong>{email}</strong>.
            Please copy it now - this is the only time it will be displayed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="temp-password">Temporary Password</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="temp-password"
                  type={showPassword ? 'text' : 'password'}
                  value={tempPassword}
                  readOnly
                  className="pr-10 font-mono"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="sr-only">
                    {showPassword ? 'Hide password' : 'Show password'}
                  </span>
                </Button>
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleCopy}
                className={copied ? 'text-green-600' : ''}
              >
                {copied ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                <span className="sr-only">Copy password</span>
              </Button>
            </div>
          </div>

          <div className="rounded-md bg-amber-50 dark:bg-amber-950 p-3 text-sm text-amber-800 dark:text-amber-200">
            <p className="font-medium">Important:</p>
            <ul className="list-disc list-inside mt-1 space-y-1">
              <li>Share this password securely with the user</li>
              <li>The user should change it upon first login</li>
              <li>This password will not be shown again</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={handleClose} className="w-full sm:w-auto">
            I&apos;ve Copied the Password
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
