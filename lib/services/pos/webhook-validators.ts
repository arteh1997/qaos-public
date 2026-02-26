/**
 * POS Webhook Signature Validators
 *
 * Each POS provider has its own webhook signing mechanism.
 * This module provides per-provider validation functions.
 */

import crypto from 'crypto'

/**
 * Square: HMAC-SHA256 of the webhook URL + body, using the signature key.
 * Signature in header: x-square-hmacsha256-signature
 */
export function validateSquareSignature(
  payload: string,
  signature: string,
  signatureKey: string,
  webhookUrl?: string
): boolean {
  const combined = (webhookUrl || '') + payload
  const expected = crypto
    .createHmac('sha256', signatureKey)
    .update(combined)
    .digest('base64')
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  )
}

/**
 * Toast: HMAC-SHA256 of the raw body, using the webhook secret.
 * Signature in header: Toast-Signature
 */
export function validateToastSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  )
}

/**
 * Clover: HMAC-SHA256 with base64 encoding.
 * Signature in header: X-Clover-Hmac-SHA256
 */
export function validateCloverSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('base64')
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  )
}

/**
 * Lightspeed: HMAC-SHA256 hex digest.
 * Signature in header: X-Lightspeed-Signature
 */
export function validateLightspeedSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  )
}

/**
 * Zettle (PayPal): HMAC-SHA256 hex digest.
 * Signature in header: X-iZettle-Signature
 */
export function validateZettleSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  )
}

/**
 * SumUp: HMAC-SHA256 hex digest.
 * Signature in header: X-Sumup-Signature
 */
export function validateSumUpSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  )
}

/**
 * Epos Now: HMAC-SHA256 hex digest.
 * Signature in header: X-EposNow-Signature
 */
export function validateEposNowSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  )
}

/**
 * Tevalis: HMAC-SHA256 hex digest.
 * Signature in header: X-Tevalis-Signature
 */
export function validateTevalisSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  )
}

/**
 * Foodics: HMAC-SHA256 hex digest.
 * Signature in header: X-Foodics-Signature
 */
export function validateFoodicsSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  )
}

/**
 * Oracle MICROS: HMAC-SHA256 hex digest.
 * Signature in header: X-Oracle-Signature
 */
export function validateOracleMicrosSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  )
}

/**
 * NCR Voyix (Aloha): HMAC-SHA256 hex digest.
 * Signature in header: X-NCR-Signature
 */
export function validateNcrVoyixSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  )
}

/**
 * SpotOn: HMAC-SHA256 hex digest.
 * Signature in header: X-SpotOn-Signature
 */
export function validateSpotOnSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  )
}

/**
 * Revel Systems: HMAC-SHA256 hex digest.
 * Signature in header: X-Revel-Signature
 */
export function validateRevelSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  )
}

/**
 * TouchBistro: HMAC-SHA256 hex digest.
 * Signature in header: X-TouchBistro-Signature
 */
export function validateTouchBistroSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  )
}

/**
 * Gastrofix: HMAC-SHA256 hex digest.
 * Signature in header: X-Gastrofix-Signature
 */
export function validateGastrofixSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  )
}

/**
 * iiko: HMAC-SHA256 hex digest.
 * Signature in header: X-iiko-Signature
 */
export function validateIikoSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  )
}

/**
 * POSRocket: HMAC-SHA256 hex digest.
 * Signature in header: X-PosRocket-Signature
 */
export function validatePosRocketSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  )
}

/**
 * PAR Brink: HMAC-SHA256 hex digest.
 * Signature in header: X-Brink-Signature
 */
export function validateParBrinkSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  )
}

/**
 * Heartland: HMAC-SHA256 hex digest.
 * Signature in header: X-Heartland-Signature
 */
export function validateHeartlandSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  )
}

/**
 * HungerRush: HMAC-SHA256 hex digest.
 * Signature in header: X-HungerRush-Signature
 */
export function validateHungerRushSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  )
}

/**
 * CAKE (Mad Mobile): HMAC-SHA256 hex digest.
 * Signature in header: X-Cake-Signature
 */
export function validateCakeSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  )
}

/**
 * Lavu: HMAC-SHA256 hex digest.
 * Signature in header: X-Lavu-Signature
 */
export function validateLavuSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  )
}

/**
 * Focus POS: HMAC-SHA256 hex digest.
 * Signature in header: X-FocusPOS-Signature
 */
export function validateFocusPosSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  )
}

/**
 * Shopify POS: HMAC-SHA256 base64 digest.
 * Signature in header: X-Shopify-Hmac-Sha256
 */
export function validateShopifyPosSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('base64')
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  )
}

/**
 * Aldelo Express: HMAC-SHA256 hex digest.
 * Signature in header: X-Aldelo-Signature
 */
export function validateAldeloExpressSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  )
}

/**
 * Squirrel Systems: HMAC-SHA256 hex digest.
 * Signature in header: X-Squirrel-Signature
 */
export function validateSquirrelSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  )
}

/**
 * GoTab: HMAC-SHA256 hex digest.
 * Signature in header: X-GoTab-Signature
 */
export function validateGoTabSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  )
}

/**
 * Xenial (Global Payments): HMAC-SHA256 hex digest.
 * Signature in header: X-Xenial-Signature
 */
export function validateXenialSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  )
}

/**
 * Qu POS: HMAC-SHA256 hex digest.
 * Signature in header: X-QuPOS-Signature
 */
export function validateQuPosSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  )
}

/**
 * Future POS: HMAC-SHA256 hex digest.
 * Signature in header: X-FuturePOS-Signature
 */
export function validateFuturePosSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  )
}

/**
 * Upserve (Lightspeed Restaurant): HMAC-SHA256 hex digest.
 * Signature in header: X-Upserve-Signature
 */
export function validateUpserveSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  )
}

/**
 * SICOM: HMAC-SHA256 hex digest.
 * Signature in header: X-SICOM-Signature
 */
export function validateSicomSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  )
}

/**
 * POSitouch: HMAC-SHA256 hex digest.
 * Signature in header: X-POSitouch-Signature
 */
export function validatePosiTouchSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  )
}

/**
 * Harbortouch (Shift4): HMAC-SHA256 hex digest.
 * Signature in header: X-Harbortouch-Signature
 */
export function validateHarbortouchSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  )
}

/**
 * Digital Dining (Menusoft): HMAC-SHA256 hex digest.
 * Signature in header: X-DigitalDining-Signature
 */
export function validateDigitalDiningSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  )
}

/**
 * Maitre'D (PayFacto): HMAC-SHA256 hex digest.
 * Signature in header: X-MaitreD-Signature
 */
export function validateMaitredSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  )
}

/**
 * Speedline: HMAC-SHA256 hex digest.
 * Signature in header: X-Speedline-Signature
 */
export function validateSpeedlineSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  )
}

/**
 * Custom webhook: standard HMAC-SHA256 hex digest (same as our API webhooks).
 */
export function validateCustomSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  )
}
