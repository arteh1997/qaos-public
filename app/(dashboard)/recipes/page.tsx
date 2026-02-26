'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useCSRF } from '@/hooks/useCSRF'
import { useRecipes, useRecipeDetail } from '@/hooks/useRecipes'
import { useMenuAnalysis, useMenuItems } from '@/hooks/useMenuAnalysis'
import { useStoreInventory } from '@/hooks/useStoreInventory'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import { PageGuide } from '@/components/help/PageGuide'
import { IngredientForm } from '@/components/recipes/IngredientForm'
import { MenuItemForm } from '@/components/recipes/MenuItemForm'
import {
  UtensilsCrossed, Plus, ArrowLeft, AlertTriangle,
  TrendingUp, Trash2, PoundSterling, ShoppingBag, ChevronRight,
} from 'lucide-react'
import { toast } from 'sonner'

const RATING_COLORS: Record<string, string> = {
  excellent: 'bg-emerald-50 text-emerald-700',
  good: 'bg-blue-50 text-blue-700',
  fair: 'bg-amber-50 text-amber-700',
  poor: 'bg-destructive/10 text-destructive',
  no_recipe: 'bg-muted text-muted-foreground',
}

const RATING_LABELS: Record<string, string> = {
  excellent: 'Great',
  good: 'Good',
  fair: 'Watch',
  poor: 'High cost',
  no_recipe: 'No breakdown',
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export default function MenuCostsPage() {
  const { currentStore, role } = useAuth()
  const storeId = currentStore?.store_id ?? null

  const {
    recipes, fetchRecipes,
    createRecipe, deleteRecipe, isSubmitting: submittingRecipe,
  } = useRecipes(storeId)

  const { analysis, isLoading: loadingAnalysis, fetchAnalysis } = useMenuAnalysis(storeId)
  const {
    menuItems, isLoading: loadingMenuItems, fetchMenuItems,
    createMenuItem, updateMenuItem, deleteMenuItem, isSubmitting: submittingMenuItem,
  } = useMenuItems(storeId)

  const { inventory } = useStoreInventory(storeId)
  const { csrfFetch } = useCSRF()

  // Detail view state
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null)
  const [selectedMenuItemId, setSelectedMenuItemId] = useState<string | null>(null)
  const {
    recipe: recipeDetail, isLoading: loadingDetail, fetchRecipe,
    addIngredient, removeIngredient, isSubmitting: submittingIngredient,
  } = useRecipeDetail(storeId, selectedRecipeId)

  const [showMenuItemForm, setShowMenuItemForm] = useState(false)
  const [showIngredientForm, setShowIngredientForm] = useState(false)
  const [deletingMenuItemId, setDeletingMenuItemId] = useState<string | null>(null)
  const [prefillCategory, setPrefillCategory] = useState<string | undefined>(undefined)
  const [editingCostItemId, setEditingCostItemId] = useState<string | null>(null)
  const [editingCostValue, setEditingCostValue] = useState('')
  const costInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (storeId) {
      fetchRecipes()
      fetchAnalysis()
      fetchMenuItems()
    }
  }, [storeId, fetchRecipes, fetchAnalysis, fetchMenuItems])

  useEffect(() => {
    if (selectedRecipeId) fetchRecipe()
  }, [selectedRecipeId, fetchRecipe])

  // Group menu items by category for the Menu tab
  const groupedItems = useMemo(() => {
    const groups: Record<string, typeof menuItems> = {}
    for (const item of menuItems) {
      const cat = item.category || 'Other'
      if (!groups[cat]) groups[cat] = []
      groups[cat].push(item)
    }
    // Sort: named categories first alphabetically, "Other" last
    const sorted = Object.entries(groups).sort(([a], [b]) => {
      if (a === 'Other') return 1
      if (b === 'Other') return -1
      return a.localeCompare(b)
    })
    return sorted
  }, [menuItems])

  const existingCategories = useMemo(
    () => [...new Set(menuItems.map(m => m.category).filter((c): c is string => !!c))],
    [menuItems]
  )

  if (role !== 'Owner' && role !== 'Manager') {
    return (
      <div className="space-y-6">
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Menu & Costs</h1>
        <Card><CardContent className="pt-6 text-center text-muted-foreground">This feature is only available to Owners and Managers.</CardContent></Card>
      </div>
    )
  }

  if (!storeId) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Menu & Costs</h1>
        <Card><CardContent className="pt-6 text-center text-muted-foreground">Select a store to see your menu.</CardContent></Card>
      </div>
    )
  }

  // Unified handler: creates recipe + menu item together
  const handleCreateUnifiedItem = async (data: { name: string; category?: string; selling_price: number }) => {
    try {
      const recipe = await createRecipe({
        name: data.name,
        category: data.category,
        yield_quantity: 1,
        yield_unit: 'serving',
        is_active: true,
      })
      const newMenuItem = await createMenuItem({
        name: data.name,
        category: data.category,
        selling_price: data.selling_price,
        recipe_id: recipe.id,
        currency: 'GBP',
        is_active: true,
      })
      toast.success('Item added — now add what goes into it')
      setPrefillCategory(undefined)
      // Navigate straight to detail view so user can add ingredients
      setSelectedRecipeId(recipe.id)
      setSelectedMenuItemId(newMenuItem.id)
      fetchMenuItems()
      fetchAnalysis()
      fetchRecipes()
    } catch {
      toast.error('Failed to add menu item')
    }
  }

  // Add cost breakdown to an existing menu item without one
  const handleAddCostBreakdown = async (menuItemId: string, menuItemName: string) => {
    try {
      const recipe = await createRecipe({
        name: menuItemName,
        yield_quantity: 1,
        yield_unit: 'serving',
        is_active: true,
      })
      await updateMenuItem(menuItemId, { recipe_id: recipe.id })
      toast.success('Cost breakdown created — add your ingredients')
      setSelectedRecipeId(recipe.id)
      setSelectedMenuItemId(menuItemId)
      fetchMenuItems()
      fetchRecipes()
    } catch {
      toast.error('Failed to create cost breakdown')
    }
  }

  const handleAddIngredient = async (data: Parameters<typeof addIngredient>[0]) => {
    try {
      await addIngredient(data)
      toast.success('Ingredient added')
      fetchRecipe()
      fetchAnalysis()
    } catch {
      toast.error('Failed to add ingredient')
    }
  }

  const handleRemoveIngredient = async (ingredientId: string) => {
    try {
      await removeIngredient(ingredientId)
      toast.success('Ingredient removed')
      fetchRecipe()
      fetchAnalysis()
    } catch {
      toast.error('Failed to remove ingredient')
    }
  }

  const handleSaveCost = async (inventoryItemId: string) => {
    const value = parseFloat(editingCostValue)
    if (isNaN(value) || value < 0) {
      setEditingCostItemId(null)
      return
    }
    try {
      await csrfFetch(`/api/stores/${storeId}/inventory/${inventoryItemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unit_cost: value }),
      })
      setEditingCostItemId(null)
      fetchRecipe()
      fetchAnalysis()
    } catch {
      toast.error('Failed to update cost')
    }
  }

  const handleDeleteMenuItem = async () => {
    if (!deletingMenuItemId) return
    try {
      const menuItem = menuItems.find(m => m.id === deletingMenuItemId)
      await deleteMenuItem(deletingMenuItemId)
      if (menuItem?.recipe_id) {
        try { await deleteRecipe(menuItem.recipe_id) } catch { /* recipe may already be gone */ }
      }
      toast.success('Item removed from menu')
      setDeletingMenuItemId(null)
      fetchMenuItems()
      fetchAnalysis()
      fetchRecipes()
    } catch {
      toast.error('Failed to remove menu item')
    }
  }

  const handleMenuItemClick = (menuItemId: string) => {
    const menuItem = menuItems.find(m => m.id === menuItemId)
    if (!menuItem) return
    if (menuItem.recipe_id) {
      setSelectedRecipeId(menuItem.recipe_id)
      setSelectedMenuItemId(menuItemId)
    } else {
      handleAddCostBreakdown(menuItemId, menuItem.name)
    }
  }

  const handleCostsRowClick = (item: { id: string; name: string; has_recipe: boolean }) => {
    const menuItem = menuItems.find(m => m.id === item.id)
    if (item.has_recipe && menuItem?.recipe_id) {
      setSelectedRecipeId(menuItem.recipe_id)
      setSelectedMenuItemId(item.id)
    } else {
      handleAddCostBreakdown(item.id, item.name)
    }
  }

  const goBack = () => {
    setSelectedRecipeId(null)
    setSelectedMenuItemId(null)
  }

  const openAddItemForCategory = (category: string) => {
    setPrefillCategory(category)
    setShowMenuItemForm(true)
  }

  const inventoryOptions = inventory
    .filter(i => i.inventory_item)
    .map(i => ({ id: i.inventory_item_id, name: i.inventory_item!.name, unit_of_measure: i.inventory_item!.unit_of_measure }))

  const selectedMenuItem = menuItems.find(m => m.id === selectedMenuItemId)

  // ── Detail view ──────────────────────────────────────────────────
  if (selectedRecipeId && recipeDetail) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={goBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h2 className="text-lg font-semibold">{recipeDetail.name}</h2>
              {selectedMenuItem && (
                <p className="text-sm text-muted-foreground">
                  Sells for {formatCurrency(selectedMenuItem.selling_price)}
                  {selectedMenuItem.category ? ` · ${selectedMenuItem.category}` : ''}
                </p>
              )}
            </div>
          </div>
          <Button size="sm" onClick={() => setShowIngredientForm(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Add Ingredient
          </Button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Cost to Make</p>
              <p className="text-xl font-bold">{formatCurrency(recipeDetail.total_cost)}</p>
            </CardContent>
          </Card>
          {selectedMenuItem && (
            <>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground">Profit</p>
                  <p className="text-xl font-bold text-emerald-600">
                    {formatCurrency(selectedMenuItem.selling_price - recipeDetail.total_cost)}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground">Food Cost %</p>
                  <p className="text-xl font-bold">
                    {selectedMenuItem.selling_price > 0
                      ? ((recipeDetail.total_cost / selectedMenuItem.selling_price) * 100).toFixed(1)
                      : '0'}%
                  </p>
                </CardContent>
              </Card>
            </>
          )}
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Ingredients</p>
              <p className="text-xl font-bold">{recipeDetail.ingredients.length}</p>
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-lg border shadow-sm overflow-hidden">
          <CardHeader>
            <CardTitle className="text-sm font-medium">What goes into this</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingDetail ? (
              <Skeleton className="h-24 w-full" />
            ) : recipeDetail.ingredients.length === 0 ? (
              <EmptyState
                icon={UtensilsCrossed}
                title="No ingredients yet"
                description="Add what goes into this item to see your cost breakdown."
                action={{ label: 'Add Ingredient', onClick: () => setShowIngredientForm(true), icon: Plus }}
              />
            ) : (
              <>
              {/* Mobile card view */}
              <div className="sm:hidden space-y-2">
                {recipeDetail.ingredients.map(ing => (
                  <div key={ing.id} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{ing.inventory_item?.name ?? 'Unknown'}</span>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleRemoveIngredient(ing.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground text-xs">Qty</span>
                        <p className="font-medium">{ing.quantity}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-xs">Cost Each</span>
                        <div className="font-medium">
                          {editingCostItemId === ing.inventory_item_id ? (
                            <Input
                              ref={costInputRef}
                              type="number"
                              step="0.01"
                              min="0"
                              className="h-7 w-20 text-right"
                              value={editingCostValue ?? ''}
                              onChange={e => setEditingCostValue(e.target.value ?? '')}
                              onBlur={() => handleSaveCost(ing.inventory_item_id)}
                              onKeyDown={e => { if (e.key === 'Enter') handleSaveCost(ing.inventory_item_id) }}
                              autoFocus
                            />
                          ) : (
                            <button
                              type="button"
                              className={`${(ing.unit_cost ?? 0) === 0 ? 'text-amber-600 underline decoration-dashed cursor-pointer' : 'cursor-pointer hover:underline'}`}
                              onClick={() => {
                                setEditingCostItemId(ing.inventory_item_id)
                                setEditingCostValue(ing.unit_cost ? String(ing.unit_cost) : '')
                              }}
                            >
                              {(ing.unit_cost ?? 0) === 0 ? 'Set cost' : formatCurrency(ing.unit_cost ?? 0)}
                            </button>
                          )}
                        </div>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-xs">Total</span>
                        <p className="font-medium">{formatCurrency(ing.line_cost ?? 0)}</p>
                      </div>
                    </div>
                  </div>
                ))}
                <div className="border rounded-lg p-3 bg-muted/50">
                  <div className="flex items-center justify-between font-bold text-sm">
                    <span>Total</span>
                    <span>{formatCurrency(recipeDetail.total_cost)}</span>
                  </div>
                </div>
              </div>

              {/* Desktop table */}
              <div className="hidden sm:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ingredient</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Cost Each</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="w-[50px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recipeDetail.ingredients.map(ing => (
                    <TableRow key={ing.id}>
                      <TableCell className="font-medium">{ing.inventory_item?.name ?? 'Unknown'}</TableCell>
                      <TableCell className="text-right">{ing.quantity}</TableCell>
                      <TableCell className="text-right">
                        {editingCostItemId === ing.inventory_item_id ? (
                          <Input
                            ref={costInputRef}
                            type="number"
                            step="0.01"
                            min="0"
                            className="h-7 w-20 text-right ml-auto"
                            value={editingCostValue ?? ''}
                            onChange={e => setEditingCostValue(e.target.value ?? '')}
                            onBlur={() => handleSaveCost(ing.inventory_item_id)}
                            onKeyDown={e => { if (e.key === 'Enter') handleSaveCost(ing.inventory_item_id) }}
                            autoFocus
                          />
                        ) : (
                          <button
                            type="button"
                            className={`text-right w-full ${(ing.unit_cost ?? 0) === 0 ? 'text-amber-600 underline decoration-dashed cursor-pointer' : 'cursor-pointer hover:underline'}`}
                            onClick={() => {
                              setEditingCostItemId(ing.inventory_item_id)
                              setEditingCostValue(ing.unit_cost ? String(ing.unit_cost) : '')
                            }}
                          >
                            {(ing.unit_cost ?? 0) === 0 ? 'Set cost' : formatCurrency(ing.unit_cost ?? 0)}
                          </button>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(ing.line_cost ?? 0)}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => handleRemoveIngredient(ing.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-bold">
                    <TableCell colSpan={3} className="text-right">Total</TableCell>
                    <TableCell className="text-right">{formatCurrency(recipeDetail.total_cost)}</TableCell>
                    <TableCell />
                  </TableRow>
                </TableBody>
              </Table>
              </div>
              </>
            )}
          </CardContent>
        </Card>

        <IngredientForm
          open={showIngredientForm}
          onOpenChange={setShowIngredientForm}
          onSubmit={handleAddIngredient}
          isSubmitting={submittingIngredient}
          inventoryItems={inventoryOptions}
        />
      </div>
    )
  }

  // Loading detail state
  if (selectedRecipeId && loadingDetail) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={goBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Skeleton className="h-6 w-48" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}><CardContent className="pt-4"><Skeleton className="h-12 w-full" /></CardContent></Card>
          ))}
        </div>
      </div>
    )
  }

  // ── Main view ────────────────────────────────────────────────────
  const hasItems = menuItems.length > 0

  return (
    <div className="space-y-6">
      <PageHeader
        title="Menu & Costs"
        description="Your menu items organised by category, and what they cost to make."
      >
        <Button onClick={() => { setPrefillCategory(undefined); setShowMenuItemForm(true) }}>
          <Plus className="h-4 w-4 mr-2" />
          Add Item
        </Button>
        <PageGuide pageKey="recipes" />
      </PageHeader>

      {!hasItems && !loadingMenuItems ? (
        /* Empty state — onboarding */
        <Card className="border-dashed">
          <CardContent className="pt-8 pb-8">
            <div className="flex flex-col items-center text-center max-w-md mx-auto space-y-4">
              <div className="rounded-full bg-muted p-3">
                <UtensilsCrossed className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">What&apos;s on your menu?</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Add the items you sell — burgers, wraps, drinks — and we&apos;ll help you track what they cost to make.
                </p>
              </div>
              <div className="w-full space-y-3 text-left">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <span className="flex items-center justify-center rounded-full bg-card border h-6 w-6 text-xs font-medium shrink-0">1</span>
                  <div>
                    <p className="text-sm font-medium">Add a menu item</p>
                    <p className="text-xs text-muted-foreground">What you sell, which category it&apos;s in, and the price</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <span className="flex items-center justify-center rounded-full bg-card border h-6 w-6 text-xs font-medium shrink-0">2</span>
                  <div>
                    <p className="text-sm font-medium">Add what goes into it</p>
                    <p className="text-xs text-muted-foreground">Pick ingredients from your inventory</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <span className="flex items-center justify-center rounded-full bg-card border h-6 w-6 text-xs font-medium shrink-0">3</span>
                  <div>
                    <p className="text-sm font-medium">See your profit instantly</p>
                    <p className="text-xs text-muted-foreground">We&apos;ll calculate cost, profit, and warn you if costs get too high</p>
                  </div>
                </div>
              </div>
              <Button onClick={() => setShowMenuItemForm(true)} className="mt-2">
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Item
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : loadingMenuItems ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}><CardContent className="pt-4"><Skeleton className="h-20 w-full" /></CardContent></Card>
          ))}
        </div>
      ) : (
        <Tabs defaultValue="menu">
          <TabsList>
            <TabsTrigger value="menu">Menu</TabsTrigger>
            <TabsTrigger value="costs">Costs</TabsTrigger>
          </TabsList>

          {/* ── Menu Tab ── */}
          <TabsContent value="menu" className="space-y-4 mt-4">
            {groupedItems.map(([category, items]) => (
              <Card key={category} className="overflow-hidden">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold">{category}</CardTitle>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{items.length} {items.length === 1 ? 'item' : 'items'}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => openAddItemForCategory(category === 'Other' ? '' : category)}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Add
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="divide-y">
                    {items.map(item => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between py-3 cursor-pointer hover:bg-muted/30 -mx-6 px-6 transition-colors"
                        onClick={() => handleMenuItemClick(item.id)}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{item.name}</p>
                          {!item.recipe_id && (
                            <p className="text-xs text-muted-foreground">Tap to add what&apos;s in this</p>
                          )}
                        </div>
                        <div className="flex items-center gap-3 shrink-0 ml-4">
                          <span className="text-sm font-medium">{formatCurrency(item.selling_price)}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={e => { e.stopPropagation(); setDeletingMenuItemId(item.id) }}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* ── Costs Tab ── */}
          <TabsContent value="costs" className="space-y-4 mt-4">
            {/* Summary cards */}
            {loadingAnalysis ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Card key={i}><CardContent className="pt-4"><Skeleton className="h-12 w-full" /></CardContent></Card>
                ))}
              </div>
            ) : analysis && analysis.summary.total_menu_items > 0 ? (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <ShoppingBag className="h-4 w-4" />
                        Items on Menu
                      </div>
                      <p className="text-2xl font-bold mt-1">{analysis.summary.total_menu_items}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <PoundSterling className="h-4 w-4" />
                        Avg Food Cost
                      </div>
                      <p className="text-2xl font-bold mt-1">{analysis.summary.average_food_cost_percentage.toFixed(1)}%</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <AlertTriangle className="h-4 w-4" />
                        Above Target
                      </div>
                      <p className={`text-2xl font-bold mt-1 ${analysis.cost_alerts.length > 0 ? 'text-amber-600' : ''}`}>
                        {analysis.cost_alerts.length}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <TrendingUp className="h-4 w-4" />
                        Total Profit
                      </div>
                      <p className="text-2xl font-bold mt-1 text-emerald-600">{formatCurrency(analysis.summary.total_profit)}</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Cost alerts */}
                {analysis.cost_alerts.length > 0 && (
                  <Card className="border-amber-200">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                        Items above target cost ({analysis.summary.target_food_cost_percentage}%)
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {analysis.cost_alerts.map(item => (
                          <div key={item.id} className="flex items-center justify-between p-2 rounded-lg bg-amber-50">
                            <span className="font-medium text-sm">{item.name}</span>
                            <div className="flex items-center gap-3">
                              <span className="text-sm text-muted-foreground">{item.food_cost_percentage.toFixed(1)}%</span>
                              <Badge variant="secondary" className="bg-destructive/10 text-destructive">
                                +{(item.food_cost_percentage - analysis.summary.target_food_cost_percentage).toFixed(1)}% over
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* All items table */}
                <Card className="rounded-lg border shadow-sm overflow-hidden">
                  <CardHeader>
                    <CardTitle className="text-sm font-medium">All Items</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0 sm:p-0">
                    {/* Mobile card view */}
                    <div className="sm:hidden space-y-2 p-4">
                      {analysis.items.map(item => (
                        <div
                          key={item.id}
                          className="border rounded-lg p-3 space-y-2 cursor-pointer hover:bg-muted/30 transition-colors"
                          onClick={() => handleCostsRowClick(item)}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-sm">{item.name}</span>
                            <Badge variant="secondary" className={RATING_COLORS[item.rating]}>
                              {RATING_LABELS[item.rating] ?? item.rating}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4 text-sm flex-wrap">
                            <div>
                              <span className="text-muted-foreground text-xs">Price</span>
                              <p className="font-medium">{formatCurrency(item.selling_price)}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground text-xs">Cost</span>
                              <p className="font-medium">
                                {item.has_recipe ? formatCurrency(item.food_cost) : <span className="text-muted-foreground">—</span>}
                              </p>
                            </div>
                            <div>
                              <span className="text-muted-foreground text-xs">Profit</span>
                              <p className="font-medium text-emerald-600">
                                {item.has_recipe ? formatCurrency(item.profit_margin) : <span className="text-muted-foreground">—</span>}
                              </p>
                            </div>
                            <div>
                              <span className="text-muted-foreground text-xs">Food Cost %</span>
                              <p className="font-medium">
                                {item.has_recipe ? `${item.food_cost_percentage.toFixed(1)}%` : <span className="text-muted-foreground">—</span>}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Desktop table */}
                    <div className="hidden sm:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Item</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead className="text-right">Sells For</TableHead>
                          <TableHead className="text-right">Cost</TableHead>
                          <TableHead className="text-right">Profit</TableHead>
                          <TableHead className="text-right">Food Cost %</TableHead>
                          <TableHead>Rating</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {analysis.items.map(item => (
                          <TableRow
                            key={item.id}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => handleCostsRowClick(item)}
                          >
                            <TableCell className="font-medium">{item.name}</TableCell>
                            <TableCell>{item.category ?? '-'}</TableCell>
                            <TableCell className="text-right">{formatCurrency(item.selling_price)}</TableCell>
                            <TableCell className="text-right">
                              {item.has_recipe ? formatCurrency(item.food_cost) : (
                                <span className="text-muted-foreground text-xs">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right text-emerald-600">
                              {item.has_recipe ? formatCurrency(item.profit_margin) : (
                                <span className="text-muted-foreground text-xs">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {item.has_recipe ? `${item.food_cost_percentage.toFixed(1)}%` : (
                                <span className="text-muted-foreground text-xs">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className={RATING_COLORS[item.rating]}>
                                {RATING_LABELS[item.rating] ?? item.rating}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    </div>
                  </CardContent>
                </Card>

                {/* Category breakdown */}
                {analysis.categories.length > 0 && (
                  <Card className="rounded-lg border shadow-sm overflow-hidden">
                    <CardHeader>
                      <CardTitle className="text-sm font-medium">By Category</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0 sm:p-0">
                      {/* Mobile card view */}
                      <div className="sm:hidden space-y-2 p-4">
                        {analysis.categories.map(cat => (
                          <div key={cat.category} className="border rounded-lg p-3 space-y-2">
                            <span className="font-medium text-sm">{cat.category}</span>
                            <div className="flex items-center gap-4 text-sm flex-wrap">
                              <div>
                                <span className="text-muted-foreground text-xs">Items</span>
                                <p className="font-medium">{cat.item_count}</p>
                              </div>
                              <div>
                                <span className="text-muted-foreground text-xs">Avg Food Cost %</span>
                                <p className="font-medium">{cat.avg_food_cost_pct.toFixed(1)}%</p>
                              </div>
                              <div>
                                <span className="text-muted-foreground text-xs">Revenue</span>
                                <p className="font-medium">{formatCurrency(cat.total_revenue)}</p>
                              </div>
                              <div>
                                <span className="text-muted-foreground text-xs">Profit</span>
                                <p className="font-medium text-emerald-600">{formatCurrency(cat.total_profit)}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Desktop table */}
                      <div className="hidden sm:block">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Category</TableHead>
                            <TableHead className="text-right">Items</TableHead>
                            <TableHead className="text-right">Avg Food Cost %</TableHead>
                            <TableHead className="text-right">Revenue</TableHead>
                            <TableHead className="text-right">Profit</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {analysis.categories.map(cat => (
                            <TableRow key={cat.category}>
                              <TableCell className="font-medium">{cat.category}</TableCell>
                              <TableCell className="text-right">{cat.item_count}</TableCell>
                              <TableCell className="text-right">{cat.avg_food_cost_pct.toFixed(1)}%</TableCell>
                              <TableCell className="text-right">{formatCurrency(cat.total_revenue)}</TableCell>
                              <TableCell className="text-right text-emerald-600">{formatCurrency(cat.total_profit)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            ) : (
              <EmptyState
                icon={TrendingUp}
                title="No cost data yet"
                description="Add ingredients to your menu items to see profitability analysis."
              />
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* Dialogs */}
      <MenuItemForm
        open={showMenuItemForm}
        onOpenChange={(open) => { setShowMenuItemForm(open); if (!open) setPrefillCategory(undefined) }}
        onSubmit={handleCreateUnifiedItem}
        isSubmitting={submittingRecipe || submittingMenuItem}
        existingCategories={existingCategories}
        defaultCategory={prefillCategory}
      />

      <IngredientForm
        open={showIngredientForm}
        onOpenChange={setShowIngredientForm}
        onSubmit={handleAddIngredient}
        isSubmitting={submittingIngredient}
        inventoryItems={inventoryOptions}
      />

      <AlertDialog open={!!deletingMenuItemId} onOpenChange={open => { if (!open) setDeletingMenuItemId(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove from Menu</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure? This will remove the item and its cost breakdown from your menu.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteMenuItem} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
