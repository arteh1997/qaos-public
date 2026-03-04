"use client";

import { useState } from "react";
import { Shift, Store, Profile } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Plus,
  Trash2,
  Sun,
  Sunset,
  Moon,
  Clock,
  MoonStar,
  CalendarDays,
} from "lucide-react";
import { format, parseISO, addDays } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ShiftFormData } from "@/lib/validations/shift";
import {
  DEFAULT_SHIFT_PATTERNS,
  getStoreHoursForDate,
  getDayOfWeekKey,
} from "@/lib/shift-patterns";

interface ShiftFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shift?: Shift | null;
  stores: Store[];
  users: (Profile & { store?: { id: string; name: string } | null })[];
  onSubmit: (data: ShiftFormData) => Promise<void>;
  isLoading?: boolean;
  /** Pre-select a store when the form opens */
  initialStoreId?: string;
  /** Pre-fill the first shift's date when the form opens */
  initialDate?: Date;
  /** If true, user can only add one shift (no "Add Another Day" button) */
  singleShiftMode?: boolean;
}

interface ShiftEntry {
  id: string;
  date: string;
  mode: "preset" | "custom";
  pattern: string;
  startTime: string;
  endTime: string;
}

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

interface ShiftFormBodyProps extends ShiftFormProps {
  initialSelectedStore: string;
  initialSelectedStaff: string;
  initialShifts: ShiftEntry[];
  initialNotes: string;
}

function ShiftFormBody({
  open,
  onOpenChange,
  shift,
  stores,
  users,
  onSubmit,
  isLoading,
  singleShiftMode = false,
  initialSelectedStore,
  initialSelectedStaff,
  initialShifts,
  initialNotes,
}: ShiftFormBodyProps) {
  const [selectedStore, setSelectedStore] = useState(initialSelectedStore);
  const [selectedStaff, setSelectedStaff] = useState(initialSelectedStaff);
  const [shifts, setShifts] = useState<ShiftEntry[]>(initialShifts);
  const [notes, setNotes] = useState(initialNotes);
  const [submittingIndex, setSubmittingIndex] = useState<number | null>(null);
  const [openDatePickerId, setOpenDatePickerId] = useState<string | null>(null);

  // Get store object
  const store = stores.find((s) => s.id === selectedStore);

  // Helper function to get shift patterns for a specific date
  const getShiftPatternsForDate = (dateStr: string) => {
    if (!store?.weekly_hours || !dateStr)
      return { patterns: [], dayOfWeek: null, storeHours: null };
    const dayOfWeek = getDayOfWeekKey(parseISO(dateStr));
    const storeHours = getStoreHoursForDate(store, parseISO(dateStr));
    const dayHours = store.weekly_hours[dayOfWeek];
    const shiftPatterns = dayHours?.shifts || null;

    const patterns = shiftPatterns
      ? DEFAULT_SHIFT_PATTERNS.filter((pattern) => {
          const slot = shiftPatterns[pattern.id as keyof typeof shiftPatterns];
          return slot?.start_time && slot?.end_time;
        })
      : [];

    return { patterns, dayOfWeek, storeHours, shiftPatterns };
  };

  // Filter users - show all active users who belong to this store (any role can have a shift)
  const availableUsers = users.filter((u) => u.status === "Active");

  // Add a new shift entry (for a new date)
  const addShiftEntry = () => {
    const newId = String(Date.now());
    setShifts((prev) => [
      ...prev,
      {
        id: newId,
        date: "",
        mode: "preset",
        pattern: "opening",
        startTime: "09:00",
        endTime: "17:00",
      },
    ]);
  };

  // Remove a shift entry
  const removeShiftEntry = (id: string) => {
    setShifts((prev) => prev.filter((s) => s.id !== id));
  };

  // Update a shift entry
  const updateShiftEntry = (id: string, updates: Partial<ShiftEntry>) => {
    setShifts((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...updates } : s)),
    );
  };

  // Get times for a shift entry (from pattern or custom)
  const getShiftTimes = (entry: ShiftEntry): { start: string; end: string } => {
    if (entry.mode === "preset" && entry.date) {
      const { shiftPatterns } = getShiftPatternsForDate(entry.date);
      if (shiftPatterns) {
        const pattern =
          shiftPatterns[entry.pattern as keyof typeof shiftPatterns];
        if (pattern?.start_time && pattern?.end_time) {
          return { start: pattern.start_time, end: pattern.end_time };
        }
      }
    }
    return { start: entry.startTime, end: entry.endTime };
  };

  // Check if a shift is overnight (end time is before start time)
  const isOvernightShift = (startTime: string, endTime: string): boolean => {
    const [startHour, startMin] = startTime.split(":").map(Number);
    const [endHour, endMin] = endTime.split(":").map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    return endMinutes < startMinutes;
  };

  // Check if all shifts have dates
  const allShiftsHaveDates = shifts.every((s) => s.date);

  // Handle submit - creates all shifts
  const handleSubmit = async () => {
    if (
      !selectedStore ||
      !selectedStaff ||
      !allShiftsHaveDates ||
      shifts.length === 0
    )
      return;

    for (let i = 0; i < shifts.length; i++) {
      setSubmittingIndex(i);
      const entry = shifts[i];
      const times = getShiftTimes(entry);

      const startDateTime = new Date(`${entry.date}T${times.start}:00`);
      let endDateTime = new Date(`${entry.date}T${times.end}:00`);

      // If end time is before start time, it's an overnight shift - add a day to end time
      if (isOvernightShift(times.start, times.end)) {
        endDateTime = addDays(endDateTime, 1);
      }

      await onSubmit({
        store_id: selectedStore,
        user_id: selectedStaff,
        start_time: startDateTime.toISOString(),
        end_time: endDateTime.toISOString(),
        notes: i === 0 ? notes : "", // Only add notes to first shift
      });
    }

    setSubmittingIndex(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-lg max-h-[90vh] overflow-y-auto"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{shift ? "Edit Shift" : "Create A Shift"}</DialogTitle>
          <DialogDescription>
            {shift
              ? "Update shift details below."
              : `Schedule a shift at ${store?.name || "your store"}.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Team Member Selection */}
          <div className="space-y-2">
            <Label>Team Member</Label>
            <Select value={selectedStaff} onValueChange={setSelectedStaff}>
              <SelectTrigger>
                <SelectValue placeholder="Select team member" />
              </SelectTrigger>
              <SelectContent>
                {availableUsers.length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground text-center">
                    No team members available
                  </div>
                ) : (
                  availableUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.full_name || u.email}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Shift Entries - Each with its own date */}
          <div className="space-y-3">
            <Label>Shifts</Label>

            {shifts.map((entry, index) => {
              const { patterns, dayOfWeek, storeHours, shiftPatterns } =
                entry.date
                  ? getShiftPatternsForDate(entry.date)
                  : {
                      patterns: [],
                      dayOfWeek: null,
                      storeHours: null,
                      shiftPatterns: null,
                    };
              const hasPatterns = patterns.length > 0;

              return (
                <div
                  key={entry.id}
                  className="border rounded-lg p-3 space-y-3 bg-muted/30"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      Shift {index + 1}
                    </span>
                    {shifts.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                        onClick={() => removeShiftEntry(entry.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  {/* Date for this shift */}
                  <div className="space-y-1">
                    <Label className="text-xs">Date</Label>
                    <Popover
                      open={openDatePickerId === entry.id}
                      onOpenChange={(isOpen) =>
                        setOpenDatePickerId(isOpen ? entry.id : null)
                      }
                    >
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          className={`w-full justify-start text-left font-normal ${!entry.date ? "text-muted-foreground" : ""}`}
                        >
                          <CalendarDays className="mr-2 h-4 w-4" />
                          {entry.date
                            ? format(parseISO(entry.date), "EEE, MMM d, yyyy")
                            : "Select date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={
                            entry.date ? parseISO(entry.date) : undefined
                          }
                          onSelect={(date) => {
                            if (date)
                              updateShiftEntry(entry.id, {
                                date: format(date, "yyyy-MM-dd"),
                              });
                            setOpenDatePickerId(null);
                          }}
                          disabled={{ before: new Date() }}
                          weekStartsOn={1}
                        />
                      </PopoverContent>
                    </Popover>
                    {entry.date && dayOfWeek && (
                      <p className="text-xs text-muted-foreground">
                        {DAY_NAMES[dayOfWeek]}
                        {storeHours?.isOpen && storeHours.openingTime && (
                          <span>
                            {" "}
                            • {storeHours.openingTime} -{" "}
                            {storeHours.closingTime}
                          </span>
                        )}
                        {storeHours && !storeHours.isOpen && (
                          <span className="text-amber-600"> • Closed</span>
                        )}
                      </p>
                    )}
                  </div>

                  {/* Only show time options after date is selected */}
                  {entry.date && (
                    <>
                      {/* Mode toggle */}
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant={
                            entry.mode === "preset" ? "default" : "outline"
                          }
                          size="sm"
                          onClick={() =>
                            updateShiftEntry(entry.id, { mode: "preset" })
                          }
                          disabled={!hasPatterns}
                          className="flex-1"
                        >
                          Use Preset
                        </Button>
                        <Button
                          type="button"
                          variant={
                            entry.mode === "custom" ? "default" : "outline"
                          }
                          size="sm"
                          onClick={() =>
                            updateShiftEntry(entry.id, { mode: "custom" })
                          }
                          className="flex-1"
                        >
                          Custom Time
                        </Button>
                      </div>

                      {/* Preset selection */}
                      {entry.mode === "preset" && hasPatterns && (
                        <div
                          className={`grid gap-2 ${patterns.length === 3 ? "grid-cols-3" : patterns.length === 2 ? "grid-cols-2" : "grid-cols-1"}`}
                        >
                          {patterns.map((pattern) => {
                            const Icon = PATTERN_ICONS[pattern.id] || Clock;
                            const isSelected = entry.pattern === pattern.id;
                            const shiftSlot =
                              shiftPatterns?.[
                                pattern.id as keyof typeof shiftPatterns
                              ];

                            if (!shiftSlot?.start_time || !shiftSlot?.end_time)
                              return null;

                            return (
                              <button
                                key={pattern.id}
                                type="button"
                                onClick={() =>
                                  updateShiftEntry(entry.id, {
                                    pattern: pattern.id,
                                  })
                                }
                                className={`p-2 rounded-lg border-2 text-center transition-all ${
                                  isSelected
                                    ? "border-primary bg-primary/5"
                                    : "border-muted hover:border-muted-foreground/30"
                                }`}
                              >
                                <Icon
                                  className={`h-4 w-4 mx-auto mb-1 ${isSelected ? "text-primary" : "text-muted-foreground"}`}
                                />
                                <div className="font-medium text-xs">
                                  {pattern.name}
                                </div>
                                <div className="text-[10px] text-muted-foreground">
                                  {shiftSlot.start_time} - {shiftSlot.end_time}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {/* Preset not available message */}
                      {entry.mode === "preset" && !hasPatterns && (
                        <p className="text-xs text-amber-900 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 p-2 rounded font-medium">
                          No shift patterns configured for{" "}
                          {dayOfWeek ? DAY_NAMES[dayOfWeek] : "this day"}. Use
                          custom time or configure patterns in store settings.
                        </p>
                      )}

                      {/* Custom time inputs */}
                      {entry.mode === "custom" && (
                        <>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs">Start Time</Label>
                              <TimePicker
                                value={entry.startTime}
                                onChange={(v) =>
                                  updateShiftEntry(entry.id, { startTime: v })
                                }
                                placeholder="Start"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">End Time</Label>
                              <TimePicker
                                value={entry.endTime}
                                onChange={(v) =>
                                  updateShiftEntry(entry.id, { endTime: v })
                                }
                                placeholder="End"
                              />
                            </div>
                          </div>
                          {/* Overnight shift indicator */}
                          {isOvernightShift(entry.startTime, entry.endTime) && (
                            <div className="flex items-center gap-2 p-2 bg-indigo-50 dark:bg-indigo-950/50 rounded text-xs text-indigo-700 dark:text-indigo-300">
                              <MoonStar className="h-4 w-4 flex-shrink-0" />
                              <span>
                                Overnight shift: ends {entry.endTime} on{" "}
                                <span className="font-medium">
                                  {format(
                                    addDays(parseISO(entry.date), 1),
                                    "EEE, MMM d",
                                  )}
                                </span>
                              </span>
                            </div>
                          )}
                        </>
                      )}
                    </>
                  )}
                </div>
              );
            })}

            {/* Add another shift button */}
            {!shift && !singleShiftMode && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                onClick={addShiftEntry}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Another Shift
              </Button>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notes (optional)</Label>
            <Textarea
              placeholder="Add any notes about this shift"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Summary */}
          {selectedStore &&
            selectedStaff &&
            allShiftsHaveDates &&
            shifts.length > 0 && (
              <div className="bg-muted/50 rounded-lg p-3 text-sm">
                <div className="font-medium">Summary</div>
                <div className="text-muted-foreground mt-1 space-y-1">
                  <p>
                    {availableUsers.find((u) => u.id === selectedStaff)
                      ?.full_name || "Team member"}
                  </p>
                  <div className="mt-2 space-y-1">
                    {shifts.map((entry, i) => {
                      const times = getShiftTimes(entry);
                      const { dayOfWeek } = getShiftPatternsForDate(entry.date);
                      const overnight = isOvernightShift(
                        times.start,
                        times.end,
                      );
                      return (
                        <p key={entry.id} className="text-xs">
                          {dayOfWeek ? DAY_NAMES[dayOfWeek].slice(0, 3) : ""}{" "}
                          {format(parseISO(entry.date), "MMM d")}: {times.start}{" "}
                          - {times.end}
                          {overnight && (
                            <span className="text-indigo-600 dark:text-indigo-400">
                              {" "}
                              (+1 day)
                            </span>
                          )}
                          {entry.mode === "preset" && (
                            <span className="text-muted-foreground">
                              {" "}
                              ({entry.pattern})
                            </span>
                          )}
                        </p>
                      );
                    })}
                  </div>
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
              disabled={
                !selectedStore ||
                !selectedStaff ||
                !allShiftsHaveDates ||
                shifts.length === 0 ||
                isLoading
              }
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {shift
                ? "Update Shift"
                : `Create ${shifts.length} Shift${shifts.length > 1 ? "s" : ""}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ShiftForm({
  open,
  onOpenChange,
  shift,
  stores,
  users,
  onSubmit,
  isLoading,
  initialStoreId,
  initialDate,
  singleShiftMode = false,
}: ShiftFormProps) {
  // Compute initial state once per open/shift so the inner body can remount with fresh defaults
  const initialSelectedStore = shift ? shift.store_id : initialStoreId || "";
  const initialSelectedStaff = shift ? shift.user_id : "";
  const initialShifts: ShiftEntry[] = shift
    ? [
        {
          id: "1",
          date: format(new Date(shift.start_time), "yyyy-MM-dd"),
          mode: "custom",
          pattern: "",
          startTime: format(new Date(shift.start_time), "HH:mm"),
          endTime: format(new Date(shift.end_time), "HH:mm"),
        },
      ]
    : [
        {
          id: "1",
          date: initialDate ? format(initialDate, "yyyy-MM-dd") : "",
          mode: "preset",
          pattern: "opening",
          startTime: "09:00",
          endTime: "17:00",
        },
      ];
  const initialNotes = shift ? (shift.notes ?? "") : "";

  return (
    <ShiftFormBody
      key={`${open}-${shift?.id ?? "new"}-${initialStoreId}-${initialDate?.toISOString()}`}
      open={open}
      onOpenChange={onOpenChange}
      shift={shift}
      stores={stores}
      users={users}
      onSubmit={onSubmit}
      isLoading={isLoading}
      initialStoreId={initialStoreId}
      initialDate={initialDate}
      singleShiftMode={singleShiftMode}
      initialSelectedStore={initialSelectedStore}
      initialSelectedStaff={initialSelectedStaff}
      initialShifts={initialShifts}
      initialNotes={initialNotes}
    />
  );
}
