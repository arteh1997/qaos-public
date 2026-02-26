import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdapter, POS_PROVIDERS } from '@/lib/services/pos'
import { auditLog } from '@/lib/audit'
import { logger } from '@/lib/logger'

interface RouteParams {
  params: Promise<{ provider: string }>
}

/**
 * GET /api/integrations/pos/[provider]/callback?code=xxx&state=yyy
 * POS OAuth callback — exchanges code for tokens, creates/updates connection.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { provider } = await params
  const supabase = createAdminClient()
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin

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

  try {
    // Validate state token
    const { data: oauthState, error: stateError } = await supabase
      .from('integration_oauth_states')
      .select('*')
      .eq('state_token', state)
      .eq('provider', provider)
      .is('used_at', null)
      .single()

    if (stateError || !oauthState) {
      return NextResponse.redirect(`${baseUrl}/integrations?error=invalid_state`, 302)
    }

    if (new Date(oauthState.expires_at) < new Date()) {
      return NextResponse.redirect(`${baseUrl}/integrations?error=state_expired`, 302)
    }

    // Mark state as used
    await supabase
      .from('integration_oauth_states')
      .update({ used_at: new Date().toISOString() })
      .eq('id', oauthState.id)

    const storeId = (oauthState.redirect_data as Record<string, string>)?.store_id
    if (!storeId) {
      return NextResponse.redirect(`${baseUrl}/integrations?error=missing_store`, 302)
    }

    // Exchange code for tokens
    const adapter = getAdapter(provider)
    if (!adapter?.exchangeCode) {
      return NextResponse.redirect(`${baseUrl}/integrations?error=unsupported_provider`, 302)
    }

    const tokens = await adapter.exchangeCode(code)
    const providerInfo = POS_PROVIDERS[provider]

    // Create POS connection
    const { error: insertError } = await supabase
      .from('pos_connections')
      .insert({
        store_id: storeId,
        provider,
        name: providerInfo?.name || provider,
        is_active: true,
        credentials: JSON.parse(JSON.stringify(tokens)),
        config: {},
        sync_status: 'pending',
        created_by: oauthState.created_by,
      })

    if (insertError) {
      return NextResponse.redirect(`${baseUrl}/integrations?error=save_failed`, 302)
    }

    await auditLog(supabase, {
      userId: oauthState.created_by,
      storeId,
      action: 'pos.connected',
      details: { provider, merchant_id: tokens.merchant_id },
    })

    return NextResponse.redirect(
      `${baseUrl}/stores/${storeId}/pos?success=connected&provider=${provider}`,
      302
    )
  } catch (err) {
    logger.error(`POS OAuth callback error (${provider}):`, { error: err })
    return NextResponse.redirect(`${baseUrl}/integrations?error=exchange_failed`, 302)
  }
}
