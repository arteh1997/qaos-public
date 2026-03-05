"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  CreditCard,
  Shield,
  Check,
  Loader2,
  AlertCircle,
  Clock,
  TrendingDown,
  Users,
  Package,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { getCSRFHeaders } from "@/hooks/useCSRF";
import {
  BILLING_CONFIG,
  getMonthlyPriceDisplay,
} from "@/lib/stripe/billing-config";
import Link from "next/link";

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "",
);

interface PageProps {
  params: Promise<{ storeId: string }>;
}

function PaymentForm({
  storeId,
  onSuccess,
  storeName,
}: {
  storeId: string;
  onSuccess: () => void;
  storeName: string;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const monthlyPrice = getMonthlyPriceDisplay();

  const trialEndDate = new Date(
    Date.now() + BILLING_CONFIG.TRIAL_DAYS * 24 * 60 * 60 * 1000,
  );
  const formattedTrialEndDate = trialEndDate.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Confirm the setup intent
      const { error: confirmError, setupIntent } = await stripe.confirmSetup({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/billing`,
        },
        redirect: "if_required",
      });

      if (confirmError) {
        throw new Error(
          confirmError.message || "Failed to confirm payment method",
        );
      }

      if (!setupIntent || !setupIntent.payment_method) {
        throw new Error("No payment method returned");
      }

      // Create the subscription
      const subscriptionResponse = await fetch("/api/billing/subscriptions", {
        method: "POST",
        headers: getCSRFHeaders(),
        body: JSON.stringify({
          store_id: storeId,
          payment_method_id: setupIntent.payment_method,
        }),
      });

      if (!subscriptionResponse.ok) {
        const data = await subscriptionResponse.json();
        throw new Error(data.message || "Failed to create subscription");
      }

      toast.success(`Trial started! Welcome to Qaos.`);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <PaymentElement
        options={{
          layout: "tabs",
          // Disable Link to remove confusion
          wallets: {
            applePay: "never",
            googlePay: "never",
          },
        }}
      />

      <Button
        type="submit"
        className="w-full bg-blue-600 hover:bg-blue-700"
        size="lg"
        disabled={!stripe || !elements || isSubmitting}
      >
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Starting Your Trial...
          </>
        ) : (
          <>
            <Sparkles className="mr-2 h-5 w-5" />
            Start Free Trial
          </>
        )}
      </Button>

      <div className="space-y-2">
        <div className="flex items-center justify-center gap-2 text-sm">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <span className="font-medium text-emerald-700">
            £0.00 charged today
          </span>
        </div>
        <p className="text-xs text-center text-muted-foreground">
          Your trial starts now. First charge:{" "}
          <span className="font-medium">{monthlyPrice}</span> on{" "}
          <span className="font-medium">{formattedTrialEndDate}</span>
          <br />
          Cancel anytime before then - No questions asked
        </p>
      </div>
    </form>
  );
}

export default function SubscribePage({ params }: PageProps) {
  const { storeId } = use(params);
  const router = useRouter();
  const { stores, isLoading: authLoading } = useAuth();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const store = stores?.find((s) => s.store_id === storeId);
  const isOwner = store?.role === "Owner";
  const monthlyPrice = getMonthlyPriceDisplay();

  useEffect(() => {
    async function createSetupIntent() {
      if (authLoading) return;

      if (!isOwner) {
        setError("Only store owners can manage subscriptions");
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch("/api/billing/setup-intent", {
          method: "POST",
          headers: getCSRFHeaders(),
        });

        if (!response.ok) {
          throw new Error("Failed to initialize payment");
        }

        const data = await response.json();
        setClientSecret(data.data.clientSecret);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load payment form",
        );
      } finally {
        setIsLoading(false);
      }
    }

    createSetupIntent();
  }, [authLoading, isOwner]);

  const handleSuccess = () => {
    router.push("/billing");
  };

  if (authLoading || isLoading) {
    return (
      <div className="max-w-6xl mx-auto px-4 space-y-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto px-4 space-y-6">
        <Button variant="ghost" asChild>
          <Link href="/billing">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Billing
          </Link>
        </Button>

        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* Back Button */}
        <Button variant="ghost" asChild>
          <Link href="/billing">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Billing
          </Link>
        </Button>

        {/* Hero Section */}
        <div className="text-center space-y-4">
          <Badge className="bg-blue-100 text-blue-700 border-blue-200 px-4 py-1">
            <Sparkles className="h-3 w-3 mr-1" />
            {BILLING_CONFIG.TRIAL_DAYS}-Day Free Trial
          </Badge>
          <h1 className="text-2xl sm:text-4xl font-bold tracking-tight">
            Start Managing{" "}
            <span className="text-blue-600">{store?.store?.name}</span>
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto px-4">
            Join hundreds of teams saving time and reducing waste with smart
            inventory management
          </p>
        </div>

        {/* Two-Column Layout */}
        <div className="grid lg:grid-cols-5 gap-8">
          {/* LEFT: Value Proposition (2/5) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Key Benefits */}
            <Card className="bg-gradient-to-br from-emerald-50 to-white border-emerald-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-emerald-900">
                  <TrendingDown className="h-5 w-5" />
                  What You&apos;ll Get
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="p-1.5 bg-emerald-100 rounded">
                      <Clock className="h-4 w-4 text-emerald-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">
                        Save 15+ Hours/Month
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Automated tracking replaces manual spreadsheets
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="p-1.5 bg-emerald-100 rounded">
                      <TrendingDown className="h-4 w-4 text-emerald-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">
                        Reduce Waste by 23%
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Smart alerts prevent overstocking and spoilage
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="p-1.5 bg-emerald-100 rounded">
                      <Users className="h-4 w-4 text-emerald-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">Manage Your Team</p>
                      <p className="text-xs text-muted-foreground">
                        Schedule shifts, track attendance, real-time updates
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="p-1.5 bg-emerald-100 rounded">
                      <Package className="h-4 w-4 text-emerald-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">
                        Real-Time Inventory
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Know exactly what&apos;s in stock, from anywhere
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* What's Included */}
            <Card className="bg-card">
              <CardHeader>
                <CardTitle className="text-base">Everything Included</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-600" />
                    <span>Unlimited team members</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-600" />
                    <span>Unlimited inventory items</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-600" />
                    <span>Stock counts & receptions</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-600" />
                    <span>Shift scheduling & management</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-600" />
                    <span>Usage reports & analytics</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* RIGHT: Checkout Form (3/5) */}
          <div className="lg:col-span-3 space-y-6">
            {/* Pricing Summary Card */}
            <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-white">
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Professional Plan
                      </p>
                      <p className="text-2xl sm:text-3xl font-bold text-slate-900">
                        {monthlyPrice}
                        <span className="text-base font-normal text-muted-foreground">
                          /month
                        </span>
                      </p>
                    </div>
                    <Badge className="bg-emerald-100 text-emerald-700 border-emerald-300 text-base sm:text-lg px-3 py-1 w-fit">
                      Free for {BILLING_CONFIG.TRIAL_DAYS} days
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t">
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1 text-emerald-700 font-semibold">
                        <CheckCircle2 className="h-4 w-4" />
                        <span>£0</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Due Today
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="font-semibold">
                        {BILLING_CONFIG.TRIAL_DAYS} Days
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Free Trial
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="font-semibold">{monthlyPrice}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        After Trial
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Payment Form Card */}
            <Card className="bg-card">
              <CardHeader>
                <CardTitle>Payment Details</CardTitle>
                <CardDescription>
                  Secure checkout • We&apos;ll only charge you after your free
                  trial
                </CardDescription>
              </CardHeader>
              <CardContent>
                {clientSecret && (
                  <Elements
                    stripe={stripePromise}
                    options={{
                      clientSecret,
                      appearance: {
                        theme: "stripe",
                        variables: {
                          colorPrimary: "#2563eb",
                          borderRadius: "8px",
                        },
                      },
                    }}
                  >
                    <PaymentForm
                      storeId={storeId}
                      onSuccess={handleSuccess}
                      storeName={store?.store?.name || "your store"}
                    />
                  </Elements>
                )}
              </CardContent>
            </Card>

            {/* Trust Signals */}
            <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground py-4">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-blue-600" />
                <span>256-bit SSL encryption</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span>Cancel anytime</span>
              </div>
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-slate-600" />
                <span>Powered by Stripe</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer FAQ */}
        <Card className="bg-slate-50 border-slate-200 mt-12">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
              <div>
                <p className="font-semibold mb-2">
                  What happens after the trial?
                </p>
                <p className="text-muted-foreground text-xs">
                  You&apos;ll be charged {monthlyPrice}/month automatically.
                  Cancel anytime before trial ends to avoid charges.
                </p>
              </div>
              <div>
                <p className="font-semibold mb-2">Can I cancel anytime?</p>
                <p className="text-muted-foreground text-xs">
                  Yes! Cancel from your billing page with one click. No
                  contracts, no commitments, no questions.
                </p>
              </div>
              <div>
                <p className="font-semibold mb-2">Is my payment secure?</p>
                <p className="text-muted-foreground text-xs">
                  Absolutely. We use Stripe for payments - the same secure
                  platform trusted by Amazon, Google, and millions of
                  businesses.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
