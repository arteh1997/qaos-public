import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { exchangeCodeForTokens } from '@/lib/services/accounting/quickbooks'
import { auditLog } from '@/lib/audit'
import { logger } from '@/lib/logger'

/**
 * GET /api/integrations/quickbooks/callback?code=xxx&state=yyy&realmId=zzz
 * QuickBooks OAuth callback — exchanges code for tokens, stores connection.
 *
 * QBO sends realmId as a query parameter (unlike Xero which uses connections endpoint).
 */
export async function GET(request: NextRequest) {
  const supabase = createAdminClient()
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const realmId = searchParams.get('realmId')
  const error = searchParams.get('error')
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin

  // Handle user denial
  if (error) {
    return NextResponse.redirect(
      `${baseUrl}/integrations?error=${encodeURIComponent(error)}`,
      302
    )
  }

  if (!code || !state) {
    return NextResponse.redirect(
      `${baseUrl}/integrations?error=missing_params`,
      302
    )
  }

  if (!realmId) {
    return NextResponse.redirect(
      `${baseUrl}/integrations?error=missing_realm_id`,
      302
    )
  }

  try {
    // Validate state token
    const { data: oauthState, error: stateError } = await supabase
      .from('integration_oauth_states')
      .select('*')
      .eq('state_token', state)
      .eq('provider', 'quickbooks')
      .is('used_at', null)
      .single()

    if (stateError || !oauthState) {
      return NextResponse.redirect(
        `${baseUrl}/integrations?error=invalid_state`,
        302
      )
    }

    // Check expiry
    if (new Date(oauthState.expires_at) < new Date()) {
      return NextResponse.redirect(
        `${baseUrl}/integrations?error=state_expired`,
        302
      )
    }

    // Mark state as used
    await supabase
      .from('integration_oauth_states')
      .update({ used_at: new Date().toISOString() })
      .eq('id', oauthState.id)

    const storeId = (oauthState.redirect_data as Record<string, string>)?.store_id
    if (!storeId) {
      return NextResponse.redirect(
        `${baseUrl}/integrations?error=missing_store`,
        302
      )
    }

    // Exchange code for tokens (QBO includes realmId from the callback URL)
    const credentials = await exchangeCodeForTokens(code, realmId)

    // Upsert accounting connection (one per store+provider)
    const { error: upsertError } = await supabase
      .from('accounting_connections')
      .upsert(
        {
          store_id: storeId,
          provider: 'quickbooks',
          credentials: JSON.parse(JSON.stringify(credentials)),
          is_active: true,
          sync_status: 'idle',
          sync_error: null,
          created_by: oauthState.created_by,
        },
        { onConflict: 'store_id,provider' }
      )

    if (upsertError) {
      return NextResponse.redirect(
        `${baseUrl}/integrations?error=save_failed`,
        302
      )
    }

    await auditLog(supabase, {
      userId: oauthState.created_by,
      storeId,
      action: 'quickbooks.connected',
      details: { realm_id: realmId },
    })

    return NextResponse.redirect(
      `${baseUrl}/integrations/quickbooks?success=connected`,
      302
    )
  } catch (err) {
    logger.error('QuickBooks OAuth callback error:', { error: err })
    return NextResponse.redirect(
      `${baseUrl}/integrations?error=exchange_failed`,
      302
    )
  }
}
