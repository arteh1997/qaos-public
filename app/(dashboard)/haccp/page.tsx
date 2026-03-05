"use client";

import { useAuth } from "@/hooks/useAuth";
import { useHACCPDashboard } from "@/hooks/useHACCP";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/ui/page-header";
import { PageGuide } from "@/components/help/PageGuide";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Shield,
  ClipboardCheck,
  Thermometer,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
} from "lucide-react";
import Link from "next/link";

function getComplianceColor(score: number): string {
  if (score >= 90) return "text-emerald-400";
  if (score >= 70) return "text-amber-400";
  return "text-destructive";
}

function getComplianceBg(score: number): string {
  if (score >= 90) return "bg-emerald-500/10";
  if (score >= 70) return "bg-amber-500/10";
  return "bg-destructive/10";
}

function getStatusBadge(status: string) {
  switch (status) {
    case "pass":
      return (
        <Badge
          variant="secondary"
          className="bg-emerald-500/10 text-emerald-400"
        >
          Pass
        </Badge>
      );
    case "fail":
      return (
        <Badge
          variant="secondary"
          className="bg-destructive/10 text-destructive"
        >
          Fail
        </Badge>
      );
    case "partial":
      return (
        <Badge variant="secondary" className="bg-amber-500/10 text-amber-400">
          Partial
        </Badge>
      );
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

function getFrequencyLabel(frequency: string): string {
  switch (frequency) {
    case "daily":
      return "Daily";
    case "shift":
      return "Per Shift";
    case "weekly":
      return "Weekly";
    default:
      return frequency;
  }
}

export default function HACCPDashboardPage() {
  const { currentStore } = useAuth();
  const storeId = currentStore?.store_id ?? null;

  const { data: dashboard, isLoading } = useHACCPDashboard(storeId);

  if (!storeId) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="HACCP Compliance"
          description="Food safety management and monitoring"
        >
          <PageGuide pageKey="haccp" />
        </PageHeader>
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            Select a store to view HACCP compliance.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="HACCP Compliance"
        description="Food safety management and monitoring"
      >
        <div className="flex items-center gap-2">
          <Link href="/haccp/checks">
            <Button size="sm">
              <ClipboardCheck className="h-4 w-4 mr-2" />
              Run Check
            </Button>
          </Link>
          <Link href="/haccp/temperatures">
            <Button variant="outline" size="sm">
              <Thermometer className="h-4 w-4 mr-2" />
              Log Temperature
            </Button>
          </Link>
        </div>
        <PageGuide pageKey="haccp" />
      </PageHeader>

      {/* Stat Cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-4">
                <Skeleton className="h-4 w-20 mb-2" />
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : dashboard ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className={getComplianceBg(dashboard.compliance_score)}>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Shield className="h-4 w-4" />
                Compliance Score
              </div>
              <p
                className={`text-2xl font-bold mt-1 ${getComplianceColor(dashboard.compliance_score)}`}
              >
                {dashboard.compliance_score}%
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <ClipboardCheck className="h-4 w-4" />
                Checks Today
              </div>
              <p className="text-2xl font-bold mt-1">
                {dashboard.today.total_checks}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Thermometer className="h-4 w-4" />
                Temp Alerts
              </div>
              <p
                className={`text-2xl font-bold mt-1 ${dashboard.today.out_of_range_temps > 0 ? "text-destructive" : ""}`}
              >
                {dashboard.today.out_of_range_temps}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <AlertTriangle className="h-4 w-4" />
                Open Actions
              </div>
              <p
                className={`text-2xl font-bold mt-1 ${dashboard.unresolved_corrective_actions > 0 ? "text-amber-400" : ""}`}
              >
                {dashboard.unresolved_corrective_actions}
              </p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Due Checks — Reminder Cards */}
      {dashboard && dashboard.due_checks && dashboard.due_checks.length > 0 && (
        <Card className="border-amber-500/20 bg-amber-500/10">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-400" />
              <CardTitle className="text-sm font-medium text-amber-900">
                Checks Due ({dashboard.due_checks.length})
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {dashboard.due_checks.map((check) => (
                <Link key={check.id} href="/haccp/checks">
                  <div className="flex items-center justify-between border border-amber-500/20 bg-card rounded-lg p-3 hover:bg-amber-500/10 transition-colors cursor-pointer">
                    <div>
                      <p className="font-medium text-sm">{check.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {getFrequencyLabel(check.frequency)}
                      </p>
                    </div>
                    <Badge
                      variant="secondary"
                      className="bg-amber-100 text-amber-800 shrink-0"
                    >
                      Due
                    </Badge>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Checks */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Recent Checks</CardTitle>
            <Link href="/haccp/checks">
              <Button variant="ghost" size="sm" className="text-xs">
                View All
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : !dashboard || dashboard.recent_checks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No checks recorded yet. Run your first HACCP check to get started.
            </p>
          ) : (
            <>
              {/* Mobile card view */}
              <div className="sm:hidden space-y-3">
                {dashboard.recent_checks.map((check) => (
                  <div
                    key={check.id}
                    className="border rounded-lg p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {new Date(check.created_at).toLocaleDateString(
                          "en-GB",
                          {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          },
                        )}
                      </span>
                      {getStatusBadge(check.status)}
                    </div>
                    <p className="font-medium text-sm">
                      {check.template_name ?? "Check"}
                    </p>
                    {check.completed_by_name && (
                      <p className="text-xs text-muted-foreground">
                        By {check.completed_by_name}
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
                      <TableHead>Template</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Completed By</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dashboard.recent_checks.map((check) => (
                      <TableRow key={check.id}>
                        <TableCell className="whitespace-nowrap text-sm">
                          {new Date(check.created_at).toLocaleDateString(
                            "en-GB",
                            {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            },
                          )}
                        </TableCell>
                        <TableCell className="font-medium">
                          {check.template_name ?? "Check"}
                        </TableCell>
                        <TableCell>{getStatusBadge(check.status)}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {check.completed_by_name ?? "-"}
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

      {/* Recent Temperature Alerts */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">
              Recent Temperature Alerts
            </CardTitle>
            <Link href="/haccp/temperatures">
              <Button variant="ghost" size="sm" className="text-xs">
                View All
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : !dashboard || dashboard.recent_temp_alerts.length === 0 ? (
            <div className="flex items-center gap-2 justify-center py-6">
              <CheckCircle className="h-4 w-4 text-emerald-400" />
              <p className="text-sm text-muted-foreground">
                No temperature alerts. All readings within range.
              </p>
            </div>
          ) : (
            <>
              {/* Mobile card view */}
              <div className="sm:hidden space-y-3">
                {dashboard.recent_temp_alerts.map((log) => (
                  <div
                    key={log.id}
                    className="border border-destructive/20 rounded-lg p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {new Date(log.recorded_at).toLocaleDateString("en-GB", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      <div className="flex items-center gap-1">
                        <XCircle className="h-3.5 w-3.5 text-destructive" />
                        <span className="text-sm font-bold text-destructive">
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
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dashboard.recent_temp_alerts.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="whitespace-nowrap text-sm">
                          {new Date(log.recorded_at).toLocaleDateString(
                            "en-GB",
                            {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            },
                          )}
                        </TableCell>
                        <TableCell className="font-medium">
                          {log.location_name}
                        </TableCell>
                        <TableCell className="text-right font-bold text-destructive">
                          {log.temperature_celsius}°C
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {log.min_temp ?? "—"}°C to {log.max_temp ?? "—"}°C
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

      {/* Navigation Links */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Link href="/haccp/templates">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
            <CardContent className="pt-4 flex flex-col items-center text-center gap-2">
              <Shield className="h-6 w-6 text-muted-foreground" />
              <p className="text-sm font-medium">Templates</p>
              <p className="text-xs text-muted-foreground">
                Manage check templates
              </p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/haccp/checks">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
            <CardContent className="pt-4 flex flex-col items-center text-center gap-2">
              <ClipboardCheck className="h-6 w-6 text-muted-foreground" />
              <p className="text-sm font-medium">Checks</p>
              <p className="text-xs text-muted-foreground">
                Submit and view checks
              </p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/haccp/temperatures">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
            <CardContent className="pt-4 flex flex-col items-center text-center gap-2">
              <Thermometer className="h-6 w-6 text-muted-foreground" />
              <p className="text-sm font-medium">Temperatures</p>
              <p className="text-xs text-muted-foreground">
                Log and monitor temps
              </p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/haccp/corrective-actions">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
            <CardContent className="pt-4 flex flex-col items-center text-center gap-2">
              <AlertTriangle className="h-6 w-6 text-muted-foreground" />
              <p className="text-sm font-medium">Actions</p>
              <p className="text-xs text-muted-foreground">
                Corrective actions
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
