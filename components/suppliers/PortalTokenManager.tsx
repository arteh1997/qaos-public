"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Copy, Key, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { getCSRFHeaders } from "@/hooks/useCSRF";

interface PortalToken {
  id: string;
  token_prefix: string;
  name: string;
  is_active: boolean;
  can_view_orders: boolean;
  can_upload_invoices: boolean;
  can_update_catalog: boolean;
  can_update_order_status: boolean;
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
}

interface PortalTokenManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplierId: string;
  supplierName: string;
}

export function PortalTokenManager({
  open,
  onOpenChange,
  supplierId,
  supplierName,
}: PortalTokenManagerProps) {
  const { currentStore } = useAuth();
  const storeId = currentStore?.store_id;
  const [tokens, setTokens] = useState<PortalToken[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Form state
  const [tokenName, setTokenName] = useState("Default");
  const [permissions, setPermissions] = useState({
    can_view_orders: true,
    can_upload_invoices: true,
    can_update_catalog: true,
    can_update_order_status: false,
  });

  const fetchTokens = useCallback(async () => {
    if (!storeId) return;
    setIsLoading(true);
    try {
      const res = await fetch(
        `/api/stores/${storeId}/suppliers/${supplierId}/portal-tokens`,
      );
      const data = await res.json();
      if (data.success !== false) {
        setTokens(Array.isArray(data.data) ? data.data : data);
      }
    } finally {
      setIsLoading(false);
    }
  }, [storeId, supplierId]);

  useEffect(() => {
    if (open) fetchTokens();
  }, [open, fetchTokens]);

  const handleCreate = async () => {
    if (!storeId) return;
    setCreating(true);
    try {
      const res = await fetch(
        `/api/stores/${storeId}/suppliers/${supplierId}/portal-tokens`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...getCSRFHeaders(),
          },
          body: JSON.stringify({ name: tokenName, ...permissions }),
        },
      );
      const data = await res.json();
      if (data.data?.token) {
        setNewToken(data.data.token);
        toast.success("Portal token created");
        fetchTokens();
      } else {
        toast.error(data.message || "Failed to create token");
      }
    } catch {
      toast.error("Failed to create token");
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const portalUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/portal`
      : "/portal";

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Portal Access — {supplierName}</DialogTitle>
            <DialogDescription>
              Create and manage portal tokens for this supplier. Tokens allow
              them to view orders, upload invoices, and update their catalog.
            </DialogDescription>
          </DialogHeader>

          {/* New token display */}
          {newToken && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4 space-y-2">
              <p className="text-sm font-medium text-emerald-800">
                New token created — copy it now, it won&apos;t be shown again:
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-card p-2 rounded border font-mono break-all">
                  {newToken}
                </code>
                <Button
                  size="icon"
                  variant="outline"
                  className="h-8 w-8 shrink-0"
                  onClick={() => handleCopy(newToken)}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <span className="text-xs text-muted-foreground">
                  Portal URL:
                </span>
                <code className="text-xs text-emerald-400">{portalUrl}</code>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={() => handleCopy(portalUrl)}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="mt-1"
                onClick={() => setNewToken(null)}
              >
                Dismiss
              </Button>
            </div>
          )}

          {/* Token list */}
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-14" />
              ))}
            </div>
          ) : tokens.length === 0 ? (
            <div className="text-center py-8 space-y-2">
              <Key className="h-8 w-8 mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No portal tokens yet
              </p>
              <p className="text-xs text-muted-foreground">
                Create a token and share it with {supplierName} to give them
                portal access.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {tokens.map((token) => (
                <div
                  key={token.id}
                  className="border rounded-lg p-3 space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Key className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-sm font-medium">{token.name}</span>
                    </div>
                    <Badge
                      className={
                        token.is_active
                          ? "bg-emerald-500/10 text-emerald-400"
                          : "bg-muted text-muted-foreground"
                      }
                    >
                      {token.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <code className="font-mono">{token.token_prefix}...</code>
                    {token.last_used_at && (
                      <span>
                        Last used{" "}
                        {new Date(token.last_used_at).toLocaleDateString(
                          "en-GB",
                        )}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {token.can_view_orders && (
                      <Badge variant="secondary" className="text-xs">
                        Orders
                      </Badge>
                    )}
                    {token.can_upload_invoices && (
                      <Badge variant="secondary" className="text-xs">
                        Invoices
                      </Badge>
                    )}
                    {token.can_update_catalog && (
                      <Badge variant="secondary" className="text-xs">
                        Catalog
                      </Badge>
                    )}
                    {token.can_update_order_status && (
                      <Badge variant="secondary" className="text-xs">
                        Status
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(portalUrl, "_blank")}
            >
              <ExternalLink className="h-3.5 w-3.5 mr-1" />
              Open Portal
            </Button>
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Create Token
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Token Dialog */}
      <AlertDialog open={showCreate} onOpenChange={setShowCreate}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Create Portal Token</AlertDialogTitle>
            <AlertDialogDescription>
              This token will give {supplierName} access to the portal with the
              selected permissions.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Token Name</label>
              <Input
                value={tokenName}
                onChange={(e) => setTokenName(e.target.value)}
                placeholder="e.g. Main Access"
              />
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium">Permissions</label>
              {[
                {
                  key: "can_view_orders" as const,
                  label: "View purchase orders",
                },
                {
                  key: "can_upload_invoices" as const,
                  label: "Upload invoices",
                },
                {
                  key: "can_update_catalog" as const,
                  label: "Update product catalog",
                },
                {
                  key: "can_update_order_status" as const,
                  label: "Update order status",
                },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-sm">{label}</span>
                  <Switch
                    checked={permissions[key]}
                    onCheckedChange={(checked) =>
                      setPermissions((prev) => ({ ...prev, [key]: checked }))
                    }
                  />
                </div>
              ))}
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={creating}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCreate}
              disabled={creating || !tokenName.trim()}
            >
              {creating ? "Creating..." : "Create Token"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
