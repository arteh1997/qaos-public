"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Calendar, CreditCard, Shield } from "lucide-react";
import {
  BILLING_CONFIG,
  getMonthlyPriceDisplay,
} from "@/lib/stripe/billing-config";

interface BillingInfoCardProps {
  showTrial?: boolean;
  className?: string;
}

export function BillingInfoCard({
  showTrial = true,
  className,
}: BillingInfoCardProps) {
  const monthlyPrice = getMonthlyPriceDisplay();

  return (
    <Card className={className}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl">
              {BILLING_CONFIG.PRODUCT_NAME}
            </CardTitle>
            <CardDescription>
              Everything you need to manage your restaurant
            </CardDescription>
          </div>
          {showTrial && (
            <Badge variant="secondary" className="text-sm">
              30-day free trial
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Price */}
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-bold">{monthlyPrice}</span>
          <span className="text-muted-foreground">/ month / store</span>
        </div>

        {/* Features */}
        <div className="space-y-3">
          <p className="text-sm font-medium text-muted-foreground">
            Everything included:
          </p>
          <ul className="space-y-2">
            {BILLING_CONFIG.FEATURES.map((feature, index) => (
              <li key={index} className="flex items-center gap-2 text-sm">
                <Check className="h-4 w-4 text-green-400 flex-shrink-0" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Billing Info */}
        {showTrial && (
          <div className="space-y-3 pt-4 border-t">
            <p className="text-sm font-medium">How billing works:</p>
            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="flex items-start gap-2">
                <Calendar className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>
                  Your 30-day free trial starts today. You won&apos;t be charged
                  until the trial ends.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <CreditCard className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>
                  After your trial, you&apos;ll be charged {monthlyPrice}{" "}
                  monthly. Cancel anytime.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <Shield className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>
                  We require a card upfront to prevent abuse, but you can cancel
                  before the trial ends.
                </span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
