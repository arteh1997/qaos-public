import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import {
  auditLog,
  auditLogBatch,
  createAuditContext,
  AuditLogEntry,
} from '@/lib/audit'

// Mock Supabase client
const mockInsert = vi.fn()
const mockMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
const mockEq = vi.fn(() => ({ maybeSingle: mockMaybeSingle }))
const mockSelect = vi.fn(() => ({ eq: mockEq }))
const mockSupabase = {
  from: vi.fn((table: string) => {
    if (table === 'profiles') {
      return { select: mockSelect }
    }
    return { insert: mockInsert }
  }),
}

// Helper to create mock NextRequest
function createMockRequest(headers?: Record<string, string>): NextRequest {
  const headerObj = new Headers(headers)
  return {
    headers: headerObj,
  } as unknown as NextRequest
}

describe('Audit Logging', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockInsert.mockResolvedValue({ error: null })
  })

  describe('auditLog', () => {
    it('should insert audit log entry', async () => {
      const entry: AuditLogEntry = {
        userId: 'user-123',
        userEmail: 'test@example.com',
        action: 'user.invite',
        storeId: 'store-456',
        resourceType: 'user_invite',
        resourceId: 'invite-789',
        details: { email: 'invited@example.com', role: 'Staff' },
      }

      await auditLog(mockSupabase as any, entry)

      expect(mockSupabase.from).toHaveBeenCalledWith('audit_logs')
      expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
        user_id: 'user-123',
        user_email: 'test@example.com',
        action: 'user.invite',
        action_category: 'user',
        store_id: 'store-456',
        resource_type: 'user_invite',
        resource_id: 'invite-789',
        details: { email: 'invited@example.com', role: 'Staff' },
      }))
    })

    it('should extract category from action', async () => {
      const actions = [
        { action: 'auth.login', expectedCategory: 'auth' },
        { action: 'user.invite', expectedCategory: 'user' },
        { action: 'store.create', expectedCategory: 'store' },
        { action: 'stock.count_submit', expectedCategory: 'stock' },
        { action: 'inventory.item_create', expectedCategory: 'inventory' },
        { action: 'shift.create', expectedCategory: 'shift' },
        { action: 'settings.profile_update', expectedCategory: 'settings' },
        { action: 'report.export', expectedCategory: 'report' },
      ]

      for (const { action, expectedCategory } of actions) {
        vi.clearAllMocks()
        mockInsert.mockResolvedValue({ error: null })

        await auditLog(mockSupabase as any, { action })

        expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
          action_category: expectedCategory,
        }))
      }
    })

    it('should handle missing optional fields', async () => {
      await auditLog(mockSupabase as any, {
        action: 'auth.login',
      })

      expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
        user_id: null,
        user_email: null,
        store_id: null,
        resource_type: null,
        resource_id: null,
        details: {},
        ip_address: null,
        user_agent: null,
      }))
    })

    it('should extract IP from x-forwarded-for header', async () => {
      const request = createMockRequest({
        'x-forwarded-for': '192.168.1.1, 10.0.0.1',
      })

      await auditLog(mockSupabase as any, {
        action: 'auth.login',
        request,
      })

      expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
        ip_address: '192.168.1.1',
      }))
    })

    it('should extract IP from x-real-ip header', async () => {
      const request = createMockRequest({
        'x-real-ip': '10.20.30.40',
      })

      await auditLog(mockSupabase as any, {
        action: 'auth.login',
        request,
      })

      expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
        ip_address: '10.20.30.40',
      }))
    })

    it('should extract IP from x-client-ip header', async () => {
      const request = createMockRequest({
        'x-client-ip': '172.16.0.1',
      })

      await auditLog(mockSupabase as any, {
        action: 'auth.login',
        request,
      })

      expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
        ip_address: '172.16.0.1',
      }))
    })

    it('should extract user agent from request', async () => {
      const request = createMockRequest({
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      })

      await auditLog(mockSupabase as any, {
        action: 'auth.login',
        request,
      })

      expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
        user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      }))
    })

    it('should not throw on insert error', async () => {
      mockInsert.mockResolvedValue({ error: new Error('Database error') })

      await expect(
        auditLog(mockSupabase as any, { action: 'auth.login' })
      ).resolves.not.toThrow()
    })

    it('should not throw on unexpected exception', async () => {
      mockInsert.mockRejectedValue(new Error('Unexpected error'))

      await expect(
        auditLog(mockSupabase as any, { action: 'auth.login' })
      ).resolves.not.toThrow()
    })
  })

  describe('auditLogBatch', () => {
    it('should insert multiple audit log entries', async () => {
      const entries: AuditLogEntry[] = [
        { action: 'user.invite', userId: 'user-1' },
        { action: 'user.invite', userId: 'user-2' },
        { action: 'user.invite', userId: 'user-3' },
      ]

      await auditLogBatch(mockSupabase as any, entries)

      expect(mockInsert).toHaveBeenCalledWith(expect.arrayContaining([
        expect.objectContaining({ user_id: 'user-1' }),
        expect.objectContaining({ user_id: 'user-2' }),
        expect.objectContaining({ user_id: 'user-3' }),
      ]))
    })

    it('should not insert if entries array is empty', async () => {
      await auditLogBatch(mockSupabase as any, [])

      expect(mockInsert).not.toHaveBeenCalled()
    })

    it('should not throw on insert error', async () => {
      mockInsert.mockResolvedValue({ error: new Error('Database error') })

      await expect(
        auditLogBatch(mockSupabase as any, [{ action: 'auth.login' }])
      ).resolves.not.toThrow()
    })

    it('should not throw on unexpected exception', async () => {
      mockInsert.mockRejectedValue(new Error('Unexpected error'))

      await expect(
        auditLogBatch(mockSupabase as any, [{ action: 'auth.login' }])
      ).resolves.not.toThrow()
    })
  })

  describe('createAuditContext', () => {
    it('should create partial audit entry with common fields', () => {
      const request = createMockRequest()
      const context = createAuditContext(request, 'user-123', 'test@example.com')

      expect(context).toEqual({
        request,
        userId: 'user-123',
        userEmail: 'test@example.com',
      })
    })

    it('should handle null user fields', () => {
      const request = createMockRequest()
      const context = createAuditContext(request, null, null)

      expect(context).toEqual({
        request,
        userId: null,
        userEmail: null,
      })
    })

    it('should handle undefined user fields', () => {
      const request = createMockRequest()
      const context = createAuditContext(request)

      expect(context).toEqual({
        request,
        userId: undefined,
        userEmail: undefined,
      })
    })
  })
})
