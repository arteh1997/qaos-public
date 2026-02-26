/**
 * Email templates for transactional notifications
 * (shifts, payroll, purchase orders, account events)
 */

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'Restaurant Inventory'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

// Shared email wrapper
function emailWrapper(title: string, body: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - ${APP_NAME}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; border-bottom: 1px solid #e4e4e7;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #18181b;">${APP_NAME}</h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 40px;">
              ${body}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px 40px; border-top: 1px solid #e4e4e7;">
              <p style="margin: 0; font-size: 12px; line-height: 1.6; color: #a1a1aa; text-align: center;">
                You can manage your notification preferences in <a href="${APP_URL}/settings" style="color: #3b82f6; text-decoration: none;">Settings</a>.
              </p>
              <p style="margin: 10px 0 0; font-size: 12px; line-height: 1.6; color: #a1a1aa; text-align: center;">
                &copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function alertBox(color: string, bgColor: string, text: string): string {
  return `<div style="margin-bottom: 24px; padding: 16px; background-color: ${bgColor}; border-left: 4px solid ${color}; border-radius: 8px;">
    <p style="margin: 0; font-size: 14px; font-weight: 600; color: ${color};">${text}</p>
  </div>`
}

function heading(text: string): string {
  return `<h2 style="margin: 0 0 20px; font-size: 20px; font-weight: 600; color: #18181b;">${text}</h2>`
}

function paragraph(text: string): string {
  return `<p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #3f3f46;">${text}</p>`
}

function detailRow(label: string, value: string): string {
  return `<tr>
    <td style="color: #71717a; padding: 4px 0;">${label}:</td>
    <td style="color: #18181b; font-weight: 600; text-align: right; padding: 4px 0;">${value}</td>
  </tr>`
}

function detailBox(rows: string): string {
  return `<div style="margin-bottom: 30px; padding: 20px; background-color: #fafafa; border-radius: 8px;">
    <table role="presentation" style="width: 100%; font-size: 14px; line-height: 1.8;">
      ${rows}
    </table>
  </div>`
}

function ctaButton(text: string, url: string, color = '#18181b'): string {
  return `<table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="text-align: center;">
        <a href="${url}" style="display: inline-block; padding: 14px 32px; background-color: ${color}; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 8px;">
          ${text}
        </a>
      </td>
    </tr>
  </table>`
}

// ============================================================================
// 1. Shift Assigned
// ============================================================================

export function getShiftAssignedEmailHtml(params: {
  recipientName: string
  managerName: string
  storeName: string
  date: string
  dayOfWeek: string
  startTime: string
  endTime: string
  duration: string
  notes: string | null
  shiftsUrl: string
}): string {
  const { recipientName, managerName, storeName, date, dayOfWeek, startTime, endTime, duration, notes, shiftsUrl } = params

  const notesRow = notes ? detailRow('Notes', notes) : ''

  const body = [
    alertBox('#2563eb', '#eff6ff', 'New Shift Scheduled'),
    heading("You've been assigned a new shift"),
    paragraph(`<strong>${managerName}</strong> has scheduled you for a shift at <strong>${storeName}</strong>.`),
    detailBox([
      detailRow('Date', `${dayOfWeek}, ${date}`),
      detailRow('Time', `${startTime} – ${endTime}`),
      detailRow('Duration', duration),
      notesRow,
    ].join('')),
    ctaButton('View My Shifts', shiftsUrl),
  ].join('')

  return emailWrapper(`New Shift: ${dayOfWeek} ${date}`, body)
}

// ============================================================================
// 2. Shift Updated
// ============================================================================

export function getShiftUpdatedEmailHtml(params: {
  recipientName: string
  managerName: string
  storeName: string
  date: string
  dayOfWeek: string
  previousStartTime: string
  previousEndTime: string
  newStartTime: string
  newEndTime: string
  notes: string | null
  shiftsUrl: string
}): string {
  const { recipientName, managerName, storeName, date, dayOfWeek, previousStartTime, previousEndTime, newStartTime, newEndTime, notes, shiftsUrl } = params

  const notesRow = notes ? detailRow('Notes', notes) : ''

  const body = [
    alertBox('#ea580c', '#fff7ed', 'Shift Schedule Changed'),
    heading('Your shift has been updated'),
    paragraph(`<strong>${managerName}</strong> has updated your shift at <strong>${storeName}</strong>.`),
    detailBox([
      detailRow('Date', `${dayOfWeek}, ${date}`),
      detailRow('Previous', `${previousStartTime} – ${previousEndTime}`),
      detailRow('Updated', `${newStartTime} – ${newEndTime}`),
      notesRow,
    ].join('')),
    ctaButton('View My Shifts', shiftsUrl),
  ].join('')

  return emailWrapper(`Shift Updated: ${dayOfWeek} ${date}`, body)
}

// ============================================================================
// 3. Shift Cancelled
// ============================================================================

export function getShiftCancelledEmailHtml(params: {
  recipientName: string
  managerName: string
  storeName: string
  date: string
  dayOfWeek: string
  startTime: string
  endTime: string
  shiftsUrl: string
}): string {
  const { recipientName, managerName, storeName, date, dayOfWeek, startTime, endTime, shiftsUrl } = params

  const body = [
    alertBox('#dc2626', '#fef2f2', 'Shift Cancelled'),
    heading('Your shift has been cancelled'),
    paragraph(`<strong>${managerName}</strong> has cancelled your shift at <strong>${storeName}</strong>.`),
    detailBox([
      detailRow('Date', `${dayOfWeek}, ${date}`),
      detailRow('Time', `${startTime} – ${endTime} (was scheduled)`),
    ].join('')),
    ctaButton('View My Shifts', shiftsUrl),
  ].join('')

  return emailWrapper(`Shift Cancelled: ${dayOfWeek} ${date}`, body)
}

// ============================================================================
// 4. Payslip Available
// ============================================================================

export function getPayslipAvailableEmailHtml(params: {
  recipientName: string
  storeName: string
  periodStart: string
  periodEnd: string
  totalHours: number
  hourlyRate: number
  grossPay: number
  adjustments: number
  adjustmentNotes: string | null
  netPay: number
  currency: string
  payUrl: string
}): string {
  const { recipientName, storeName, periodStart, periodEnd, totalHours, hourlyRate, grossPay, adjustments, adjustmentNotes, netPay, currency, payUrl } = params

  const currencySymbols: Record<string, string> = { GBP: '\u00a3', USD: '$', EUR: '\u20ac' }
  const sym = currencySymbols[currency.toUpperCase()] ?? currency

  const adjustmentRow = adjustments !== 0
    ? detailRow('Adjustments', `${adjustments > 0 ? '+' : ''}${sym}${adjustments.toFixed(2)}${adjustmentNotes ? ` (${adjustmentNotes})` : ''}`)
    : ''

  const body = [
    alertBox('#059669', '#f0fdf4', 'Payslip Ready'),
    heading('Your payslip is available'),
    paragraph(`Your pay for the period <strong>${periodStart} – ${periodEnd}</strong> at <strong>${storeName}</strong> has been processed.`),
    detailBox([
      detailRow('Period', `${periodStart} – ${periodEnd}`),
      detailRow('Total Hours', `${totalHours.toFixed(1)}`),
      detailRow('Hourly Rate', `${sym}${hourlyRate.toFixed(2)}`),
      detailRow('Gross Pay', `${sym}${grossPay.toFixed(2)}`),
      adjustmentRow,
      `<tr><td colspan="2" style="border-top: 1px solid #e4e4e7; padding: 0;"></td></tr>`,
      `<tr>
        <td style="color: #18181b; font-weight: 700; padding: 8px 0;">Net Pay:</td>
        <td style="color: #059669; font-weight: 700; font-size: 18px; text-align: right; padding: 8px 0;">${sym}${netPay.toFixed(2)}</td>
      </tr>`,
    ].join('')),
    ctaButton('View My Pay', payUrl, '#059669'),
  ].join('')

  return emailWrapper(`Payslip: ${periodStart} – ${periodEnd}`, body)
}

// ============================================================================
// 6. PO Status Update (from Supplier)
// ============================================================================

export function getPOStatusUpdateEmailHtml(params: {
  recipientName: string
  storeName: string
  poNumber: string
  supplierName: string
  status: string
  expectedDeliveryDate: string | null
  itemCount: number
  totalAmount: number
  currency: string
  poUrl: string
}): string {
  const { recipientName, storeName, poNumber, supplierName, status, expectedDeliveryDate, itemCount, totalAmount, currency, poUrl } = params

  const currencySymbols: Record<string, string> = { GBP: '\u00a3', USD: '$', EUR: '\u20ac' }
  const sym = currencySymbols[currency.toUpperCase()] ?? currency

  const statusDisplay = status.charAt(0).toUpperCase() + status.slice(1)
  const deliveryRow = expectedDeliveryDate ? detailRow('Expected Delivery', expectedDeliveryDate) : ''

  const body = [
    alertBox('#2563eb', '#eff6ff', 'Purchase Order Update'),
    heading(`PO #${poNumber} — ${statusDisplay}`),
    paragraph(`<strong>${supplierName}</strong> has updated the status of your purchase order at <strong>${storeName}</strong>.`),
    detailBox([
      detailRow('PO Number', `#${poNumber}`),
      detailRow('Supplier', supplierName),
      detailRow('Status', statusDisplay),
      deliveryRow,
      detailRow('Items', `${itemCount} line items`),
      detailRow('Total', `${sym}${totalAmount.toFixed(2)}`),
    ].join('')),
    ctaButton('View Purchase Order', poUrl),
  ].join('')

  return emailWrapper(`PO #${poNumber} ${statusDisplay}`, body)
}

// ============================================================================
// 7. Delivery Received
// ============================================================================

export function getDeliveryReceivedEmailHtml(params: {
  recipientName: string
  storeName: string
  poNumber: string
  supplierName: string
  receivedByName: string
  itemsReceived: number
  totalItems: number
  totalValue: number
  currency: string
  deliveriesUrl: string
}): string {
  const { recipientName, storeName, poNumber, supplierName, receivedByName, itemsReceived, totalItems, totalValue, currency, deliveriesUrl } = params

  const currencySymbols: Record<string, string> = { GBP: '\u00a3', USD: '$', EUR: '\u20ac' }
  const sym = currencySymbols[currency.toUpperCase()] ?? currency

  const body = [
    alertBox('#059669', '#f0fdf4', 'Delivery Received'),
    heading(`PO #${poNumber} received at ${storeName}`),
    paragraph(`<strong>${receivedByName}</strong> has recorded a delivery from <strong>${supplierName}</strong>.`),
    detailBox([
      detailRow('PO Number', `#${poNumber}`),
      detailRow('Supplier', supplierName),
      detailRow('Items Received', `${itemsReceived} of ${totalItems}`),
      detailRow('Total Value', `${sym}${totalValue.toFixed(2)}`),
      detailRow('Received By', receivedByName),
    ].join('')),
    ctaButton('View Details', deliveriesUrl, '#059669'),
  ].join('')

  return emailWrapper(`Delivery Received: PO #${poNumber}`, body)
}

// ============================================================================
// 8. Removed from Store
// ============================================================================

export function getRemovedFromStoreEmailHtml(params: {
  recipientName: string
  storeName: string
  removedByName: string
  activeShiftsEnded: number
  dashboardUrl: string
}): string {
  const { recipientName, storeName, removedByName, activeShiftsEnded, dashboardUrl } = params

  const shiftNote = activeShiftsEnded > 0
    ? paragraph(`${activeShiftsEnded} active shift${activeShiftsEnded !== 1 ? 's were' : ' was'} automatically ended.`)
    : ''

  const body = [
    alertBox('#71717a', '#f4f4f5', 'Store Access Updated'),
    heading(`You've been removed from ${storeName}`),
    paragraph(`<strong>${removedByName}</strong> has removed your access to <strong>${storeName}</strong>. If you have other stores, you can still access them from your dashboard.`),
    shiftNote,
    ctaButton('Go to Dashboard', dashboardUrl),
  ].join('')

  return emailWrapper(`Store Access Removed: ${storeName}`, body)
}

// ============================================================================
// 9. Payment Succeeded (Receipt)
// ============================================================================

export function getPaymentSucceededEmailHtml(params: {
  storeName: string
  amount: string
  periodLabel: string
  billingUrl: string
}): string {
  const { storeName, amount, periodLabel, billingUrl } = params

  const body = [
    alertBox('#059669', '#f0fdf4', 'Payment Confirmed'),
    heading(`Payment received for ${storeName}`),
    paragraph('Your subscription payment has been successfully processed.'),
    detailBox([
      detailRow('Amount', amount),
      detailRow('Store', storeName),
      detailRow('Period', periodLabel),
    ].join('')),
    ctaButton('View Billing', billingUrl, '#059669'),
  ].join('')

  return emailWrapper(`Payment Received: ${storeName}`, body)
}

// ============================================================================
// 10. Subscription Cancelled
// ============================================================================

export function getSubscriptionCancelledEmailHtml(params: {
  storeName: string
  accessUntil: string
  billingUrl: string
}): string {
  const { storeName, accessUntil, billingUrl } = params

  const body = [
    alertBox('#ea580c', '#fff7ed', 'Subscription Cancelled'),
    heading(`${storeName} subscription has been cancelled`),
    paragraph(`Your subscription has been cancelled. You'll retain access until <strong>${accessUntil}</strong>.`),
    detailBox([
      detailRow('Store', storeName),
      detailRow('Access Until', accessUntil),
      detailRow('Data', 'Preserved for 90 days'),
    ].join('')),
    paragraph('If this was a mistake, you can resubscribe at any time to restore full access.'),
    ctaButton('Resubscribe', billingUrl, '#ea580c'),
  ].join('')

  return emailWrapper(`Subscription Cancelled: ${storeName}`, body)
}
