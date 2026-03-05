"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { useStores } from "@/hooks/useStores";
import { useAlertPreferences } from "@/hooks/useAlertPreferences";
import { useNotificationPreferences } from "@/hooks/useNotificationPreferences";
import { useApiKeys } from "@/hooks/useApiKeys";
import { useWebhooks } from "@/hooks/useWebhooks";
import { StoreForm } from "@/components/forms/StoreForm";
import { ApiKeyForm } from "@/components/settings/ApiKeyForm";
import { WebhookForm } from "@/components/settings/WebhookForm";
import { StoreFormData } from "@/lib/validations/store";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Settings,
  Bell,
  MapPin,
  Clock,
  Plus,
  Pencil,
  AlertTriangle,
  PackageX,
  ClipboardList,
  Mail,
  CalendarClock,
  Wallet,
  Truck,
  UserMinus,
  Code2,
  Key,
  Webhook,
  Trash2,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { PageGuide } from "@/components/help/PageGuide";

const DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;
const DAY_SHORT: Record<string, string> = {
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
  sunday: "Sun",
};

function formatTime12h(time: string | null | undefined): string {
  if (!time) return "—";
  const [h, m] = time.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return time;
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

export default function SettingsPage() {
  const { currentStore, role } = useAuth();
  const storeId = currentStore?.store_id ?? null;
  const store = currentStore?.store ?? null;
  const isOwner = role === "Owner";
  const isManager = role === "Manager";
  const isOwnerOrManager = isOwner || isManager;

  const { updateStore } = useStores();
  const [storeFormOpen, setStoreFormOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiKeyFormOpen, setApiKeyFormOpen] = useState(false);
  const [webhookFormOpen, setWebhookFormOpen] = useState(false);

  const { apiKeys, createApiKey, revokeApiKey } = useApiKeys(
    isOwner ? storeId : null,
  );
  const { webhooks, createWebhook, deleteWebhook } = useWebhooks(
    isOwner ? storeId : null,
  );

  const {
    preferences,
    isLoading: loadingPrefs,
    updatePreferences,
    isUpdating,
  } = useAlertPreferences(isOwnerOrManager ? storeId : null);
  const {
    preferences: notifPrefs,
    isLoading: loadingNotifPrefs,
    updatePreferences: updateNotifPrefs,
    isUpdating: isUpdatingNotif,
  } = useNotificationPreferences(storeId);

  if (!storeId || !store) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">
            Settings
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your store and preferences
          </p>
        </div>
        <Card>
          <CardContent className="py-16 text-center">
            <Settings className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">
              Select a store to manage settings.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleEditStore = () => {
    setStoreFormOpen(true);
  };

  const handleStoreSubmit = async (data: StoreFormData) => {
    setIsSubmitting(true);
    try {
      await updateStore({ id: store.id, data });
      setStoreFormOpen(false);
    } catch {
      // Hook already shows error toast
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAlertToggle = async (field: string, value: boolean) => {
    try {
      await updatePreferences({ [field]: value });
      toast.success("Preference updated");
    } catch {
      toast.error("Failed to update preference");
    }
  };

  const handleNotifToggle = async (field: string, value: boolean) => {
    try {
      await updateNotifPrefs({ [field]: value });
      toast.success("Preference updated");
    } catch {
      toast.error("Failed to update preference");
    }
  };

  const weeklyHours = store.weekly_hours as Record<
    string,
    { is_open: boolean; opening_time: string; closing_time: string }
  > | null;

  return (
    <div className="space-y-6">
      {/* ── PAGE HEADER ── */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">
            Settings
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Store details and notification preferences
          </p>
        </div>
        <div className="flex items-center gap-1">
          <PageGuide pageKey="settings" />
          {isOwner && (
            <Link href="/stores/new">
              <Button size="sm" className="shrink-0">
                <Plus className="h-4 w-4 mr-1.5" />
                Add Location
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* ── STORE DETAILS (Owner/Manager only) ── */}
      {isOwnerOrManager && (
        <Card className="overflow-hidden">
          {/* Store hero header */}
          <div className="bg-muted/50 px-4 py-3 sm:px-5 sm:py-4 border-b">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base sm:text-lg font-semibold tracking-tight truncate">
                    {store.name}
                  </h2>
                  <Badge
                    variant="outline"
                    className={
                      store.is_active
                        ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400 text-[11px]"
                        : "border-border bg-muted text-muted-foreground text-[11px]"
                    }
                  >
                    {store.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>
                {store.address && (
                  <div className="flex items-start gap-1.5 mt-1">
                    <MapPin className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
                    <span className="text-xs sm:text-sm text-muted-foreground leading-snug">
                      {store.address}
                    </span>
                  </div>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleEditStore}
                className="shrink-0 h-8 text-xs"
              >
                <Pencil className="h-3 w-3 mr-1" />
                Edit
              </Button>
            </div>
          </div>

          {/* Operating hours */}
          <CardContent className="px-4 pt-3 pb-4 sm:px-5 sm:pt-4 sm:pb-5">
            <div className="flex items-center gap-1.5 mb-2.5">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Operating Hours
              </h3>
            </div>

            {weeklyHours ? (
              <div className="rounded-md border overflow-hidden">
                {DAYS.map((day, i) => {
                  const d = weeklyHours[day];
                  if (!d) return null;
                  const isOpen = d.is_open;

                  return (
                    <div
                      key={day}
                      className={`flex items-center justify-between px-3 py-2 text-xs sm:text-sm ${
                        i < DAYS.length - 1 ? "border-b" : ""
                      } ${isOpen ? "" : "bg-muted/30"}`}
                    >
                      <span
                        className={`font-medium w-8 sm:w-10 ${isOpen ? "" : "text-muted-foreground"}`}
                      >
                        {DAY_SHORT[day]}
                      </span>
                      {isOpen ? (
                        <span className="tabular-nums">
                          {formatTime12h(d.opening_time)}
                          <span className="text-muted-foreground mx-1">–</span>
                          {formatTime12h(d.closing_time)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground italic text-[11px]">
                          Closed
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-md border px-3 py-2 flex items-center justify-between text-xs sm:text-sm">
                <span className="text-muted-foreground">Every day</span>
                <span className="font-medium tabular-nums">
                  {formatTime12h(store.opening_time)}
                  <span className="text-muted-foreground mx-1">–</span>
                  {formatTime12h(store.closing_time)}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── EMAIL NOTIFICATIONS ── */}
      <div className="space-y-3">
        <div>
          <h2 className="text-sm sm:text-base font-semibold tracking-tight flex items-center gap-1.5">
            <Bell className="h-3.5 w-3.5 text-muted-foreground" />
            Email Notifications
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Choose which emails you receive for this store
          </p>
        </div>

        {loadingNotifPrefs ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        ) : notifPrefs ? (
          <div className="space-y-4">
            {/* Shifts section */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                <CalendarClock className="h-3 w-3" />
                Shifts
              </h3>
              <div className="grid gap-2">
                <div className="rounded-lg border bg-card flex items-center gap-3 px-3 py-2.5 sm:px-4 sm:py-3">
                  <div className="flex-1 min-w-0">
                    <Label className="text-xs sm:text-sm font-medium">
                      Shift Assigned
                    </Label>
                    <p className="text-[11px] sm:text-xs text-muted-foreground leading-snug">
                      When a new shift is scheduled for you
                    </p>
                  </div>
                  <Switch
                    checked={notifPrefs.shift_assigned}
                    onCheckedChange={(v) =>
                      handleNotifToggle("shift_assigned", v)
                    }
                    disabled={isUpdatingNotif}
                  />
                </div>
                <div className="rounded-lg border bg-card flex items-center gap-3 px-3 py-2.5 sm:px-4 sm:py-3">
                  <div className="flex-1 min-w-0">
                    <Label className="text-xs sm:text-sm font-medium">
                      Shift Updated
                    </Label>
                    <p className="text-[11px] sm:text-xs text-muted-foreground leading-snug">
                      When your shift times are changed
                    </p>
                  </div>
                  <Switch
                    checked={notifPrefs.shift_updated}
                    onCheckedChange={(v) =>
                      handleNotifToggle("shift_updated", v)
                    }
                    disabled={isUpdatingNotif}
                  />
                </div>
                <div className="rounded-lg border bg-card flex items-center gap-3 px-3 py-2.5 sm:px-4 sm:py-3">
                  <div className="flex-1 min-w-0">
                    <Label className="text-xs sm:text-sm font-medium">
                      Shift Cancelled
                    </Label>
                    <p className="text-[11px] sm:text-xs text-muted-foreground leading-snug">
                      When your shift is removed from the schedule
                    </p>
                  </div>
                  <Switch
                    checked={notifPrefs.shift_cancelled}
                    onCheckedChange={(v) =>
                      handleNotifToggle("shift_cancelled", v)
                    }
                    disabled={isUpdatingNotif}
                  />
                </div>
              </div>
            </div>

            {/* Payroll section */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                <Wallet className="h-3 w-3" />
                Payroll
              </h3>
              <div className="grid gap-2">
                <div className="rounded-lg border bg-card flex items-center gap-3 px-3 py-2.5 sm:px-4 sm:py-3">
                  <div className="flex-1 min-w-0">
                    <Label className="text-xs sm:text-sm font-medium">
                      Payslip Available
                    </Label>
                    <p className="text-[11px] sm:text-xs text-muted-foreground leading-snug">
                      When a pay run is completed and your payslip is ready
                    </p>
                  </div>
                  <Switch
                    checked={notifPrefs.payslip_available}
                    onCheckedChange={(v) =>
                      handleNotifToggle("payslip_available", v)
                    }
                    disabled={isUpdatingNotif}
                  />
                </div>
              </div>
            </div>

            {/* Purchase Orders section (Owner/Manager only) */}
            {isOwnerOrManager && (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                  <Truck className="h-3 w-3" />
                  Purchase Orders
                </h3>
                <div className="grid gap-2">
                  <div className="rounded-lg border bg-card flex items-center gap-3 px-3 py-2.5 sm:px-4 sm:py-3">
                    <div className="flex-1 min-w-0">
                      <Label className="text-xs sm:text-sm font-medium">
                        Supplier Updates
                      </Label>
                      <p className="text-[11px] sm:text-xs text-muted-foreground leading-snug">
                        When a supplier acknowledges or ships an order
                      </p>
                    </div>
                    <Switch
                      checked={notifPrefs.po_supplier_update}
                      onCheckedChange={(v) =>
                        handleNotifToggle("po_supplier_update", v)
                      }
                      disabled={isUpdatingNotif}
                    />
                  </div>
                  <div className="rounded-lg border bg-card flex items-center gap-3 px-3 py-2.5 sm:px-4 sm:py-3">
                    <div className="flex-1 min-w-0">
                      <Label className="text-xs sm:text-sm font-medium">
                        Delivery Received
                      </Label>
                      <p className="text-[11px] sm:text-xs text-muted-foreground leading-snug">
                        When a delivery is received at the store
                      </p>
                    </div>
                    <Switch
                      checked={notifPrefs.delivery_received}
                      onCheckedChange={(v) =>
                        handleNotifToggle("delivery_received", v)
                      }
                      disabled={isUpdatingNotif}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Account section */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                <UserMinus className="h-3 w-3" />
                Account
              </h3>
              <div className="grid gap-2">
                <div className="rounded-lg border bg-card flex items-center gap-3 px-3 py-2.5 sm:px-4 sm:py-3">
                  <div className="flex-1 min-w-0">
                    <Label className="text-xs sm:text-sm font-medium">
                      Removed from Store
                    </Label>
                    <p className="text-[11px] sm:text-xs text-muted-foreground leading-snug">
                      When your access to this store is revoked
                    </p>
                  </div>
                  <Switch
                    checked={notifPrefs.removed_from_store}
                    onCheckedChange={(v) =>
                      handleNotifToggle("removed_from_store", v)
                    }
                    disabled={isUpdatingNotif}
                  />
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* ── INVENTORY ALERTS (Owner/Manager only) ── */}
      {isOwnerOrManager && (
        <div className="space-y-3">
          <div>
            <h2 className="text-sm sm:text-base font-semibold tracking-tight flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground" />
              Inventory Alerts
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Automated stock level monitoring and alerts
            </p>
          </div>

          {loadingPrefs ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-lg" />
              ))}
            </div>
          ) : preferences ? (
            <div className="space-y-3">
              {/* Alert type cards */}
              <div className="grid gap-2">
                {/* Low Stock */}
                <div className="rounded-lg border bg-card flex items-center gap-3 px-3 py-2.5 sm:px-4 sm:py-3">
                  <div className="rounded-full p-1.5 bg-amber-500/10 text-amber-400 shrink-0">
                    <AlertTriangle className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <Label className="text-xs sm:text-sm font-medium">
                      Low Stock
                    </Label>
                    <p className="text-[11px] sm:text-xs text-muted-foreground leading-snug">
                      Items drop below their PAR level
                    </p>
                  </div>
                  <Switch
                    checked={preferences.low_stock_enabled}
                    onCheckedChange={(v) =>
                      handleAlertToggle("low_stock_enabled", v)
                    }
                    disabled={isUpdating}
                  />
                </div>

                {/* Critical Stock */}
                <div className="rounded-lg border bg-card flex items-center gap-3 px-3 py-2.5 sm:px-4 sm:py-3">
                  <div className="rounded-full p-1.5 bg-destructive/10 text-destructive shrink-0">
                    <PackageX className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <Label className="text-xs sm:text-sm font-medium">
                      Critical Stock
                    </Label>
                    <p className="text-[11px] sm:text-xs text-muted-foreground leading-snug">
                      Items nearly or completely out of stock
                    </p>
                  </div>
                  <Switch
                    checked={preferences.critical_stock_enabled}
                    onCheckedChange={(v) =>
                      handleAlertToggle("critical_stock_enabled", v)
                    }
                    disabled={isUpdating}
                  />
                </div>

                {/* Missing Count */}
                <div className="rounded-lg border bg-card flex items-center gap-3 px-3 py-2.5 sm:px-4 sm:py-3">
                  <div className="rounded-full p-1.5 bg-blue-500/10 text-blue-400 shrink-0">
                    <ClipboardList className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <Label className="text-xs sm:text-sm font-medium">
                      Missing Count
                    </Label>
                    <p className="text-[11px] sm:text-xs text-muted-foreground leading-snug">
                      Daily stock count not submitted
                    </p>
                  </div>
                  <Switch
                    checked={preferences.missing_count_enabled}
                    onCheckedChange={(v) =>
                      handleAlertToggle("missing_count_enabled", v)
                    }
                    disabled={isUpdating}
                  />
                </div>
              </div>

              {/* Delivery preferences */}
              <Card>
                <CardContent className="px-3 pt-3 pb-3 sm:px-5 sm:pt-4 sm:pb-4">
                  <div className="flex items-center gap-1.5 mb-3">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Alert Delivery
                    </h3>
                  </div>

                  <div className="space-y-3">
                    {/* Email toggle */}
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <Label className="text-xs sm:text-sm font-medium">
                          Email Alerts
                        </Label>
                        <p className="text-[11px] sm:text-xs text-muted-foreground">
                          Receive inventory alerts to your email
                        </p>
                      </div>
                      <Switch
                        checked={preferences.email_enabled}
                        onCheckedChange={(v) =>
                          handleAlertToggle("email_enabled", v)
                        }
                        disabled={isUpdating}
                      />
                    </div>

                    {/* Frequency + Time — only visible when email is on */}
                    {preferences.email_enabled && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-0.5">
                        <div className="space-y-1">
                          <Label className="text-[11px] sm:text-xs text-muted-foreground">
                            Frequency
                          </Label>
                          <Select
                            value={preferences.alert_frequency}
                            onValueChange={async (v) => {
                              try {
                                await updatePreferences({
                                  alert_frequency: v as
                                    | "daily"
                                    | "weekly"
                                    | "never",
                                });
                                toast.success("Frequency updated");
                              } catch {
                                toast.error("Failed to update");
                              }
                            }}
                            disabled={isUpdating}
                          >
                            <SelectTrigger className="h-8 text-xs sm:text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="daily">Daily</SelectItem>
                              <SelectItem value="weekly">Weekly</SelectItem>
                              <SelectItem value="never">Never</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px] sm:text-xs text-muted-foreground">
                            Preferred Time
                          </Label>
                          <Select
                            value={String(preferences.preferred_hour)}
                            onValueChange={async (v) => {
                              try {
                                await updatePreferences({
                                  preferred_hour: parseInt(v),
                                });
                                toast.success("Preferred time updated");
                              } catch {
                                toast.error("Failed to update");
                              }
                            }}
                            disabled={isUpdating}
                          >
                            <SelectTrigger className="h-8 text-xs sm:text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Array.from({ length: 24 }).map((_, h) => (
                                <SelectItem key={h} value={String(h)}>
                                  {h === 0
                                    ? "12:00 AM"
                                    : h < 12
                                      ? `${h}:00 AM`
                                      : h === 12
                                        ? "12:00 PM"
                                        : `${h - 12}:00 PM`}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : null}
        </div>
      )}

      {/* ── DEVELOPER (Owner only) ── */}
      {isOwner && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm sm:text-base font-semibold tracking-tight flex items-center gap-1.5">
                <Code2 className="h-3.5 w-3.5 text-muted-foreground" />
                Developer
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                API keys and webhook endpoints for integrations.{" "}
                <Link
                  href="/integrations"
                  className="underline underline-offset-2 hover:text-foreground transition-colors inline-flex items-center gap-0.5"
                >
                  Integrations
                  <ExternalLink className="h-2.5 w-2.5" />
                </Link>{" "}
                ·{" "}
                <Link
                  href="/billing"
                  className="underline underline-offset-2 hover:text-foreground transition-colors inline-flex items-center gap-0.5"
                >
                  Billing
                  <ExternalLink className="h-2.5 w-2.5" />
                </Link>
              </p>
            </div>
          </div>

          {/* API Keys */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Key className="h-3 w-3" />
                API Keys
              </h3>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => setApiKeyFormOpen(true)}
              >
                <Plus className="h-3 w-3 mr-1" />
                New Key
              </Button>
            </div>

            {apiKeys.length === 0 ? (
              <div className="rounded-lg border bg-card px-4 py-6 text-center">
                <Key className="h-6 w-6 mx-auto text-muted-foreground/40 mb-2" />
                <p className="text-xs text-muted-foreground">
                  No API keys yet. Create one to access the API
                  programmatically.
                </p>
              </div>
            ) : (
              <div className="rounded-md border overflow-hidden divide-y">
                {apiKeys.map((apiKey) => (
                  <div
                    key={apiKey.id}
                    className="flex items-center justify-between gap-3 px-3 py-2.5 bg-card"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm font-medium truncate">
                        {apiKey.name}
                      </p>
                      <p className="text-[11px] text-muted-foreground font-mono">
                        {apiKey.key_prefix}…
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge
                        variant="outline"
                        className={
                          apiKey.is_active
                            ? "text-[10px] border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                            : "text-[10px] text-muted-foreground"
                        }
                      >
                        {apiKey.is_active ? "Active" : "Revoked"}
                      </Badge>
                      {apiKey.is_active && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 text-muted-foreground hover:text-destructive"
                          onClick={async () => {
                            try {
                              await revokeApiKey(apiKey.id);
                              toast.success("API key revoked");
                            } catch {
                              toast.error("Failed to revoke API key");
                            }
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Webhooks */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Webhook className="h-3 w-3" />
                Webhooks
              </h3>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => setWebhookFormOpen(true)}
              >
                <Plus className="h-3 w-3 mr-1" />
                Add Endpoint
              </Button>
            </div>

            {webhooks.length === 0 ? (
              <div className="rounded-lg border bg-card px-4 py-6 text-center">
                <Webhook className="h-6 w-6 mx-auto text-muted-foreground/40 mb-2" />
                <p className="text-xs text-muted-foreground">
                  No webhook endpoints yet. Add one to receive real-time event
                  notifications.
                </p>
              </div>
            ) : (
              <div className="rounded-md border overflow-hidden divide-y">
                {webhooks.map((webhook) => (
                  <div
                    key={webhook.id}
                    className="flex items-center justify-between gap-3 px-3 py-2.5 bg-card"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm font-medium font-mono truncate">
                        {webhook.url}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {webhook.events.length} event
                        {webhook.events.length !== 1 ? "s" : ""}
                        {webhook.description ? ` · ${webhook.description}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge
                        variant="outline"
                        className={
                          webhook.is_active
                            ? "text-[10px] border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                            : "text-[10px] text-muted-foreground"
                        }
                      >
                        {webhook.is_active ? "Active" : "Inactive"}
                      </Badge>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 text-muted-foreground hover:text-destructive"
                        onClick={async () => {
                          try {
                            await deleteWebhook(webhook.id);
                            toast.success("Webhook deleted");
                          } catch {
                            toast.error("Failed to delete webhook");
                          }
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit Store Dialog */}
      {isOwnerOrManager && (
        <StoreForm
          open={storeFormOpen}
          onOpenChange={setStoreFormOpen}
          store={store}
          onSubmit={handleStoreSubmit}
          isLoading={isSubmitting}
        />
      )}

      {/* Developer Dialogs (Owner only) */}
      {isOwner && (
        <>
          <ApiKeyForm
            open={apiKeyFormOpen}
            onOpenChange={setApiKeyFormOpen}
            onSubmit={createApiKey}
          />
          <WebhookForm
            open={webhookFormOpen}
            onOpenChange={setWebhookFormOpen}
            onSubmit={createWebhook}
          />
        </>
      )}
    </div>
  );
}
