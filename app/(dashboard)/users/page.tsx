"use client";

import { Suspense, useState, useMemo, useCallback } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useUsers, UsersFilters } from "@/hooks/useUsers";
import { useStores } from "@/hooks/useStores";
import { useShifts } from "@/hooks/useShifts";
import { usePendingInvites } from "@/hooks/usePendingInvites";
import { InviteUserForm } from "@/components/forms/InviteUserForm";
import { UserForm } from "@/components/forms/UserForm";
import { BulkUserImportForm } from "@/components/forms/BulkUserImportForm";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  PageHeaderSkeleton,
  UsersTableSkeleton,
} from "@/components/ui/skeletons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/dialogs/ConfirmDialog";
import { Profile, AppRole } from "@/types";
import { InviteUserFormData, UpdateUserFormData } from "@/lib/validations/user";
import {
  Plus,
  Search,
  Mail,
  Phone,
  Calendar,
  MoreHorizontal,
  Pencil,
  Trash2,
  X,
  Send,
  UserPlus,
  Upload,
} from "lucide-react";
import { useCSRF } from "@/hooks/useCSRF";
import { toast } from "sonner";
import { format } from "date-fns";
import { PageGuide } from "@/components/help/PageGuide";
import Link from "next/link";

// Store user entry with store name for display
type StoreUserWithStore = {
  store_id: string;
  role: AppRole;
  is_billing_owner: boolean;
  store: { id: string; name: string } | null;
};

type UserWithStore = Profile & {
  store?: { id: string; name: string } | null;
  store_users?: StoreUserWithStore[];
};

// --- Helpers ---

function getInitials(name: string | null) {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

const ROLE_STYLES: Record<string, { dot: string; bg: string; text: string }> = {
  Owner: { dot: "bg-amber-500", bg: "bg-amber-500/10", text: "text-amber-400" },
  "Co-Owner": {
    dot: "bg-amber-400",
    bg: "bg-amber-500/10",
    text: "text-amber-400",
  },
  Manager: { dot: "bg-blue-500", bg: "bg-blue-500/10", text: "text-blue-400" },
  Staff: {
    dot: "bg-emerald-500",
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
  },
};

function RoleBadge({ role }: { role: string }) {
  const style = ROLE_STYLES[role] || {
    dot: "bg-muted-foreground",
    bg: "bg-muted",
    text: "text-muted-foreground",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium ${style.bg} ${style.text}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
      {role}
    </span>
  );
}

function StatusDot({ status }: { status: string }) {
  const color =
    status === "Active"
      ? "bg-emerald-500"
      : status === "Invited"
        ? "bg-amber-400"
        : "bg-muted-foreground/40";
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className={`h-1.5 w-1.5 rounded-full ${color}`} />
      {status}
    </span>
  );
}

// --- Main Component ---

function UsersPageContent() {
  const { currentStore, role: currentUserRole } = useAuth();
  const { csrfFetch } = useCSRF();
  const currentStoreId = currentStore?.store_id;
  const { stores, isLoading: storesLoading } = useStores();
  const { shifts, isLoading: shiftsLoading } = useShifts(
    currentStoreId || null,
  );
  const {
    invites: pendingInvites,
    cancelInvite,
    resendInvite,
    refetch: refetchInvites,
  } = usePendingInvites();

  const [searchInput, setSearchInput] = useState("");
  const [roleFilter, setRoleFilter] = useState<AppRole | "all">("all");

  const usersFilters: UsersFilters = {
    role: "all",
    status: "all",
    storeId: currentStoreId || "all",
    page: 1,
  };

  const { users, isLoading, updateUser, deleteUser, refetch } =
    useUsers(usersFilters);

  // Form state
  const [inviteFormOpen, setInviteFormOpen] = useState(false);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [editFormOpen, setEditFormOpen] = useState(false);
  const [editUser, setEditUser] = useState<Profile | null>(null);
  const [isInviting, setIsInviting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [deleteUser_, setDeleteUser_] = useState<Profile | null>(null);

  // Shifts
  const activeShifts = useMemo(() => {
    const now = new Date();
    return shifts.filter((shift) => {
      const start = new Date(shift.start_time);
      const end = new Date(shift.end_time);
      return now >= start && now <= end;
    });
  }, [shifts]);

  const onShiftUserIds = useMemo(
    () => new Set(activeShifts.map((s) => s.user_id)),
    [activeShifts],
  );

  // Get display role for a user at the current store
  const getDisplayRole = useCallback(
    (user: UserWithStore): string => {
      if (!currentStoreId || !user.store_users) return user.role;
      const entry = user.store_users.find(
        (su) => su.store_id === currentStoreId,
      );
      if (entry) {
        if (entry.role === "Owner")
          return entry.is_billing_owner ? "Owner" : "Co-Owner";
        return entry.role;
      }
      return user.role;
    },
    [currentStoreId],
  );

  const isBillingOwner = useCallback((user: UserWithStore): boolean => {
    return user.store_users?.some((su) => su.is_billing_owner) ?? false;
  }, []);

  // Filtered + sorted users
  const filteredUsers = useMemo(() => {
    let filtered = users.filter((u) => u.status === "Active");

    if (searchInput) {
      const search = searchInput.toLowerCase();
      filtered = filtered.filter(
        (u) =>
          u.full_name?.toLowerCase().includes(search) ||
          u.email.toLowerCase().includes(search),
      );
    }

    if (roleFilter !== "all") {
      filtered = filtered.filter((u) => {
        const role = getDisplayRole(u as UserWithStore);
        // "Owners" filter includes both Owner and Co-Owner
        if (roleFilter === "Owner")
          return role === "Owner" || role === "Co-Owner";
        return role === roleFilter;
      });
    }

    // Sort: on-shift first, then by name
    return [...filtered].sort((a, b) => {
      const aOnShift = onShiftUserIds.has(a.id) ? 0 : 1;
      const bOnShift = onShiftUserIds.has(b.id) ? 0 : 1;
      if (aOnShift !== bOnShift) return aOnShift - bOnShift;
      return (a.full_name || "").localeCompare(b.full_name || "");
    });
  }, [users, searchInput, roleFilter, getDisplayRole, onShiftUserIds]);

  // Stats
  const stats = useMemo(() => {
    const activeUsers = users.filter((u) => u.status === "Active");
    const scheduledToday = new Set(
      shifts
        .filter(
          (s) =>
            new Date(s.start_time).toDateString() === new Date().toDateString(),
        )
        .map((s) => s.user_id),
    );
    return {
      total: activeUsers.length,
      onShift: activeShifts.length > 0 ? onShiftUserIds.size : 0,
      scheduledToday: scheduledToday.size,
    };
  }, [users, shifts, activeShifts, onShiftUserIds]);

  // Role counts
  const roleCounts = useMemo(() => {
    const active = users.filter((u) => u.status === "Active");
    return {
      all: active.length,
      Owner: active.filter((u) => {
        const r = getDisplayRole(u as UserWithStore);
        return r === "Owner" || r === "Co-Owner";
      }).length,
      Manager: active.filter(
        (u) => getDisplayRole(u as UserWithStore) === "Manager",
      ).length,
      Staff: active.filter(
        (u) => getDisplayRole(u as UserWithStore) === "Staff",
      ).length,
    };
  }, [users, getDisplayRole]);

  // Handlers
  const handleInvite = async (data: InviteUserFormData) => {
    setIsInviting(true);
    try {
      const response = await csrfFetch("/api/users/invite", {
        method: "POST",
        body: JSON.stringify(data),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.message || "Failed to send invitation");
      toast.success(`Invitation sent to ${data.email}`);
      setInviteFormOpen(false);
      refetch();
      refetchInvites();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to send invitation",
      );
    } finally {
      setIsInviting(false);
    }
  };

  const handleEdit = (user: Profile) => {
    setEditUser(user);
    setEditFormOpen(true);
  };

  const handleUpdate = async (data: UpdateUserFormData) => {
    if (!editUser) return;
    setIsUpdating(true);
    try {
      await updateUser({
        id: editUser.id,
        data: {
          full_name: data.fullName,
          role: data.role,
          status: data.status,
        },
      });
      setEditFormOpen(false);
      setEditUser(null);
    } catch {
      // Error handled by hook
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = () => {
    if (deleteUser_ && currentStoreId) {
      deleteUser(deleteUser_.id, currentStoreId);
      setDeleteUser_(null);
    }
  };

  // --- Loading ---
  if (isLoading || storesLoading || shiftsLoading) {
    return (
      <div className="space-y-6">
        <PageHeaderSkeleton />
        <UsersTableSkeleton rows={8} />
      </div>
    );
  }

  // --- No store ---
  if (!currentStore) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">
            Team
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Select a store to manage your team
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">
            Team
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {stats.total} {stats.total === 1 ? "member" : "members"}
            {stats.onShift > 0 && (
              <span className="mx-1.5 text-muted-foreground/40">&middot;</span>
            )}
            {stats.onShift > 0 && (
              <span className="text-emerald-400">{stats.onShift} on shift</span>
            )}
            {stats.scheduledToday > 0 && (
              <span className="mx-1.5 text-muted-foreground/40">&middot;</span>
            )}
            {stats.scheduledToday > 0 && (
              <span>{stats.scheduledToday} scheduled today</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PageGuide pageKey="users" />
          {(currentUserRole === "Owner" || currentUserRole === "Manager") && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBulkImportOpen(true)}
            >
              <Upload className="h-4 w-4 mr-1.5" />
              Import
            </Button>
          )}
          <Button onClick={() => setInviteFormOpen(true)} size="sm">
            <Plus className="h-4 w-4 mr-1.5" />
            Invite
          </Button>
        </div>
      </div>

      {/* Pending Invitations Banner */}
      {pendingInvites.length > 0 && (
        <div className="rounded-lg border bg-card">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Pending invitations</span>
              <span className="text-xs text-muted-foreground">
                ({pendingInvites.length})
              </span>
            </div>
          </div>
          <div className="divide-y">
            {pendingInvites.map((invite) => (
              <div
                key={invite.id}
                className="flex items-center justify-between px-4 py-3 gap-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{invite.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {invite.role} &middot; Sent{" "}
                    {format(new Date(invite.created_at), "MMM d")}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-xs"
                    onClick={() => resendInvite(invite.id)}
                  >
                    <Send className="h-3.5 w-3.5 mr-1" />
                    Resend
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => cancelInvite(invite.id)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search + Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9 h-9 bg-card"
          />
        </div>
        <div className="flex gap-1">
          {(["all", "Owner", "Manager", "Staff"] as const).map((role) => {
            const count =
              role === "all"
                ? roleCounts.all
                : roleCounts[role as keyof typeof roleCounts];
            const isActive = roleFilter === role;
            return (
              <button
                key={role}
                onClick={() =>
                  setRoleFilter(role === "all" ? "all" : (role as AppRole))
                }
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  isActive
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                {role === "all"
                  ? "All"
                  : role === "Owner"
                    ? "Owners"
                    : `${role}s`}
                <span className="ml-1 tabular-nums">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Team List */}
      {filteredUsers.length === 0 ? (
        <div className="rounded-lg border bg-card py-16 text-center">
          <div className="mx-auto w-10 h-10 rounded-full bg-muted flex items-center justify-center mb-3">
            <UserPlus className="h-5 w-5 text-muted-foreground" />
          </div>
          <h3 className="text-sm font-medium mb-1">
            {searchInput ? "No results found" : "No team members yet"}
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            {searchInput
              ? "Try a different search term."
              : "Invite your first team member to get started."}
          </p>
          {!searchInput && (
            <Button size="sm" onClick={() => setInviteFormOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" />
              Invite
            </Button>
          )}
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block rounded-lg border bg-card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">
                    Member
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 hidden lg:table-cell">
                    Contact
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">
                    Role
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">
                    Status
                  </th>
                  <th className="w-10 px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredUsers.map((user) => {
                  const displayRole = getDisplayRole(user as UserWithStore);
                  const isOnShift = onShiftUserIds.has(user.id);
                  const shift = isOnShift
                    ? activeShifts.find((s) => s.user_id === user.id)
                    : null;
                  const style = ROLE_STYLES[displayRole] || ROLE_STYLES.Staff;

                  return (
                    <tr
                      key={user.id}
                      className="group hover:bg-muted/30 transition-colors"
                    >
                      {/* Member */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <Avatar className="h-9 w-9">
                              <AvatarFallback
                                className={`${style.bg} ${style.text} text-xs font-semibold`}
                              >
                                {getInitials(user.full_name)}
                              </AvatarFallback>
                            </Avatar>
                            {isOnShift && (
                              <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 border-2 border-card" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">
                              {user.full_name || "No name"}
                            </p>
                            <p className="text-xs text-muted-foreground truncate lg:hidden">
                              {user.email}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Contact */}
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <div className="space-y-0.5">
                          <p className="text-sm text-muted-foreground truncate">
                            {user.email}
                          </p>
                          {user.phone && (
                            <p className="text-xs text-muted-foreground">
                              {user.phone}
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Role */}
                      <td className="px-4 py-3">
                        <RoleBadge role={displayRole} />
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        {isOnShift && shift ? (
                          <span className="text-xs font-medium text-emerald-400">
                            On shift until{" "}
                            {format(new Date(shift.end_time), "h:mm a")}
                          </span>
                        ) : (
                          <StatusDot status={user.status} />
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem onClick={() => handleEdit(user)}>
                              <Pencil className="h-4 w-4 mr-2" />
                              Edit member
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link href={`/shifts?user=${user.id}`}>
                                <Calendar className="h-4 w-4 mr-2" />
                                View schedule
                              </Link>
                            </DropdownMenuItem>
                            {user.phone && (
                              <DropdownMenuItem
                                onClick={() =>
                                  window.open(`tel:${user.phone}`, "_self")
                                }
                              >
                                <Phone className="h-4 w-4 mr-2" />
                                Call {user.full_name?.split(" ")[0] || "member"}
                              </DropdownMenuItem>
                            )}
                            {user.email && (
                              <DropdownMenuItem
                                onClick={() =>
                                  window.open(`mailto:${user.email}`, "_self")
                                }
                              >
                                <Mail className="h-4 w-4 mr-2" />
                                Send email
                              </DropdownMenuItem>
                            )}
                            {!isBillingOwner(user as UserWithStore) && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => setDeleteUser_(user)}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Remove from store
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile List */}
          <div className="md:hidden space-y-2">
            {filteredUsers.map((user) => {
              const displayRole = getDisplayRole(user as UserWithStore);
              const isOnShift = onShiftUserIds.has(user.id);
              const shift = isOnShift
                ? activeShifts.find((s) => s.user_id === user.id)
                : null;
              const style = ROLE_STYLES[displayRole] || ROLE_STYLES.Staff;

              return (
                <div
                  key={user.id}
                  className="rounded-lg border bg-card px-4 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="relative shrink-0">
                        <Avatar className="h-9 w-9">
                          <AvatarFallback
                            className={`${style.bg} ${style.text} text-xs font-semibold`}
                          >
                            {getInitials(user.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        {isOnShift && (
                          <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 border-2 border-card" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {user.full_name || "No name"}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {user.email}
                        </p>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 shrink-0"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onClick={() => handleEdit(user)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit member
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={`/shifts?user=${user.id}`}>
                            <Calendar className="h-4 w-4 mr-2" />
                            View schedule
                          </Link>
                        </DropdownMenuItem>
                        {user.phone && (
                          <DropdownMenuItem
                            onClick={() =>
                              window.open(`tel:${user.phone}`, "_self")
                            }
                          >
                            <Phone className="h-4 w-4 mr-2" />
                            Call
                          </DropdownMenuItem>
                        )}
                        {!isBillingOwner(user as UserWithStore) && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => setDeleteUser_(user)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Remove from store
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="flex items-center gap-2 mt-2 ml-12">
                    <RoleBadge role={displayRole} />
                    {isOnShift && shift ? (
                      <span className="text-xs font-medium text-emerald-400">
                        On shift until{" "}
                        {format(new Date(shift.end_time), "h:mm a")}
                      </span>
                    ) : (
                      <StatusDot status={user.status} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Bulk Import Dialog */}
      <Dialog open={bulkImportOpen} onOpenChange={setBulkImportOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Bulk Import Users</DialogTitle>
          </DialogHeader>
          <BulkUserImportForm
            stores={stores}
            onSuccess={() => {
              setBulkImportOpen(false);
              refetch();
              refetchInvites();
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Dialogs */}
      <InviteUserForm
        open={inviteFormOpen}
        onOpenChange={setInviteFormOpen}
        stores={stores}
        onSubmit={handleInvite}
        isLoading={isInviting}
        inviterRole={
          (currentStore?.role || currentUserRole || "Owner") as AppRole
        }
      />

      <UserForm
        open={editFormOpen}
        onOpenChange={(open) => {
          setEditFormOpen(open);
          if (!open) setEditUser(null);
        }}
        user={editUser}
        onSubmit={handleUpdate}
        isLoading={isUpdating}
      />

      <ConfirmDialog
        open={!!deleteUser_}
        onOpenChange={(open) => {
          if (!open) setDeleteUser_(null);
        }}
        title="Remove from store"
        description={`Remove ${deleteUser_?.full_name || deleteUser_?.email} from this store? They'll lose access but their account stays active.`}
        confirmLabel="Remove"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  );
}

export default function UsersPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <PageHeaderSkeleton />
          <UsersTableSkeleton rows={8} />
        </div>
      }
    >
      <UsersPageContent />
    </Suspense>
  );
}
