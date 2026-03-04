"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Save, Loader2 } from "lucide-react";
import type { XeroAccount, AccountingConfig } from "@/types";

interface AccountMappingFormProps {
  categories: string[];
  accounts: XeroAccount[];
  config: AccountingConfig | undefined;
  isLoadingAccounts: boolean;
  isSaving: boolean;
  onSave: (config: Partial<AccountingConfig>) => void;
}

interface AccountMappingFormBodyProps extends AccountMappingFormProps {
  initialMappings: Record<string, string>;
  initialAutoSync: boolean;
  initialSyncInvoices: boolean;
  initialSyncPOs: boolean;
}

function AccountMappingFormBody({
  categories,
  accounts,
  isLoadingAccounts,
  isSaving,
  onSave,
  initialMappings,
  initialAutoSync,
  initialSyncInvoices,
  initialSyncPOs,
}: AccountMappingFormBodyProps) {
  const [mappings, setMappings] =
    useState<Record<string, string>>(initialMappings);
  const [autoSync, setAutoSync] = useState(initialAutoSync);
  const [syncInvoices, setSyncInvoices] = useState(initialSyncInvoices);
  const [syncPOs, setSyncPOs] = useState(initialSyncPOs);

  const handleSave = () => {
    onSave({
      gl_mappings: mappings,
      auto_sync: autoSync,
      sync_invoices: syncInvoices,
      sync_purchase_orders: syncPOs,
    });
  };

  if (isLoadingAccounts) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-64 mt-1" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* GL Account Mapping */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Account Mapping</CardTitle>
          <CardDescription>
            Map your inventory categories to GL expense accounts in Xero
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Default account */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <Label className="text-sm text-muted-foreground sm:w-40 shrink-0">
              Default Account
            </Label>
            <Select
              value={mappings["_default"] || ""}
              onValueChange={(value) =>
                setMappings((prev) => ({ ...prev, _default: value }))
              }
            >
              <SelectTrigger className="sm:flex-1">
                <SelectValue placeholder="Select default account..." />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((acc) => (
                  <SelectItem key={acc.account_id} value={acc.code}>
                    {acc.code} — {acc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Per-category mapping */}
          {categories.map((category) => (
            <div
              key={category}
              className="flex flex-col sm:flex-row sm:items-center gap-2"
            >
              <Label className="text-sm sm:w-40 shrink-0 truncate">
                {category}
              </Label>
              <Select
                value={mappings[category] || ""}
                onValueChange={(value) =>
                  setMappings((prev) => ({ ...prev, [category]: value }))
                }
              >
                <SelectTrigger className="sm:flex-1">
                  <SelectValue placeholder="Use default" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Use default</SelectItem>
                  {accounts.map((acc) => (
                    <SelectItem key={acc.account_id} value={acc.code}>
                      {acc.code} — {acc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}

          {categories.length === 0 && (
            <p className="text-sm text-muted-foreground py-2">
              No categories found. Add categories to your inventory items to map
              them to GL accounts.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Sync Settings */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Sync Settings</CardTitle>
          <CardDescription>Control what gets synced to Xero</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Auto-sync</Label>
              <p className="text-xs text-muted-foreground">
                Automatically sync approved invoices to Xero
              </p>
            </div>
            <Switch checked={autoSync} onCheckedChange={setAutoSync} />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Sync invoices</Label>
              <p className="text-xs text-muted-foreground">
                Push supplier invoices as bills in Xero
              </p>
            </div>
            <Switch checked={syncInvoices} onCheckedChange={setSyncInvoices} />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Sync purchase orders</Label>
              <p className="text-xs text-muted-foreground">
                Push purchase orders to Xero
              </p>
            </div>
            <Switch checked={syncPOs} onCheckedChange={setSyncPOs} />
          </div>
        </CardContent>
      </Card>

      {/* Save button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <Loader2 className="size-4 mr-2 animate-spin" />
          ) : (
            <Save className="size-4 mr-2" />
          )}
          Save Configuration
        </Button>
      </div>
    </div>
  );
}

export function AccountMappingForm({
  categories,
  accounts,
  config,
  isLoadingAccounts,
  isSaving,
  onSave,
}: AccountMappingFormProps) {
  // Derive initial values from config; inner component remounts when config identity changes
  const initialMappings = config?.gl_mappings ?? {};
  const initialAutoSync = config?.auto_sync ?? false;
  const initialSyncInvoices = config?.sync_invoices !== false;
  const initialSyncPOs = config?.sync_purchase_orders ?? false;

  return (
    <AccountMappingFormBody
      key={config ? JSON.stringify(config) : "no-config"}
      categories={categories}
      accounts={accounts}
      config={config}
      isLoadingAccounts={isLoadingAccounts}
      isSaving={isSaving}
      onSave={onSave}
      initialMappings={initialMappings}
      initialAutoSync={initialAutoSync}
      initialSyncInvoices={initialSyncInvoices}
      initialSyncPOs={initialSyncPOs}
    />
  );
}
