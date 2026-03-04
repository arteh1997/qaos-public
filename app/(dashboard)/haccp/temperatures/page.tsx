"use client";

import { useState, useMemo, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useHACCPTemperatureLogs, useLogTemperature } from "@/hooks/useHACCP";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/ui/page-header";
import { PageGuide } from "@/components/help/PageGuide";
import { EmptyState } from "@/components/ui/empty-state";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Thermometer,
  ArrowLeft,
  Plus,
  CheckCircle,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { subDays, startOfDay, endOfDay } from "date-fns";
import type { DateRange } from "react-day-picker";

export default function HACCPTemperaturesPage() {
  const { currentStore } = useAuth();
  const storeId = currentStore?.store_id ?? null;

  // Filter state
  const [locationFilter, setLocationFilter] = useState<string>("all");
  const [outOfRangeOnly, setOutOfRangeOnly] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange>(() => ({
    from: subDays(new Date(), 29),
    to: new Date(),
  }));

  const queryParams = useMemo(
    () => ({
      from: dateRange?.from
        ? startOfDay(dateRange.from).toISOString()
        : undefined,
      to: dateRange?.to ? endOfDay(dateRange.to).toISOString() : undefined,
      location: locationFilter !== "all" ? locationFilter : undefined,
      out_of_range_only: outOfRangeOnly || undefined,
    }),
    [dateRange, locationFilter, outOfRangeOnly],
  );

  const { data: logs, isLoading } = useHACCPTemperatureLogs(
    storeId,
    queryParams,
  );
  const logTemperature = useLogTemperature(storeId);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [formLocation, setFormLocation] = useState("");
  const [formTemperature, setFormTemperature] = useState("");
  const [formMinTempRaw, setFormMinTemp] = useState("");
  const [formMaxTempRaw, setFormMaxTemp] = useState("");

  // Derive unique locations from logs for the dropdown
  const allLocations = useMemo(() => {
    if (!logs) return [];
    const set = new Set(logs.map((l) => l.location_name));
    return Array.from(set).sort();
  }, [logs]);

  // Build a map of location -> last known min/max bounds
  const locationBounds = useMemo(() => {
    if (!logs)
      return new Map<string, { min: number | null; max: number | null }>();
    const bounds = new Map<
      string,
      { min: number | null; max: number | null }
    >();
    // Logs are ordered most-recent-first, so the first occurrence per location has the latest bounds
    for (const log of logs) {
      if (
        !bounds.has(log.location_name) &&
        (log.min_temp != null || log.max_temp != null)
      ) {
        bounds.set(log.location_name, {
          min: log.min_temp ?? null,
          max: log.max_temp ?? null,
        });
      }
    }
    return bounds;
  }, [logs]);

  // Derive auto-filled min/max from the selected location's historical bounds.
  // When the user hasn't typed an override, we fall back to these derived values.
  const autoFilledBounds = useMemo(() => {
    if (!formLocation || !locationBounds.has(formLocation))
      return { min: "", max: "" };
    const b = locationBounds.get(formLocation)!;
    return {
      min: b.min != null ? String(b.min) : "",
      max: b.max != null ? String(b.max) : "",
    };
  }, [formLocation, locationBounds]);

  // Effective values: prefer user input, fall back to auto-filled bounds
  const formMinTemp =
    formMinTempRaw !== "" ? formMinTempRaw : autoFilledBounds.min;
  const formMaxTemp =
    formMaxTempRaw !== "" ? formMaxTempRaw : autoFilledBounds.max;

  const computedInRange = useMemo(() => {
    const temp = parseFloat(formTemperature);
    const min = parseFloat(formMinTemp);
    const max = parseFloat(formMaxTemp);
    if (isNaN(temp)) return null;
    if (!isNaN(min) && temp < min) return false;
    if (!isNaN(max) && temp > max) return false;
    if (!isNaN(min) || !isNaN(max)) return true;
    return null; // no range specified
  }, [formTemperature, formMinTemp, formMaxTemp]);

  const resetForm = () => {
    setFormLocation("");
    setFormTemperature("");
    setFormMinTemp("");
    setFormMaxTemp("");
  };

  const handleSubmit = async () => {
    const temperature = parseFloat(formTemperature);
    if (!formLocation.trim() || isNaN(temperature)) return;

    const min = parseFloat(formMinTemp);
    const max = parseFloat(formMaxTemp);

    await logTemperature.mutateAsync({
      location_name: formLocation.trim(),
      temperature_celsius: temperature,
      min_temp: !isNaN(min) ? min : undefined,
      max_temp: !isNaN(max) ? max : undefined,
    });

    resetForm();
    setShowForm(false);
  };

  if (!storeId) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Temperature Logging"
          description="Record and monitor equipment temperatures"
        >
          <PageGuide pageKey="haccp-temperatures" />
        </PageHeader>
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            Select a store to manage temperature logs.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Temperature Logging"
        description="Record and monitor equipment temperatures"
      >
        <div className="flex items-center gap-2">
          <Link href="/haccp">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <Button onClick={() => setShowForm(!showForm)}>
            <Plus className="h-4 w-4 mr-2" />
            Log Temperature
          </Button>
        </div>
        <PageGuide pageKey="haccp-temperatures" />
      </PageHeader>

      {/* Log Form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Log a Temperature Reading
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="log-location">Location</Label>
                {allLocations.length > 0 ? (
                  <div className="space-y-2">
                    <Select
                      value={
                        allLocations.includes(formLocation)
                          ? formLocation
                          : "__custom__"
                      }
                      onValueChange={(value) => {
                        if (value === "__custom__") {
                          setFormLocation("");
                          setFormMinTemp("");
                          setFormMaxTemp("");
                        } else {
                          setFormLocation(value);
                          setFormMinTemp("");
                          setFormMaxTemp("");
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select location..." />
                      </SelectTrigger>
                      <SelectContent>
                        {allLocations.map((loc) => (
                          <SelectItem key={loc} value={loc}>
                            {loc}
                          </SelectItem>
                        ))}
                        <SelectItem value="__custom__">
                          + New location
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    {!allLocations.includes(formLocation) && (
                      <Input
                        id="log-location"
                        placeholder="e.g. Walk-in Fridge, Freezer A"
                        value={formLocation}
                        onChange={(e) => setFormLocation(e.target.value)}
                      />
                    )}
                  </div>
                ) : (
                  <Input
                    id="log-location"
                    placeholder="e.g. Walk-in Fridge, Freezer A"
                    value={formLocation}
                    onChange={(e) => setFormLocation(e.target.value)}
                  />
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="log-temperature">Temperature (°C)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="log-temperature"
                    type="number"
                    step="0.1"
                    placeholder="0.0"
                    value={formTemperature}
                    onChange={(e) => setFormTemperature(e.target.value)}
                  />
                  {computedInRange !== null &&
                    (computedInRange ? (
                      <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0" />
                    ) : (
                      <XCircle className="h-5 w-5 text-destructive shrink-0" />
                    ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="log-min">Min Acceptable (°C)</Label>
                <Input
                  id="log-min"
                  type="number"
                  step="0.1"
                  placeholder="e.g. 2"
                  value={formMinTemp}
                  onChange={(e) => setFormMinTemp(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="log-max">Max Acceptable (°C)</Label>
                <Input
                  id="log-max"
                  type="number"
                  step="0.1"
                  placeholder="e.g. 8"
                  value={formMaxTemp}
                  onChange={(e) => setFormMaxTemp(e.target.value)}
                />
              </div>
            </div>

            {computedInRange === false && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                <XCircle className="h-4 w-4 shrink-0" />
                Temperature is outside the acceptable range
              </div>
            )}

            <div className="flex items-center gap-2">
              <Button
                onClick={handleSubmit}
                disabled={
                  logTemperature.isPending ||
                  !formLocation.trim() ||
                  !formTemperature
                }
              >
                {logTemperature.isPending ? "Logging..." : "Log Temperature"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowForm(false);
                  resetForm();
                }}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="text-sm font-medium">
              Temperature History
            </CardTitle>
            <div className="flex items-center gap-3 flex-wrap">
              <DateRangePicker
                value={dateRange}
                onChange={(range) =>
                  setDateRange(
                    range || { from: subDays(new Date(), 29), to: new Date() },
                  )
                }
                presets={[
                  "last7days",
                  "last14days",
                  "last30days",
                  "last60days",
                  "last90days",
                ]}
                align="end"
              />
              {allLocations.length > 0 && (
                <Select
                  value={locationFilter}
                  onValueChange={setLocationFilter}
                >
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="All locations" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Locations</SelectItem>
                    {allLocations.map((loc) => (
                      <SelectItem key={loc} value={loc}>
                        {loc}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <div className="flex items-center gap-2">
                <Switch
                  checked={outOfRangeOnly}
                  onCheckedChange={setOutOfRangeOnly}
                />
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  Out of range only
                </span>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !logs || logs.length === 0 ? (
            <EmptyState
              icon={Thermometer}
              title="No temperature logs"
              description="Start logging temperatures to monitor food safety compliance."
              action={{
                label: "Log Temperature",
                onClick: () => setShowForm(true),
                icon: Plus,
              }}
            />
          ) : (
            <>
              {/* Mobile card view */}
              <div className="sm:hidden space-y-3">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className={`border rounded-lg p-3 space-y-2 ${!log.is_in_range ? "border-destructive/30 bg-destructive/5" : ""}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {new Date(log.recorded_at).toLocaleDateString("en-GB", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {log.is_in_range ? (
                          <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5 text-destructive" />
                        )}
                        <span
                          className={`text-sm font-bold ${log.is_in_range ? "text-foreground" : "text-destructive"}`}
                        >
                          {log.temperature_celsius}°C
                        </span>
                      </div>
                    </div>
                    <p className="font-medium text-sm">{log.location_name}</p>
                    {(log.min_temp != null || log.max_temp != null) && (
                      <p className="text-xs text-muted-foreground">
                        Range: {log.min_temp ?? "—"}°C to {log.max_temp ?? "—"}
                        °C
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {/* Desktop table */}
              <div className="hidden sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead className="text-right">Temperature</TableHead>
                      <TableHead className="text-right">Range</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow
                        key={log.id}
                        className={!log.is_in_range ? "bg-destructive/5" : ""}
                      >
                        <TableCell className="whitespace-nowrap text-sm">
                          {new Date(log.recorded_at).toLocaleDateString(
                            "en-GB",
                            {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            },
                          )}
                        </TableCell>
                        <TableCell className="font-medium">
                          {log.location_name}
                        </TableCell>
                        <TableCell
                          className={`text-right font-bold ${log.is_in_range ? "" : "text-destructive"}`}
                        >
                          {log.temperature_celsius}°C
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {log.min_temp != null || log.max_temp != null
                            ? `${log.min_temp ?? "—"}°C to ${log.max_temp ?? "—"}°C`
                            : "-"}
                        </TableCell>
                        <TableCell>
                          {log.is_in_range ? (
                            <Badge
                              variant="secondary"
                              className="bg-emerald-50 text-emerald-700"
                            >
                              In Range
                            </Badge>
                          ) : (
                            <Badge
                              variant="secondary"
                              className="bg-destructive/10 text-destructive"
                            >
                              Out of Range
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
