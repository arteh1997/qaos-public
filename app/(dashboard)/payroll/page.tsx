"use client";

import { useState, useMemo, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  useStaffRates,
  useEarnings,
  usePayRuns,
  usePayRunDetail,
  useCreatePayRun,
  useUpdatePayRun,
  useDeletePayRun,
} from "@/hooks/usePayroll";
import type { StaffRate } from "@/hooks/usePayroll";
import { PageHeader } from "@/components/ui/page-header";
import { PageGuide } from "@/components/help/PageGuide";
import { StatsCard } from "@/components/cards/StatsCard";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { DateRange } from "react-day-picker";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import {
  PoundSterling,
  Clock,
  Users,
  FileText,
  Plus,
  ChevronDown,
  ChevronUp,
  Trash2,
  CheckCircle2,
  ArrowLeft,
} from "lucide-react";
import { format, startOfWeek, endOfWeek, parseISO } from "date-fns";
import type { PayRun, PayRunStatus } from "@/types";

// ─── Helpers ──────────────────────────────────────────────────

function formatCurrency(value: number): string {
  return value.toLocaleString("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatHours(value: number): string {
  return value.toFixed(1);
}

function toDateString(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

// ─── Role Helpers (matching Team page) ────────────────────────

function getInitials(name: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

const ROLE_STYLES: Record<string, { dot: string; bg: string; text: string }> = {
  Owner: { dot: "bg-amber-500", bg: "bg-amber-500/10", text: "text-amber-400" },
  "Co-Owner": {
    dot: "bg-amber-400",
    bg: "bg-amber-500/10",
    text: "text-amber-400",
  },
  Manager: { dot: "bg-blue-500", bg: "bg-blue-500/10", text: "text-blue-400" },
  Staff: {
    dot: "bg-emerald-500",
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
  },
};

function getDisplayRole(rate: StaffRate): string {
  if (rate.role === "Owner") {
    return rate.is_billing_owner ? "Owner" : "Co-Owner";
  }
  return rate.role;
}

function RoleBadge({ role }: { role: string }) {
  const style = ROLE_STYLES[role] || {
    dot: "bg-muted-foreground",
    bg: "bg-muted",
    text: "text-muted-foreground",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium ${style.bg} ${style.text}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
      {role}
    </span>
  );
}

// ─── Status Badge ─────────────────────────────────────────────

function PayRunStatusBadge({ status }: { status: PayRunStatus }) {
  switch (status) {
    case "draft":
      return <Badge variant="outline">Draft</Badge>;
    case "approved":
      return (
        <Badge className="border-transparent bg-blue-500/10 text-blue-400 hover:bg-blue-100">
          Approved
        </Badge>
      );
    case "paid":
      return (
        <Badge className="border-transparent bg-emerald-500/10 text-emerald-400 hover:bg-emerald-100">
          Paid
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

// ─── Loading Skeletons ────────────────────────────────────────

function StatsCardsSkeleton() {
  return (
    <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i} className="py-5 gap-4">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-7 w-20" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function TableSkeleton({
  rows = 5,
  cols = 5,
}: {
  rows?: number;
  cols?: number;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {Array.from({ length: cols }).map((_, i) => (
            <TableHead key={i}>
              <Skeleton className="h-4 w-20" />
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: rows }).map((_, r) => (
          <TableRow key={r}>
            {Array.from({ length: cols }).map((_, c) => (
              <TableCell key={c}>
                <Skeleton className="h-4 w-16" />
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// ─── Earnings Tab ─────────────────────────────────────────────

function EarningsTab({ storeId }: { storeId: string }) {
  const [dateRange, setDateRange] = useState<DateRange>(() => ({
    from: startOfWeek(new Date(), { weekStartsOn: 1 }),
    to: endOfWeek(new Date(), { weekStartsOn: 1 }),
  }));

  const from = dateRange?.from ? toDateString(dateRange.from) : "";
  const to = dateRange?.to ? toDateString(dateRange.to) : "";

  const { data, isLoading } = useEarnings(storeId, from, to);
  const createPayRun = useCreatePayRun(storeId);

  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());

  const toggleExpanded = useCallback((userId: string) => {
    setExpandedUsers((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  }, []);

  function handleDateChange(range: DateRange | undefined) {
    setDateRange(range || { from: new Date(), to: new Date() });
    setExpandedUsers(new Set());
  }

  function handleCreatePayRun() {
    createPayRun.mutate({ period_start: from, period_end: to });
  }

  const totals = data?.totals;
  const earnings = data?.earnings ?? [];
  const canCreatePayRun =
    earnings.length > 0 && !isLoading && !createPayRun.isPending;

  return (
    <div className="space-y-6">
      {/* Date range picker */}
      <DateRangePicker
        value={dateRange}
        onChange={handleDateChange}
        className="w-auto min-w-[280px]"
      />

      {/* Stats cards */}
      {isLoading ? (
        <StatsCardsSkeleton />
      ) : (
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title="Total Hours"
            value={totals ? formatHours(totals.total_hours) : "0.0"}
            icon={<Clock className="h-4 w-4" />}
          />
          <StatsCard
            title="Total Pay"
            value={
              totals ? formatCurrency(totals.total_pay) : formatCurrency(0)
            }
            icon={<PoundSterling className="h-4 w-4" />}
          />
          <StatsCard
            title="Staff Count"
            value={totals?.staff_count ?? 0}
            icon={<Users className="h-4 w-4" />}
          />
          <StatsCard
            title="Shift Count"
            value={totals?.shift_count ?? 0}
            icon={<FileText className="h-4 w-4" />}
          />
        </div>
      )}

      {/* Earnings table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Earnings Breakdown</CardTitle>
            <Button
              size="sm"
              onClick={handleCreatePayRun}
              disabled={!canCreatePayRun}
            >
              <Plus className="mr-2 h-4 w-4" />
              {createPayRun.isPending ? "Creating..." : "Create Pay Run"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <TableSkeleton rows={5} cols={5} />
          ) : earnings.length === 0 ? (
            <EmptyState
              icon={PoundSterling}
              title="No earnings found"
              description="No shifts with clock-in data were found for this period. Adjust the date range to see earnings."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8" />
                    <TableHead>Name</TableHead>
                    <TableHead className="text-right">Hours</TableHead>
                    <TableHead className="text-right">Rate</TableHead>
                    <TableHead className="text-right">Gross Pay</TableHead>
                    <TableHead className="text-right">Shifts</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {earnings.map((earning) => {
                    const isExpanded = expandedUsers.has(earning.user_id);
                    return (
                      <EarningsRow
                        key={earning.user_id}
                        earning={earning}
                        isExpanded={isExpanded}
                        onToggle={() => toggleExpanded(earning.user_id)}
                      />
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function EarningsRow({
  earning,
  isExpanded,
  onToggle,
}: {
  earning: {
    user_id: string;
    user_name: string;
    hourly_rate: number | null;
    total_hours: number;
    gross_pay: number;
    shift_count: number;
    shifts: Array<{
      shift_id: string;
      date: string;
      clock_in: string;
      clock_out: string;
      hours: number;
      pay: number;
    }>;
  };
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <TableRow className="cursor-pointer hover:bg-muted/50" onClick={onToggle}>
        <TableCell className="w-8">
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </TableCell>
        <TableCell className="font-medium">{earning.user_name}</TableCell>
        <TableCell className="text-right">
          {formatHours(earning.total_hours)}
        </TableCell>
        <TableCell className="text-right">
          {earning.hourly_rate != null ? (
            `${formatCurrency(earning.hourly_rate)}/hr`
          ) : (
            <span className="text-amber-500">Not set</span>
          )}
        </TableCell>
        <TableCell className="text-right font-medium">
          {formatCurrency(earning.gross_pay)}
        </TableCell>
        <TableCell className="text-right">{earning.shift_count}</TableCell>
      </TableRow>
      {isExpanded && earning.shifts.length > 0 && (
        <TableRow>
          <TableCell colSpan={6} className="bg-muted/30 p-0">
            <div className="px-4 sm:px-8 py-3 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Clock In</TableHead>
                    <TableHead>Clock Out</TableHead>
                    <TableHead className="text-right">Hours</TableHead>
                    <TableHead className="text-right">Pay</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {earning.shifts.map((shift) => (
                    <TableRow key={shift.shift_id}>
                      <TableCell>
                        {format(parseISO(shift.date), "d MMM yyyy")}
                      </TableCell>
                      <TableCell>
                        {shift.clock_in
                          ? format(parseISO(shift.clock_in), "HH:mm")
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {shift.clock_out
                          ? format(parseISO(shift.clock_out), "HH:mm")
                          : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatHours(shift.hours)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(shift.pay)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

// ─── Pay Runs Tab ─────────────────────────────────────────────

function PayRunsTab({ storeId }: { storeId: string }) {
  const { data: payRuns, isLoading } = usePayRuns(storeId);
  const [selectedPayRunId, setSelectedPayRunId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<DateRange | undefined>(
    undefined,
  );

  const filteredPayRuns = useMemo(() => {
    if (!payRuns) return [];
    let result = payRuns;

    // Status filter
    if (statusFilter !== "all") {
      result = result.filter((pr) => pr.status === statusFilter);
    }

    // Date range filter
    if (dateFilter?.from) {
      const filterFrom = format(dateFilter.from, "yyyy-MM-dd");
      const filterTo = dateFilter.to
        ? format(dateFilter.to, "yyyy-MM-dd")
        : filterFrom;
      result = result.filter((pr) => {
        // Show pay runs whose period overlaps with the filter range
        return pr.period_end >= filterFrom && pr.period_start <= filterTo;
      });
    }

    return result;
  }, [payRuns, statusFilter, dateFilter]);

  // Summary stats
  const totalPaid = useMemo(
    () =>
      (payRuns ?? [])
        .filter((pr) => pr.status === "paid")
        .reduce((sum, pr) => sum + pr.total_amount, 0),
    [payRuns],
  );

  if (selectedPayRunId) {
    return (
      <PayRunDetail
        storeId={storeId}
        payRunId={selectedPayRunId}
        onBack={() => setSelectedPayRunId(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters & date range */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1 rounded-lg border p-2">
          {(["all", "draft", "approved", "paid"] as const).map((status) => {
            const count =
              status === "all"
                ? (payRuns?.length ?? 0)
                : (payRuns ?? []).filter((pr) => pr.status === status).length;
            const isActive = statusFilter === status;
            return (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                {status === "all"
                  ? "All"
                  : status.charAt(0).toUpperCase() + status.slice(1)}{" "}
                <span
                  className={
                    isActive
                      ? "text-primary-foreground/70"
                      : "text-muted-foreground/60"
                  }
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
        <DateRangePicker
          value={dateFilter}
          onChange={(range) => setDateFilter(range)}
          className="w-auto min-w-[280px]"
          placeholder="Filter by date range"
        />
      </div>

      <Card>
        <CardContent className="pt-0">
          {isLoading ? (
            <TableSkeleton rows={5} cols={5} />
          ) : !payRuns || payRuns.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No pay runs yet"
              description="Create your first pay run from the Earnings tab by selecting a date range and clicking Create Pay Run."
            />
          ) : filteredPayRuns.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No matching pay runs"
              description={
                statusFilter !== "all"
                  ? `No ${statusFilter} pay runs found for this period.`
                  : "No pay runs match the selected date range."
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right hidden sm:table-cell">
                    Employees
                  </TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="hidden md:table-cell">
                    Created
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPayRuns.map((run) => (
                  <TableRow
                    key={run.id}
                    className="cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => setSelectedPayRunId(run.id)}
                  >
                    <TableCell className="font-medium">
                      {format(parseISO(run.period_start), "d MMM yyyy")} &ndash;{" "}
                      {format(parseISO(run.period_end), "d MMM yyyy")}
                    </TableCell>
                    <TableCell>
                      <PayRunStatusBadge status={run.status} />
                    </TableCell>
                    <TableCell className="text-right hidden sm:table-cell">
                      {run.items?.length ?? 0}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(run.total_amount)}
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden md:table-cell">
                      {format(parseISO(run.created_at), "d MMM yyyy")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Pay Run Detail ───────────────────────────────────────────

function PayRunDetail({
  storeId,
  payRunId,
  onBack,
}: {
  storeId: string;
  payRunId: string;
  onBack: () => void;
}) {
  const { data: payRun, isLoading } = usePayRunDetail(storeId, payRunId);
  const updatePayRun = useUpdatePayRun(storeId, payRunId);
  const deletePayRun = useDeletePayRun(storeId);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  function handleApprove() {
    updatePayRun.mutate({ status: "approved" });
  }

  function handleMarkPaid() {
    updatePayRun.mutate({ status: "paid" });
  }

  function handleDelete() {
    deletePayRun.mutate(payRunId, {
      onSuccess: () => {
        onBack();
      },
    });
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <StatsCardsSkeleton />
        <Card>
          <CardContent className="pt-6">
            <TableSkeleton rows={4} cols={6} />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!payRun) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Pay Runs
        </Button>
        <EmptyState
          icon={FileText}
          title="Pay run not found"
          description="This pay run could not be loaded. It may have been deleted."
        />
      </div>
    );
  }

  const items = payRun.items ?? [];
  const totalHours = items.reduce((sum, item) => sum + item.total_hours, 0);
  const totalOvertimeHours = items.reduce(
    (sum, item) => sum + item.overtime_hours,
    0,
  );
  const totalAdjustments = items.reduce(
    (sum, item) => sum + item.adjustments,
    0,
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">
                {format(parseISO(payRun.period_start), "d MMM yyyy")} &ndash;{" "}
                {format(parseISO(payRun.period_end), "d MMM yyyy")}
              </h2>
              <PayRunStatusBadge status={payRun.status} />
            </div>
            {payRun.notes && (
              <p className="text-sm text-muted-foreground mt-1">
                {payRun.notes}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {payRun.status === "draft" && (
            <>
              <Button
                size="sm"
                onClick={handleApprove}
                disabled={updatePayRun.isPending}
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                {updatePayRun.isPending ? "Approving..." : "Approve"}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowDeleteDialog(true)}
                disabled={deletePayRun.isPending}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            </>
          )}
          {payRun.status === "approved" && (
            <Button
              size="sm"
              onClick={handleMarkPaid}
              disabled={updatePayRun.isPending}
            >
              <PoundSterling className="mr-2 h-4 w-4" />
              {updatePayRun.isPending ? "Processing..." : "Mark as Paid"}
            </Button>
          )}
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Pay"
          value={formatCurrency(payRun.total_amount)}
          icon={<PoundSterling className="h-4 w-4" />}
        />
        <StatsCard
          title="Total Hours"
          value={formatHours(totalHours)}
          description={
            totalOvertimeHours > 0
              ? `${formatHours(totalOvertimeHours)} overtime`
              : undefined
          }
          icon={<Clock className="h-4 w-4" />}
        />
        <StatsCard
          title="Employees"
          value={items.length}
          icon={<Users className="h-4 w-4" />}
        />
        <StatsCard
          title="Adjustments"
          value={formatCurrency(totalAdjustments)}
          variant={totalAdjustments !== 0 ? "warning" : "default"}
          icon={<FileText className="h-4 w-4" />}
        />
      </div>

      {/* Items table */}
      <Card>
        <CardHeader>
          <CardTitle>Employee Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No employees in this pay run"
              description="This pay run does not contain any employee data."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead className="text-right">Rate</TableHead>
                    <TableHead className="text-right">Hours</TableHead>
                    <TableHead className="text-right">Overtime</TableHead>
                    <TableHead className="text-right">Adjustments</TableHead>
                    <TableHead className="text-right">Gross Pay</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">
                        {item.user?.full_name ?? item.user?.email ?? "Unknown"}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(item.hourly_rate)}/hr
                      </TableCell>
                      <TableCell className="text-right">
                        {formatHours(item.total_hours)}
                      </TableCell>
                      <TableCell className="text-right">
                        {item.overtime_hours > 0
                          ? formatHours(item.overtime_hours)
                          : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        {item.adjustments !== 0 ? (
                          <span title={item.adjustment_notes ?? undefined}>
                            {formatCurrency(item.adjustments)}
                          </span>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(item.gross_pay)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete pay run?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this pay run and all associated data.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletePayRun.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Rates Tab ────────────────────────────────────────────────

function RatesTab({ storeId }: { storeId: string }) {
  const { rates, isLoading, updateRate, isUpdating } = useStaffRates(storeId);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  function handleStartEdit(userId: string, currentRate: number | null) {
    setEditingUserId(userId);
    setEditValue(currentRate != null ? currentRate.toString() : "");
  }

  function handleSaveRate(userId: string) {
    const parsed = parseFloat(editValue);
    if (!isNaN(parsed) && parsed >= 0) {
      updateRate({ userId, hourlyRate: parsed });
    }
    setEditingUserId(null);
    setEditValue("");
  }

  function handleKeyDown(e: React.KeyboardEvent, userId: string) {
    if (e.key === "Enter") {
      handleSaveRate(userId);
    } else if (e.key === "Escape") {
      setEditingUserId(null);
      setEditValue("");
    }
  }

  const ratesWithRoles = useMemo(
    () => rates.map((r) => ({ ...r, displayRole: getDisplayRole(r) })),
    [rates],
  );

  const ratesSet = ratesWithRoles.filter((r) => r.hourly_rate != null).length;
  const ratesNotSet = ratesWithRoles.length - ratesSet;

  return (
    <div className="space-y-6">
      {/* Summary */}
      {!isLoading && rates.length > 0 && (
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-3">
          <StatsCard
            title="Team Members"
            value={rates.length}
            icon={<Users className="h-4 w-4" />}
          />
          <StatsCard
            title="Rates Configured"
            value={ratesSet}
            description={`${ratesNotSet} not set`}
            icon={<PoundSterling className="h-4 w-4" />}
            variant={ratesNotSet > 0 ? "warning" : "success"}
          />
          <StatsCard
            title="Avg. Rate"
            value={
              ratesSet > 0
                ? formatCurrency(
                    ratesWithRoles
                      .filter((r) => r.hourly_rate != null)
                      .reduce((sum, r) => sum + r.hourly_rate!, 0) / ratesSet,
                  ) + "/hr"
                : "-"
            }
            icon={<Clock className="h-4 w-4" />}
          />
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Hourly Rates</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Click any rate to edit it
              </p>
            </div>
            {isUpdating && (
              <span className="text-sm text-muted-foreground">Saving...</span>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <TableSkeleton rows={5} cols={3} />
          ) : rates.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No team members"
              description="Add team members to your store to configure their hourly rates."
            />
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead className="text-right">Hourly Rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ratesWithRoles.map((rate) => {
                      const style =
                        ROLE_STYLES[rate.displayRole] || ROLE_STYLES.Staff;
                      return (
                        <TableRow
                          key={rate.id}
                          className="hover:bg-muted/30 transition-colors"
                        >
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-9 w-9">
                                <AvatarFallback
                                  className={`${style.bg} ${style.text} text-xs font-semibold`}
                                >
                                  {getInitials(rate.user?.full_name ?? null)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <p className="font-medium truncate">
                                  {rate.user?.full_name ?? "No name"}
                                </p>
                                <p className="text-xs text-muted-foreground truncate">
                                  {rate.user?.email}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <RoleBadge role={rate.displayRole} />
                          </TableCell>
                          <TableCell className="text-right">
                            {editingUserId === rate.user_id ? (
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onBlur={() => handleSaveRate(rate.user_id)}
                                onKeyDown={(e) =>
                                  handleKeyDown(e, rate.user_id)
                                }
                                className="ml-auto w-28 text-right h-9"
                                autoFocus
                              />
                            ) : (
                              <button
                                type="button"
                                className="inline-flex items-center justify-end rounded px-2 py-1 text-sm hover:bg-muted transition-colors w-full text-right"
                                onClick={() =>
                                  handleStartEdit(
                                    rate.user_id,
                                    rate.hourly_rate,
                                  )
                                }
                                title="Click to edit"
                              >
                                {rate.hourly_rate != null ? (
                                  <span className="font-medium">
                                    {formatCurrency(rate.hourly_rate)}/hr
                                  </span>
                                ) : (
                                  <span className="text-amber-500">
                                    Not set
                                  </span>
                                )}
                              </button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile card view */}
              <div className="sm:hidden space-y-2">
                {ratesWithRoles.map((rate) => {
                  const style =
                    ROLE_STYLES[rate.displayRole] || ROLE_STYLES.Staff;
                  return (
                    <div
                      key={rate.id}
                      className="rounded-lg border bg-card px-4 py-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <Avatar className="h-9 w-9 shrink-0">
                            <AvatarFallback
                              className={`${style.bg} ${style.text} text-xs font-semibold`}
                            >
                              {getInitials(rate.user?.full_name ?? null)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">
                              {rate.user?.full_name ?? "No name"}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {rate.user?.email}
                            </p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          {editingUserId === rate.user_id ? (
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onBlur={() => handleSaveRate(rate.user_id)}
                              onKeyDown={(e) => handleKeyDown(e, rate.user_id)}
                              className="w-24 text-right h-9"
                              autoFocus
                            />
                          ) : (
                            <button
                              type="button"
                              className="text-sm font-medium hover:bg-muted rounded px-2 py-1 transition-colors"
                              onClick={() =>
                                handleStartEdit(rate.user_id, rate.hourly_rate)
                              }
                            >
                              {rate.hourly_rate != null ? (
                                `${formatCurrency(rate.hourly_rate)}/hr`
                              ) : (
                                <span className="text-amber-500">Not set</span>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="mt-2">
                        <RoleBadge role={rate.displayRole} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────

export default function PayrollPage() {
  const { currentStore, role } = useAuth();
  const storeId = currentStore?.store_id ?? null;

  // Role guard
  if (role !== "Owner" && role !== "Manager") {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Payroll"
          description="Only available to Owners and Managers."
        >
          <PageGuide pageKey="payroll" />
        </PageHeader>
      </div>
    );
  }

  if (!storeId) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Payroll"
          description="Select a store to manage payroll."
        >
          <PageGuide pageKey="payroll" />
        </PageHeader>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payroll"
        description="Manage staff earnings, pay runs, and hourly rates."
      >
        <PageGuide pageKey="payroll" />
      </PageHeader>

      <Tabs defaultValue="earnings">
        <TabsList>
          <TabsTrigger value="earnings">Earnings</TabsTrigger>
          <TabsTrigger value="pay-runs">Pay Runs</TabsTrigger>
          <TabsTrigger value="rates">Rates</TabsTrigger>
        </TabsList>

        <TabsContent value="earnings">
          <EarningsTab storeId={storeId} />
        </TabsContent>

        <TabsContent value="pay-runs">
          <PayRunsTab storeId={storeId} />
        </TabsContent>

        <TabsContent value="rates">
          <RatesTab storeId={storeId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
