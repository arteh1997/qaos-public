import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'

// Initialize Resend client (will be undefined if API key not set)
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

// Email configuration
const EMAIL_FROM = process.env.EMAIL_FROM || 'Restaurant Inventory <noreply@example.com>'
const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'Restaurant Inventory'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

interface SendEmailOptions {
  to: string
  subject: string
  html: string
  text?: string
}

export async function sendEmail({ to, subject, html, text }: SendEmailOptions): Promise<{ success: boolean; error?: string }> {
  if (!resend) {
    logger.warn('[Email] Resend not configured. Email would have been sent to:', to)
    logger.warn('[Email] Subject:', subject)
    // In development, log the email content
    if (process.env.NODE_ENV === 'development') {
      console.log('[Email] HTML content:', html)
    }
    return { success: true } // Return success in dev to not block the flow
  }

  try {
    const { error } = await resend.emails.send({
      from: EMAIL_FROM,
      to,
      subject,
      html,
      text: text || stripHtml(html),
    })

    if (error) {
      logger.error('[Email] Send error:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (err) {
    logger.error('[Email] Exception:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Failed to send email' }
  }
}

// Simple HTML to text conversion
function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// Helper functions for billing emails
export async function getBillingUserEmail(userId: string): Promise<string | null> {
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', userId)
      .single()

    if (error || !data) {
      logger.error('[Email] Failed to get billing user email:', error)
      return null
    }

    return data.email
  } catch (err) {
    logger.error('[Email] Exception getting billing user email:', err)
    return null
  }
}

export async function getStoreAndBillingInfo(storeId: string): Promise<{
  storeName: string
  billingUserEmail: string | null
} | null> {
  try {
    const supabase = createAdminClient()
    const { data: storeData, error: storeError } = await supabase
      .from('stores')
      .select('name, billing_user_id')
      .eq('id', storeId)
      .single()

    if (storeError || !storeData) {
      logger.error('[Email] Failed to get store data:', storeError)
      return null
    }

    if (!storeData.billing_user_id) {
      logger.warn('[Email] Store has no billing user:', storeId)
      return { storeName: storeData.name, billingUserEmail: null }
    }

    const billingUserEmail = await getBillingUserEmail(storeData.billing_user_id)

    return {
      storeName: storeData.name,
      billingUserEmail,
    }
  } catch (err) {
    logger.error('[Email] Exception getting store and billing info:', err)
    return null
  }
}

export async function sendPaymentFailureEmail(params: {
  storeId: string
  attemptCount: number
  amountDue: number
  currency: string
  nextRetryDate?: Date
}): Promise<{ success: boolean; error?: string }> {
  const { storeId, attemptCount, amountDue, currency, nextRetryDate } = params

  const storeInfo = await getStoreAndBillingInfo(storeId)
  if (!storeInfo || !storeInfo.billingUserEmail) {
    return {
      success: false,
      error: 'No billing email found for store',
    }
  }

  const updatePaymentUrl = `${APP_URL}/billing`

  const nextRetryDateStr = nextRetryDate
    ? new Date(nextRetryDate).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : undefined

  const html = getPaymentFailedEmailHtml({
    storeName: storeInfo.storeName,
    attemptCount,
    amountDue: amountDue.toString(),
    currency,
    nextRetryDate: nextRetryDateStr,
    updatePaymentUrl,
  })

  return sendEmail({
    to: storeInfo.billingUserEmail,
    subject: `Payment Failed for ${storeInfo.storeName} - Action Required`,
    html,
  })
}

export async function sendTrialEndingEmail(params: {
  storeId: string
  trialEndsAt: Date
}): Promise<{ success: boolean; error?: string }> {
  const { storeId, trialEndsAt } = params

  const storeInfo = await getStoreAndBillingInfo(storeId)
  if (!storeInfo || !storeInfo.billingUserEmail) {
    return {
      success: false,
      error: 'No billing email found for store',
    }
  }

  const daysRemaining = Math.ceil((trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  const trialEndsDate = trialEndsAt.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  const subscribeUrl = `${APP_URL}/billing`

  const html = getTrialEndingEmailHtml({
    storeName: storeInfo.storeName,
    trialEndsDate,
    daysRemaining,
    subscribeUrl,
  })

  return sendEmail({
    to: storeInfo.billingUserEmail,
    subject: `Your Trial Ends in ${daysRemaining} ${daysRemaining === 1 ? 'Day' : 'Days'} - Subscribe Now`,
    html,
  })
}

export async function sendDisputeNotificationEmail(params: {
  storeId: string
  disputeAmount: number
  currency: string
  disputeReason: string
  disputeStatus: string
  evidenceDueDate?: Date
}): Promise<{ success: boolean; error?: string }> {
  const { storeId, disputeAmount, currency, disputeReason, disputeStatus, evidenceDueDate } = params

  const storeInfo = await getStoreAndBillingInfo(storeId)
  if (!storeInfo || !storeInfo.billingUserEmail) {
    return {
      success: false,
      error: 'No billing email found for store',
    }
  }

  const evidenceDueDateStr = evidenceDueDate
    ? new Date(evidenceDueDate).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : undefined

  const manageDisputeUrl = `${APP_URL}/billing`

  const html = getDisputeNotificationEmailHtml({
    storeName: storeInfo.storeName,
    disputeAmount: disputeAmount.toString(),
    currency,
    disputeReason,
    disputeStatus,
    evidenceDueDate: evidenceDueDateStr,
    manageDisputeUrl,
  })

  const subjectMap: Record<string, string> = {
    warning_needs_response: 'Urgent: Dispute Filed - Evidence Required',
    warning_under_review: 'Dispute Under Review',
    needs_response: 'Dispute Filed - Action Required',
    under_review: 'Dispute Under Review',
    won: 'Good News: Dispute Won',
    lost: 'Dispute Lost - Funds Deducted',
  }

  const subject = subjectMap[disputeStatus] || 'Payment Dispute Notification'

  return sendEmail({
    to: storeInfo.billingUserEmail,
    subject: `${subject} - ${storeInfo.storeName}`,
    html,
  })
}

// Email templates
export function getInviteEmailHtml(params: {
  inviterName: string
  role: string
  storeName?: string
  onboardingUrl: string
  expiresIn: string
}): string {
  const { inviterName, role, storeName, onboardingUrl, expiresIn } = params

  const roleDisplay = role === 'Owner' ? 'Co-Owner' : role
  const storeInfo = storeName ? ` at <strong>${storeName}</strong>` : ''

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You're Invited to ${APP_NAME}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; border-bottom: 1px solid #e4e4e7;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #18181b;">
                ${APP_NAME}
              </h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px; font-size: 20px; font-weight: 600; color: #18181b;">
                You've Been Invited!
              </h2>

              <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #3f3f46;">
                <strong>${inviterName}</strong> has invited you to join ${APP_NAME} as a <strong>${roleDisplay}</strong>${storeInfo}.
              </p>

              <p style="margin: 0 0 30px; font-size: 16px; line-height: 1.6; color: #3f3f46;">
                Click the button below to complete your account setup. This link will expire in <strong>${expiresIn}</strong>.
              </p>

              <!-- CTA Button -->
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="text-align: center;">
                    <a href="${onboardingUrl}" style="display: inline-block; padding: 14px 32px; background-color: #18181b; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 8px;">
                      Complete Your Account
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 30px 0 0; font-size: 14px; line-height: 1.6; color: #71717a;">
                If the button doesn't work, copy and paste this link into your browser:
              </p>
              <p style="margin: 8px 0 0; font-size: 14px; line-height: 1.6; color: #3b82f6; word-break: break-all;">
                ${onboardingUrl}
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px 40px; border-top: 1px solid #e4e4e7;">
              <p style="margin: 0; font-size: 12px; line-height: 1.6; color: #a1a1aa; text-align: center;">
                If you didn't expect this invitation, you can safely ignore this email.
              </p>
              <p style="margin: 10px 0 0; font-size: 12px; line-height: 1.6; color: #a1a1aa; text-align: center;">
                © ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`
}

export function getAddedToStoreEmailHtml(params: {
  storeName: string
  role: string
  addedByName: string
  loginUrl: string
}): string {
  const { storeName, role, addedByName, loginUrl } = params

  const roleDisplay = role === 'Owner' ? 'Co-Owner' : role

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You've been added to ${storeName}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; border-bottom: 1px solid #e4e4e7;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #18181b;">
                ${APP_NAME}
              </h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px; font-size: 20px; font-weight: 600; color: #18181b;">
                You've been added to a new store!
              </h2>

              <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #3f3f46;">
                <strong>${addedByName}</strong> has added you to <strong>${storeName}</strong> as a <strong>${roleDisplay}</strong>.
              </p>

              <p style="margin: 0 0 30px; font-size: 16px; line-height: 1.6; color: #3f3f46;">
                You can now access this store from your dashboard. Use the store selector to switch between your stores.
              </p>

              <!-- CTA Button -->
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="text-align: center;">
                    <a href="${loginUrl}" style="display: inline-block; padding: 14px 32px; background-color: #18181b; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 8px;">
                      Go to Dashboard
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px 40px; border-top: 1px solid #e4e4e7;">
              <p style="margin: 0; font-size: 12px; line-height: 1.6; color: #a1a1aa; text-align: center;">
                If you weren't expecting this, please contact your team admin.
              </p>
              <p style="margin: 10px 0 0; font-size: 12px; line-height: 1.6; color: #a1a1aa; text-align: center;">
                © ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`
}

export function getWelcomeEmailHtml(params: {
  firstName: string
  role: string
  storeName?: string
  loginUrl: string
}): string {
  const { firstName, role, storeName, loginUrl } = params

  const roleDisplay = role === 'Owner' ? 'Co-Owner' : role
  const storeInfo = storeName ? ` at ${storeName}` : ''

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to ${APP_NAME}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; border-bottom: 1px solid #e4e4e7;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #18181b;">
                ${APP_NAME}
              </h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px; font-size: 20px; font-weight: 600; color: #18181b;">
                Welcome aboard, ${firstName}! 🎉
              </h2>

              <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #3f3f46;">
                Your account has been successfully set up. You're now a <strong>${roleDisplay}</strong>${storeInfo}.
              </p>

              <p style="margin: 0 0 30px; font-size: 16px; line-height: 1.6; color: #3f3f46;">
                You can now log in to start managing inventory, tracking stock, and collaborating with your team.
              </p>

              <!-- CTA Button -->
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="text-align: center;">
                    <a href="${loginUrl}" style="display: inline-block; padding: 14px 32px; background-color: #18181b; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 8px;">
                      Go to Dashboard
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Quick Tips -->
              <div style="margin-top: 40px; padding: 20px; background-color: #fafafa; border-radius: 8px;">
                <h3 style="margin: 0 0 12px; font-size: 14px; font-weight: 600; color: #18181b;">
                  Quick Tips to Get Started:
                </h3>
                <ul style="margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.8; color: #3f3f46;">
                  <li>Complete your first stock count to establish baseline inventory</li>
                  <li>Set par levels to get low stock alerts</li>
                  <li>Add the app to your home screen for quick access</li>
                </ul>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px 40px; border-top: 1px solid #e4e4e7;">
              <p style="margin: 0; font-size: 12px; line-height: 1.6; color: #a1a1aa; text-align: center;">
                Need help? Contact your store owner or manager for assistance.
              </p>
              <p style="margin: 10px 0 0; font-size: 12px; line-height: 1.6; color: #a1a1aa; text-align: center;">
                © ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`
}

export function getPaymentFailedEmailHtml(params: {
  storeName: string
  attemptCount: number
  amountDue: string
  currency: string
  nextRetryDate?: string
  updatePaymentUrl: string
}): string {
  const { storeName, attemptCount, amountDue, currency, nextRetryDate, updatePaymentUrl } = params

  const currencySymbols: Record<string, string> = { GBP: '£', USD: '$', EUR: '€' }
  const currencySymbol = currencySymbols[currency.toUpperCase()] ?? currency.toUpperCase()
  const formattedAmount = `${currencySymbol}${(parseInt(amountDue) / 100).toFixed(2)}`

  const retryMessage = nextRetryDate
    ? `We'll automatically retry on ${nextRetryDate}. However, to avoid any service interruption, please update your payment method as soon as possible.`
    : 'Please update your payment method as soon as possible to avoid service interruption.'

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Failed - ${APP_NAME}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; border-bottom: 1px solid #e4e4e7;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #18181b;">
                ${APP_NAME}
              </h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 40px;">
              <!-- Alert Box -->
              <div style="margin-bottom: 24px; padding: 16px; background-color: #fef2f2; border-left: 4px solid #dc2626; border-radius: 8px;">
                <p style="margin: 0; font-size: 14px; font-weight: 600; color: #dc2626;">
                  ⚠️ Payment Failed
                </p>
              </div>

              <h2 style="margin: 0 0 20px; font-size: 20px; font-weight: 600; color: #18181b;">
                Payment Issue for ${storeName}
              </h2>

              <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #3f3f46;">
                We were unable to process your payment of <strong>${formattedAmount}</strong> for your ${APP_NAME} subscription.
              </p>

              <p style="margin: 0 0 30px; font-size: 16px; line-height: 1.6; color: #3f3f46;">
                ${retryMessage}
              </p>

              <!-- Payment Details -->
              <div style="margin-bottom: 30px; padding: 20px; background-color: #fafafa; border-radius: 8px;">
                <h3 style="margin: 0 0 12px; font-size: 14px; font-weight: 600; color: #18181b;">
                  Payment Details:
                </h3>
                <table role="presentation" style="width: 100%; font-size: 14px; line-height: 1.8;">
                  <tr>
                    <td style="color: #71717a; padding: 4px 0;">Amount:</td>
                    <td style="color: #18181b; font-weight: 600; text-align: right; padding: 4px 0;">${formattedAmount}</td>
                  </tr>
                  <tr>
                    <td style="color: #71717a; padding: 4px 0;">Attempt:</td>
                    <td style="color: #18181b; font-weight: 600; text-align: right; padding: 4px 0;">#${attemptCount}</td>
                  </tr>
                  ${nextRetryDate ? `
                  <tr>
                    <td style="color: #71717a; padding: 4px 0;">Next Retry:</td>
                    <td style="color: #18181b; font-weight: 600; text-align: right; padding: 4px 0;">${nextRetryDate}</td>
                  </tr>
                  ` : ''}
                </table>
              </div>

              <!-- CTA Button -->
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="text-align: center;">
                    <a href="${updatePaymentUrl}" style="display: inline-block; padding: 14px 32px; background-color: #dc2626; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 8px;">
                      Update Payment Method
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Help Text -->
              <div style="margin-top: 30px; padding: 16px; background-color: #f0f9ff; border-radius: 8px;">
                <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #0369a1;">
                  <strong>Common Reasons for Payment Failure:</strong>
                </p>
                <ul style="margin: 8px 0 0; padding-left: 20px; font-size: 14px; line-height: 1.8; color: #0c4a6e;">
                  <li>Insufficient funds</li>
                  <li>Expired credit card</li>
                  <li>Billing address mismatch</li>
                  <li>Card limit reached</li>
                </ul>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px 40px; border-top: 1px solid #e4e4e7;">
              <p style="margin: 0; font-size: 12px; line-height: 1.6; color: #a1a1aa; text-align: center;">
                Need help? Contact us or check your billing settings in your account dashboard.
              </p>
              <p style="margin: 10px 0 0; font-size: 12px; line-height: 1.6; color: #a1a1aa; text-align: center;">
                © ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`
}

export function getDisputeNotificationEmailHtml(params: {
  storeName: string
  disputeAmount: string
  currency: string
  disputeReason: string
  disputeStatus: string
  evidenceDueDate?: string
  manageDisputeUrl: string
}): string {
  const { storeName, disputeAmount, currency, disputeReason, disputeStatus, evidenceDueDate, manageDisputeUrl } = params

  const currencySymbols: Record<string, string> = { GBP: '£', USD: '$', EUR: '€' }
  const currencySymbol = currencySymbols[currency.toUpperCase()] ?? currency.toUpperCase()
  const formattedAmount = `${currencySymbol}${(parseInt(disputeAmount) / 100).toFixed(2)}`

  const isNeedsResponse = disputeStatus.includes('needs_response') || disputeStatus.includes('warning')
  const isWon = disputeStatus === 'won'
  const isLost = disputeStatus === 'lost'

  const urgencyColor = isLost || isNeedsResponse ? '#dc2626' : isWon ? '#059669' : '#ea580c'
  const urgencyBg = isLost || isNeedsResponse ? '#fef2f2' : isWon ? '#f0fdf4' : '#fff7ed'
  const statusLabel = isNeedsResponse ? '⚠️ Action Required' : isWon ? '✅ Dispute Won' : isLost ? '❌ Dispute Lost' : '⏳ Under Review'

  const reasonMap: Record<string, string> = {
    fraudulent: 'Fraudulent transaction',
    duplicate: 'Duplicate charge',
    product_not_received: 'Product not received',
    product_unacceptable: 'Product unacceptable',
    unrecognized: 'Customer does not recognize',
    credit_not_processed: 'Credit not processed',
    general: 'General dispute',
  }

  const reasonDisplay = reasonMap[disputeReason] || disputeReason

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Dispute - ${APP_NAME}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; border-bottom: 1px solid #e4e4e7;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #18181b;">
                ${APP_NAME}
              </h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 40px;">
              <!-- Alert Box -->
              <div style="margin-bottom: 24px; padding: 16px; background-color: ${urgencyBg}; border-left: 4px solid ${urgencyColor}; border-radius: 8px;">
                <p style="margin: 0; font-size: 14px; font-weight: 600; color: ${urgencyColor};">
                  ${statusLabel}
                </p>
              </div>

              <h2 style="margin: 0 0 20px; font-size: 20px; font-weight: 600; color: #18181b;">
                ${isWon ? 'Dispute Resolved in Your Favor' : isLost ? 'Dispute Closed - Customer Refunded' : 'Payment Dispute Filed'}
              </h2>

              <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #3f3f46;">
                ${isWon
                  ? `Good news! A dispute for <strong>${formattedAmount}</strong> on <strong>${storeName}</strong> has been resolved in your favor. No further action is required.`
                  : isLost
                  ? `A dispute for <strong>${formattedAmount}</strong> on <strong>${storeName}</strong> was closed and the customer has been refunded.`
                  : `A customer has filed a payment dispute for <strong>${formattedAmount}</strong> on <strong>${storeName}</strong>.`
                }
              </p>

              ${isNeedsResponse && evidenceDueDate ? `
              <p style="margin: 0 0 30px; font-size: 16px; line-height: 1.6; color: #3f3f46;">
                You must submit evidence by <strong>${evidenceDueDate}</strong> to contest this dispute. Failure to respond may result in the customer being automatically refunded.
              </p>
              ` : !isWon && !isLost ? `
              <p style="margin: 0 0 30px; font-size: 16px; line-height: 1.6; color: #3f3f46;">
                The dispute is currently under review. We'll notify you of any updates.
              </p>
              ` : `
              <p style="margin: 0 0 30px; font-size: 16px; line-height: 1.6; color: #3f3f46;">
                ${isWon ? 'Thank you for providing evidence to support your case.' : 'Please review your records and processes to prevent future disputes.'}
              </p>
              `}

              <!-- Dispute Details -->
              <div style="margin-bottom: 30px; padding: 20px; background-color: #fafafa; border-radius: 8px;">
                <h3 style="margin: 0 0 12px; font-size: 14px; font-weight: 600; color: #18181b;">
                  Dispute Details:
                </h3>
                <table role="presentation" style="width: 100%; font-size: 14px; line-height: 1.8;">
                  <tr>
                    <td style="color: #71717a; padding: 4px 0;">Amount:</td>
                    <td style="color: #18181b; font-weight: 600; text-align: right; padding: 4px 0;">${formattedAmount}</td>
                  </tr>
                  <tr>
                    <td style="color: #71717a; padding: 4px 0;">Reason:</td>
                    <td style="color: #18181b; font-weight: 600; text-align: right; padding: 4px 0;">${reasonDisplay}</td>
                  </tr>
                  <tr>
                    <td style="color: #71717a; padding: 4px 0;">Status:</td>
                    <td style="color: #18181b; font-weight: 600; text-align: right; padding: 4px 0;">${disputeStatus.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</td>
                  </tr>
                  ${evidenceDueDate ? `
                  <tr>
                    <td style="color: #71717a; padding: 4px 0;">Evidence Due:</td>
                    <td style="color: ${urgencyColor}; font-weight: 600; text-align: right; padding: 4px 0;">${evidenceDueDate}</td>
                  </tr>
                  ` : ''}
                </table>
              </div>

              ${!isWon ? `
              <!-- CTA Button -->
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="text-align: center;">
                    <a href="${manageDisputeUrl}" style="display: inline-block; padding: 14px 32px; background-color: ${urgencyColor}; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 8px;">
                      ${isNeedsResponse ? 'Submit Evidence' : 'View Details'}
                    </a>
                  </td>
                </tr>
              </table>
              ` : ''}

              <!-- Help Text -->
              <div style="margin-top: 30px; padding: 16px; background-color: #f0f9ff; border-radius: 8px;">
                <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #0369a1;">
                  <strong>${isWon ? 'Dispute Resolved' : isLost ? 'Next Steps' : 'About Payment Disputes'}:</strong>
                </p>
                <ul style="margin: 8px 0 0; padding-left: 20px; font-size: 14px; line-height: 1.8; color: #0c4a6e;">
                  ${isWon ? `
                  <li>The disputed amount has been returned to your account</li>
                  <li>No further action is required</li>
                  <li>Keep records of this resolution for your files</li>
                  ` : isLost ? `
                  <li>The customer has been refunded ${formattedAmount}</li>
                  <li>Review transaction details to prevent future disputes</li>
                  <li>Contact support if you have questions</li>
                  ` : `
                  <li>Disputes are initiated by customers with their bank</li>
                  <li>You can submit evidence to contest the dispute</li>
                  <li>The process typically takes 30-60 days</li>
                  <li>Contact support if you need help</li>
                  `}
                </ul>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px 40px; border-top: 1px solid #e4e4e7;">
              <p style="margin: 0; font-size: 12px; line-height: 1.6; color: #a1a1aa; text-align: center;">
                Need help? Contact support or visit your billing dashboard for more information.
              </p>
              <p style="margin: 10px 0 0; font-size: 12px; line-height: 1.6; color: #a1a1aa; text-align: center;">
                © ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`
}

export function getSupplierPortalInviteEmailHtml(params: {
  supplierName: string
  storeName: string
  portalUrl: string
  permissions: string[]
}): string {
  const { supplierName, storeName, portalUrl, permissions } = params

  const permissionLabels: Record<string, string> = {
    can_view_orders: 'View purchase orders',
    can_upload_invoices: 'Upload invoices',
    can_update_catalog: 'Update product catalog & pricing',
    can_update_order_status: 'Update order status',
  }

  const permissionList = permissions
    .map(p => permissionLabels[p] || p)
    .map(p => `<li>${p}</li>`)
    .join('\n                  ')

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Supplier Portal Access - ${APP_NAME}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; border-bottom: 1px solid #e4e4e7;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #18181b;">
                ${APP_NAME}
              </h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px; font-size: 20px; font-weight: 600; color: #18181b;">
                Supplier Portal Access
              </h2>

              <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #3f3f46;">
                Hello <strong>${supplierName}</strong>,
              </p>

              <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #3f3f46;">
                <strong>${storeName}</strong> has invited you to their supplier portal. You can now manage your orders, invoices, and product catalog online.
              </p>

              <div style="margin-bottom: 30px; padding: 20px; background-color: #fafafa; border-radius: 8px;">
                <h3 style="margin: 0 0 12px; font-size: 14px; font-weight: 600; color: #18181b;">
                  You have access to:
                </h3>
                <ul style="margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.8; color: #3f3f46;">
                  ${permissionList}
                </ul>
              </div>

              <!-- CTA Button -->
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="text-align: center;">
                    <a href="${portalUrl}" style="display: inline-block; padding: 14px 32px; background-color: #18181b; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 8px;">
                      Open Supplier Portal
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 30px 0 0; font-size: 14px; line-height: 1.6; color: #71717a;">
                If the button doesn't work, copy and paste this link into your browser:
              </p>
              <p style="margin: 8px 0 0; font-size: 14px; line-height: 1.6; color: #3b82f6; word-break: break-all;">
                ${portalUrl}
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px 40px; border-top: 1px solid #e4e4e7;">
              <p style="margin: 0; font-size: 12px; line-height: 1.6; color: #a1a1aa; text-align: center;">
                If you didn't expect this email, you can safely ignore it.
              </p>
              <p style="margin: 10px 0 0; font-size: 12px; line-height: 1.6; color: #a1a1aa; text-align: center;">
                © ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`
}

export function getTrialEndingEmailHtml(params: {
  storeName: string
  trialEndsDate: string
  daysRemaining: number
  subscribeUrl: string
}): string {
  const { storeName, trialEndsDate, daysRemaining, subscribeUrl } = params

  const urgencyColor = daysRemaining <= 1 ? '#dc2626' : daysRemaining <= 3 ? '#ea580c' : '#0369a1'
  const urgencyBg = daysRemaining <= 1 ? '#fef2f2' : daysRemaining <= 3 ? '#fff7ed' : '#f0f9ff'

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Trial Ending Soon - ${APP_NAME}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; border-bottom: 1px solid #e4e4e7;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #18181b;">
                ${APP_NAME}
              </h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 40px;">
              <!-- Alert Box -->
              <div style="margin-bottom: 24px; padding: 16px; background-color: ${urgencyBg}; border-left: 4px solid ${urgencyColor}; border-radius: 8px;">
                <p style="margin: 0; font-size: 14px; font-weight: 600; color: ${urgencyColor};">
                  ⏰ Your trial is ending in ${daysRemaining} ${daysRemaining === 1 ? 'day' : 'days'}
                </p>
              </div>

              <h2 style="margin: 0 0 20px; font-size: 20px; font-weight: 600; color: #18181b;">
                Don't Lose Access to ${storeName}
              </h2>

              <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #3f3f46;">
                Your free trial for <strong>${storeName}</strong> ends on <strong>${trialEndsDate}</strong>.
              </p>

              <p style="margin: 0 0 30px; font-size: 16px; line-height: 1.6; color: #3f3f46;">
                To continue using ${APP_NAME} without interruption, subscribe now. Your team is counting on you to keep operations running smoothly!
              </p>

              <!-- CTA Button -->
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="text-align: center;">
                    <a href="${subscribeUrl}" style="display: inline-block; padding: 14px 32px; background-color: #18181b; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 8px;">
                      Subscribe Now
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Benefits Reminder -->
              <div style="margin-top: 40px; padding: 20px; background-color: #fafafa; border-radius: 8px;">
                <h3 style="margin: 0 0 12px; font-size: 14px; font-weight: 600; color: #18181b;">
                  What You'll Keep with a Subscription:
                </h3>
                <ul style="margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.8; color: #3f3f46;">
                  <li>Real-time inventory tracking</li>
                  <li>Stock count history and reports</li>
                  <li>Team member management</li>
                  <li>Automated low stock alerts</li>
                  <li>Export your data anytime</li>
                </ul>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px 40px; border-top: 1px solid #e4e4e7;">
              <p style="margin: 0; font-size: 12px; line-height: 1.6; color: #a1a1aa; text-align: center;">
                Questions about pricing? Check our <a href="${APP_URL}/pricing" style="color: #3b82f6; text-decoration: none;">pricing page</a> or contact support.
              </p>
              <p style="margin: 10px 0 0; font-size: 12px; line-height: 1.6; color: #a1a1aa; text-align: center;">
                © ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`
}
