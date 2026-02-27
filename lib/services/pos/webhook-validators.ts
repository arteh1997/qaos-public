/**
 * POS Webhook Signature Validators
 *
 * Most POS providers use HMAC-SHA256 with either hex or base64 encoding.
 * The factory pattern eliminates per-provider duplication while preserving
 * every named export for adapter imports.
 */

import crypto from 'crypto'

/**
 * Factory for HMAC-SHA256 webhook signature validators.
 */
function createHmacValidator(
  encoding: 'hex' | 'base64'
): (payload: string, signature: string, secret: string) => boolean {
  return (payload, signature, secret) => {
    const expected = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest(encoding)
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expected)
    )
  }
}

// --- Square: special case (URL prepended to payload, base64 encoding) ---

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

// --- Base64 encoding validators ---

export const validateCloverSignature = createHmacValidator('base64')
export const validateShopifyPosSignature = createHmacValidator('base64')

// --- Standard hex encoding validators ---

export const validateToastSignature = createHmacValidator('hex')
export const validateLightspeedSignature = createHmacValidator('hex')
export const validateZettleSignature = createHmacValidator('hex')
export const validateSumUpSignature = createHmacValidator('hex')
export const validateEposNowSignature = createHmacValidator('hex')
export const validateTevalisSignature = createHmacValidator('hex')
export const validateFoodicsSignature = createHmacValidator('hex')
export const validateOracleMicrosSignature = createHmacValidator('hex')
export const validateNcrVoyixSignature = createHmacValidator('hex')
export const validateSpotOnSignature = createHmacValidator('hex')
export const validateRevelSignature = createHmacValidator('hex')
export const validateTouchBistroSignature = createHmacValidator('hex')
export const validateGastrofixSignature = createHmacValidator('hex')
export const validateIikoSignature = createHmacValidator('hex')
export const validatePosRocketSignature = createHmacValidator('hex')
export const validateParBrinkSignature = createHmacValidator('hex')
export const validateHeartlandSignature = createHmacValidator('hex')
export const validateHungerRushSignature = createHmacValidator('hex')
export const validateCakeSignature = createHmacValidator('hex')
export const validateLavuSignature = createHmacValidator('hex')
export const validateFocusPosSignature = createHmacValidator('hex')
export const validateAldeloExpressSignature = createHmacValidator('hex')
export const validateSquirrelSignature = createHmacValidator('hex')
export const validateGoTabSignature = createHmacValidator('hex')
export const validateXenialSignature = createHmacValidator('hex')
export const validateQuPosSignature = createHmacValidator('hex')
export const validateFuturePosSignature = createHmacValidator('hex')
export const validateUpserveSignature = createHmacValidator('hex')
export const validateSicomSignature = createHmacValidator('hex')
export const validatePosiTouchSignature = createHmacValidator('hex')
export const validateHarbortouchSignature = createHmacValidator('hex')
export const validateDigitalDiningSignature = createHmacValidator('hex')
export const validateMaitredSignature = createHmacValidator('hex')
export const validateSpeedlineSignature = createHmacValidator('hex')
export const validateCustomSignature = createHmacValidator('hex')
