import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { exchangeCodeForTokens } from "@/lib/services/accounting/wave";
import { auditLog } from "@/lib/audit";
import { logger } from "@/lib/logger";

/**
 * GET /api/integrations/wave/callback?code=xxx&state=yyy
 * Wave OAuth callback — exchanges code for tokens, stores connection.
 */
export async function GET(request: NextRequest) {
  const supabase = createAdminClient();
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;

  if (error) {
    return NextResponse.redirect(
      `${baseUrl}/integrations?error=${encodeURIComponent(error)}`,
      302,
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      `${baseUrl}/integrations?error=missing_params`,
      302,
    );
  }

  try {
    const { data: oauthState, error: stateError } = await supabase
      .from("integration_oauth_states")
      .select("*")
      .eq("state_token", state)
      .eq("provider", "wave")
      .is("used_at", null)
      .single();

    if (stateError || !oauthState) {
      return NextResponse.redirect(
        `${baseUrl}/integrations?error=invalid_state`,
        302,
      );
    }

    if (new Date(oauthState.expires_at) < new Date()) {
      return NextResponse.redirect(
        `${baseUrl}/integrations?error=state_expired`,
        302,
      );
    }

    await supabase
      .from("integration_oauth_states")
      .update({ used_at: new Date().toISOString() })
      .eq("id", oauthState.id);

    const storeId = (oauthState.redirect_data as Record<string, string>)
      ?.store_id;
    if (!storeId) {
      return NextResponse.redirect(
        `${baseUrl}/integrations?error=missing_store`,
        302,
      );
    }

    const credentials = await exchangeCodeForTokens(code);

    const { error: upsertError } = await supabase
      .from("accounting_connections")
      .upsert(
        {
          store_id: storeId,
          provider: "wave",
          credentials: JSON.parse(JSON.stringify(credentials)),
          is_active: true,
          sync_status: "idle",
          sync_error: null,
          created_by: oauthState.created_by,
        },
        { onConflict: "store_id,provider" },
      );

    if (upsertError) {
      return NextResponse.redirect(
        `${baseUrl}/integrations?error=save_failed`,
        302,
      );
    }

    await auditLog(supabase, {
      userId: oauthState.created_by,
      storeId,
      action: "wave.connected",
      details: { business_id: credentials.tenant_id },
    });

    return NextResponse.redirect(
      `${baseUrl}/integrations/wave?success=connected`,
      302,
    );
  } catch (err) {
    logger.error("Wave OAuth callback error:", { error: err });
    return NextResponse.redirect(
      `${baseUrl}/integrations?error=exchange_failed`,
      302,
    );
  }
}
