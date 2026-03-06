"use client";

import { useAuth } from "@/hooks/useAuth";
import { useBilling } from "@/hooks/useBilling";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { StoreSubscriptionList } from "@/components/billing/StoreSubscriptionList";
import { PaymentMethodsCard } from "@/components/billing/PaymentMethodsCard";
import { InvoiceHistory } from "@/components/billing/InvoiceHistory";
import { AlertCircle } from "lucide-react";
import { PageGuide } from "@/components/help/PageGuide";

export default function BillingPage() {
  const { stores, isLoading: authLoading } = useAuth();
  const {
    subscriptions,
    paymentMethods,
    invoices,
    isLoading,
    error,
    addPaymentMethod,
    removePaymentMethod,
    setDefaultPaymentMethod,
    cancelSubscription,
    reactivateSubscription,
    refreshSubscriptions,
  } = useBilling();

  const billingOwnerStores = stores?.filter((s) => s.is_billing_owner) || [];
  const isOwnerButNotBillingOwner =
    !authLoading &&
    billingOwnerStores.length === 0 &&
    (stores?.some((s) => s.role === "Owner") ?? false);

  if (authLoading || isLoading) {
    return (
      <div className="space-y-6 max-w-4xl">
        <div>
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-72 mt-1.5" />
        </div>
        <Skeleton className="h-48 w-full rounded-lg" />
        <Skeleton className="h-40 w-full rounded-lg" />
        <Skeleton className="h-44 w-full rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">
            Billing
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage your subscriptions and payment methods
          </p>
        </div>
        <PageGuide pageKey="billing" />
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      )}

      {isOwnerButNotBillingOwner && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            You are an Owner of this store, but billing is managed by another
            owner. Only the designated billing owner can manage subscriptions
            and payment methods.
          </AlertDescription>
        </Alert>
      )}

      {!isOwnerButNotBillingOwner && (
        <>
          <StoreSubscriptionList
            subscriptions={subscriptions}
            ownerStores={billingOwnerStores}
            cancelSubscription={cancelSubscription}
            reactivateSubscription={reactivateSubscription}
            hasPaymentMethod={paymentMethods.length > 0}
            onSubscriptionsChanged={() => refreshSubscriptions()}
          />

          <PaymentMethodsCard
            paymentMethods={paymentMethods}
            isLoading={false}
            addPaymentMethod={addPaymentMethod}
            removePaymentMethod={removePaymentMethod}
            setDefaultPaymentMethod={setDefaultPaymentMethod}
          />

          <InvoiceHistory invoices={invoices} isLoading={false} />
        </>
      )}
    </div>
  );
}
