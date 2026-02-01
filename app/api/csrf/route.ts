import { NextResponse } from 'next/server'
import { getCSRFToken } from '@/lib/csrf'

/**
 * GET /api/csrf - Get a CSRF token
 *
 * This endpoint sets the CSRF token cookie and returns success.
 * The cookie is httpOnly, so the client reads it from cookies
 * and sends it back in the x-csrf-token header.
 */
export async function GET() {
  try {
    // This will set the cookie if not already set
    await getCSRFToken()

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[CSRF] Error generating token:', error)
    return NextResponse.json(
      { success: false, message: 'Failed to generate CSRF token' },
      { status: 500 }
    )
  }
}
