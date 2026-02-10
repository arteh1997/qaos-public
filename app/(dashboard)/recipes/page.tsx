'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useRecipes, useRecipeDetail } from '@/hooks/useRecipes'
import { useMenuAnalysis, useMenuItems } from '@/hooks/useMenuAnalysis'
import { useStoreInventory } from '@/hooks/useStoreInventory'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { RecipeForm } from '@/components/recipes/RecipeForm'
import { IngredientForm } from '@/components/recipes/IngredientForm'
import { MenuItemForm } from '@/components/recipes/MenuItemForm'
import {
  ChefHat, Plus, ArrowLeft, DollarSign, AlertTriangle,
  TrendingUp, Trash2, UtensilsCrossed,
} from 'lucide-react'
import { toast } from 'sonner'

const RATING_COLORS: Record<string, string> = {
  excellent: 'bg-green-100 text-green-800',
  good: 'bg-blue-100 text-blue-800',
  fair: 'bg-yellow-100 text-yellow-800',
  poor: 'bg-red-100 text-red-800',
  no_recipe: 'bg-gray-100 text-gray-800',
}

export default function RecipesPage() {
  const { currentStore, role } = useAuth()
  const storeId = currentStore?.store_id ?? null

  const {
    recipes, isLoading: loadingRecipes, fetchRecipes,
    createRecipe, deleteRecipe, isSubmitting: submittingRecipe,
  } = useRecipes(storeId)

  const { analysis, isLoading: loadingAnalysis, fetchAnalysis } = useMenuAnalysis(storeId)
  const {
    menuItems, isLoading: loadingMenuItems, fetchMenuItems,
    createMenuItem, deleteMenuItem, isSubmitting: submittingMenuItem,
  } = useMenuItems(storeId)

  const { inventory } = useStoreInventory(storeId)

  // Recipe detail
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null)
  const {
    recipe: recipeDetail, isLoading: loadingDetail, fetchRecipe,
    addIngredient, removeIngredient, isSubmitting: submittingIngredient,
  } = useRecipeDetail(storeId, selectedRecipeId)

  const [showRecipeForm, setShowRecipeForm] = useState(false)
  const [showIngredientForm, setShowIngredientForm] = useState(false)
  const [showMenuItemForm, setShowMenuItemForm] = useState(false)
  const [deletingRecipeId, setDeletingRecipeId] = useState<string | null>(null)
  const [deletingMenuItemId, setDeletingMenuItemId] = useState<string | null>(null)

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

  if (role !== 'Owner' && role !== 'Manager') {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Recipes & Menu Analysis</h1>
        <Card><CardContent className="pt-6 text-center text-muted-foreground">This feature is only available to Owners and Managers.</CardContent></Card>
      </div>
    )
  }

  if (!storeId) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Recipes & Menu Analysis</h1>
        <Card><CardContent className="pt-6 text-center text-muted-foreground">Select a store to manage recipes.</CardContent></Card>
      </div>
    )
  }

  const handleCreateRecipe = async (data: Parameters<typeof createRecipe>[0]) => {
    try {
      await createRecipe(data)
      toast.success('Recipe created')
      fetchRecipes()
    } catch { toast.error('Failed to create recipe') }
  }

  const handleDeleteRecipe = async () => {
    if (!deletingRecipeId) return
    try {
      await deleteRecipe(deletingRecipeId)
      toast.success('Recipe deleted')
      setDeletingRecipeId(null)
      fetchRecipes()
    } catch { toast.error('Failed to delete recipe') }
  }

  const handleAddIngredient = async (data: Parameters<typeof addIngredient>[0]) => {
    try {
      await addIngredient(data)
      toast.success('Ingredient added')
      fetchRecipe()
    } catch { toast.error('Failed to add ingredient') }
  }

  const handleRemoveIngredient = async (ingredientId: string) => {
    try {
      await removeIngredient(ingredientId)
      toast.success('Ingredient removed')
      fetchRecipe()
    } catch { toast.error('Failed to remove ingredient') }
  }

  const handleCreateMenuItem = async (data: Parameters<typeof createMenuItem>[0]) => {
    try {
      await createMenuItem(data)
      toast.success('Menu item added')
      fetchMenuItems()
      fetchAnalysis()
    } catch { toast.error('Failed to add menu item') }
  }

  const handleDeleteMenuItem = async () => {
    if (!deletingMenuItemId) return
    try {
      await deleteMenuItem(deletingMenuItemId)
      toast.success('Menu item deleted')
      setDeletingMenuItemId(null)
      fetchMenuItems()
      fetchAnalysis()
    } catch { toast.error('Failed to delete menu item') }
  }

  const inventoryOptions = inventory
    .filter(i => i.inventory_item)
    .map(i => ({ id: i.inventory_item_id, name: i.inventory_item!.name, unit_of_measure: i.inventory_item!.unit_of_measure }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ChefHat className="h-6 w-6" />
          Recipes & Menu Analysis
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Manage recipes and analyze menu profitability for {currentStore?.store?.name ?? 'your store'}
        </p>
      </div>

      <Tabs defaultValue="recipes">
        <TabsList>
          <TabsTrigger value="recipes">Recipes</TabsTrigger>
          <TabsTrigger value="menu">Menu Analysis</TabsTrigger>
        </TabsList>

        {/* Recipes Tab */}
        <TabsContent value="recipes" className="space-y-4">
          {/* Recipe Detail */}
          {selectedRecipeId && recipeDetail ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Button variant="ghost" size="icon" onClick={() => setSelectedRecipeId(null)}>
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <div>
                    <h2 className="text-lg font-semibold">{recipeDetail.name}</h2>
                    {recipeDetail.category && <p className="text-sm text-muted-foreground">{recipeDetail.category}</p>}
                  </div>
                </div>
                <Button size="sm" onClick={() => setShowIngredientForm(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Ingredient
                </Button>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-xs text-muted-foreground">Total Cost</p>
                    <p className="text-xl font-bold">${recipeDetail.total_cost.toFixed(2)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-xs text-muted-foreground">Cost per {recipeDetail.yield_unit}</p>
                    <p className="text-xl font-bold">${recipeDetail.cost_per_unit.toFixed(2)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-xs text-muted-foreground">Yield</p>
                    <p className="text-xl font-bold">{recipeDetail.yield_quantity} {recipeDetail.yield_unit}</p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Ingredients</CardTitle>
                </CardHeader>
                <CardContent>
                  {recipeDetail.ingredients.length === 0 ? (
                    <EmptyState
                      icon={UtensilsCrossed}
                      title="No ingredients"
                      description="Add ingredients to calculate recipe costs."
                      action={{ label: 'Add Ingredient', onClick: () => setShowIngredientForm(true), icon: Plus }}
                    />
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Item</TableHead>
                          <TableHead className="text-right">Quantity</TableHead>
                          <TableHead>Unit</TableHead>
                          <TableHead className="text-right">Unit Cost</TableHead>
                          <TableHead className="text-right">Line Cost</TableHead>
                          <TableHead className="w-[50px]" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {recipeDetail.ingredients.map(ing => (
                          <TableRow key={ing.id}>
                            <TableCell className="font-medium">{ing.inventory_item?.name ?? 'Unknown'}</TableCell>
                            <TableCell className="text-right">{ing.quantity}</TableCell>
                            <TableCell>{ing.unit_of_measure}</TableCell>
                            <TableCell className="text-right">${(ing.unit_cost ?? 0).toFixed(2)}</TableCell>
                            <TableCell className="text-right font-medium">${(ing.line_cost ?? 0).toFixed(2)}</TableCell>
                            <TableCell>
                              <Button variant="ghost" size="icon" onClick={() => handleRemoveIngredient(ing.id)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="font-bold">
                          <TableCell colSpan={4} className="text-right">Total</TableCell>
                          <TableCell className="text-right">${recipeDetail.total_cost.toFixed(2)}</TableCell>
                          <TableCell />
                        </TableRow>
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-end">
                <Button onClick={() => setShowRecipeForm(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Recipe
                </Button>
              </div>

              {loadingRecipes ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Card key={i}><CardContent className="pt-4"><Skeleton className="h-24 w-full" /></CardContent></Card>
                  ))}
                </div>
              ) : recipes.length === 0 ? (
                <EmptyState
                  icon={ChefHat}
                  title="No recipes yet"
                  description="Create your first recipe to start tracking food costs."
                  action={{ label: 'Add Recipe', onClick: () => setShowRecipeForm(true), icon: Plus }}
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {recipes.map(recipe => (
                    <Card
                      key={recipe.id}
                      className="cursor-pointer transition-colors hover:border-primary/50"
                      onClick={() => setSelectedRecipeId(recipe.id)}
                    >
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-medium">{recipe.name}</h3>
                            {recipe.category && <p className="text-sm text-muted-foreground">{recipe.category}</p>}
                          </div>
                          <Button variant="ghost" size="icon" onClick={e => { e.stopPropagation(); setDeletingRecipeId(recipe.id) }}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                        <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t">
                          <div>
                            <p className="text-xs text-muted-foreground">Cost</p>
                            <p className="text-sm font-medium">${(recipe.total_cost ?? 0).toFixed(2)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Per Unit</p>
                            <p className="text-sm font-medium">${(recipe.cost_per_unit ?? 0).toFixed(2)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Items</p>
                            <p className="text-sm font-medium">{recipe.ingredient_count}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* Menu Analysis Tab */}
        <TabsContent value="menu" className="space-y-4">
          <div className="flex items-center justify-end">
            <Button onClick={() => setShowMenuItemForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Menu Item
            </Button>
          </div>

          {/* Summary Cards */}
          {loadingAnalysis ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Card key={i}><CardContent className="pt-4"><Skeleton className="h-12 w-full" /></CardContent></Card>
              ))}
            </div>
          ) : analysis ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <DollarSign className="h-4 w-4" />
                      Avg Food Cost %
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
                    <p className="text-2xl font-bold mt-1 text-orange-600">{analysis.cost_alerts.length}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <TrendingUp className="h-4 w-4" />
                      Total Profit
                    </div>
                    <p className="text-2xl font-bold mt-1 text-green-600">${analysis.summary.total_profit.toFixed(2)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-sm text-muted-foreground">Ratings</div>
                    <div className="flex items-center gap-1 mt-1">
                      {Object.entries(analysis.summary.rating_distribution).map(([key, val]) => (
                        val > 0 && (
                          <Badge key={key} variant="secondary" className={RATING_COLORS[key]}>
                            {val}
                          </Badge>
                        )
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Menu Items Table */}
              {analysis.items.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium">Menu Items</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Item</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead className="text-right">Selling Price</TableHead>
                          <TableHead className="text-right">Food Cost</TableHead>
                          <TableHead className="text-right">Food Cost %</TableHead>
                          <TableHead className="text-right">Profit</TableHead>
                          <TableHead>Rating</TableHead>
                          <TableHead className="w-[50px]" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {analysis.items.map(item => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.name}</TableCell>
                            <TableCell>{item.category ?? '-'}</TableCell>
                            <TableCell className="text-right">${item.selling_price.toFixed(2)}</TableCell>
                            <TableCell className="text-right">${item.food_cost.toFixed(2)}</TableCell>
                            <TableCell className="text-right">{item.food_cost_percentage.toFixed(1)}%</TableCell>
                            <TableCell className="text-right text-green-600">${item.profit_margin.toFixed(2)}</TableCell>
                            <TableCell>
                              <Badge variant="secondary" className={RATING_COLORS[item.rating]}>
                                {item.rating.replace('_', ' ')}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Button variant="ghost" size="icon" onClick={() => setDeletingMenuItemId(item.id)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}

              {/* Category Breakdown */}
              {analysis.categories.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium">Category Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
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
                            <TableCell className="text-right">${cat.total_revenue.toFixed(2)}</TableCell>
                            <TableCell className="text-right text-green-600">${cat.total_profit.toFixed(2)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}

              {/* Cost Alerts */}
              {analysis.cost_alerts.length > 0 && (
                <Card className="border-amber-300">
                  <CardHeader>
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                      Cost Alerts - Items Exceeding Target ({analysis.summary.target_food_cost_percentage}%)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {analysis.cost_alerts.map(item => (
                        <div key={item.id} className="flex items-center justify-between p-2 rounded-lg bg-amber-50">
                          <span className="font-medium">{item.name}</span>
                          <div className="flex items-center gap-4">
                            <span className="text-sm text-muted-foreground">Food Cost: {item.food_cost_percentage.toFixed(1)}%</span>
                            <Badge variant="secondary" className="bg-red-100 text-red-800">
                              +{(item.food_cost_percentage - analysis.summary.target_food_cost_percentage).toFixed(1)}% over target
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <EmptyState
              icon={UtensilsCrossed}
              title="No menu analysis data"
              description="Add menu items linked to recipes to see profitability analysis."
              action={{ label: 'Add Menu Item', onClick: () => setShowMenuItemForm(true), icon: Plus }}
            />
          )}
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <RecipeForm
        open={showRecipeForm}
        onOpenChange={setShowRecipeForm}
        onSubmit={handleCreateRecipe}
        isSubmitting={submittingRecipe}
      />

      <IngredientForm
        open={showIngredientForm}
        onOpenChange={setShowIngredientForm}
        onSubmit={handleAddIngredient}
        isSubmitting={submittingIngredient}
        inventoryItems={inventoryOptions}
      />

      <MenuItemForm
        open={showMenuItemForm}
        onOpenChange={setShowMenuItemForm}
        onSubmit={handleCreateMenuItem}
        isSubmitting={submittingMenuItem}
        recipes={recipes}
      />

      <AlertDialog open={!!deletingRecipeId} onOpenChange={open => { if (!open) setDeletingRecipeId(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Recipe</AlertDialogTitle>
            <AlertDialogDescription>Are you sure? This will remove the recipe and all its ingredients.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteRecipe} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deletingMenuItemId} onOpenChange={open => { if (!open) setDeletingMenuItemId(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Menu Item</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to remove this menu item?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteMenuItem} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
