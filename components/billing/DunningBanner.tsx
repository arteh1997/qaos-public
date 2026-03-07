"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useBilling } from "@/hooks/useBilling";
import { getCSRFHeaders } from "@/hooks/useCSRF";
import { DUNNING_GRACE_PERIOD_DAYS } from "@/lib/stripe/billing-config";

export function DunningBanner() {
  const { subscriptions, isLoading } = useBilling();
  const [isRedirecting, setIsRedirecting] = useState(false);

  const pastDueSubscription = subscriptions.find(
    (sub) => sub.status === "past_due",
  );

  if (isLoading || !pastDueSubscription) return null;

  const updatedAt = new Date(pastDueSubscription.updated_at);
  const graceDeadline = new Date(
    updatedAt.getTime() + DUNNING_GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000,
  );
  const now = new Date();
  const daysRemaining = Math.max(
    0,
    Math.ceil(
      (graceDeadline.getTime() - now.getTime()) / (24 * 60 * 60 * 1000),
    ),
  );

  async function handleUpdatePayment() {
    setIsRedirecting(true);
    try {
      const res = await fetch("/api/billing/portal", {
        method: "POST",
        headers: getCSRFHeaders(),
      });
      if (!res.ok) {
        setIsRedirecting(false);
        return;
      }
      const { url } = await res.json();
      window.location.href = url;
    } catch {
      setIsRedirecting(false);
    }
  }

  return (
    <Alert variant="destructive" className="mb-6">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Payment failed</AlertTitle>
      <AlertDescription>
        <p>
          Your latest payment could not be processed.
          {daysRemaining > 0
            ? ` You have ${daysRemaining} day${daysRemaining === 1 ? "" : "s"} to update your payment method before your subscription is downgraded.`
            : " Your grace period has expired. Please update your payment method to restore full access."}
        </p>
        <div className="mt-3 flex gap-3">
          <Button
            size="sm"
            variant="destructive"
            onClick={handleUpdatePayment}
            disabled={isRedirecting}
          >
            {isRedirecting ? "Redirecting..." : "Update Payment Method"}
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
