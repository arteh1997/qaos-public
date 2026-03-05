"use client";

import { useEffect, useState } from "react";
import { PortalLayout } from "@/components/supplier-portal/PortalLayout";
import { usePortalCatalog } from "@/hooks/useSupplierPortal";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ShoppingBag, Save, Search } from "lucide-react";
import { toast } from "sonner";

interface EditedItem {
  id: string;
  unit_cost?: number;
  lead_time_days?: number;
  min_order_quantity?: number;
}

export default function PortalCatalogPage() {
  const { items, isLoading, fetchCatalog, updateCatalog } = usePortalCatalog();
  const [edits, setEdits] = useState<Map<string, EditedItem>>(new Map());
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchCatalog();
  }, [fetchCatalog]);

  const handleEdit = (
    id: string,
    field: keyof Omit<EditedItem, "id">,
    value: number,
  ) => {
    setEdits((prev) => {
      const next = new Map(prev);
      const existing = next.get(id) || { id };
      next.set(id, { ...existing, [field]: value });
      return next;
    });
  };

  const handleSave = async () => {
    if (edits.size === 0) return;
    setSaving(true);
    try {
      const updates = Array.from(edits.values());
      const res = await updateCatalog(updates);
      if (res.success) {
        const failed = (res.data as Array<{ success: boolean }>).filter(
          (r) => !r.success,
        ).length;
        if (failed > 0) {
          toast.error(`${failed} item(s) failed to update`);
        } else {
          toast.success("Catalog updated successfully");
        }
        setEdits(new Map());
        fetchCatalog();
      } else {
        toast.error(res.message || "Failed to update catalog");
      }
    } catch {
      toast.error("Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  const filteredItems = items.filter((item) => {
    if (!search) return true;
    const inv = (item as Record<string, unknown>).inventory_items as Record<
      string,
      unknown
    > | null;
    const name = ((inv?.name as string) || "").toLowerCase();
    return name.includes(search.toLowerCase());
  });

  return (
    <PortalLayout title="Product Catalog">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search items..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        {edits.size > 0 && (
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-1.5" />
            Save {edits.size} Change{edits.size !== 1 ? "s" : ""}
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-14 rounded-lg" />
          ))}
        </div>
      ) : filteredItems.length === 0 ? (
        <EmptyState
          icon={ShoppingBag}
          title="No catalog items"
          description={
            search
              ? "No items match your search."
              : "Your product catalog is empty."
          }
        />
      ) : (
        <>
          {/* Mobile card view */}
          <div className="sm:hidden space-y-2">
            {filteredItems.map((raw) => {
              const item = raw as Record<string, unknown>;
              const inv = item.inventory_items as Record<
                string,
                unknown
              > | null;
              const id = item.id as string;
              const currentCost =
                edits.get(id)?.unit_cost ?? (item.unit_cost as number);
              const currentLead =
                edits.get(id)?.lead_time_days ??
                (item.lead_time_days as number | null);
              const currentMin =
                edits.get(id)?.min_order_quantity ??
                (item.min_order_quantity as number);

              return (
                <Card key={id}>
                  <CardContent className="p-3 space-y-2">
                    <div className="font-medium text-sm">
                      {(inv?.name as string) || "Unknown"}
                      {(inv?.unit_of_measure as string) ? (
                        <span className="text-xs text-muted-foreground ml-1">
                          ({inv!.unit_of_measure as string})
                        </span>
                      ) : null}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-xs text-muted-foreground">
                          Unit Cost (£)
                        </label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={currentCost ?? ""}
                          onChange={(e) =>
                            handleEdit(
                              id,
                              "unit_cost",
                              parseFloat(e.target.value) || 0,
                            )
                          }
                          className="h-8 text-sm mt-0.5"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">
                          Lead (days)
                        </label>
                        <Input
                          type="number"
                          min="0"
                          value={currentLead ?? ""}
                          onChange={(e) =>
                            handleEdit(
                              id,
                              "lead_time_days",
                              parseInt(e.target.value) || 0,
                            )
                          }
                          className="h-8 text-sm mt-0.5"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">
                          Min Qty
                        </label>
                        <Input
                          type="number"
                          min="0"
                          value={currentMin ?? ""}
                          onChange={(e) =>
                            handleEdit(
                              id,
                              "min_order_quantity",
                              parseInt(e.target.value) || 0,
                            )
                          }
                          className="h-8 text-sm mt-0.5"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Desktop table */}
          <Card className="hidden sm:block rounded-lg border shadow-sm overflow-hidden">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead className="text-right w-32">
                      Unit Cost (£)
                    </TableHead>
                    <TableHead className="text-right w-28">
                      Lead Time (days)
                    </TableHead>
                    <TableHead className="text-right w-28">
                      Min Order Qty
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map((raw) => {
                    const item = raw as Record<string, unknown>;
                    const inv = item.inventory_items as Record<
                      string,
                      unknown
                    > | null;
                    const id = item.id as string;
                    const hasEdits = edits.has(id);
                    const currentCost =
                      edits.get(id)?.unit_cost ?? (item.unit_cost as number);
                    const currentLead =
                      edits.get(id)?.lead_time_days ??
                      (item.lead_time_days as number | null);
                    const currentMin =
                      edits.get(id)?.min_order_quantity ??
                      (item.min_order_quantity as number);

                    return (
                      <TableRow
                        key={id}
                        className={hasEdits ? "bg-amber-500/10" : ""}
                      >
                        <TableCell>
                          <div>
                            <span className="font-medium">
                              {(inv?.name as string) || "Unknown"}
                            </span>
                            {(inv?.unit_of_measure as string) ? (
                              <span className="text-xs text-muted-foreground ml-1">
                                ({inv!.unit_of_measure as string})
                              </span>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {(item.supplier_sku as string) || "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={currentCost ?? ""}
                            onChange={(e) =>
                              handleEdit(
                                id,
                                "unit_cost",
                                parseFloat(e.target.value) || 0,
                              )
                            }
                            className="h-8 text-sm text-right w-24 ml-auto"
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            min="0"
                            value={currentLead ?? ""}
                            onChange={(e) =>
                              handleEdit(
                                id,
                                "lead_time_days",
                                parseInt(e.target.value) || 0,
                              )
                            }
                            className="h-8 text-sm text-right w-20 ml-auto"
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            min="0"
                            value={currentMin ?? ""}
                            onChange={(e) =>
                              handleEdit(
                                id,
                                "min_order_quantity",
                                parseInt(e.target.value) || 0,
                              )
                            }
                            className="h-8 text-sm text-right w-20 ml-auto"
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </PortalLayout>
  );
}
