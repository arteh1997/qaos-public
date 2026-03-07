"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useStoreInventory } from "@/hooks/useStoreInventory";
import { useStockReception } from "@/hooks/useStockReception";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Search,
  AlertTriangle,
  Plus,
  PackageCheck,
  ChevronDown,
  ChevronUp,
  X,
} from "lucide-react";

interface StockReceptionFormProps {
  storeId: string;
  onSuccess?: () => void;
}

interface ReceptionItem {
  inventory_item_id: string;
  name: string;
  category: string | null;
  unit_of_measure: string;
  current_quantity: number;
  received_quantity: number | null;
  total_cost: number | null;
  par_level: number | null;
  isEditing: boolean;
}

export function StockReceptionForm({
  storeId,
  onSuccess,
}: StockReceptionFormProps) {
  const { inventory, isLoading: inventoryLoading } = useStoreInventory(storeId);
  const { submitReception, isSubmitting } = useStockReception();
  const [receptionItems, setReceptionItems] = useState<ReceptionItem[]>([]);
  const [notes, setNotes] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [showNotes, setShowNotes] = useState(false);

  // Track the storeId we initialized for
  const initializedForStore = useRef<string | null>(null);

  // Get unique categories from items
  const categories = useMemo(() => {
    const cats = new Set<string>();
    receptionItems.forEach((item) => {
      if (item.category) cats.add(item.category);
    });
    return Array.from(cats).sort();
  }, [receptionItems]);

  // Initialize reception items when inventory loads.
  // One-time seed from async data guarded by initializedForStore ref (runs only once per store).
  // A lazy useState initializer can't be used here because inventory loads asynchronously after mount.
  useEffect(() => {
    if (
      !inventoryLoading &&
      inventory.length > 0 &&
      initializedForStore.current !== storeId
    ) {
      initializedForStore.current = storeId;

      const items: ReceptionItem[] = inventory.map((inv) => ({
        inventory_item_id: inv.inventory_item_id,
        name: inv.inventory_item?.name ?? "Unknown",
        category: inv.inventory_item?.category ?? null,
        unit_of_measure: inv.inventory_item?.unit_of_measure ?? "each",
        current_quantity: inv.quantity,
        received_quantity: null,
        total_cost: null,
        par_level: inv.par_level,
        isEditing: false,
      }));

      setReceptionItems(items);
    }
  }, [inventoryLoading, inventory, storeId]);

  // Handle clicking to start editing
  const handleStartEditing = useCallback((itemId: string) => {
    setReceptionItems((prev) =>
      prev.map((item) =>
        item.inventory_item_id === itemId
          ? {
              ...item,
              isEditing: true,
              received_quantity: item.received_quantity ?? 0,
            }
          : item,
      ),
    );
  }, []);

  // Handle quantity change (integers only)
  const handleQuantityChange = useCallback((itemId: string, value: string) => {
    const numValue = value === "" ? null : parseInt(value, 10);
    setReceptionItems((prev) =>
      prev.map((item) =>
        item.inventory_item_id === itemId
          ? {
              ...item,
              received_quantity: isNaN(numValue as number) ? null : numValue,
            }
          : item,
      ),
    );
  }, []);

  // Handle cost change
  const handleCostChange = useCallback((itemId: string, value: string) => {
    const numValue = value === "" ? null : parseFloat(value);
    setReceptionItems((prev) =>
      prev.map((item) =>
        item.inventory_item_id === itemId
          ? {
              ...item,
              total_cost:
                numValue !== null && !isNaN(numValue) ? numValue : null,
            }
          : item,
      ),
    );
  }, []);

  // Handle blur - stop editing
  const handleBlur = useCallback((itemId: string) => {
    setReceptionItems((prev) =>
      prev.map((item) => {
        if (item.inventory_item_id !== itemId) return item;
        // If value is 0 or null, reset
        if (!item.received_quantity || item.received_quantity === 0) {
          return {
            ...item,
            isEditing: false,
            received_quantity: null,
            total_cost: null,
          };
        }
        return { ...item, isEditing: false };
      }),
    );
  }, []);

  // Clear a received item
  const handleClearItem = useCallback((itemId: string) => {
    setReceptionItems((prev) =>
      prev.map((item) =>
        item.inventory_item_id === itemId
          ? {
              ...item,
              received_quantity: null,
              total_cost: null,
              isEditing: false,
            }
          : item,
      ),
    );
  }, []);

  const handleSubmit = async () => {
    const itemsToSubmit = receptionItems
      .filter(
        (item) => item.received_quantity !== null && item.received_quantity > 0,
      )
      .map((item) => ({
        inventory_item_id: item.inventory_item_id,
        quantity: item.received_quantity!,
        total_cost: item.total_cost ?? undefined,
      }));

    if (itemsToSubmit.length === 0) {
      return;
    }

    // Build a map of received quantities for optimistic update
    const receivedMap = new Map(
      itemsToSubmit.map((item) => [item.inventory_item_id, item.quantity]),
    );

    try {
      await submitReception({
        store_id: storeId,
        items: itemsToSubmit,
        notes: notes || undefined,
      });

      // Reset form: update quantities optimistically, clear all inputs
      setReceptionItems((prev) =>
        prev.map((item) => {
          const received = receivedMap.get(item.inventory_item_id) ?? 0;
          return {
            ...item,
            current_quantity: item.current_quantity + received,
            received_quantity: null,
            total_cost: null,
            isEditing: false,
          };
        }),
      );
      setNotes("");
      setShowNotes(false);

      onSuccess?.();
    } catch {
      // Error already shown as toast by the hook
    }
  };

  // Filter items by search and category, then sort: received first, low stock next, then alphabetical
  const filteredItems = useMemo(() => {
    const filtered = receptionItems.filter((item) => {
      const matchesSearch = searchQuery
        ? item.name.toLowerCase().includes(searchQuery.toLowerCase())
        : true;
      const matchesCategory =
        categoryFilter === "all" ? true : item.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });

    return filtered.sort((a, b) => {
      // Items with received quantities always at top
      const aHasReceived =
        a.received_quantity !== null && a.received_quantity > 0;
      const bHasReceived =
        b.received_quantity !== null && b.received_quantity > 0;
      if (aHasReceived && !bHasReceived) return -1;
      if (!aHasReceived && bHasReceived) return 1;

      // Then low stock items
      const aIsLowStock = a.par_level
        ? a.current_quantity < a.par_level
        : false;
      const bIsLowStock = b.par_level
        ? b.current_quantity < b.par_level
        : false;
      if (aIsLowStock && !bIsLowStock) return -1;
      if (!aIsLowStock && bIsLowStock) return 1;

      // Then alphabetical
      return a.name.localeCompare(b.name);
    });
  }, [receptionItems, searchQuery, categoryFilter]);

  // Counts
  const receivedItems = receptionItems.filter(
    (item) => item.received_quantity !== null && item.received_quantity > 0,
  );
  const receivedItemsCount = receivedItems.length;
  const totalUnitsReceived = receivedItems.reduce(
    (sum, item) => sum + (item.received_quantity ?? 0),
    0,
  );
  const totalCostEntered = receivedItems.reduce(
    (sum, item) => sum + (item.total_cost ?? 0),
    0,
  );
  const lowStockCount = receptionItems.filter(
    (item) => item.par_level && item.current_quantity < item.par_level,
  ).length;

  if (inventoryLoading) {
    return (
      <div className="space-y-3">
        {[...Array(8)].map((_, i) => (
          <Skeleton key={i} className="h-14" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search items..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-10"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-44 h-10">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Quick stats */}
      {lowStockCount > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
          <span className="text-sm text-amber-400">
            <strong>{lowStockCount}</strong> item
            {lowStockCount !== 1 ? "s" : ""} below minimum stock level
          </span>
        </div>
      )}

      {/* Items List — Card-based for all screen sizes */}
      <div className="space-y-2">
        {filteredItems.length === 0 ? (
          <div className="h-[200px] flex items-center justify-center border rounded-lg text-muted-foreground">
            No items found
          </div>
        ) : (
          filteredItems.map((item) => {
            const isLowStock = item.par_level
              ? item.current_quantity < item.par_level
              : false;
            const hasReceived =
              item.received_quantity !== null && item.received_quantity > 0;

            return (
              <div
                key={item.inventory_item_id}
                className={`
                  group relative border rounded-lg px-4 py-3 transition-colors
                  ${
                    hasReceived
                      ? "bg-emerald-500/10 border-emerald-500/20"
                      : isLowStock
                        ? "bg-card border-amber-500/20"
                        : "bg-card hover:bg-muted/50"
                  }
                `}
              >
                {/* Accent bar */}
                {hasReceived && (
                  <div className="absolute left-0 top-2 bottom-2 w-0.5 bg-emerald-500 rounded-full" />
                )}
                {isLowStock && !hasReceived && (
                  <div className="absolute left-0 top-2 bottom-2 w-0.5 bg-amber-400 rounded-full" />
                )}

                <div className="flex items-center gap-4">
                  {/* Item info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">
                        {item.name}
                      </span>
                      {isLowStock && (
                        <Badge
                          variant="outline"
                          className="text-amber-400 border-amber-300 bg-amber-500/10 text-[10px] h-5 shrink-0"
                        >
                          Low Stock
                        </Badge>
                      )}
                    </div>
                    {item.category && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {item.category}
                      </p>
                    )}
                  </div>

                  {/* Current stock */}
                  <div className="text-right shrink-0 hidden sm:block">
                    <p className="text-xs text-muted-foreground">In Stock</p>
                    <p
                      className={`text-sm font-mono font-semibold ${isLowStock ? "text-amber-400" : "text-muted-foreground"}`}
                    >
                      {item.current_quantity}
                      {item.par_level !== null && (
                        <span className="text-muted-foreground/60 font-normal text-xs">
                          {" "}
                          / {item.par_level}
                        </span>
                      )}
                    </p>
                  </div>

                  {/* Received quantity */}
                  <div className="shrink-0">
                    {item.isEditing ? (
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        autoFocus
                        value={item.received_quantity ?? ""}
                        onChange={(e) =>
                          handleQuantityChange(
                            item.inventory_item_id,
                            e.target.value,
                          )
                        }
                        onFocus={(e) => e.target.select()}
                        onBlur={() => handleBlur(item.inventory_item_id)}
                        onKeyDown={(e) => {
                          if (e.key === ".") e.preventDefault();
                          if (e.key === "Enter") e.currentTarget.blur();
                        }}
                        className="w-20 h-9 text-center text-sm font-mono"
                        aria-label={`Received quantity for ${item.name}`}
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          handleStartEditing(item.inventory_item_id)
                        }
                        className={`
                          min-w-[72px] h-9 px-3 text-sm font-medium rounded-md border cursor-pointer
                          transition-all flex items-center justify-center gap-1
                          ${
                            hasReceived
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-300 hover:bg-emerald-100"
                              : "bg-card hover:bg-muted border-input"
                          }
                        `}
                        aria-label={`Add received quantity for ${item.name}`}
                      >
                        {hasReceived ? (
                          <span className="font-mono">
                            +{item.received_quantity}
                          </span>
                        ) : (
                          <Plus className="h-4 w-4 text-muted-foreground" />
                        )}
                      </button>
                    )}
                  </div>

                  {/* Cost entry (appears when quantity entered) */}
                  {hasReceived && (
                    <div className="shrink-0 hidden sm:block">
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                          £
                        </span>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.total_cost ?? ""}
                          onChange={(e) =>
                            handleCostChange(
                              item.inventory_item_id,
                              e.target.value,
                            )
                          }
                          placeholder="Cost"
                          className="w-24 h-9 pl-6 text-sm font-mono"
                          aria-label={`Total cost for ${item.name}`}
                        />
                      </div>
                    </div>
                  )}

                  {/* Clear button */}
                  {hasReceived && (
                    <button
                      type="button"
                      onClick={() => handleClearItem(item.inventory_item_id)}
                      className="shrink-0 h-7 w-7 rounded-full flex items-center justify-center text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 transition-colors"
                      aria-label={`Clear ${item.name}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {/* Mobile: stock + cost row */}
                <div className="flex items-center gap-3 mt-2 sm:hidden">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">
                      Stock:
                    </span>
                    <span
                      className={`text-xs font-mono font-semibold ${isLowStock ? "text-amber-400" : "text-foreground"}`}
                    >
                      {item.current_quantity}
                      {item.par_level !== null && (
                        <span className="text-muted-foreground/60 font-normal">
                          {" "}
                          / {item.par_level}
                        </span>
                      )}
                    </span>
                  </div>
                  {hasReceived && (
                    <div className="relative flex-1 max-w-[120px]">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                        £
                      </span>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.total_cost ?? ""}
                        onChange={(e) =>
                          handleCostChange(
                            item.inventory_item_id,
                            e.target.value,
                          )
                        }
                        placeholder="Cost"
                        className="w-full h-8 pl-6 text-xs font-mono"
                        aria-label={`Total cost for ${item.name}`}
                      />
                    </div>
                  )}
                </div>

                {/* Cost per unit hint */}
                {hasReceived &&
                  item.total_cost !== null &&
                  item.total_cost > 0 &&
                  item.received_quantity &&
                  item.received_quantity > 0 && (
                    <p className="text-[11px] text-muted-foreground mt-1 sm:text-right">
                      £{(item.total_cost / item.received_quantity).toFixed(2)}{" "}
                      per unit
                    </p>
                  )}
              </div>
            );
          })
        )}
      </div>

      {/* Notes toggle + Submit */}
      <div className="space-y-3 pt-3 border-t">
        {/* Notes */}
        {!showNotes ? (
          <button
            type="button"
            onClick={() => setShowNotes(true)}
            className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Add delivery notes
          </button>
        ) : (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="notes" className="text-sm">
                Delivery Notes
              </Label>
              <button
                type="button"
                onClick={() => {
                  setShowNotes(false);
                  setNotes("");
                }}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Remove
              </button>
            </div>
            <Textarea
              id="notes"
              placeholder="Supplier name, invoice number, discrepancies..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-[72px] text-sm"
            />
          </div>
        )}

        {/* Summary + Submit */}
        {receivedItemsCount > 0 && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 rounded-lg bg-muted/50 border">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <span className="font-medium">
                {receivedItemsCount} item{receivedItemsCount !== 1 ? "s" : ""}
              </span>
              <span className="text-muted-foreground">
                {totalUnitsReceived} unit{totalUnitsReceived !== 1 ? "s" : ""}{" "}
                total
              </span>
              {totalCostEntered > 0 && (
                <span className="text-muted-foreground">
                  £{totalCostEntered.toFixed(2)} cost
                </span>
              )}
            </div>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="w-full sm:w-auto gap-2"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <PackageCheck className="h-4 w-4" />
              )}
              Record Delivery
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
