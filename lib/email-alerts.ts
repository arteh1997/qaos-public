/**
 * Email templates for inventory alerts
 */

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'Restaurant Inventory'

interface LowStockItemData {
  item_name: string
  category: string | null
  current_quantity: number
  par_level: number
  shortage: number
  unit_of_measure: string
}

export function getLowStockAlertEmailHtml(params: {
  storeName: string
  items: LowStockItemData[]
  dashboardUrl: string
  lowStockReportUrl: string
}): string {
  const { storeName, items, dashboardUrl, lowStockReportUrl } = params

  const itemRows = items.slice(0, 20).map(item => `
    <tr>
      <td style="padding: 10px 12px; border-bottom: 1px solid #e4e4e7; font-size: 14px; color: #18181b;">
        ${item.item_name}
        ${item.category ? `<br><span style="font-size: 12px; color: #71717a;">${item.category}</span>` : ''}
      </td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #e4e4e7; font-size: 14px; color: #ea580c; font-weight: 600; text-align: center;">
        ${item.current_quantity} ${item.unit_of_measure}
      </td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #e4e4e7; font-size: 14px; color: #71717a; text-align: center;">
        ${item.par_level} ${item.unit_of_measure}
      </td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #e4e4e7; font-size: 14px; color: #dc2626; font-weight: 600; text-align: center;">
        -${item.shortage}
      </td>
    </tr>
  `).join('')

  const moreItems = items.length > 20 ? `<p style="margin: 16px 0 0; font-size: 14px; color: #71717a;">...and ${items.length - 20} more items</p>` : ''

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Low Stock Alert - ${APP_NAME}</title>
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
              <!-- Alert Box -->
              <div style="margin-bottom: 24px; padding: 16px; background-color: #fff7ed; border-left: 4px solid #ea580c; border-radius: 8px;">
                <p style="margin: 0; font-size: 14px; font-weight: 600; color: #ea580c;">
                  Low Stock Alert - ${items.length} item${items.length !== 1 ? 's' : ''} below par level
                </p>
              </div>

              <h2 style="margin: 0 0 20px; font-size: 20px; font-weight: 600; color: #18181b;">
                ${storeName} - Low Stock Report
              </h2>

              <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #3f3f46;">
                The following items at <strong>${storeName}</strong> are running low and may need to be reordered:
              </p>

              <!-- Items Table -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; border: 1px solid #e4e4e7; border-radius: 8px; overflow: hidden;">
                <thead>
                  <tr style="background-color: #fafafa;">
                    <th style="padding: 10px 12px; text-align: left; font-size: 12px; font-weight: 600; color: #71717a; text-transform: uppercase;">Item</th>
                    <th style="padding: 10px 12px; text-align: center; font-size: 12px; font-weight: 600; color: #71717a; text-transform: uppercase;">Current</th>
                    <th style="padding: 10px 12px; text-align: center; font-size: 12px; font-weight: 600; color: #71717a; text-transform: uppercase;">Par Level</th>
                    <th style="padding: 10px 12px; text-align: center; font-size: 12px; font-weight: 600; color: #71717a; text-transform: uppercase;">Shortage</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemRows}
                </tbody>
              </table>

              ${moreItems}

              <!-- CTA Buttons -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; margin-top: 30px;">
                <tr>
                  <td style="text-align: center;">
                    <a href="${lowStockReportUrl}" style="display: inline-block; padding: 14px 32px; background-color: #18181b; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 8px;">
                      View Full Report
                    </a>
                  </td>
                </tr>
                <tr>
                  <td style="text-align: center; padding-top: 12px;">
                    <a href="${dashboardUrl}" style="font-size: 14px; color: #3b82f6; text-decoration: none;">
                      Go to Store Dashboard
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
                You received this alert because you have low stock notifications enabled for ${storeName}.
                <a href="${APP_URL}/stores/${encodeURIComponent(params.storeName)}/settings" style="color: #3b82f6; text-decoration: none;">Manage alert preferences</a>
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
</html>
`
}

export function getCriticalStockAlertEmailHtml(params: {
  storeName: string
  items: LowStockItemData[]
  dashboardUrl: string
}): string {
  const { storeName, items, dashboardUrl } = params

  const itemList = items.slice(0, 15).map(item => `
    <tr>
      <td style="padding: 10px 12px; border-bottom: 1px solid #e4e4e7; font-size: 14px; color: #18181b;">
        ${item.item_name}
        ${item.category ? `<br><span style="font-size: 12px; color: #71717a;">${item.category}</span>` : ''}
      </td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #e4e4e7; font-size: 14px; color: #dc2626; font-weight: 700; text-align: center;">
        0 ${item.unit_of_measure}
      </td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #e4e4e7; font-size: 14px; color: #71717a; text-align: center;">
        ${item.par_level} ${item.unit_of_measure}
      </td>
    </tr>
  `).join('')

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CRITICAL: Out of Stock - ${APP_NAME}</title>
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
              <!-- Alert Box -->
              <div style="margin-bottom: 24px; padding: 16px; background-color: #fef2f2; border-left: 4px solid #dc2626; border-radius: 8px;">
                <p style="margin: 0; font-size: 14px; font-weight: 600; color: #dc2626;">
                  CRITICAL: ${items.length} item${items.length !== 1 ? 's' : ''} completely out of stock
                </p>
              </div>

              <h2 style="margin: 0 0 20px; font-size: 20px; font-weight: 600; color: #18181b;">
                ${storeName} - Out of Stock Items
              </h2>

              <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #3f3f46;">
                The following items at <strong>${storeName}</strong> have <strong>zero quantity</strong> and require immediate attention:
              </p>

              <!-- Items Table -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; border: 1px solid #e4e4e7; border-radius: 8px; overflow: hidden;">
                <thead>
                  <tr style="background-color: #fef2f2;">
                    <th style="padding: 10px 12px; text-align: left; font-size: 12px; font-weight: 600; color: #dc2626; text-transform: uppercase;">Item</th>
                    <th style="padding: 10px 12px; text-align: center; font-size: 12px; font-weight: 600; color: #dc2626; text-transform: uppercase;">Current</th>
                    <th style="padding: 10px 12px; text-align: center; font-size: 12px; font-weight: 600; color: #dc2626; text-transform: uppercase;">Par Level</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemList}
                </tbody>
              </table>

              <!-- CTA Button -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; margin-top: 30px;">
                <tr>
                  <td style="text-align: center;">
                    <a href="${dashboardUrl}" style="display: inline-block; padding: 14px 32px; background-color: #dc2626; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 8px;">
                      View Store Dashboard
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
                You received this critical alert because you have stock notifications enabled for ${storeName}.
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
</html>
`
}

export function getMissingCountAlertEmailHtml(params: {
  storeName: string
  date: string
  dashboardUrl: string
}): string {
  const { storeName, date, dashboardUrl } = params

  const formattedDate = new Date(date + 'T12:00:00Z').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Missing Daily Count - ${APP_NAME}</title>
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
              <!-- Alert Box -->
              <div style="margin-bottom: 24px; padding: 16px; background-color: #fffbeb; border-left: 4px solid #f59e0b; border-radius: 8px;">
                <p style="margin: 0; font-size: 14px; font-weight: 600; color: #b45309;">
                  Daily stock count not submitted
                </p>
              </div>

              <h2 style="margin: 0 0 20px; font-size: 20px; font-weight: 600; color: #18181b;">
                Missing Count for ${storeName}
              </h2>

              <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #3f3f46;">
                No daily stock count was submitted for <strong>${storeName}</strong> on <strong>${formattedDate}</strong>.
              </p>

              <p style="margin: 0 0 30px; font-size: 16px; line-height: 1.6; color: #3f3f46;">
                Regular stock counts help maintain accurate inventory levels and prevent stockouts. Please ensure counts are completed each day.
              </p>

              <!-- CTA Button -->
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="text-align: center;">
                    <a href="${dashboardUrl}" style="display: inline-block; padding: 14px 32px; background-color: #18181b; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 8px;">
                      Submit Count Now
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
                You received this reminder because you have missing count notifications enabled for ${storeName}.
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
</html>
`
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
