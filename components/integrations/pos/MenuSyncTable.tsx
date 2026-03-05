"use client";

import { useState, useMemo } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  usePosMenuItems,
  useCreatePosMapping,
  useDeletePosMapping,
} from "@/hooks/usePosProviders";
import { usePosItemMappings } from "@/hooks/usePosConnections";
import { useStoreInventory } from "@/hooks/useStoreInventory";
import { toast } from "sonner";
import {
  Search,
  Link2,
  Link2Off,
  ArrowRight,
  Loader2,
  CheckCircle2,
  Package,
  RefreshCw,
} from "lucide-react";

interface MenuSyncTableProps {
  storeId: string;
  connectionId: string;
  connectionProvider: string;
}

export function MenuSyncTable({
  storeId,
  connectionId,
  connectionProvider,
}: MenuSyncTableProps) {
  const [search, setSearch] = useState("");
  const [mappingItemId, setMappingItemId] = useState<string | null>(null);
  const [inventorySearch, setInventorySearch] = useState("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const {
    data: menuItems,
    isLoading: menuLoading,
    refetch: refetchMenu,
  } = usePosMenuItems(storeId, connectionId);
  const { data: mappings, isLoading: mappingsLoading } = usePosItemMappings(
    storeId,
    connectionId,
  );
  const { inventory } = useStoreInventory(storeId);
  const createMapping = useCreatePosMapping(storeId);
  const deleteMapping = useDeletePosMapping(storeId);

  // Build a mapping lookup: pos_item_id → mapping
  const mappingLookup = useMemo(() => {
    const map = new Map<
      string,
      typeof mappings extends (infer T)[] | undefined ? T : never
    >();
    if (mappings) {
      for (const m of mappings) {
        map.set(m.pos_item_id, m);
      }
    }
    return map;
  }, [mappings]);

  // Filter menu items by search
  const filteredItems = useMemo(() => {
    if (!menuItems) return [];
    if (!search.trim()) return menuItems;
    const q = search.toLowerCase();
    return menuItems.filter(
      (item) =>
        item.pos_item_name.toLowerCase().includes(q) ||
        item.pos_item_id.toLowerCase().includes(q) ||
        item.category?.toLowerCase().includes(q),
    );
  }, [menuItems, search]);

  // Filter inventory by search for the mapping dropdown
  const filteredInventory = useMemo(() => {
    if (!inventory) return [];
    if (!inventorySearch.trim()) return inventory.slice(0, 20);
    const q = inventorySearch.toLowerCase();
    return inventory
      .filter(
        (item) =>
          item.inventory_item?.name?.toLowerCase().includes(q) ||
          item.inventory_item?.category?.toLowerCase().includes(q),
      )
      .slice(0, 20);
  }, [inventory, inventorySearch]);

  const handleMapItem = async (
    posItemId: string,
    posItemName: string,
    inventoryItemId: string,
  ) => {
    try {
      await createMapping.mutateAsync({
        pos_connection_id: connectionId,
        pos_item_id: posItemId,
        pos_item_name: posItemName,
        inventory_item_id: inventoryItemId,
        quantity_per_sale: quantities[posItemId] || 1,
      });
      toast.success(`Mapped "${posItemName}" successfully`);
      setMappingItemId(null);
      setInventorySearch("");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to create mapping",
      );
    }
  };

  const handleUnmapItem = async (posItemId: string) => {
    const mapping = mappingLookup.get(posItemId);
    if (!mapping) return;
    try {
      await deleteMapping.mutateAsync(mapping.id);
      toast.success("Mapping removed");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to remove mapping",
      );
    }
  };

  const mappedCount =
    menuItems?.filter((i) => mappingLookup.has(i.pos_item_id)).length || 0;
  const totalCount = menuItems?.length || 0;

  if (menuLoading || mappingsLoading) {
    return (
      <Card>
        <CardContent className="pt-6 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Skeleton className="size-8 rounded" />
                <div>
                  <Skeleton className="h-4 w-32 mb-1" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
              <Skeleton className="h-8 w-24" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">
                Map Menu Items to Inventory
              </CardTitle>
              <CardDescription>
                {mappedCount} of {totalCount} items mapped
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchMenu()}
              className="shrink-0"
            >
              <RefreshCw className="size-3.5 mr-1.5" />
              Refresh from POS
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Progress bar */}
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all"
              style={{
                width:
                  totalCount > 0
                    ? `${(mappedCount / totalCount) * 100}%`
                    : "0%",
              }}
            />
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search POS items..."
              className="pl-9"
            />
          </div>

          {/* Items list */}
          {filteredItems.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="size-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">
                {search
                  ? "No items match your search"
                  : "No menu items found from your POS"}
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {filteredItems.map((item) => {
                const mapping = mappingLookup.get(item.pos_item_id);
                const isMapped = !!mapping;
                const isExpanded = mappingItemId === item.pos_item_id;

                return (
                  <div key={item.pos_item_id} className="py-3">
                    <div className="flex items-center justify-between gap-3">
                      {/* POS item info */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">
                            {item.pos_item_name}
                          </p>
                          {item.category && (
                            <Badge
                              variant="secondary"
                              className="text-xs shrink-0"
                            >
                              {item.category}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          ID: {item.pos_item_id}
                          {item.price != null && ` · £${item.price.toFixed(2)}`}
                        </p>
                      </div>

                      {/* Mapping status / actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        {isMapped ? (
                          <>
                            <Badge
                              variant="secondary"
                              className="bg-emerald-500/10 text-emerald-400 text-xs"
                            >
                              <CheckCircle2 className="size-3 mr-1" />
                              {mapping.inventory_item?.name || "Mapped"}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-muted-foreground hover:text-destructive"
                              onClick={() => handleUnmapItem(item.pos_item_id)}
                              disabled={deleteMapping.isPending}
                            >
                              <Link2Off className="size-3.5" />
                            </Button>
                          </>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setMappingItemId(
                                isExpanded ? null : item.pos_item_id,
                              );
                              setInventorySearch("");
                            }}
                          >
                            <Link2 className="size-3.5 mr-1" />
                            Map
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Expanded mapping UI */}
                    {isExpanded && !isMapped && (
                      <div className="mt-3 rounded-lg border border-border p-3 bg-muted/30 space-y-3">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span className="font-medium">
                            {item.pos_item_name}
                          </span>
                          <ArrowRight className="size-3" />
                          <span>Select inventory item</span>
                        </div>

                        <div className="flex gap-3 items-end">
                          <div className="flex-1">
                            <Input
                              value={inventorySearch}
                              onChange={(e) =>
                                setInventorySearch(e.target.value)
                              }
                              placeholder="Search inventory items..."
                              className="text-sm"
                            />
                          </div>
                          <div className="w-24">
                            <label className="text-xs text-muted-foreground block mb-1">
                              Qty/sale
                            </label>
                            <Input
                              type="number"
                              min={0.01}
                              step={0.01}
                              value={quantities[item.pos_item_id] ?? 1}
                              onChange={(e) =>
                                setQuantities((prev) => ({
                                  ...prev,
                                  [item.pos_item_id]:
                                    Number(e.target.value) || 1,
                                }))
                              }
                              className="text-sm"
                            />
                          </div>
                        </div>

                        {/* Inventory items list */}
                        <div className="max-h-48 overflow-y-auto divide-y rounded border bg-card">
                          {filteredInventory.length === 0 ? (
                            <p className="p-3 text-sm text-muted-foreground text-center">
                              No inventory items found
                            </p>
                          ) : (
                            filteredInventory.map((inv) => (
                              <button
                                key={inv.inventory_item_id}
                                className="w-full text-left px-3 py-2 hover:bg-muted/50 flex items-center justify-between gap-2 transition-colors"
                                onClick={() =>
                                  handleMapItem(
                                    item.pos_item_id,
                                    item.pos_item_name,
                                    inv.inventory_item_id,
                                  )
                                }
                                disabled={createMapping.isPending}
                              >
                                <div className="min-w-0">
                                  <p className="text-sm font-medium truncate">
                                    {inv.inventory_item?.name || "Unknown"}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {inv.inventory_item?.category ||
                                      "No category"}
                                    {" · "}
                                    {inv.inventory_item?.unit_of_measure}
                                  </p>
                                </div>
                                <div className="text-right shrink-0">
                                  <p className="text-xs text-muted-foreground">
                                    Stock: {inv.quantity ?? 0}
                                  </p>
                                </div>
                              </button>
                            ))
                          )}
                        </div>

                        {createMapping.isPending && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="size-3.5 animate-spin" />
                            Saving mapping...
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
