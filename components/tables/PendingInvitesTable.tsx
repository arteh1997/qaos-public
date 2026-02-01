'use client'

import { useState } from 'react'
import { PendingInvite } from '@/hooks/usePendingInvites'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ConfirmDialog } from '@/components/dialogs/ConfirmDialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreHorizontal, X, RefreshCw, Clock, Mail } from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'

interface PendingInvitesTableProps {
  invites: PendingInvite[]
  onCancel: (inviteId: string) => Promise<void>
  onResend?: (invite: PendingInvite) => Promise<void>
}

export function PendingInvitesTable({
  invites,
  onCancel,
  onResend,
}: PendingInvitesTableProps) {
  const [cancelingId, setCancelingId] = useState<string | null>(null)
  const [resendingId, setResendingId] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [selectedInvite, setSelectedInvite] = useState<PendingInvite | null>(null)

  const handleCancelClick = (invite: PendingInvite) => {
    setSelectedInvite(invite)
    setConfirmOpen(true)
  }

  const handleConfirmCancel = async () => {
    if (!selectedInvite) return

    setCancelingId(selectedInvite.id)
    try {
      await onCancel(selectedInvite.id)
    } finally {
      setCancelingId(null)
      setConfirmOpen(false)
      setSelectedInvite(null)
    }
  }

  const handleResend = async (invite: PendingInvite) => {
    if (!onResend) return

    setResendingId(invite.id)
    try {
      await onResend(invite)
    } finally {
      setResendingId(null)
    }
  }

  if (invites.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center border rounded-lg">
        <Mail className="h-8 w-8 text-muted-foreground/50 mb-2" />
        <p className="text-sm text-muted-foreground">No pending invitations</p>
        <p className="text-xs text-muted-foreground mt-1">
          Invitations you send will appear here until they are accepted
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Store</TableHead>
              <TableHead>Sent</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead className="w-[70px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invites.map((invite) => {
              const expiresAt = new Date(invite.expires_at)
              const isExpiringSoon = expiresAt.getTime() - Date.now() < 30 * 60 * 1000 // 30 min

              return (
                <TableRow key={invite.id}>
                  <TableCell className="font-medium">{invite.email}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{invite.role}</Badge>
                  </TableCell>
                  <TableCell>
                    {invite.store?.name || (
                      <span className="text-muted-foreground">All stores</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDistanceToNow(new Date(invite.created_at), { addSuffix: true })}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <Clock className={`h-3.5 w-3.5 ${isExpiringSoon ? 'text-yellow-600' : 'text-muted-foreground'}`} />
                      <span className={isExpiringSoon ? 'text-yellow-600' : 'text-muted-foreground'}>
                        {format(expiresAt, 'h:mm a')}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Open menu</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {onResend && (
                          <DropdownMenuItem
                            onClick={() => handleResend(invite)}
                            disabled={resendingId === invite.id}
                          >
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Resend Invitation
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() => handleCancelClick(invite)}
                          disabled={cancelingId === invite.id}
                          className="text-destructive focus:text-destructive"
                        >
                          <X className="mr-2 h-4 w-4" />
                          Cancel Invitation
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Cancel Invitation"
        description={`Are you sure you want to cancel the invitation for ${selectedInvite?.email}? They will no longer be able to join using this link.`}
        confirmLabel="Cancel Invitation"
        cancelLabel="Keep"
        variant="destructive"
        isLoading={cancelingId !== null}
        onConfirm={handleConfirmCancel}
      />
    </>
  )
}
