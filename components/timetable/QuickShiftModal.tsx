"use client";

import { useState, useMemo } from "react";
import { Store, Profile } from "@/types";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { TimePicker } from "@/components/ui/time-picker";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Clock,
  Sun,
  Sunset,
  Moon,
  AlertCircle,
  MoonStar,
} from "lucide-react";
import { format, addDays } from "date-fns";
import {
  DEFAULT_SHIFT_PATTERNS,
  formatShiftTime,
  getStoreHoursForDate,
  getDayOfWeekKey,
} from "@/lib/shift-patterns";

interface QuickShiftModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: Date;
  stores: Store[];
  staff: Profile[];
  preselectedStoreId?: string;
  preselectedStaffId?: string;
  onSubmit: (data: {
    store_id: string;
    user_id: string;
    start_time: string;
    end_time: string;
  }) => Promise<void>;
  isLoading?: boolean;
}

type ShiftMode = "preset" | "custom";

const PATTERN_ICONS: Record<string, typeof Sun> = {
  opening: Sun,
  mid: Sunset,
  closing: Moon,
};

const DAY_NAMES: Record<string, string> = {
  sunday: "Sunday",
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
};

function QuickShiftModalContent({
  open,
  onOpenChange,
  date,
  stores,
  staff,
  preselectedStoreId,
  preselectedStaffId,
  onSubmit,
  isLoading,
}: QuickShiftModalProps) {
  const [mode, setMode] = useState<ShiftMode>("preset");
  const [selectedPattern, setSelectedPattern] = useState<string>("opening");
  const [selection, setSelection] = useState({
    store: preselectedStoreId || "",
    staff: preselectedStaffId || "",
  });
  const selectedStore = selection.store;
  const selectedStaff = selection.staff;
  const setSelectedStore = (v: string) =>
    setSelection((prev) => ({ ...prev, store: v }));
  const setSelectedStaff = (v: string) =>
    setSelection((prev) => ({ ...prev, staff: v }));
  const [customStartTime, setCustomStartTime] = useState("09:00");
  const [customEndTime, setCustomEndTime] = useState("17:00");

  // Get selected store details
  const store = stores.find((s) => s.id === selectedStore);

  // Get the hours for this specific day
  const dayOfWeek = getDayOfWeekKey(date);
  const storeHoursForDay = useMemo(() => {
    if (!store) return null;
    return getStoreHoursForDate(store, date);
  }, [store, date]);

  // Get the store-defined shift patterns for this day
  const storeShiftPatterns = useMemo(() => {
    if (!store?.weekly_hours) return null;
    const dayHours = store.weekly_hours[dayOfWeek];
    return dayHours?.shifts || null;
  }, [store, dayOfWeek]);

  const hasShiftPatterns =
    storeShiftPatterns &&
    (storeShiftPatterns.opening ||
      storeShiftPatterns.mid ||
      storeShiftPatterns.closing);

  // Filter staff by selected store
  // Note: staff prop should already be filtered to Staff role in parent component
  const availableStaff = useMemo(() => {
    if (!selectedStore) return staff;
    return staff.filter((s) => s.store_id === selectedStore);
  }, [staff, selectedStore]);

  // Get available shift patterns for this day (only show ones that are configured)
  const availablePatterns = useMemo(() => {
    if (!storeShiftPatterns) return [];
    return DEFAULT_SHIFT_PATTERNS.filter((pattern) => {
      const slot =
        storeShiftPatterns[pattern.id as keyof typeof storeShiftPatterns];
      return slot?.start_time && slot?.end_time;
    });
  }, [storeShiftPatterns]);

  // Derive effective selected pattern — if the stored selectedPattern isn't available in the
  // current day's patterns, fall back to the first available one (no setState in render).
  const effectivePattern = useMemo(() => {
    if (availablePatterns.length === 0) return selectedPattern;
    if (availablePatterns.find((p) => p.id === selectedPattern))
      return selectedPattern;
    return availablePatterns[0].id;
  }, [availablePatterns, selectedPattern]);

  // Get preset shift times from store-defined patterns
  const presetTimes = useMemo(() => {
    if (!hasShiftPatterns || !storeShiftPatterns) return null;

    const shiftSlot =
      storeShiftPatterns[effectivePattern as keyof typeof storeShiftPatterns];
    if (!shiftSlot?.start_time || !shiftSlot?.end_time) return null;

    // Parse the time strings and create Date objects
    const [startHour, startMin] = shiftSlot.start_time.split(":").map(Number);
    const [endHour, endMin] = shiftSlot.end_time.split(":").map(Number);

    const start = new Date(date);
    start.setHours(startHour, startMin, 0, 0);

    const end = new Date(date);
    end.setHours(endHour, endMin, 0, 0);

    return { start, end };
  }, [effectivePattern, storeShiftPatterns, hasShiftPatterns, date]);

  // Check if custom times create an overnight shift
  const isOvernightShift = useMemo(() => {
    if (mode !== "custom") return false;
    const [startHour, startMin] = customStartTime.split(":").map(Number);
    const [endHour, endMin] = customEndTime.split(":").map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    return endMinutes < startMinutes;
  }, [mode, customStartTime, customEndTime]);

  const handleSubmit = async () => {
    if (!selectedStore || !selectedStaff) return;

    let startTime: Date;
    let endTime: Date;

    if (mode === "preset" && presetTimes) {
      startTime = presetTimes.start;
      endTime = presetTimes.end;
    } else {
      // Custom times
      const [startHour, startMin] = customStartTime.split(":").map(Number);
      const [endHour, endMin] = customEndTime.split(":").map(Number);

      startTime = new Date(date);
      startTime.setHours(startHour, startMin, 0, 0);

      endTime = new Date(date);
      endTime.setHours(endHour, endMin, 0, 0);

      // If overnight shift, add a day to end time
      if (isOvernightShift) {
        endTime = addDays(endTime, 1);
      }
    }

    await onSubmit({
      store_id: selectedStore,
      user_id: selectedStaff,
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
    });

    // Reset form
    setSelectedPattern("opening");
    setMode("preset");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Shift</DialogTitle>
          <DialogDescription>
            {format(date, "EEEE, MMMM d, yyyy")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Store Selection */}
          <div className="space-y-2">
            <Label>Store</Label>
            <Select value={selectedStore} onValueChange={setSelectedStore}>
              <SelectTrigger>
                <SelectValue placeholder="Select store" />
              </SelectTrigger>
              <SelectContent>
                {stores
                  .filter((s) => s.is_active)
                  .map((s) => {
                    const hours = getStoreHoursForDate(s, date);
                    return (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                        {hours.isOpen && hours.openingTime && (
                          <span className="text-muted-foreground ml-2 text-xs">
                            ({hours.openingTime} - {hours.closingTime})
                          </span>
                        )}
                        {!hours.isOpen && (
                          <span className="text-amber-400 ml-2 text-xs">
                            (Closed {DAY_NAMES[dayOfWeek]})
                          </span>
                        )}
                      </SelectItem>
                    );
                  })}
              </SelectContent>
            </Select>
          </div>

          {/* Store closed warning */}
          {store && storeHoursForDay && !storeHoursForDay.isOpen && (
            <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-sm">
              <AlertCircle className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
              <div>
                <span className="font-medium text-amber-800 dark:text-amber-200">
                  Store is closed on {DAY_NAMES[dayOfWeek]}s
                </span>
                <p className="text-amber-400 dark:text-amber-300 text-xs mt-0.5">
                  You can still add a shift using custom times if needed.
                </p>
              </div>
            </div>
          )}

          {/* Staff Selection */}
          <div className="space-y-2">
            <Label>Staff Member</Label>
            <Select
              value={selectedStaff}
              onValueChange={setSelectedStaff}
              disabled={!selectedStore}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    selectedStore ? "Select staff" : "Select store first"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {availableStaff.length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground text-center">
                    No staff assigned to this store
                  </div>
                ) : (
                  availableStaff.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.full_name || s.email}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Shift Time Selection */}
          <div className="space-y-3">
            <Label>Shift Time</Label>

            {/* Mode toggle */}
            <div className="flex gap-2">
              <Button
                type="button"
                variant={mode === "preset" ? "default" : "outline"}
                size="sm"
                onClick={() => setMode("preset")}
                disabled={!hasShiftPatterns}
                className="flex-1"
              >
                Use Presets
              </Button>
              <Button
                type="button"
                variant={mode === "custom" ? "default" : "outline"}
                size="sm"
                onClick={() => setMode("custom")}
                className="flex-1"
              >
                Custom Time
              </Button>
            </div>

            {!hasShiftPatterns && mode === "preset" && selectedStore && (
              <p className="text-xs text-amber-900 dark:text-amber-300 bg-amber-500/10 p-2 rounded font-medium">
                {storeHoursForDay && !storeHoursForDay.isOpen
                  ? `Store is closed on ${DAY_NAMES[dayOfWeek]}s. Use custom time or select a different day.`
                  : `No shift patterns configured for ${DAY_NAMES[dayOfWeek]}. Set them in store settings or use custom time.`}
              </p>
            )}

            {!selectedStore && mode === "preset" && (
              <p className="text-xs text-muted-foreground p-2">
                Select a store to see available shift presets.
              </p>
            )}

            {mode === "preset" && hasShiftPatterns && storeHoursForDay && (
              <>
                <p className="text-xs text-muted-foreground">
                  {DAY_NAMES[dayOfWeek]} hours: {storeHoursForDay.openingTime} -{" "}
                  {storeHoursForDay.closingTime}
                </p>
                <div
                  className={`grid gap-2 ${availablePatterns.length === 3 ? "grid-cols-3" : availablePatterns.length === 2 ? "grid-cols-2" : "grid-cols-1"}`}
                >
                  {availablePatterns.map((pattern) => {
                    const Icon = PATTERN_ICONS[pattern.id] || Clock;
                    const isSelected = effectivePattern === pattern.id;
                    const shiftSlot =
                      storeShiftPatterns?.[
                        pattern.id as keyof typeof storeShiftPatterns
                      ];

                    if (!shiftSlot?.start_time || !shiftSlot?.end_time)
                      return null;

                    // Create Date objects for formatting
                    const [startHour, startMin] = shiftSlot.start_time
                      .split(":")
                      .map(Number);
                    const [endHour, endMin] = shiftSlot.end_time
                      .split(":")
                      .map(Number);
                    const startDate = new Date(date);
                    startDate.setHours(startHour, startMin, 0, 0);
                    const endDate = new Date(date);
                    endDate.setHours(endHour, endMin, 0, 0);

                    return (
                      <button
                        key={pattern.id}
                        type="button"
                        onClick={() => setSelectedPattern(pattern.id)}
                        className={`p-3 rounded-lg border-2 text-center transition-all ${
                          isSelected
                            ? "border-primary bg-primary/5"
                            : "border-muted hover:border-muted-foreground/30"
                        }`}
                      >
                        <Icon
                          className={`h-5 w-5 mx-auto mb-1 ${isSelected ? "text-primary" : "text-muted-foreground"}`}
                        />
                        <div className="font-medium text-sm">
                          {pattern.name}
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          {formatShiftTime(startDate)} -{" "}
                          {formatShiftTime(endDate)}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {mode === "custom" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Start Time</Label>
                    <TimePicker
                      value={customStartTime}
                      onChange={(v) => setCustomStartTime(v)}
                      placeholder="Start"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">End Time</Label>
                    <TimePicker
                      value={customEndTime}
                      onChange={(v) => setCustomEndTime(v)}
                      placeholder="End"
                    />
                  </div>
                </div>
                {/* Overnight shift indicator */}
                {isOvernightShift && (
                  <div className="flex items-center gap-2 p-2 bg-indigo-50 dark:bg-indigo-950/50 rounded text-xs text-indigo-700 dark:text-indigo-300">
                    <MoonStar className="h-4 w-4 flex-shrink-0" />
                    <span>
                      Overnight shift: ends {customEndTime} on{" "}
                      <span className="font-medium">
                        {format(addDays(date, 1), "EEE, MMM d")}
                      </span>
                    </span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Summary */}
          {selectedStore && selectedStaff && (
            <div className="bg-muted/50 rounded-lg p-3 text-sm">
              <div className="font-medium">Summary</div>
              <div className="text-muted-foreground mt-1">
                {availableStaff.find((s) => s.id === selectedStaff)
                  ?.full_name || "Staff"}{" "}
                at {store?.name}
                <br />
                {mode === "preset" && presetTimes ? (
                  <>
                    {formatShiftTime(presetTimes.start)} -{" "}
                    {formatShiftTime(presetTimes.end)}
                  </>
                ) : (
                  <>
                    {customStartTime} - {customEndTime}
                    {isOvernightShift && (
                      <span className="text-indigo-600 dark:text-indigo-400">
                        {" "}
                        (+1 day)
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!selectedStore || !selectedStaff || isLoading}
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add Shift
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Outer wrapper forces QuickShiftModalContent to remount with fresh initial state whenever
// the dialog opens or the preselected values change, eliminating the setState-in-useEffect pattern.
export function QuickShiftModal(props: QuickShiftModalProps) {
  return (
    <QuickShiftModalContent
      key={`${props.open}-${props.preselectedStoreId ?? ""}-${props.preselectedStaffId ?? ""}`}
      {...props}
    />
  );
}
