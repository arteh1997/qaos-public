"use client";

import { use, useState } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { useStore } from "@/hooks/useStore";
import { useStoreUsers, StoreUserWithProfile } from "@/hooks/useStoreUsers";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/dialogs/ConfirmDialog";
import {
  ArrowLeft,
  MoreHorizontal,
  UserMinus,
  Crown,
  Shield,
} from "lucide-react";

interface StoreUsersPageProps {
  params: Promise<{ storeId: string }>;
}

export default function StoreUsersPage({ params }: StoreUsersPageProps) {
  const { storeId } = use(params);
  const { stores: userStores } = useAuth();
  const { data: store, isLoading: storeLoading } = useStore(storeId);
  const {
    storeUsers,
    isLoading: usersLoading,
    removeUserFromStore,
  } = useStoreUsers(storeId);
  // TODO: Implement transferBillingOwnership in useStoreUsers hook
  const transferBillingOwnership = async (_userId: string) => {
    toast.error("Billing ownership transfer is not yet implemented");
  };
  const [userToRemove, setUserToRemove] = useState<StoreUserWithProfile | null>(
    null,
  );
  const [userToTransfer, setUserToTransfer] =
    useState<StoreUserWithProfile | null>(null);

  const isLoading = storeLoading || usersLoading;

  // Check if current user is the billing owner
  const currentUserMembership = userStores.find((s) => s.store_id === storeId);
  const isBillingOwner = currentUserMembership?.is_billing_owner ?? false;
  const isOwner = currentUserMembership?.role === "Owner";

  const roleColors: Record<string, string> = {
    Owner: "bg-amber-500",
    Manager: "bg-purple-500",
    Staff: "bg-emerald-500",
  };

  const handleRemoveUser = async () => {
    if (!userToRemove) return;
    await removeUserFromStore(userToRemove.id);
    setUserToRemove(null);
  };

  const handleTransferOwnership = async () => {
    if (!userToTransfer) return;
    await transferBillingOwnership(userToTransfer.id);
    setUserToTransfer(null);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-8 w-48" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!store) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-muted-foreground">Store not found</p>
        <Link href="/">
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <Link href="/">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Store Team</h1>
          <p className="text-muted-foreground">{store.name}</p>
        </div>
      </div>

      {storeUsers.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">
            No users assigned to this store
          </p>
          <Link href="/users">
            <Button>Manage Users</Button>
          </Link>
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                {isOwner && <TableHead className="w-[70px]"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {storeUsers.map((storeUser) => (
                <TableRow key={storeUser.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {storeUser.user?.full_name || "No name"}
                      {storeUser.is_billing_owner && (
                        <Crown
                          className="h-4 w-4 text-amber-500"
                          aria-label="Billing Owner"
                        />
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {storeUser.user?.email}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge
                        className={`${roleColors[storeUser.role]} text-primary-foreground`}
                      >
                        {storeUser.role}
                      </Badge>
                      {storeUser.role === "Owner" &&
                        !storeUser.is_billing_owner && (
                          <span className="text-xs text-muted-foreground">
                            (Co-Owner)
                          </span>
                        )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        storeUser.user?.status === "Active"
                          ? "default"
                          : "secondary"
                      }
                    >
                      {storeUser.user?.status || "Unknown"}
                    </Badge>
                  </TableCell>
                  {isOwner && (
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {/* Transfer billing ownership - only billing owner can do this */}
                          {isBillingOwner &&
                            storeUser.role === "Owner" &&
                            !storeUser.is_billing_owner && (
                              <>
                                <DropdownMenuItem
                                  onClick={() => setUserToTransfer(storeUser)}
                                >
                                  <Crown className="mr-2 h-4 w-4" />
                                  Transfer Billing Ownership
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                              </>
                            )}
                          {/* Remove from store - cannot remove billing owner */}
                          {!storeUser.is_billing_owner && (
                            <DropdownMenuItem
                              onClick={() => setUserToRemove(storeUser)}
                              className="text-destructive"
                            >
                              <UserMinus className="mr-2 h-4 w-4" />
                              Remove from Store
                            </DropdownMenuItem>
                          )}
                          {storeUser.is_billing_owner && (
                            <DropdownMenuItem
                              disabled
                              className="text-muted-foreground"
                            >
                              <Shield className="mr-2 h-4 w-4" />
                              Billing Owner (Protected)
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Remove User Confirmation */}
      <ConfirmDialog
        open={!!userToRemove}
        onOpenChange={(open) => !open && setUserToRemove(null)}
        title="Remove User from Store"
        description={`Are you sure you want to remove ${userToRemove?.user?.full_name || userToRemove?.user?.email} from ${store.name}? They will lose access to this store.`}
        confirmLabel="Remove"
        variant="destructive"
        onConfirm={handleRemoveUser}
      />

      {/* Transfer Ownership Confirmation */}
      <ConfirmDialog
        open={!!userToTransfer}
        onOpenChange={(open) => !open && setUserToTransfer(null)}
        title="Transfer Billing Ownership"
        description={`Are you sure you want to transfer billing ownership of ${store.name} to ${userToTransfer?.user?.full_name || userToTransfer?.user?.email}? They will become responsible for the store subscription and you will become a co-owner.`}
        confirmLabel="Transfer Ownership"
        variant="default"
        onConfirm={handleTransferOwnership}
      />
    </div>
  );
}
