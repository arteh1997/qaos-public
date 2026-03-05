"use client";

import { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useStoreInventory } from "@/hooks/useStoreInventory";
import { useCSRF } from "@/hooks/useCSRF";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/page-header";
import { PageGuide } from "@/components/help/PageGuide";
import { StatsCard } from "@/components/cards/StatsCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PoundSterling,
  TrendingUp,
  AlertTriangle,
  ArrowUpDown,
  Check,
  X,
  Search,
  Package,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";

type SortField = "name" | "quantity" | "unit_cost" | "total_value";
type SortDir = "asc" | "desc";

function formatGBP(value: number, precise = false): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: precise ? 2 : 0,
    maximumFractionDigits: precise ? 2 : 0,
  }).format(value);
}

export default function StockValuePage() {
  const { storeId, role } = useAuth();
  const { inventory, isLoading } = useStoreInventory(storeId);
  const { csrfFetch } = useCSRF();
  const queryClient = useQueryClient();

  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const inputRef = useRef<HTMLInputElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir(field === "name" ? "asc" : "desc");
    }
  };

  const handleStartEdit = useCallback((itemId: string, currentCost: number) => {
    setEditingId(itemId);
    setEditingValue(currentCost > 0 ? String(currentCost) : "");
  }, []);

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingValue("");
  };

  const handleSaveCost = async (inventoryItemId: string) => {
    const value = parseFloat(editingValue);
    if (isNaN(value) || value < 0) {
      handleCancelEdit();
      return;
    }

    setSaving(true);
    try {
      const res = await csrfFetch(
        `/api/stores/${storeId}/inventory/${inventoryItemId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ unit_cost: value }),
        },
      );
      if (!res.ok) throw new Error("Failed to save");
      toast.success("Cost updated");
      setEditingId(null);
      setEditingValue("");
      queryClient.invalidateQueries({ queryKey: ["store-inventory", storeId] });
    } catch {
      toast.error("Failed to update cost");
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, inventoryItemId: string) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSaveCost(inventoryItemId);
    } else if (e.key === "Escape") {
      handleCancelEdit();
    }
  };

  const scrollToTableAndEdit = useCallback(
    (itemId: string) => {
      tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      setTimeout(() => handleStartEdit(itemId, 0), 400);
    },
    [handleStartEdit],
  );

  // ── Data computation ──
  const data = useMemo(() => {
    if (!inventory)
      return {
        items: [] as {
          id: string;
          name: string;
          category: string;
          unit: string;
          quantity: number;
          unit_cost: number;
          total_value: number;
        }[],
        total: 0,
        byCategory: [] as {
          category: string;
          count: number;
          value: number;
          percentage: number;
        }[],
        missingCostCount: 0,
        itemsWithCost: 0,
        missingCostItems: [] as {
          id: string;
          name: string;
          category: string;
          unit: string;
          quantity: number;
          unit_cost: number;
          total_value: number;
        }[],
        topItems: [] as {
          id: string;
          name: string;
          category: string;
          unit: string;
          quantity: number;
          unit_cost: number;
          total_value: number;
        }[],
        categories: [] as string[],
      };

    const items = inventory.map((item) => ({
      id: item.inventory_item_id,
      name: item.inventory_item?.name || "Unknown",
      category: item.inventory_item?.category || "Uncategorized",
      unit: item.inventory_item?.unit_of_measure || "units",
      quantity: item.quantity,
      unit_cost: item.unit_cost || 0,
      total_value: item.quantity * (item.unit_cost || 0),
    }));

    const total = items.reduce((sum, i) => sum + i.total_value, 0);
    const missingCostCount = items.filter((i) => i.unit_cost === 0).length;
    const itemsWithCost = items.filter((i) => i.unit_cost > 0).length;
    const missingCostItems = items.filter((i) => i.unit_cost === 0).slice(0, 5);

    // Top items by value
    const topItems = [...items]
      .filter((i) => i.total_value > 0)
      .sort((a, b) => b.total_value - a.total_value)
      .slice(0, 8);

    // Group by category
    const categoryMap = new Map<string, { count: number; value: number }>();
    for (const item of items) {
      const existing = categoryMap.get(item.category) || { count: 0, value: 0 };
      existing.count++;
      existing.value += item.total_value;
      categoryMap.set(item.category, existing);
    }
    const byCategory = Array.from(categoryMap.entries())
      .map(([category, d]) => ({
        category,
        ...d,
        percentage: total > 0 ? (d.value / total) * 100 : 0,
      }))
      .sort((a, b) => b.value - a.value);

    const categories = Array.from(categoryMap.keys()).sort();

    return {
      items,
      total,
      byCategory,
      missingCostCount,
      itemsWithCost,
      missingCostItems,
      topItems,
      categories,
    };
  }, [inventory]);

  // ── Filtered & sorted items for the table ──
  const tableItems = useMemo(() => {
    let filtered = data.items;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((i) => i.name.toLowerCase().includes(q));
    }

    if (categoryFilter !== "all") {
      filtered = filtered.filter((i) => i.category === categoryFilter);
    }

    return [...filtered].sort((a, b) => {
      const m = sortDir === "asc" ? 1 : -1;
      switch (sortField) {
        case "name":
          return m * a.name.localeCompare(b.name);
        case "quantity":
          return m * (a.quantity - b.quantity);
        case "unit_cost":
          return m * (a.unit_cost - b.unit_cost);
        case "total_value":
          return m * (a.total_value - b.total_value);
        default:
          return 0;
      }
    });
  }, [data.items, searchQuery, categoryFilter, sortField, sortDir]);

  const filteredTotal = useMemo(
    () => tableItems.reduce((sum, i) => sum + i.total_value, 0),
    [tableItems],
  );

  // ── Guards ──
  if (role !== "Owner" && role !== "Manager") {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <PoundSterling className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <h2 className="text-lg font-semibold mb-2">Access Restricted</h2>
          <p className="text-sm text-muted-foreground">
            Only Owners and Managers can view stock value.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!storeId) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <PoundSterling className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <h2 className="text-lg font-semibold mb-2">No Store Selected</h2>
          <p className="text-sm text-muted-foreground">
            Select a store to view stock value.
          </p>
        </CardContent>
      </Card>
    );
  }

  const topCategory = data.byCategory[0];
  const shownCategories = data.byCategory.slice(0, 6);
  const remainingCategories = data.byCategory.slice(6);
  const remainingValue = remainingCategories.reduce(
    (sum, c) => sum + c.value,
    0,
  );

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <PageHeader
        title="Inventory Value"
        description="Total stock value across all items"
      >
        <PageGuide pageKey="inventory-value" />
      </PageHeader>

      {/* ── Stats Cards ── */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3">
        <StatsCard
          title="Stock Value"
          value={formatGBP(data.total)}
          description={`Across ${data.itemsWithCost} priced items`}
          icon={<PoundSterling className="h-4 w-4" />}
        />
        <StatsCard
          title="Top Category"
          value={topCategory?.category ?? "—"}
          description={
            topCategory
              ? `${formatGBP(topCategory.value)} — ${Math.round(topCategory.percentage)}% of total`
              : "No data yet"
          }
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <StatsCard
          title="Needs Pricing"
          value={data.missingCostCount}
          description={
            data.missingCostCount === 0
              ? "All costs set"
              : `${data.missingCostCount} item${data.missingCostCount !== 1 ? "s" : ""} need a cost`
          }
          icon={
            data.missingCostCount === 0 ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <AlertTriangle className="h-4 w-4" />
            )
          }
          variant={data.missingCostCount > 0 ? "warning" : "default"}
        />
      </div>

      {/* ── Where Your Money Goes ── */}
      {shownCategories.length > 0 && data.total > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">
              Where Your Money Goes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {shownCategories.map((cat) => (
              <div key={cat.category} className="flex items-center gap-3">
                <span className="text-sm font-medium w-32 sm:w-40 truncate shrink-0">
                  {cat.category}
                </span>
                <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${Math.max(cat.percentage, 2)}%` }}
                  />
                </div>
                <span className="text-sm font-semibold font-mono w-16 text-right shrink-0">
                  {formatGBP(cat.value)}
                </span>
              </div>
            ))}
            {remainingCategories.length > 0 && (
              <p className="text-xs text-muted-foreground pt-1">
                and {remainingCategories.length} more categor
                {remainingCategories.length === 1 ? "y" : "ies"} (
                {formatGBP(remainingValue)} total)
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Most Valuable Items ── */}
      {data.topItems.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">
              Most Valuable Stock
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-0 divide-y">
              {data.topItems.map((item, index) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
                >
                  <span className="text-sm font-mono text-muted-foreground w-5 text-right shrink-0">
                    {index + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.quantity} × {formatGBP(item.unit_cost, true)}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className="text-xs shrink-0 hidden sm:inline-flex"
                  >
                    {item.category}
                  </Badge>
                  <span className="text-sm font-semibold font-mono shrink-0">
                    {formatGBP(item.total_value)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Needs Attention ── */}
      {data.missingCostCount > 0 && (
        <Card className="border-amber-300">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
              <CardTitle className="text-base font-semibold">
                Needs Attention
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              These items have no cost set. Tap to set a price so your stock
              value is accurate.
            </p>
            <div className="space-y-0 divide-y">
              {data.missingCostItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => scrollToTableAndEdit(item.id)}
                  className="flex items-center justify-between w-full py-2.5 first:pt-0 last:pb-0 text-left hover:bg-muted/50 -mx-2 px-2 rounded transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.quantity} {item.unit} in stock
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className="text-amber-400 border-amber-300 shrink-0"
                  >
                    Set cost
                  </Badge>
                </button>
              ))}
            </div>
            {data.missingCostCount > 5 && (
              <p className="text-xs text-muted-foreground mt-3">
                +{data.missingCostCount - 5} more item
                {data.missingCostCount - 5 !== 1 ? "s" : ""} without costs
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── All Items Table ── */}
      <div ref={tableRef}>
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-4">
              <CardTitle className="text-base font-semibold">
                All Items
              </CardTitle>
              <span className="text-sm text-muted-foreground">
                {tableItems.length} item{tableItems.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search items..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full sm:w-44 h-9">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {data.categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {tableItems.length === 0 ? (
              <div className="py-12 text-center">
                <Package className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">
                  {searchQuery || categoryFilter !== "all"
                    ? "No items match your filters."
                    : "No inventory items yet. Add items in the Inventory page first."}
                </p>
              </div>
            ) : (
              <>
                {/* Mobile cards */}
                <div className="space-y-2 md:hidden">
                  {tableItems.map((item) => (
                    <div
                      key={item.id}
                      className={`flex items-center justify-between p-3 rounded-lg ${item.unit_cost === 0 ? "bg-amber-500/10" : "bg-muted/50"}`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">
                          {item.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {item.quantity} {item.unit} &middot; {item.category}
                        </p>
                      </div>
                      <div className="text-right ml-3">
                        {editingId === item.id ? (
                          <div className="flex items-center gap-1">
                            <span className="text-sm text-muted-foreground">
                              £
                            </span>
                            <Input
                              ref={inputRef}
                              type="number"
                              step="0.01"
                              min="0"
                              value={editingValue}
                              onChange={(e) => setEditingValue(e.target.value)}
                              onKeyDown={(e) => handleKeyDown(e, item.id)}
                              onBlur={() => handleSaveCost(item.id)}
                              className="w-20 h-7 text-sm text-right"
                              disabled={saving}
                            />
                          </div>
                        ) : (
                          <button
                            onClick={() =>
                              handleStartEdit(item.id, item.unit_cost)
                            }
                            className="text-right"
                          >
                            {item.unit_cost > 0 ? (
                              <>
                                <p className="font-semibold text-sm font-mono">
                                  {formatGBP(item.total_value, true)}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {formatGBP(item.unit_cost, true)} each
                                </p>
                              </>
                            ) : (
                              <Badge
                                variant="outline"
                                className="text-amber-400 border-amber-300"
                              >
                                Set cost
                              </Badge>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop table */}
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>
                          <button
                            onClick={() => toggleSort("name")}
                            className="flex items-center gap-1 hover:text-foreground"
                          >
                            Item <ArrowUpDown className="h-3 w-3" />
                          </button>
                        </TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">
                          <button
                            onClick={() => toggleSort("quantity")}
                            className="flex items-center gap-1 ml-auto hover:text-foreground"
                          >
                            In Stock <ArrowUpDown className="h-3 w-3" />
                          </button>
                        </TableHead>
                        <TableHead className="text-right">
                          <button
                            onClick={() => toggleSort("unit_cost")}
                            className="flex items-center gap-1 ml-auto hover:text-foreground"
                          >
                            Cost Each <ArrowUpDown className="h-3 w-3" />
                          </button>
                        </TableHead>
                        <TableHead className="text-right">
                          <button
                            onClick={() => toggleSort("total_value")}
                            className="flex items-center gap-1 ml-auto hover:text-foreground"
                          >
                            Stock Value <ArrowUpDown className="h-3 w-3" />
                          </button>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tableItems.map((item) => (
                        <TableRow
                          key={item.id}
                          className={
                            item.unit_cost === 0 ? "bg-amber-500/10" : undefined
                          }
                        >
                          <TableCell className="font-medium">
                            {item.name}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {item.category}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {item.quantity} {item.unit}
                          </TableCell>
                          <TableCell className="text-right">
                            {editingId === item.id ? (
                              <div className="flex items-center justify-end gap-1">
                                <span className="text-sm text-muted-foreground">
                                  £
                                </span>
                                <Input
                                  ref={inputRef}
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={editingValue}
                                  onChange={(e) =>
                                    setEditingValue(e.target.value)
                                  }
                                  onKeyDown={(e) => handleKeyDown(e, item.id)}
                                  className="w-24 h-7 text-sm text-right font-mono"
                                  disabled={saving}
                                />
                                <button
                                  onClick={() => handleSaveCost(item.id)}
                                  className="p-1 rounded hover:bg-muted"
                                  title="Save"
                                >
                                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                                </button>
                                <button
                                  onClick={handleCancelEdit}
                                  className="p-1 rounded hover:bg-muted"
                                  title="Cancel"
                                >
                                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() =>
                                  handleStartEdit(item.id, item.unit_cost)
                                }
                                className="inline-flex items-center gap-1 hover:underline cursor-pointer"
                              >
                                {item.unit_cost > 0 ? (
                                  <span className="font-mono">
                                    {formatGBP(item.unit_cost, true)}
                                  </span>
                                ) : (
                                  <Badge
                                    variant="outline"
                                    className="text-amber-400 border-amber-300 font-normal"
                                  >
                                    Set cost
                                  </Badge>
                                )}
                              </button>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono font-semibold">
                            {item.unit_cost > 0
                              ? formatGBP(item.total_value, true)
                              : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                      {filteredTotal > 0 && (
                        <TableRow className="bg-muted/50 font-bold border-t-2">
                          <TableCell colSpan={4} className="text-right">
                            Total Stock Value
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {formatGBP(filteredTotal, true)}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
