"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";

interface StockUpdateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemName: string;
  currentQuantity: number;
  parLevel: number | null;
  unitOfMeasure: string;
  onSave: (quantity: number) => void;
  isLoading?: boolean;
}

interface StockUpdateFormProps {
  initialQuantity: string;
  currentQuantity: number;
  parLevel: number | null;
  itemName: string;
  unitOfMeasure: string;
  onSave: (quantity: number) => void;
  onOpenChange: (open: boolean) => void;
  isLoading?: boolean;
}

function StockUpdateForm({
  initialQuantity,
  currentQuantity,
  parLevel,
  unitOfMeasure,
  onSave,
  onOpenChange,
  isLoading,
}: StockUpdateFormProps) {
  const [quantity, setQuantity] = useState<string>(initialQuantity);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = parseInt(quantity, 10);
    if (!isNaN(value) && value >= 0) {
      onSave(value);
      onOpenChange(false);
    }
  };

  const newQuantity = parseInt(quantity, 10) || 0;
  const isLowStock = parLevel !== null && newQuantity < parLevel;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Current Stock:</span>
          <span className="font-medium">
            {currentQuantity} {unitOfMeasure}
          </span>
        </div>
        {parLevel !== null && (
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>PAR Level:</span>
            <span className="font-medium">
              {parLevel} {unitOfMeasure}
            </span>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="quantity">New Quantity ({unitOfMeasure})</Label>
        <Input
          id="quantity"
          type="number"
          min="0"
          step="1"
          placeholder="Enter new quantity"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === ".") e.preventDefault();
          }}
          onFocus={(e) => e.target.select()}
          autoFocus
        />
        {isLowStock && (
          <p className="text-xs text-destructive">
            Warning: This quantity is below the PAR level of {parLevel}.
          </p>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => onOpenChange(false)}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading || quantity === ""}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Update
        </Button>
      </div>
    </form>
  );
}

export function StockUpdateDialog({
  open,
  onOpenChange,
  itemName,
  currentQuantity,
  parLevel,
  unitOfMeasure,
  onSave,
  isLoading,
}: StockUpdateDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Update Stock</DialogTitle>
          <DialogDescription>
            Update the current stock level for <strong>{itemName}</strong>.
          </DialogDescription>
        </DialogHeader>
        {/* key forces the form to remount with fresh state when the dialog opens */}
        <StockUpdateForm
          key={`${open}-${currentQuantity}`}
          initialQuantity={currentQuantity.toString()}
          currentQuantity={currentQuantity}
          parLevel={parLevel}
          itemName={itemName}
          unitOfMeasure={unitOfMeasure}
          onSave={onSave}
          onOpenChange={onOpenChange}
          isLoading={isLoading}
        />
      </DialogContent>
    </Dialog>
  );
}
