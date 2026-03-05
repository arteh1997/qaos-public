"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  storeSchema,
  StoreFormData,
  DAYS_OF_WEEK,
  DAY_LABELS,
  getDefaultWeeklyHours,
  calculateDefaultShiftPatterns,
} from "@/lib/validations/store";
import { Store, DayOfWeek, WeeklyHours, DayHours } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { TimePicker } from "@/components/ui/time-picker";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Loader2, Clock, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

function formatTime12h(time: string): string {
  const [h, m] = time.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return time;
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

/** Normalize a time value from PostgreSQL TIME format (HH:MM:SS) to HH:MM */
function normalizeTime(time: string | null | undefined): string | null {
  if (!time) return null;
  // Strip seconds if present (PostgreSQL TIME returns HH:MM:SS)
  const parts = time.split(":");
  if (parts.length >= 2) {
    return `${parts[0].padStart(2, "0")}:${parts[1].padStart(2, "0")}`;
  }
  return time;
}

interface StoreFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  store?: Store | null;
  onSubmit: (data: StoreFormData) => Promise<void>;
  isLoading?: boolean;
}

interface StoreFormBodyProps extends StoreFormProps {
  initialShowWeeklyHours: boolean;
  initialWeeklyHours: WeeklyHours | null;
  initialFormValues: StoreFormData;
}

function StoreFormBody({
  open,
  onOpenChange,
  store,
  onSubmit,
  isLoading,
  initialShowWeeklyHours,
  initialWeeklyHours,
  initialFormValues,
}: StoreFormBodyProps) {
  const [showWeeklyHours, setShowWeeklyHours] = useState(
    initialShowWeeklyHours,
  );
  const [weeklyHours, setWeeklyHours] = useState<WeeklyHours | null>(
    initialWeeklyHours,
  );
  const [expandedDays, setExpandedDays] = useState<Record<DayOfWeek, boolean>>({
    monday: false,
    tuesday: false,
    wednesday: false,
    thursday: false,
    friday: false,
    saturday: false,
    sunday: false,
  });

  const form = useForm<StoreFormData>({
    resolver: zodResolver(storeSchema),
    defaultValues: initialFormValues,
  });

  const handleDefaultTimesChange = () => {
    const openingTime = form.getValues("opening_time");
    const closingTime = form.getValues("closing_time");

    // If weekly hours are shown and both default times are set, update all days
    if (showWeeklyHours && openingTime && closingTime && weeklyHours) {
      const updated = { ...weeklyHours };
      DAYS_OF_WEEK.forEach((day) => {
        if (updated[day].is_open) {
          updated[day] = {
            ...updated[day],
            opening_time: openingTime,
            closing_time: closingTime,
          };
        }
      });
      setWeeklyHours(updated);
    }
  };

  const handleToggleWeeklyHours = (enabled: boolean) => {
    setShowWeeklyHours(enabled);

    if (enabled) {
      const openingTime = form.getValues("opening_time") || "09:00";
      const closingTime = form.getValues("closing_time") || "22:00";
      const defaultHours = getDefaultWeeklyHours(openingTime, closingTime);
      setWeeklyHours(defaultHours);
    } else {
      setWeeklyHours(null);
    }
  };

  const handleDayChange = (
    day: DayOfWeek,
    field: keyof DayHours,
    value: boolean | string | null,
  ) => {
    if (!weeklyHours) return;

    const updated = {
      ...weeklyHours,
      [day]: {
        ...weeklyHours[day],
        [field]: value,
      },
    };

    // When opening/closing times change, recalculate shift patterns for that day
    if (
      (field === "opening_time" || field === "closing_time") &&
      updated[day].is_open
    ) {
      const openTime =
        field === "opening_time"
          ? (value as string)
          : updated[day].opening_time;
      const closeTime =
        field === "closing_time"
          ? (value as string)
          : updated[day].closing_time;
      if (openTime && closeTime) {
        const newShifts = calculateDefaultShiftPatterns(openTime, closeTime);
        // Preserve user-customised mid-range times, but always lock:
        //   opening.start_time = store opening time
        //   closing.end_time = store closing time
        const existingShifts = updated[day].shifts || {};
        updated[day].shifts = {
          opening: {
            start_time: openTime, // Locked to store opening
            end_time:
              existingShifts.opening?.end_time ||
              newShifts?.opening?.end_time ||
              "",
          },
          mid: existingShifts.mid || newShifts?.mid,
          closing: {
            start_time:
              existingShifts.closing?.start_time ||
              newShifts?.closing?.start_time ||
              "",
            end_time: closeTime, // Locked to store closing
          },
        };
      }
    }

    setWeeklyHours(updated);
  };

  const handleShiftChange = (
    day: DayOfWeek,
    shiftType: "opening" | "mid" | "closing",
    timeField: "start_time" | "end_time",
    value: string,
  ) => {
    if (!weeklyHours) return;

    const currentShifts = weeklyHours[day].shifts || {};
    const currentShift = currentShifts[shiftType] || {
      start_time: "",
      end_time: "",
    };

    const updated = {
      ...weeklyHours,
      [day]: {
        ...weeklyHours[day],
        shifts: {
          ...currentShifts,
          [shiftType]: {
            ...currentShift,
            [timeField]: value,
          },
        },
      },
    };
    setWeeklyHours(updated);
  };

  const toggleDayExpanded = (day: DayOfWeek) => {
    setExpandedDays((prev) => ({
      ...prev,
      [day]: !prev[day],
    }));
  };

  const handleSubmit = async (data: StoreFormData) => {
    try {
      await onSubmit({
        ...data,
        weekly_hours: showWeeklyHours ? weeklyHours : null,
      });
      form.reset();
      setShowWeeklyHours(false);
      setWeeklyHours(null);
    } catch {
      // Error handled by parent component
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{store ? "Edit Store" : "Add Store"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Store Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter store name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Enter store address" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Operating Hours */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <Label className="text-sm font-medium">Operating Hours</Label>
              </div>

              {/* Default Hours - only show when NOT using per-day hours */}
              {!showWeeklyHours && (
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="opening_time"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Opens</FormLabel>
                        <FormControl>
                          <TimePicker
                            value={field.value}
                            onChange={(v) => {
                              field.onChange(v);
                              handleDefaultTimesChange();
                            }}
                            placeholder="Opens"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="closing_time"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Closes</FormLabel>
                        <FormControl>
                          <TimePicker
                            value={field.value}
                            onChange={(v) => {
                              field.onChange(v);
                              handleDefaultTimesChange();
                            }}
                            placeholder="Closes"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {/* Toggle for per-day hours */}
              <div className="flex items-center justify-between rounded-lg border px-3 py-2.5">
                <Label className="text-xs text-muted-foreground">
                  Different hours for each day?
                </Label>
                <Switch
                  checked={showWeeklyHours}
                  onCheckedChange={handleToggleWeeklyHours}
                />
              </div>

              {/* Per-day hours — each day is its own card */}
              {showWeeklyHours && weeklyHours && (
                <div className="space-y-2.5">
                  {DAYS_OF_WEEK.map((day) => {
                    const dayData = weeklyHours[day];
                    const isOpen = dayData.is_open;

                    return (
                      <Collapsible
                        key={day}
                        open={expandedDays[day]}
                        onOpenChange={() => toggleDayExpanded(day)}
                      >
                        <div
                          className={cn(
                            "rounded-lg border p-3 transition-colors",
                            isOpen ? "bg-background" : "bg-muted/30",
                          )}
                        >
                          {/* Day header row */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Checkbox
                                checked={isOpen}
                                onCheckedChange={(checked) =>
                                  handleDayChange(
                                    day,
                                    "is_open",
                                    checked as boolean,
                                  )
                                }
                              />
                              <span
                                className={cn(
                                  "text-sm font-medium",
                                  !isOpen && "text-muted-foreground",
                                )}
                              >
                                {DAY_LABELS[day]}
                              </span>
                            </div>
                            {!isOpen && (
                              <span className="text-xs text-muted-foreground italic">
                                Closed
                              </span>
                            )}
                          </div>

                          {/* Open day: time pickers + shift toggle */}
                          {isOpen && (
                            <div className="mt-3 space-y-2.5">
                              {/* Hours row */}
                              <div className="flex items-center gap-2">
                                <TimePicker
                                  value={dayData.opening_time}
                                  onChange={(v) =>
                                    handleDayChange(day, "opening_time", v)
                                  }
                                  placeholder="Opens"
                                  className="flex-1"
                                />
                                <span className="text-sm text-muted-foreground shrink-0">
                                  to
                                </span>
                                <TimePicker
                                  value={dayData.closing_time}
                                  onChange={(v) =>
                                    handleDayChange(day, "closing_time", v)
                                  }
                                  placeholder="Closes"
                                  className="flex-1"
                                />
                              </div>

                              {/* Shift times toggle */}
                              <CollapsibleTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 -ml-2 text-muted-foreground hover:text-foreground"
                                >
                                  <ChevronDown
                                    className={cn(
                                      "h-3.5 w-3.5 transition-transform",
                                      expandedDays[day] && "rotate-180",
                                    )}
                                  />
                                  <span className="text-xs ml-1.5">
                                    Shift times
                                  </span>
                                </Button>
                              </CollapsibleTrigger>

                              {/* Shift patterns */}
                              <CollapsibleContent>
                                <div className="rounded-md bg-muted/40 p-3 space-y-2.5">
                                  {(["opening", "mid", "closing"] as const).map(
                                    (shiftType) => {
                                      const shiftStyles = {
                                        opening:
                                          "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
                                        mid: "text-blue-400 bg-blue-500/10 border-blue-500/20",
                                        closing:
                                          "text-purple-400 bg-purple-500/10 border-purple-500/20",
                                      };
                                      const shiftLabels = {
                                        opening: "Opening",
                                        mid: "Mid",
                                        closing: "Closing",
                                      };

                                      // Opening start is locked to store opening, closing end is locked to store closing
                                      const isStartLocked =
                                        shiftType === "opening";
                                      const isEndLocked =
                                        shiftType === "closing";

                                      return (
                                        <div
                                          key={shiftType}
                                          className="flex items-center gap-2"
                                        >
                                          <span
                                            className={cn(
                                              "text-[11px] font-semibold px-2 py-0.5 rounded-full border shrink-0",
                                              shiftStyles[shiftType],
                                            )}
                                          >
                                            {shiftLabels[shiftType]}
                                          </span>
                                          {isStartLocked ? (
                                            <span className="flex-1 h-8 px-2.5 text-sm flex items-center rounded-md border bg-muted/50 text-muted-foreground">
                                              {dayData.opening_time
                                                ? formatTime12h(
                                                    dayData.opening_time,
                                                  )
                                                : "—"}
                                            </span>
                                          ) : (
                                            <TimePicker
                                              size="sm"
                                              value={
                                                dayData.shifts?.[shiftType]
                                                  ?.start_time
                                              }
                                              onChange={(v) =>
                                                handleShiftChange(
                                                  day,
                                                  shiftType,
                                                  "start_time",
                                                  v,
                                                )
                                              }
                                              placeholder="Start"
                                              className="flex-1"
                                            />
                                          )}
                                          <span className="text-xs text-muted-foreground">
                                            –
                                          </span>
                                          {isEndLocked ? (
                                            <span className="flex-1 h-8 px-2.5 text-sm flex items-center rounded-md border bg-muted/50 text-muted-foreground">
                                              {dayData.closing_time
                                                ? formatTime12h(
                                                    dayData.closing_time,
                                                  )
                                                : "—"}
                                            </span>
                                          ) : (
                                            <TimePicker
                                              size="sm"
                                              value={
                                                dayData.shifts?.[shiftType]
                                                  ?.end_time
                                              }
                                              onChange={(v) =>
                                                handleShiftChange(
                                                  day,
                                                  shiftType,
                                                  "end_time",
                                                  v,
                                                )
                                              }
                                              placeholder="End"
                                              className="flex-1"
                                            />
                                          )}
                                        </div>
                                      );
                                    },
                                  )}
                                </div>
                              </CollapsibleContent>
                            </div>
                          )}
                        </div>
                      </Collapsible>
                    );
                  })}
                </div>
              )}
            </div>

            <FormField
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Active</FormLabel>
                  </div>
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {store ? "Update" : "Create"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export function StoreForm({
  open,
  onOpenChange,
  store,
  onSubmit,
  isLoading,
}: StoreFormProps) {
  // Compute initial values from props — inner component remounts with fresh state via key
  const initialShowWeeklyHours = !!store?.weekly_hours;
  const initialWeeklyHours = store?.weekly_hours ?? null;
  const initialFormValues: StoreFormData = {
    name: store?.name ?? "",
    address: store?.address ?? "",
    is_active: store?.is_active ?? true,
    opening_time: normalizeTime(store?.opening_time) || "09:00",
    closing_time: normalizeTime(store?.closing_time) || "22:00",
    weekly_hours: null, // Managed by local weeklyHours state, not form
  };

  return (
    <StoreFormBody
      key={`${open}-${store?.id ?? "new"}`}
      open={open}
      onOpenChange={onOpenChange}
      store={store}
      onSubmit={onSubmit}
      isLoading={isLoading}
      initialShowWeeklyHours={initialShowWeeklyHours}
      initialWeeklyHours={initialWeeklyHours}
      initialFormValues={initialFormValues}
    />
  );
}
