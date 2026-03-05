"use client";

import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  useHACCPCorrectiveActions,
  useCreateCorrectiveAction,
  useResolveCorrectiveAction,
} from "@/hooks/useHACCP";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/ui/page-header";
import { PageGuide } from "@/components/help/PageGuide";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AlertTriangle, ArrowLeft, Plus, CheckCircle } from "lucide-react";
import Link from "next/link";

export default function HACCPCorrectiveActionsPage() {
  const { currentStore, role } = useAuth();
  const storeId = currentStore?.store_id ?? null;

  const isManagement = role === "Owner" || role === "Manager";

  // Filter state
  const [unresolvedOnly, setUnresolvedOnly] = useState(false);

  const queryParams = useMemo(
    () => ({
      unresolved_only: unresolvedOnly || undefined,
    }),
    [unresolvedOnly],
  );

  const { data: actions, isLoading } = useHACCPCorrectiveActions(
    storeId,
    queryParams,
  );
  const createAction = useCreateCorrectiveAction(storeId);
  const resolveAction = useResolveCorrectiveAction(storeId);

  // Create dialog state
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createDescription, setCreateDescription] = useState("");

  // Resolve dialog state
  const [resolvingActionId, setResolvingActionId] = useState<string | null>(
    null,
  );
  const [resolveActionTaken, setResolveActionTaken] = useState("");

  const handleCreate = async () => {
    if (!createDescription.trim()) return;
    await createAction.mutateAsync({
      description: createDescription.trim(),
    });
    setCreateDescription("");
    setShowCreateDialog(false);
  };

  const handleResolve = async () => {
    if (!resolvingActionId || !resolveActionTaken.trim()) return;
    await resolveAction.mutateAsync({
      actionId: resolvingActionId,
      action_taken: resolveActionTaken.trim(),
    });
    setResolvingActionId(null);
    setResolveActionTaken("");
  };

  if (!storeId) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Corrective Actions"
          description="Track and resolve food safety issues"
        >
          <PageGuide pageKey="haccp-corrective-actions" />
        </PageHeader>
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            Select a store to manage corrective actions.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Corrective Actions"
        description="Track and resolve food safety issues"
      >
        <div className="flex items-center gap-2">
          <Link href="/haccp">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          {isManagement && (
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Action
            </Button>
          )}
        </div>
        <PageGuide pageKey="haccp-corrective-actions" />
      </PageHeader>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Switch
            checked={unresolvedOnly}
            onCheckedChange={setUnresolvedOnly}
          />
          <span className="text-sm text-muted-foreground">Unresolved only</span>
        </div>
      </div>

      {/* Actions List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            {unresolvedOnly ? "Open Actions" : "All Corrective Actions"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !actions || actions.length === 0 ? (
            <EmptyState
              icon={unresolvedOnly ? CheckCircle : AlertTriangle}
              title={
                unresolvedOnly ? "No open actions" : "No corrective actions"
              }
              description={
                unresolvedOnly
                  ? "All corrective actions have been resolved."
                  : "Create a corrective action when a food safety issue is identified."
              }
              action={
                isManagement
                  ? {
                      label: "Create Action",
                      onClick: () => setShowCreateDialog(true),
                      icon: Plus,
                    }
                  : undefined
              }
            />
          ) : (
            <>
              {/* Mobile card view */}
              <div className="sm:hidden space-y-3">
                {actions.map((action) => (
                  <div
                    key={action.id}
                    className={`border rounded-lg p-3 space-y-2 ${action.status === "open" ? "border-amber-500/20" : ""}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {new Date(action.created_at).toLocaleDateString(
                          "en-GB",
                          {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          },
                        )}
                      </span>
                      {action.status === "open" ? (
                        <Badge
                          variant="secondary"
                          className="bg-amber-500/10 text-amber-400"
                        >
                          Open
                        </Badge>
                      ) : (
                        <Badge
                          variant="secondary"
                          className="bg-emerald-500/10 text-emerald-400"
                        >
                          Resolved
                        </Badge>
                      )}
                    </div>
                    <p className="font-medium text-sm">{action.description}</p>
                    {action.action_taken && (
                      <div className="text-xs text-muted-foreground">
                        <span className="font-medium">Action taken:</span>{" "}
                        {action.action_taken}
                      </div>
                    )}
                    {action.created_by_name && (
                      <p className="text-xs text-muted-foreground">
                        Created by {action.created_by_name}
                      </p>
                    )}
                    {action.resolved_by_name && (
                      <p className="text-xs text-muted-foreground">
                        Resolved by {action.resolved_by_name} on{" "}
                        {action.resolved_at
                          ? new Date(action.resolved_at).toLocaleDateString(
                              "en-GB",
                              {
                                month: "short",
                                day: "numeric",
                              },
                            )
                          : "-"}
                      </p>
                    )}
                    {action.status === "open" && isManagement && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full mt-2"
                        onClick={() => {
                          setResolvingActionId(action.id);
                          setResolveActionTaken("");
                        }}
                      >
                        <CheckCircle className="h-3.5 w-3.5 mr-1" />
                        Resolve
                      </Button>
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
                      <TableHead>Description</TableHead>
                      <TableHead>Action Taken</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created By</TableHead>
                      <TableHead>Resolved By</TableHead>
                      {isManagement && <TableHead className="w-[100px]" />}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {actions.map((action) => (
                      <TableRow
                        key={action.id}
                        className={
                          action.status === "open" ? "bg-amber-500/10" : ""
                        }
                      >
                        <TableCell className="whitespace-nowrap text-sm">
                          {new Date(action.created_at).toLocaleDateString(
                            "en-GB",
                            {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            },
                          )}
                        </TableCell>
                        <TableCell className="font-medium max-w-[250px]">
                          {action.description}
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-[200px] truncate">
                          {action.action_taken ?? "-"}
                        </TableCell>
                        <TableCell>
                          {action.status === "open" ? (
                            <Badge
                              variant="secondary"
                              className="bg-amber-500/10 text-amber-400"
                            >
                              Open
                            </Badge>
                          ) : (
                            <Badge
                              variant="secondary"
                              className="bg-emerald-500/10 text-emerald-400"
                            >
                              Resolved
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {action.created_by_name ?? "-"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {action.resolved_by_name
                            ? `${action.resolved_by_name} (${action.resolved_at ? new Date(action.resolved_at).toLocaleDateString("en-GB", { month: "short", day: "numeric" }) : ""})`
                            : "-"}
                        </TableCell>
                        {isManagement && (
                          <TableCell>
                            {action.status === "open" && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setResolvingActionId(action.id);
                                  setResolveActionTaken("");
                                }}
                              >
                                Resolve
                              </Button>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Create Action Dialog */}
      <Dialog
        open={showCreateDialog}
        onOpenChange={(open) => {
          setShowCreateDialog(open);
          if (!open) setCreateDescription("");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Corrective Action</DialogTitle>
            <DialogDescription>
              Describe the food safety issue that needs to be addressed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="action-description">Description</Label>
              <Textarea
                id="action-description"
                placeholder="Describe the issue (e.g. Walk-in fridge temperature exceeded 8°C for 2 hours)"
                value={createDescription}
                onChange={(e) => setCreateDescription(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateDialog(false);
                setCreateDescription("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={createAction.isPending || !createDescription.trim()}
            >
              {createAction.isPending ? "Creating..." : "Create Action"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Resolve Action Dialog */}
      <Dialog
        open={!!resolvingActionId}
        onOpenChange={(open) => {
          if (!open) {
            setResolvingActionId(null);
            setResolveActionTaken("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve Corrective Action</DialogTitle>
            <DialogDescription>
              Describe what was done to address this food safety issue.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {resolvingActionId && actions && (
              <div className="p-3 rounded-lg bg-muted text-sm">
                <span className="font-medium">Issue: </span>
                {actions.find((a) => a.id === resolvingActionId)?.description ??
                  ""}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="resolve-action-taken">Action Taken</Label>
              <Textarea
                id="resolve-action-taken"
                placeholder="Describe the corrective action taken (e.g. Moved all perishables to backup fridge, called engineer for repair)"
                value={resolveActionTaken}
                onChange={(e) => setResolveActionTaken(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setResolvingActionId(null);
                setResolveActionTaken("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleResolve}
              disabled={resolveAction.isPending || !resolveActionTaken.trim()}
            >
              {resolveAction.isPending ? "Resolving..." : "Mark as Resolved"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
