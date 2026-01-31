import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { LowStockItem } from '@/types'
import { AlertTriangle } from 'lucide-react'

interface LowStockCardProps {
  items: LowStockItem[]
  maxItems?: number
}

export function LowStockCard({ items, maxItems = 5 }: LowStockCardProps) {
  const displayItems = items.slice(0, maxItems)

  return (
    <Card className="border-yellow-500/50">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-yellow-500" />
          <CardTitle className="text-base">Low Stock Alerts</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {displayItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">No low stock alerts</p>
        ) : (
          <div className="space-y-3">
            {displayItems.map((item, index) => (
              <div
                key={`${item.store_id}-${item.inventory_item_id}`}
                className="flex items-center justify-between text-sm"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{item.item_name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {item.store_name}
                  </p>
                </div>
                <Badge variant="destructive" className="ml-2 flex-shrink-0">
                  -{item.shortage.toFixed(1)}
                </Badge>
              </div>
            ))}
            {items.length > maxItems && (
              <p className="text-xs text-muted-foreground text-center pt-2">
                +{items.length - maxItems} more items
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
