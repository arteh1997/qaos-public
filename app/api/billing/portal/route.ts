import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe/config";
import { validateCSRFToken } from "@/lib/csrf";

/**
 * POST /api/billing/portal
 * Creates a Stripe Customer Portal session for the authenticated user.
 */
export async function POST(request: NextRequest) {
  const csrfError = await validateCSRFToken(request);
  if (csrfError) return csrfError;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .single();

  if (!profile?.stripe_customer_id) {
    return NextResponse.json(
      { error: "No billing account found" },
      { status: 404 },
    );
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: profile.stripe_customer_id,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/billing`,
  });

  return NextResponse.json({ url: session.url });
}
