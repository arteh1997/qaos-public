"use client";

import { useState, useRef, useMemo } from "react";
import { supabaseUpdate } from "@/lib/supabase/client";
import { Store, DayOfWeek, WeeklyHours, DayHours } from "@/types";
import {
  DAYS_OF_WEEK,
  DAY_LABELS,
  getDefaultWeeklyHours,
  calculateDefaultShiftPatterns,
} from "@/lib/validations/store";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { TimePicker } from "@/components/ui/time-picker";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Loader2, Check, ChevronDown, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface HoursSetupStepProps {
  store: Store;
  isComplete: boolean;
  onComplete: () => void;
}

function formatTime12h(time: string): string {
  const [h, m] = time.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return time;
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

function normalizeTime(
  time: string | null | undefined,
  defaultValue: string,
): string {
  if (!time) return defaultValue;
  const parts = time.split(":");
  if (parts.length >= 2) {
    return `${parts[0].padStart(2, "0")}:${parts[1]}`;
  }
  return defaultValue;
}

export function HoursSetupStep({
  store,
  isComplete,
  onComplete,
}: HoursSetupStepProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedDays, setExpandedDays] = useState<Record<DayOfWeek, boolean>>({
    monday: false,
    tuesday: false,
    wednesday: false,
    thursday: false,
    friday: false,
    saturday: false,
    sunday: false,
  });

  // Initialise weekly hours from store data or defaults
  const [weeklyHours, setWeeklyHours] = useState<WeeklyHours>(() => {
    if (store.weekly_hours) return store.weekly_hours;

    const openTime = normalizeTime(store.opening_time, "09:00");
    const closeTime = normalizeTime(store.closing_time, "22:00");
    return getDefaultWeeklyHours(openTime, closeTime);
  });

  // Track the last-saved state so we can detect changes and allow cancel
  const savedHoursRef = useRef<WeeklyHours>(
    JSON.parse(JSON.stringify(weeklyHours)),
  );

  const hasChanges = useMemo(
    () => JSON.stringify(weeklyHours) !== JSON.stringify(savedHoursRef.current),
    [weeklyHours],
  );

  const handleCancel = () => {
    setWeeklyHours(JSON.parse(JSON.stringify(savedHoursRef.current)));
  };

  const handleDayChange = (
    day: DayOfWeek,
    field: keyof DayHours,
    value: boolean | string | null,
  ) => {
    const updated = {
      ...weeklyHours,
      [day]: {
        ...weeklyHours[day],
        [field]: value,
      },
    };

    // When opening/closing times change, recalculate shift patterns
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
    const currentShifts = weeklyHours[day].shifts || {};
    const currentShift = currentShifts[shiftType] || {
      start_time: "",
      end_time: "",
    };

    setWeeklyHours({
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
    });
  };

  const toggleDayExpanded = (day: DayOfWeek) => {
    setExpandedDays((prev) => ({ ...prev, [day]: !prev[day] }));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      // Use first open day's times as the default opening/closing
      const firstOpenDay = DAYS_OF_WEEK.find((d) => weeklyHours[d].is_open);
      const defaultOpenTime = firstOpenDay
        ? weeklyHours[firstOpenDay].opening_time
        : "09:00";
      const defaultCloseTime = firstOpenDay
        ? weeklyHours[firstOpenDay].closing_time
        : "22:00";

      const { error } = await supabaseUpdate("stores", store.id, {
        opening_time: defaultOpenTime,
        closing_time: defaultCloseTime,
        weekly_hours: weeklyHours,
        updated_at: new Date().toISOString(),
      });

      if (error) throw error;

      // Update saved state so hasChanges resets
      savedHoursRef.current = JSON.parse(JSON.stringify(weeklyHours));

      toast.success("Operating hours saved!");
      onComplete();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save hours",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Set your operating hours for each day. Toggle days off if you&apos;re
        closed, and expand shift times to configure staff shifts.
      </p>

      {/* Per-day cards — matching StoreForm design */}
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
                        handleDayChange(day, "is_open", checked as boolean)
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
                        <span className="text-xs ml-1.5">Shift times</span>
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
                            const isStartLocked = shiftType === "opening";
                            const isEndLocked = shiftType === "closing";

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
                                      ? formatTime12h(dayData.opening_time)
                                      : "—"}
                                  </span>
                                ) : (
                                  <TimePicker
                                    size="sm"
                                    value={
                                      dayData.shifts?.[shiftType]?.start_time
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
                                      ? formatTime12h(dayData.closing_time)
                                      : "—"}
                                  </span>
                                ) : (
                                  <TimePicker
                                    size="sm"
                                    value={
                                      dayData.shifts?.[shiftType]?.end_time
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

      <div className="flex flex-col sm:flex-row gap-2">
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting || (isComplete && !hasChanges)}
          className="w-full sm:w-auto"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Check className="mr-2 h-4 w-4" />
              {isComplete ? "Update Hours" : "Save Hours"}
            </>
          )}
        </Button>

        {hasChanges && isComplete && (
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={isSubmitting}
            className="w-full sm:w-auto"
          >
            <Undo2 className="mr-2 h-4 w-4" />
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}
