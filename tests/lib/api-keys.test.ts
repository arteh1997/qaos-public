import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock crypto
vi.mock('crypto', () => ({
  default: {
    randomBytes: vi.fn(() => ({
      toString: () => 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
    })),
    createHash: vi.fn(() => ({
      update: vi.fn(() => ({
        digest: vi.fn(() => 'hashed_key_value_here'),
      })),
    })),
    createHmac: vi.fn(() => ({
      update: vi.fn(() => ({
        digest: vi.fn(() => 'hmac_signature_here'),
      })),
    })),
  },
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          then: vi.fn(),
        })),
      })),
    })),
  })),
}))

describe('API Key Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('generateApiKey', () => {
    it('should generate a key with rk_live_ prefix', async () => {
      const { generateApiKey } = await import('@/lib/api/api-keys')
      const result = generateApiKey()

      expect(result.key).toMatch(/^rk_live_/)
      expect(result.keyHash).toBeDefined()
      expect(result.keyPrefix).toMatch(/^rk_live_/)
    })

    it('should return hash and prefix', async () => {
      const { generateApiKey } = await import('@/lib/api/api-keys')
      const result = generateApiKey()

      expect(result.keyHash).toBe('hashed_key_value_here')
      expect(result.keyPrefix.length).toBeGreaterThan(8)
    })
  })

  describe('hashApiKey', () => {
    it('should hash a key using SHA-256', async () => {
      const { hashApiKey } = await import('@/lib/api/api-keys')
      const hash = hashApiKey('rk_live_test123')

      expect(hash).toBe('hashed_key_value_here')
    })
  })

  describe('hasScope', () => {
    it('should match exact scope', async () => {
      const { hasScope } = await import('@/lib/api/api-keys')
      expect(hasScope(['inventory:read'], 'inventory:read')).toBe(true)
    })

    it('should not match different scope', async () => {
      const { hasScope } = await import('@/lib/api/api-keys')
      expect(hasScope(['inventory:read'], 'inventory:write')).toBe(false)
    })

    it('should match wildcard scope', async () => {
      const { hasScope } = await import('@/lib/api/api-keys')
      expect(hasScope(['*'], 'inventory:read')).toBe(true)
      expect(hasScope(['*'], 'stock:write')).toBe(true)
    })

    it('should match category wildcard', async () => {
      const { hasScope } = await import('@/lib/api/api-keys')
      expect(hasScope(['inventory:*'], 'inventory:read')).toBe(true)
      expect(hasScope(['inventory:*'], 'inventory:write')).toBe(true)
      expect(hasScope(['inventory:*'], 'stock:read')).toBe(false)
    })

    it('should handle empty scopes', async () => {
      const { hasScope } = await import('@/lib/api/api-keys')
      expect(hasScope([], 'inventory:read')).toBe(false)
    })
  })

  describe('signWebhookPayload', () => {
    it('should sign payload with HMAC-SHA256', async () => {
      const { signWebhookPayload } = await import('@/lib/api/api-keys')
      const signature = signWebhookPayload('{"test": true}', 'secret')

      expect(signature).toBe('hmac_signature_here')
    })
  })

  describe('generateWebhookSecret', () => {
    it('should generate a secret with whsec_ prefix', async () => {
      const { generateWebhookSecret } = await import('@/lib/api/api-keys')
      const secret = generateWebhookSecret()

      expect(secret).toMatch(/^whsec_/)
    })
  })

  describe('validateApiKey', () => {
    it('should reject empty key', async () => {
      const { validateApiKey } = await import('@/lib/api/api-keys')
      const result = await validateApiKey('')

      expect(result?.valid).toBe(false)
    })

    it('should reject key without proper prefix', async () => {
      const { validateApiKey } = await import('@/lib/api/api-keys')
      const result = await validateApiKey('invalid_key')

      expect(result?.valid).toBe(false)
    })

    it('should reject key not found in database', async () => {
      const { validateApiKey } = await import('@/lib/api/api-keys')
      const result = await validateApiKey('rk_live_nonexistent')

      expect(result?.valid).toBe(false)
    })
  })

  describe('API_SCOPES', () => {
    it('should define expected scopes', async () => {
      const { API_SCOPES } = await import('@/lib/api/api-keys')

      expect(API_SCOPES['inventory:read']).toBeDefined()
      expect(API_SCOPES['inventory:write']).toBeDefined()
      expect(API_SCOPES['stock:read']).toBeDefined()
      expect(API_SCOPES['stock:write']).toBeDefined()
      expect(API_SCOPES['reports:read']).toBeDefined()
      expect(API_SCOPES['webhooks:manage']).toBeDefined()
      expect(API_SCOPES['*']).toBeDefined()
    })
  })
})
