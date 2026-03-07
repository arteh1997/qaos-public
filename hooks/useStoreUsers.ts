"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppRole, StoreUser, Profile } from "@/types";
import { useCSRF } from "./useCSRF";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export interface StoreUserWithProfile extends StoreUser {
  user: Profile;
}

/**
 * Fetch users for a specific store
 */
async function fetchStoreUsers(
  storeId: string,
): Promise<StoreUserWithProfile[]> {
  if (!storeId) {
    return [];
  }

  const response = await fetch(`/api/stores/${storeId}/users`);
  if (!response.ok) {
    throw new Error("Failed to fetch store users");
  }

  const data = await response.json();
  return data.data || [];
}

/**
 * TanStack Query hook for store users
 *
 * Replaces the old useStoreUsers hook with:
 * - No race conditions when adding/removing users
 * - Proper request sequencing
 * - Automatic cache invalidation
 *
 * @example
 * const { data: users, isLoading } = useStoreUsersQuery('store-id')
 */
export function useStoreUsersQuery(storeId: string | null) {
  return useQuery({
    queryKey: ["store-users", storeId],
    queryFn: () => {
      if (!storeId) throw new Error("Store ID is required");
      return fetchStoreUsers(storeId);
    },
    enabled: !!storeId,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

/**
 * Mutation hook for adding a user to a store
 */
export function useAddUserToStore(storeId: string | null) {
  const queryClient = useQueryClient();
  const { csrfFetch } = useCSRF();
  const { refreshProfile } = useAuth();

  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      if (!storeId) throw new Error("Store ID is required");

      const response = await csrfFetch(`/api/stores/${storeId}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, role }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to add user to store");
      }

      return response.json();
    },
    onSuccess: () => {
      if (storeId) {
        queryClient.invalidateQueries({ queryKey: ["store-users", storeId] });
      }
      refreshProfile();
      toast.success("User added to store");
    },
    onError: (err) => {
      toast.error(
        "Failed to add user: " +
          (err instanceof Error ? err.message : "Unknown error"),
      );
    },
  });
}

/**
 * Mutation hook for removing a user from a store
 */
export function useRemoveUserFromStore(storeId: string | null) {
  const queryClient = useQueryClient();
  const { csrfFetch } = useCSRF();
  const { refreshProfile } = useAuth();

  return useMutation({
    mutationFn: async (userId: string) => {
      if (!storeId) throw new Error("Store ID is required");

      const response = await csrfFetch(
        `/api/stores/${storeId}/users/${userId}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.message || "Failed to remove user from store",
        );
      }

      return response.json();
    },
    // Optimistic update
    onMutate: async (userId) => {
      if (!storeId) return;

      await queryClient.cancelQueries({ queryKey: ["store-users", storeId] });
      const previousUsers = queryClient.getQueryData(["store-users", storeId]);

      queryClient.setQueryData<StoreUserWithProfile[]>(
        ["store-users", storeId],
        (old) => {
          if (!old) return old;
          return old.filter((su) => su.user_id !== userId);
        },
      );

      return { previousUsers };
    },
    onError: (err, _userId, context) => {
      if (context?.previousUsers && storeId) {
        queryClient.setQueryData(
          ["store-users", storeId],
          context.previousUsers,
        );
      }
      toast.error(
        "Failed to remove user: " +
          (err instanceof Error ? err.message : "Unknown error"),
      );
    },
    onSuccess: () => {
      if (storeId) {
        queryClient.invalidateQueries({ queryKey: ["store-users", storeId] });
      }
      refreshProfile();
      toast.success("User removed from store");
    },
  });
}

/**
 * Mutation hook for updating a user's role at a store
 */
export function useUpdateUserRole(storeId: string | null) {
  const queryClient = useQueryClient();
  const { csrfFetch } = useCSRF();
  const { refreshProfile } = useAuth();

  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      if (!storeId) throw new Error("Store ID is required");

      const response = await csrfFetch(
        `/api/stores/${storeId}/users/${userId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role }),
        },
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to update user role");
      }

      return response.json();
    },
    // Optimistic update
    onMutate: async ({ userId, role }) => {
      if (!storeId) return;

      await queryClient.cancelQueries({ queryKey: ["store-users", storeId] });
      const previousUsers = queryClient.getQueryData(["store-users", storeId]);

      queryClient.setQueryData<StoreUserWithProfile[]>(
        ["store-users", storeId],
        (old) => {
          if (!old) return old;
          return old.map((su) =>
            su.user_id === userId ? { ...su, role: role as AppRole } : su,
          );
        },
      );

      return { previousUsers };
    },
    onError: (err, _variables, context) => {
      if (context?.previousUsers && storeId) {
        queryClient.setQueryData(
          ["store-users", storeId],
          context.previousUsers,
        );
      }
      toast.error(
        "Failed to update role: " +
          (err instanceof Error ? err.message : "Unknown error"),
      );
    },
    onSuccess: () => {
      if (storeId) {
        queryClient.invalidateQueries({ queryKey: ["store-users", storeId] });
      }
      refreshProfile();
      toast.success("User role updated");
    },
  });
}

/**
 * Mutation hook for transferring billing ownership
 */
export function useTransferBillingOwnership(storeId: string | null) {
  const queryClient = useQueryClient();
  const { csrfFetch } = useCSRF();
  const { refreshProfile } = useAuth();

  return useMutation({
    mutationFn: async (newBillingOwnerUserId: string) => {
      if (!storeId) throw new Error("Store ID is required");

      const response = await csrfFetch(`/api/stores/${storeId}/billing-owner`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newBillingOwnerId: newBillingOwnerUserId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.message || "Failed to transfer billing ownership",
        );
      }

      return response.json();
    },
    onSuccess: () => {
      if (storeId) {
        queryClient.invalidateQueries({ queryKey: ["store-users", storeId] });
      }
      refreshProfile();
      toast.success("Billing ownership transferred successfully");
    },
    onError: (err) => {
      toast.error(
        "Failed to transfer billing ownership: " +
          (err instanceof Error ? err.message : "Unknown error"),
      );
    },
  });
}

/**
 * Combined hook that matches the old useStoreUsers API
 *
 * @example
 * const { storeUsers, addUserToStore, removeUserFromStore, updateUserRole, isLoading } = useStoreUsers('store-id')
 */
export function useStoreUsers(storeId: string | null) {
  const query = useStoreUsersQuery(storeId);
  const addMutation = useAddUserToStore(storeId);
  const removeMutation = useRemoveUserFromStore(storeId);
  const updateRoleMutation = useUpdateUserRole(storeId);
  const transferMutation = useTransferBillingOwnership(storeId);

  return {
    storeUsers: query.data || [],
    isLoading: query.isLoading,
    error: query.error,
    addUserToStore: addMutation.mutate,
    removeUserFromStore: removeMutation.mutate,
    updateUserRole: updateRoleMutation.mutate,
    transferBillingOwnership: transferMutation.mutateAsync,
    isAdding: addMutation.isPending,
    isRemoving: removeMutation.isPending,
    isUpdatingRole: updateRoleMutation.isPending,
    isTransferring: transferMutation.isPending,
    refetch: query.refetch,
  };
}
