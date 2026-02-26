import { describe, it, expect } from 'vitest'
import crypto from 'crypto'
import {
  validateSquareSignature,
  validateToastSignature,
  validateCloverSignature,
  validateLightspeedSignature,
  validateZettleSignature,
  validateSumUpSignature,
  validateEposNowSignature,
  validateTevalisSignature,
  validateCustomSignature,
} from '@/lib/services/pos/webhook-validators'

// ── Helpers ──────────────────────────────────────────────────────────────────

function hmacHex(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex')
}

function hmacBase64(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('base64')
}

const TEST_SECRET = 'whsec_test_secret_key_12345'
const TEST_PAYLOAD = JSON.stringify({
  type: 'payment.completed',
  merchant_id: 'store_abc',
  data: { order_id: 'order_123', amount: 2499 },
})
const TEST_URL = 'https://app.example.com/api/pos/webhook/conn_xyz'

// ── Square (base64, signs url + body) ────────────────────────────────────────

describe('validateSquareSignature', () => {
  it('should accept a valid signature with URL', () => {
    const combined = TEST_URL + TEST_PAYLOAD
    const sig = hmacBase64(combined, TEST_SECRET)
    expect(validateSquareSignature(TEST_PAYLOAD, sig, TEST_SECRET, TEST_URL)).toBe(true)
  })

  it('should accept a valid signature without URL (empty string fallback)', () => {
    // When webhookUrl is omitted, combined = '' + payload = payload
    const sig = hmacBase64(TEST_PAYLOAD, TEST_SECRET)
    expect(validateSquareSignature(TEST_PAYLOAD, sig, TEST_SECRET)).toBe(true)
  })

  it('should return false for an invalid signature (same-length base64)', () => {
    // A base64 HMAC-SHA256 is always 44 chars, so timingSafeEqual returns false
    const wrongSig = hmacBase64('wrong-payload-same-len', TEST_SECRET)
    expect(validateSquareSignature(TEST_PAYLOAD, wrongSig, TEST_SECRET, TEST_URL)).toBe(false)
  })

  it('should return false when payload is tampered after signing', () => {
    const combined = TEST_URL + TEST_PAYLOAD
    const sig = hmacBase64(combined, TEST_SECRET)
    const tampered = TEST_PAYLOAD.replace('order_123', 'order_999')
    expect(validateSquareSignature(tampered, sig, TEST_SECRET, TEST_URL)).toBe(false)
  })

  it('should return false when a wrong secret is used', () => {
    const combined = TEST_URL + TEST_PAYLOAD
    const sig = hmacBase64(combined, TEST_SECRET)
    expect(validateSquareSignature(TEST_PAYLOAD, sig, 'wrong_secret', TEST_URL)).toBe(false)
  })

  it('should throw for an empty signature (length mismatch with expected)', () => {
    expect(() =>
      validateSquareSignature(TEST_PAYLOAD, '', TEST_SECRET, TEST_URL)
    ).toThrow()
  })

  it('should return false when URL differs from what was signed', () => {
    const combined = TEST_URL + TEST_PAYLOAD
    const sig = hmacBase64(combined, TEST_SECRET)
    expect(
      validateSquareSignature(TEST_PAYLOAD, sig, TEST_SECRET, 'https://other.example.com/webhook')
    ).toBe(false)
  })

  it('should use base64 encoding (not hex)', () => {
    const combined = TEST_URL + TEST_PAYLOAD
    const base64Sig = hmacBase64(combined, TEST_SECRET)
    const hexSig = hmacHex(combined, TEST_SECRET)
    // base64 should pass
    expect(validateSquareSignature(TEST_PAYLOAD, base64Sig, TEST_SECRET, TEST_URL)).toBe(true)
    // hex is 64 chars, base64 is 44 chars — length mismatch causes timingSafeEqual to throw
    expect(() =>
      validateSquareSignature(TEST_PAYLOAD, hexSig, TEST_SECRET, TEST_URL)
    ).toThrow()
  })

  it('should sign url + body concatenated, not body alone when URL is provided', () => {
    // Signing just the body should fail when a URL was expected in the combined string
    const bodyOnlySig = hmacBase64(TEST_PAYLOAD, TEST_SECRET)
    expect(
      validateSquareSignature(TEST_PAYLOAD, bodyOnlySig, TEST_SECRET, TEST_URL)
    ).toBe(false)
  })
})

// ── Toast (hex, signs body only) ─────────────────────────────────────────────

describe('validateToastSignature', () => {
  it('should accept a valid hex signature', () => {
    const sig = hmacHex(TEST_PAYLOAD, TEST_SECRET)
    expect(validateToastSignature(TEST_PAYLOAD, sig, TEST_SECRET)).toBe(true)
  })

  it('should return false for an invalid signature (same-length hex)', () => {
    // All SHA-256 hex digests are 64 chars, so timingSafeEqual returns false (not throw)
    const wrongSig = hmacHex('different-payload', TEST_SECRET)
    expect(validateToastSignature(TEST_PAYLOAD, wrongSig, TEST_SECRET)).toBe(false)
  })

  it('should return false for a tampered payload', () => {
    const sig = hmacHex(TEST_PAYLOAD, TEST_SECRET)
    const tampered = TEST_PAYLOAD.replace('2499', '100')
    expect(validateToastSignature(tampered, sig, TEST_SECRET)).toBe(false)
  })

  it('should return false when a wrong secret is used', () => {
    const sig = hmacHex(TEST_PAYLOAD, TEST_SECRET)
    expect(validateToastSignature(TEST_PAYLOAD, sig, 'wrong_secret')).toBe(false)
  })

  it('should throw for an empty signature (length mismatch)', () => {
    expect(() =>
      validateToastSignature(TEST_PAYLOAD, '', TEST_SECRET)
    ).toThrow()
  })

  it('should use hex encoding (not base64)', () => {
    const hexSig = hmacHex(TEST_PAYLOAD, TEST_SECRET)
    const base64Sig = hmacBase64(TEST_PAYLOAD, TEST_SECRET)
    expect(validateToastSignature(TEST_PAYLOAD, hexSig, TEST_SECRET)).toBe(true)
    // base64 is 44 chars, hex is 64 chars — length mismatch throws
    expect(() =>
      validateToastSignature(TEST_PAYLOAD, base64Sig, TEST_SECRET)
    ).toThrow()
  })
})

// ── Clover (base64, signs body only) ─────────────────────────────────────────

describe('validateCloverSignature', () => {
  it('should accept a valid base64 signature', () => {
    const sig = hmacBase64(TEST_PAYLOAD, TEST_SECRET)
    expect(validateCloverSignature(TEST_PAYLOAD, sig, TEST_SECRET)).toBe(true)
  })

  it('should return false for an invalid signature (same-length base64)', () => {
    const wrongSig = hmacBase64('wrong', TEST_SECRET)
    expect(validateCloverSignature(TEST_PAYLOAD, wrongSig, TEST_SECRET)).toBe(false)
  })

  it('should return false for a tampered payload', () => {
    const sig = hmacBase64(TEST_PAYLOAD, TEST_SECRET)
    const tampered = TEST_PAYLOAD.replace('store_abc', 'store_evil')
    expect(validateCloverSignature(tampered, sig, TEST_SECRET)).toBe(false)
  })

  it('should return false when a wrong secret is used', () => {
    const sig = hmacBase64(TEST_PAYLOAD, TEST_SECRET)
    expect(validateCloverSignature(TEST_PAYLOAD, sig, 'wrong_secret')).toBe(false)
  })

  it('should throw for an empty signature (length mismatch)', () => {
    expect(() =>
      validateCloverSignature(TEST_PAYLOAD, '', TEST_SECRET)
    ).toThrow()
  })

  it('should use base64 encoding (not hex)', () => {
    const base64Sig = hmacBase64(TEST_PAYLOAD, TEST_SECRET)
    const hexSig = hmacHex(TEST_PAYLOAD, TEST_SECRET)
    expect(validateCloverSignature(TEST_PAYLOAD, base64Sig, TEST_SECRET)).toBe(true)
    // hex is 64 chars, base64 is 44 chars — length mismatch throws
    expect(() =>
      validateCloverSignature(TEST_PAYLOAD, hexSig, TEST_SECRET)
    ).toThrow()
  })
})

// ── Lightspeed (hex, signs body only) ────────────────────────────────────────

describe('validateLightspeedSignature', () => {
  it('should accept a valid hex signature', () => {
    const sig = hmacHex(TEST_PAYLOAD, TEST_SECRET)
    expect(validateLightspeedSignature(TEST_PAYLOAD, sig, TEST_SECRET)).toBe(true)
  })

  it('should return false for an invalid signature', () => {
    const wrongSig = hmacHex('wrong-body', TEST_SECRET)
    expect(validateLightspeedSignature(TEST_PAYLOAD, wrongSig, TEST_SECRET)).toBe(false)
  })

  it('should return false for a tampered payload', () => {
    const sig = hmacHex(TEST_PAYLOAD, TEST_SECRET)
    const tampered = TEST_PAYLOAD.replace('payment.completed', 'payment.refunded')
    expect(validateLightspeedSignature(tampered, sig, TEST_SECRET)).toBe(false)
  })

  it('should return false when a wrong secret is used', () => {
    const sig = hmacHex(TEST_PAYLOAD, TEST_SECRET)
    expect(validateLightspeedSignature(TEST_PAYLOAD, sig, 'bad_secret')).toBe(false)
  })

  it('should throw for an empty signature (length mismatch)', () => {
    expect(() =>
      validateLightspeedSignature(TEST_PAYLOAD, '', TEST_SECRET)
    ).toThrow()
  })

  it('should use hex encoding (not base64)', () => {
    const hexSig = hmacHex(TEST_PAYLOAD, TEST_SECRET)
    const base64Sig = hmacBase64(TEST_PAYLOAD, TEST_SECRET)
    expect(validateLightspeedSignature(TEST_PAYLOAD, hexSig, TEST_SECRET)).toBe(true)
    expect(() =>
      validateLightspeedSignature(TEST_PAYLOAD, base64Sig, TEST_SECRET)
    ).toThrow()
  })
})

// ── Zettle (hex, signs body only) ────────────────────────────────────────────

describe('validateZettleSignature', () => {
  it('should accept a valid hex signature', () => {
    const sig = hmacHex(TEST_PAYLOAD, TEST_SECRET)
    expect(validateZettleSignature(TEST_PAYLOAD, sig, TEST_SECRET)).toBe(true)
  })

  it('should return false for an invalid signature', () => {
    const wrongSig = hmacHex('tampered-data', TEST_SECRET)
    expect(validateZettleSignature(TEST_PAYLOAD, wrongSig, TEST_SECRET)).toBe(false)
  })

  it('should return false for a tampered payload', () => {
    const sig = hmacHex(TEST_PAYLOAD, TEST_SECRET)
    const tampered = TEST_PAYLOAD.replace('store_abc', 'store_xyz')
    expect(validateZettleSignature(tampered, sig, TEST_SECRET)).toBe(false)
  })

  it('should return false when a wrong secret is used', () => {
    const sig = hmacHex(TEST_PAYLOAD, TEST_SECRET)
    expect(validateZettleSignature(TEST_PAYLOAD, sig, 'another_secret')).toBe(false)
  })

  it('should throw for an empty signature (length mismatch)', () => {
    expect(() =>
      validateZettleSignature(TEST_PAYLOAD, '', TEST_SECRET)
    ).toThrow()
  })
})

// ── SumUp (hex, signs body only) ─────────────────────────────────────────────

describe('validateSumUpSignature', () => {
  it('should accept a valid hex signature', () => {
    const sig = hmacHex(TEST_PAYLOAD, TEST_SECRET)
    expect(validateSumUpSignature(TEST_PAYLOAD, sig, TEST_SECRET)).toBe(true)
  })

  it('should return false for an invalid signature', () => {
    const wrongSig = hmacHex('not-the-payload', TEST_SECRET)
    expect(validateSumUpSignature(TEST_PAYLOAD, wrongSig, TEST_SECRET)).toBe(false)
  })

  it('should return false for a tampered payload', () => {
    const sig = hmacHex(TEST_PAYLOAD, TEST_SECRET)
    const tampered = TEST_PAYLOAD.replace('"amount":2499', '"amount":1')
    expect(validateSumUpSignature(tampered, sig, TEST_SECRET)).toBe(false)
  })

  it('should return false when a wrong secret is used', () => {
    const sig = hmacHex(TEST_PAYLOAD, TEST_SECRET)
    expect(validateSumUpSignature(TEST_PAYLOAD, sig, 'compromised_key')).toBe(false)
  })

  it('should throw for an empty signature (length mismatch)', () => {
    expect(() =>
      validateSumUpSignature(TEST_PAYLOAD, '', TEST_SECRET)
    ).toThrow()
  })
})

// ── Epos Now (hex, signs body only) ──────────────────────────────────────────

describe('validateEposNowSignature', () => {
  it('should accept a valid hex signature', () => {
    const sig = hmacHex(TEST_PAYLOAD, TEST_SECRET)
    expect(validateEposNowSignature(TEST_PAYLOAD, sig, TEST_SECRET)).toBe(true)
  })

  it('should return false for an invalid signature', () => {
    const wrongSig = hmacHex('garbage', TEST_SECRET)
    expect(validateEposNowSignature(TEST_PAYLOAD, wrongSig, TEST_SECRET)).toBe(false)
  })

  it('should return false for a tampered payload', () => {
    const sig = hmacHex(TEST_PAYLOAD, TEST_SECRET)
    const tampered = TEST_PAYLOAD.replace('order_123', 'order_hacked')
    expect(validateEposNowSignature(tampered, sig, TEST_SECRET)).toBe(false)
  })

  it('should return false when a wrong secret is used', () => {
    const sig = hmacHex(TEST_PAYLOAD, TEST_SECRET)
    expect(validateEposNowSignature(TEST_PAYLOAD, sig, 'leaked_key')).toBe(false)
  })

  it('should throw for an empty signature (length mismatch)', () => {
    expect(() =>
      validateEposNowSignature(TEST_PAYLOAD, '', TEST_SECRET)
    ).toThrow()
  })
})

// ── Tevalis (hex, signs body only) ───────────────────────────────────────────

describe('validateTevalisSignature', () => {
  it('should accept a valid hex signature', () => {
    const sig = hmacHex(TEST_PAYLOAD, TEST_SECRET)
    expect(validateTevalisSignature(TEST_PAYLOAD, sig, TEST_SECRET)).toBe(true)
  })

  it('should return false for an invalid signature', () => {
    const wrongSig = hmacHex('invalid-body', TEST_SECRET)
    expect(validateTevalisSignature(TEST_PAYLOAD, wrongSig, TEST_SECRET)).toBe(false)
  })

  it('should return false for a tampered payload', () => {
    const sig = hmacHex(TEST_PAYLOAD, TEST_SECRET)
    const tampered = TEST_PAYLOAD.replace('merchant_id', 'hacker_id')
    expect(validateTevalisSignature(tampered, sig, TEST_SECRET)).toBe(false)
  })

  it('should return false when a wrong secret is used', () => {
    const sig = hmacHex(TEST_PAYLOAD, TEST_SECRET)
    expect(validateTevalisSignature(TEST_PAYLOAD, sig, 'rotated_key')).toBe(false)
  })

  it('should throw for an empty signature (length mismatch)', () => {
    expect(() =>
      validateTevalisSignature(TEST_PAYLOAD, '', TEST_SECRET)
    ).toThrow()
  })
})

// ── Custom (hex, signs body only) ────────────────────────────────────────────

describe('validateCustomSignature', () => {
  it('should accept a valid hex signature', () => {
    const sig = hmacHex(TEST_PAYLOAD, TEST_SECRET)
    expect(validateCustomSignature(TEST_PAYLOAD, sig, TEST_SECRET)).toBe(true)
  })

  it('should return false for an invalid signature', () => {
    const wrongSig = hmacHex('spoofed-payload', TEST_SECRET)
    expect(validateCustomSignature(TEST_PAYLOAD, wrongSig, TEST_SECRET)).toBe(false)
  })

  it('should return false for a tampered payload', () => {
    const sig = hmacHex(TEST_PAYLOAD, TEST_SECRET)
    const tampered = TEST_PAYLOAD.replace('order_123', 'order_0')
    expect(validateCustomSignature(tampered, sig, TEST_SECRET)).toBe(false)
  })

  it('should return false when a wrong secret is used', () => {
    const sig = hmacHex(TEST_PAYLOAD, TEST_SECRET)
    expect(validateCustomSignature(TEST_PAYLOAD, sig, 'expired_secret')).toBe(false)
  })

  it('should throw for an empty signature (length mismatch)', () => {
    expect(() =>
      validateCustomSignature(TEST_PAYLOAD, '', TEST_SECRET)
    ).toThrow()
  })

  it('should use the same algorithm as the internal webhook system', () => {
    // Custom uses standard HMAC-SHA256 hex -- verify it matches a manual computation
    const manualSig = crypto.createHmac('sha256', TEST_SECRET).update(TEST_PAYLOAD).digest('hex')
    expect(validateCustomSignature(TEST_PAYLOAD, manualSig, TEST_SECRET)).toBe(true)
  })
})

// ── Cross-cutting HMAC behaviour ─────────────────────────────────────────────

describe('HMAC-SHA256 cross-cutting concerns', () => {
  it('all hex providers should accept the same hex signature for same payload and secret', () => {
    const hexSig = hmacHex(TEST_PAYLOAD, TEST_SECRET)
    expect(validateToastSignature(TEST_PAYLOAD, hexSig, TEST_SECRET)).toBe(true)
    expect(validateLightspeedSignature(TEST_PAYLOAD, hexSig, TEST_SECRET)).toBe(true)
    expect(validateZettleSignature(TEST_PAYLOAD, hexSig, TEST_SECRET)).toBe(true)
    expect(validateSumUpSignature(TEST_PAYLOAD, hexSig, TEST_SECRET)).toBe(true)
    expect(validateEposNowSignature(TEST_PAYLOAD, hexSig, TEST_SECRET)).toBe(true)
    expect(validateTevalisSignature(TEST_PAYLOAD, hexSig, TEST_SECRET)).toBe(true)
    expect(validateCustomSignature(TEST_PAYLOAD, hexSig, TEST_SECRET)).toBe(true)
  })

  it('all base64 providers should accept the same base64 signature for same payload and secret', () => {
    const base64Sig = hmacBase64(TEST_PAYLOAD, TEST_SECRET)
    expect(validateCloverSignature(TEST_PAYLOAD, base64Sig, TEST_SECRET)).toBe(true)
    // Square with no URL falls back to '' + payload which is just payload
    expect(validateSquareSignature(TEST_PAYLOAD, base64Sig, TEST_SECRET)).toBe(true)
  })

  it('should be deterministic -- same inputs always produce the same result', () => {
    const sig = hmacHex(TEST_PAYLOAD, TEST_SECRET)
    for (let i = 0; i < 10; i++) {
      expect(validateToastSignature(TEST_PAYLOAD, sig, TEST_SECRET)).toBe(true)
    }
  })

  it('should throw for cross-encoding (hex sig to base64 provider) due to length mismatch', () => {
    const hexSig = hmacHex(TEST_PAYLOAD, TEST_SECRET)
    // Clover expects base64 (44 chars), hex is 64 chars -- length mismatch throws
    expect(() =>
      validateCloverSignature(TEST_PAYLOAD, hexSig, TEST_SECRET)
    ).toThrow()
  })

  it('should throw for cross-encoding (base64 sig to hex provider) due to length mismatch', () => {
    const base64Sig = hmacBase64(TEST_PAYLOAD, TEST_SECRET)
    // Toast expects hex (64 chars), base64 is 44 chars -- length mismatch throws
    expect(() =>
      validateToastSignature(TEST_PAYLOAD, base64Sig, TEST_SECRET)
    ).toThrow()
  })

  it('should handle unicode payloads correctly for hex providers', () => {
    const unicodePayload = JSON.stringify({ name: 'Caf\u00e9 Menu \u2014 \u00a312.50' })
    const hexSig = hmacHex(unicodePayload, TEST_SECRET)
    expect(validateToastSignature(unicodePayload, hexSig, TEST_SECRET)).toBe(true)
    expect(validateLightspeedSignature(unicodePayload, hexSig, TEST_SECRET)).toBe(true)
    expect(validateCustomSignature(unicodePayload, hexSig, TEST_SECRET)).toBe(true)
  })

  it('should handle unicode payloads correctly for base64 providers', () => {
    const unicodePayload = JSON.stringify({ name: 'Caf\u00e9 Menu \u2014 \u00a312.50' })
    const base64Sig = hmacBase64(unicodePayload, TEST_SECRET)
    expect(validateCloverSignature(unicodePayload, base64Sig, TEST_SECRET)).toBe(true)
    expect(validateSquareSignature(unicodePayload, base64Sig, TEST_SECRET)).toBe(true)
  })

  it('should handle large payloads', () => {
    const largePayload = JSON.stringify({
      items: Array.from({ length: 1000 }, (_, i) => ({ id: i, name: `Item ${i}` })),
    })
    const sig = hmacHex(largePayload, TEST_SECRET)
    expect(validateCustomSignature(largePayload, sig, TEST_SECRET)).toBe(true)
  })

  it('should handle empty payload string', () => {
    const emptyPayload = ''
    const sig = hmacHex(emptyPayload, TEST_SECRET)
    expect(validateCustomSignature(emptyPayload, sig, TEST_SECRET)).toBe(true)
  })

  it('should return false for even a single-character change in payload', () => {
    const sig = hmacHex(TEST_PAYLOAD, TEST_SECRET)
    // Change last character before the closing brace
    const altered = TEST_PAYLOAD.slice(0, -2) + '0}'
    expect(validateCustomSignature(altered, sig, TEST_SECRET)).toBe(false)
  })

  it('should return false when signing key has trailing whitespace', () => {
    const sig = hmacHex(TEST_PAYLOAD, TEST_SECRET)
    expect(validateCustomSignature(TEST_PAYLOAD, sig, TEST_SECRET + ' ')).toBe(false)
  })

  it('should use HMAC-SHA256 (not SHA1 or SHA512)', () => {
    // Verify that a sha1 digest does NOT match
    const sha1Sig = crypto.createHmac('sha1', TEST_SECRET).update(TEST_PAYLOAD).digest('hex')
    // sha1 hex is 40 chars, sha256 hex is 64 chars -- length mismatch throws
    expect(() =>
      validateCustomSignature(TEST_PAYLOAD, sha1Sig, TEST_SECRET)
    ).toThrow()

    // Verify that a sha512 digest does NOT match
    const sha512Sig = crypto.createHmac('sha512', TEST_SECRET).update(TEST_PAYLOAD).digest('hex')
    // sha512 hex is 128 chars, sha256 hex is 64 chars -- length mismatch throws
    expect(() =>
      validateCustomSignature(TEST_PAYLOAD, sha512Sig, TEST_SECRET)
    ).toThrow()

    // sha256 works
    const sha256Sig = hmacHex(TEST_PAYLOAD, TEST_SECRET)
    expect(validateCustomSignature(TEST_PAYLOAD, sha256Sig, TEST_SECRET)).toBe(true)
  })

  it('should use timing-safe comparison (no early bail-out)', () => {
    // We cannot directly test timing, but we can verify the function uses
    // crypto.timingSafeEqual by confirming that mismatched buffer lengths
    // throw (the hallmark of timingSafeEqual) rather than returning false
    const sig = hmacHex(TEST_PAYLOAD, TEST_SECRET)
    expect(() =>
      validateCustomSignature(TEST_PAYLOAD, sig.slice(0, 32), TEST_SECRET)
    ).toThrow()
  })
})
