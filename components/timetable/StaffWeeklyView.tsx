"use client";

import { useMemo } from "react";
import { Shift, Store } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Clock, MapPin } from "lucide-react";
import {
  format,
  startOfWeek,
  endOfWeek,
  addWeeks,
  subWeeks,
  isSameDay,
  isToday,
} from "date-fns";
import {
  getWeekDates,
  guessShiftPattern,
  formatShiftTime,
} from "@/lib/shift-patterns";

interface StaffWeeklyViewProps {
  shifts: Shift[];
  stores: Store[];
  currentWeek: Date;
  onWeekChange: (date: Date) => void;
}

export function StaffWeeklyView({
  shifts,
  stores,
  currentWeek,
  onWeekChange,
}: StaffWeeklyViewProps) {
  const weekDates = useMemo(() => getWeekDates(currentWeek), [currentWeek]);

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });

  // Group shifts by day
  const shiftsByDay = useMemo(() => {
    const grouped: Record<string, Shift[]> = {};

    weekDates.forEach((date) => {
      const dateKey = format(date, "yyyy-MM-dd");
      grouped[dateKey] = shifts.filter((shift) => {
        const shiftDate = new Date(shift.start_time);
        return isSameDay(shiftDate, date);
      });
    });

    return grouped;
  }, [shifts, weekDates]);

  // Calculate total hours for the week
  const totalHours = useMemo(() => {
    let hours = 0;
    shifts.forEach((shift) => {
      const start = new Date(shift.start_time);
      const end = new Date(shift.end_time);
      // Only count if within current week
      if (start >= weekStart && start <= weekEnd) {
        hours += (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      }
    });
    return Math.round(hours * 10) / 10;
  }, [shifts, weekStart, weekEnd]);

  // Count shifts this week
  const shiftsThisWeek = useMemo(() => {
    return shifts.filter((shift) => {
      const start = new Date(shift.start_time);
      return start >= weekStart && start <= weekEnd;
    }).length;
  }, [shifts, weekStart, weekEnd]);

  const getStoreName = (storeId: string) => {
    return stores.find((s) => s.id === storeId)?.name || "Unknown Store";
  };

  const getPatternColor = (shift: Shift, store?: Store) => {
    const pattern = guessShiftPattern(
      new Date(shift.start_time),
      store?.opening_time || "06:00",
    );

    const colors: Record<string, string> = {
      opening: "bg-emerald-900/30 border-emerald-700",
      mid: "bg-blue-900/30 border-blue-700",
      closing: "bg-purple-900/30 border-purple-700",
    };

    return colors[pattern] || "bg-gray-800 border-gray-700";
  };

  const getPatternLabel = (shift: Shift, store?: Store) => {
    const pattern = guessShiftPattern(
      new Date(shift.start_time),
      store?.opening_time || "06:00",
    );

    const labels: Record<string, string> = {
      opening: "Opening",
      mid: "Mid",
      closing: "Closing",
      custom: "Shift",
    };

    return labels[pattern] || "Shift";
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <CardTitle className="text-base sm:text-lg flex items-center gap-2">
            <Clock className="h-4 w-4 sm:h-5 sm:w-5" />
            Weekly Schedule
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => onWeekChange(subWeeks(currentWeek, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs sm:text-sm font-medium min-w-[140px] sm:min-w-[180px] text-center">
              {format(weekStart, "MMM d")} - {format(weekEnd, "MMM d, yyyy")}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => onWeekChange(addWeeks(currentWeek, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Week Stats */}
        <div className="flex gap-3 sm:gap-4 mt-2 text-xs sm:text-sm text-muted-foreground">
          <span>
            {shiftsThisWeek} shift{shiftsThisWeek !== 1 ? "s" : ""}
          </span>
          <span className="text-muted-foreground/50">|</span>
          <span>{totalHours}h scheduled</span>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {/* Mobile List View */}
        <div className="sm:hidden border-t">
          {weekDates.map((date) => {
            const dateKey = format(date, "yyyy-MM-dd");
            const dayShifts = shiftsByDay[dateKey] || [];
            const isCurrentDay = isToday(date);

            return (
              <div key={dateKey} className="border-b last:border-b-0">
                {/* Day Header */}
                <div
                  className={`px-3 py-2 flex items-center justify-between ${
                    isCurrentDay ? "bg-primary/10" : "bg-muted/30"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-lg font-semibold ${isCurrentDay ? "text-primary" : ""}`}
                    >
                      {format(date, "d")}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {format(date, "EEEE")}
                    </span>
                  </div>
                  {dayShifts.length > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {dayShifts.length} shift
                      {dayShifts.length !== 1 ? "s" : ""}
                    </Badge>
                  )}
                </div>

                {/* Shifts for this day */}
                <div className="p-2 space-y-2">
                  {dayShifts.length === 0 ? (
                    <div className="text-xs text-muted-foreground text-center py-3">
                      No shifts scheduled
                    </div>
                  ) : (
                    dayShifts.map((shift) => {
                      const store = stores.find((s) => s.id === shift.store_id);
                      const startTime = new Date(shift.start_time);
                      const endTime = new Date(shift.end_time);
                      const duration =
                        (endTime.getTime() - startTime.getTime()) /
                        (1000 * 60 * 60);

                      return (
                        <div
                          key={shift.id}
                          className={`rounded-md border p-2.5 ${getPatternColor(shift, store)}`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <Badge
                              variant="outline"
                              className="text-[10px] h-5 px-1.5"
                            >
                              {getPatternLabel(shift, store)}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {Math.round(duration)}h
                            </span>
                          </div>
                          <div className="text-sm font-medium">
                            {formatShiftTime(startTime)} -{" "}
                            {formatShiftTime(endTime)}
                          </div>
                          <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                            <MapPin className="h-3 w-3" />
                            {getStoreName(shift.store_id)}
                          </div>
                          {shift.clock_in_time && (
                            <div className="text-xs text-green-400 mt-1">
                              Clocked in:{" "}
                              {format(new Date(shift.clock_in_time), "h:mm a")}
                            </div>
                          )}
                          {shift.clock_out_time && (
                            <div className="text-xs text-muted-foreground">
                              Clocked out:{" "}
                              {format(new Date(shift.clock_out_time), "h:mm a")}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Desktop Calendar Grid */}
        <div className="hidden sm:grid grid-cols-7 border-t">
          {weekDates.map((date, index) => {
            const dateKey = format(date, "yyyy-MM-dd");
            const dayShifts = shiftsByDay[dateKey] || [];
            const isCurrentDay = isToday(date);

            return (
              <div
                key={dateKey}
                className={`min-h-[140px] border-r last:border-r-0 ${
                  isCurrentDay ? "bg-primary/5" : ""
                } ${index > 0 ? "" : ""}`}
              >
                {/* Day Header */}
                <div
                  className={`p-2 border-b text-center ${
                    isCurrentDay ? "bg-primary/10" : "bg-muted/30"
                  }`}
                >
                  <div className="text-xs text-muted-foreground">
                    {format(date, "EEE")}
                  </div>
                  <div
                    className={`text-lg font-semibold ${
                      isCurrentDay ? "text-primary" : ""
                    }`}
                  >
                    {format(date, "d")}
                  </div>
                </div>

                {/* Shifts */}
                <div className="p-1.5 space-y-1.5">
                  {dayShifts.length === 0 ? (
                    <div className="text-xs text-muted-foreground text-center py-4">
                      No shift
                    </div>
                  ) : (
                    dayShifts.map((shift) => {
                      const store = stores.find((s) => s.id === shift.store_id);
                      const startTime = new Date(shift.start_time);
                      const endTime = new Date(shift.end_time);
                      const duration =
                        (endTime.getTime() - startTime.getTime()) /
                        (1000 * 60 * 60);

                      return (
                        <div
                          key={shift.id}
                          className={`rounded-md border p-2 ${getPatternColor(shift, store)}`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <Badge
                              variant="outline"
                              className="text-[10px] h-4 px-1"
                            >
                              {getPatternLabel(shift, store)}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground">
                              {Math.round(duration)}h
                            </span>
                          </div>
                          <div className="text-xs font-medium">
                            {formatShiftTime(startTime)} -{" "}
                            {formatShiftTime(endTime)}
                          </div>
                          <div className="text-[10px] text-muted-foreground flex items-center gap-0.5 mt-1">
                            <MapPin className="h-2.5 w-2.5" />
                            {getStoreName(shift.store_id)}
                          </div>
                          {shift.clock_in_time && (
                            <div className="text-[10px] text-green-400 mt-1">
                              Clocked in:{" "}
                              {format(new Date(shift.clock_in_time), "h:mm a")}
                            </div>
                          )}
                          {shift.clock_out_time && (
                            <div className="text-[10px] text-muted-foreground">
                              Clocked out:{" "}
                              {format(new Date(shift.clock_out_time), "h:mm a")}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="p-2 sm:p-3 border-t bg-muted/20 flex flex-wrap gap-2 sm:gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-emerald-900/30 border border-emerald-700" />
            <span>Opening</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-blue-900/30 border border-blue-700" />
            <span>Mid</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-purple-900/30 border border-purple-700" />
            <span>Closing</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
