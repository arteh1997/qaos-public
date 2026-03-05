"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PaymentForm } from "@/components/billing/PaymentForm";
import { CreditCard, Plus, Trash2, Star, Loader2, X } from "lucide-react";
import { PaymentMethod } from "@/types/billing";
import { getCSRFHeaders } from "@/hooks/useCSRF";
import { UseMutationResult } from "@tanstack/react-query";
import { toast } from "sonner";

const BRAND_LABELS: Record<string, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  amex: "Amex",
  discover: "Discover",
  diners: "Diners",
  jcb: "JCB",
  unionpay: "UnionPay",
};

interface PaymentMethodsCardProps {
  paymentMethods: PaymentMethod[];
  isLoading: boolean;
  addPaymentMethod: UseMutationResult<unknown, Error, string, unknown>;
  removePaymentMethod: UseMutationResult<unknown, Error, string, unknown>;
  setDefaultPaymentMethod: UseMutationResult<unknown, Error, string, unknown>;
}

export function PaymentMethodsCard({
  paymentMethods,
  isLoading,
  addPaymentMethod,
  removePaymentMethod,
  setDefaultPaymentMethod,
}: PaymentMethodsCardProps) {
  const [isAddingCard, setIsAddingCard] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [isLoadingSecret, setIsLoadingSecret] = useState(false);

  const handleStartAdd = async () => {
    setIsLoadingSecret(true);
    try {
      const response = await fetch("/api/billing/setup-intent", {
        method: "POST",
        headers: getCSRFHeaders(),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || "Failed to initialize payment form");
      }
      const data = await response.json();
      setClientSecret(data.data.clientSecret);
      setIsAddingCard(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to initialize");
    } finally {
      setIsLoadingSecret(false);
    }
  };

  const handleCardAdded = async (paymentMethodId: string) => {
    await addPaymentMethod.mutateAsync(paymentMethodId);
    setIsAddingCard(false);
    setClientSecret(null);
  };

  const handleCancelAdd = () => {
    setIsAddingCard(false);
    setClientSecret(null);
  };

  return (
    <Card>
      <CardContent className="px-4 pt-4 pb-4 sm:px-6 sm:pt-5 sm:pb-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Payment Methods
          </h3>
          {!isAddingCard && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={handleStartAdd}
              disabled={isLoadingSecret}
            >
              {isLoadingSecret ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <Plus className="h-3 w-3 mr-1" />
              )}
              Add Card
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-14 w-full rounded-md" />
            <Skeleton className="h-14 w-full rounded-md" />
          </div>
        ) : (
          <>
            {/* Card list */}
            {paymentMethods.length > 0 ? (
              <div className="divide-y">
                {paymentMethods.map((pm) => (
                  <div
                    key={pm.id}
                    className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-1.5 bg-muted rounded-md shrink-0">
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">
                            {BRAND_LABELS[pm.brand] || pm.brand} •••• {pm.last4}
                          </span>
                          {pm.is_default && (
                            <Badge
                              variant="outline"
                              className="border-emerald-500/20 bg-emerald-500/10 text-emerald-400 text-[10px] px-1.5 py-0"
                            >
                              Default
                            </Badge>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          Expires {String(pm.exp_month).padStart(2, "0")}/
                          {pm.exp_year}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {!pm.is_default && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-muted-foreground"
                          onClick={() => setDefaultPaymentMethod.mutate(pm.id)}
                          disabled={setDefaultPaymentMethod.isPending}
                        >
                          {setDefaultPaymentMethod.isPending ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <>
                              <Star className="h-3 w-3 mr-1" />
                              <span className="hidden sm:inline">
                                Set Default
                              </span>
                            </>
                          )}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-muted-foreground hover:text-destructive"
                        onClick={() => removePaymentMethod.mutate(pm.id)}
                        disabled={removePaymentMethod.isPending}
                      >
                        {removePaymentMethod.isPending ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Trash2 className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : !isAddingCard ? (
              <div className="text-center py-6">
                <CreditCard className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">
                  No payment methods on file
                </p>
              </div>
            ) : null}

            {/* Inline add card form */}
            {isAddingCard && clientSecret && (
              <div className="mt-3 pt-3 border-t">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-medium">Add New Card</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={handleCancelAdd}
                  >
                    <X className="h-3 w-3 mr-1" />
                    Cancel
                  </Button>
                </div>
                <PaymentForm
                  clientSecret={clientSecret}
                  onSuccess={handleCardAdded}
                  submitLabel="Add Card"
                  isSubmitting={addPaymentMethod.isPending}
                />
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
