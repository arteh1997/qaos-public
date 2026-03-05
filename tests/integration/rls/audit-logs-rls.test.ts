/**
 * RLS Integration Tests: audit_logs
 *
 * Tests Row Level Security policies for audit log access.
 * Ensures sensitive activity logs are properly isolated by store and role.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import {
  createTestUser,
  createTestStore,
  createAuthenticatedClient,
  deleteTestUser,
  deleteTestStore,
  adminClient,
  type TestUserCredentials,
  type TestStore,
} from '../../utils/rls-test-helpers'

describe('RLS: audit_logs', () => {
  let storeA: TestStore
  let storeB: TestStore
  let ownerA: TestUserCredentials
  let managerA: TestUserCredentials
  let staffA: TestUserCredentials
  let ownerB: TestUserCredentials
  let platformAdmin: TestUserCredentials
  let logA1: { id: string }
  let logA2: { id: string }
  let logB1: { id: string }
  let logStaffA: { id: string }

  beforeAll(async () => {
    // Create two separate stores
    storeA = await createTestStore({ name: 'Test Store A - Audit RLS' })
    storeB = await createTestStore({ name: 'Test Store B - Audit RLS' })

    // Create users at each store
    ownerA = await createTestUser({
      email: 'owner-a-audit-rls@test.com',
      password: 'TestPass123!',
      role: 'Owner',
      storeId: storeA.id,
      cleanupFirst: true,
    })

    managerA = await createTestUser({
      email: 'manager-a-audit-rls@test.com',
      password: 'TestPass123!',
      role: 'Manager',
      storeId: storeA.id,
      cleanupFirst: true,
    })

    staffA = await createTestUser({
      email: 'staff-a-audit-rls@test.com',
      password: 'TestPass123!',
      role: 'Staff',
      storeId: storeA.id,
      cleanupFirst: true,
    })

    ownerB = await createTestUser({
      email: 'owner-b-audit-rls@test.com',
      password: 'TestPass123!',
      role: 'Owner',
      storeId: storeB.id,
      cleanupFirst: true,
    })

    platformAdmin = await createTestUser({
      email: 'admin-audit-rls@test.com',
      password: 'TestPass123!',
      role: 'Owner',
      isPlatformAdmin: true,
      cleanupFirst: true,
    })

    // Create audit logs using admin (service role)
     
    const adminAny = adminClient as any

    const { data: log1 } = await adminAny
      .from('audit_logs')
      .insert({
        user_id: ownerA.id,
        user_email: ownerA.email,
        action: 'inventory.create',
        action_category: 'inventory',
        store_id: storeA.id,
        resource_type: 'inventory_item',
        details: { item: 'Test Item 1' },
      })
      .select()
      .single()
    logA1 = log1

    const { data: log2 } = await adminAny
      .from('audit_logs')
      .insert({
        user_id: managerA.id,
        user_email: managerA.email,
        action: 'shift.create',
        action_category: 'shift',
        store_id: storeA.id,
        resource_type: 'shift',
        details: { shift_id: 'test-shift' },
      })
      .select()
      .single()
    logA2 = log2

    const { data: logB } = await adminAny
      .from('audit_logs')
      .insert({
        user_id: ownerB.id,
        user_email: ownerB.email,
        action: 'user.invite',
        action_category: 'user',
        store_id: storeB.id,
        resource_type: 'user',
        details: { email: 'invited@test.com' },
      })
      .select()
      .single()
    logB1 = logB

    const { data: logStaff } = await adminAny
      .from('audit_logs')
      .insert({
        user_id: staffA.id,
        user_email: staffA.email,
        action: 'shift.clock_in',
        action_category: 'shift',
        store_id: storeA.id,
        resource_type: 'shift',
        details: { shift_id: 'staff-shift' },
      })
      .select()
      .single()
    logStaffA = logStaff
  }, 30000)

  afterAll(async () => {
    // Clean up audit logs
     
    const adminAny = adminClient as any
    await adminAny
      .from('audit_logs')
      .delete()
      .in('id', [logA1.id, logA2.id, logB1.id, logStaffA.id])

    // Clean up users and stores
    await deleteTestUser(ownerA.id)
    await deleteTestUser(managerA.id)
    await deleteTestUser(staffA.id)
    await deleteTestUser(ownerB.id)
    await deleteTestUser(platformAdmin.id)
    await deleteTestStore(storeA.id)
    await deleteTestStore(storeB.id)
  }, 30000)

  describe('Store Isolation', () => {
    it('should allow Owner A to see only Store A logs', async () => {
      const client = await createAuthenticatedClient(ownerA)
       
      const clientAny = client as any

      const { data, error } = await clientAny
        .from('audit_logs')
        .select('id, store_id, action')
        .in('id', [logA1.id, logA2.id, logB1.id, logStaffA.id])

      expect(error).toBeNull()
      expect(data).toBeDefined()

      // Owner should see Store A logs + their own logs
      // Should include at least logA1 and logStaffA (both Store A)
      const storeIds = data.map((log: { store_id: string | null }) => log.store_id).filter(Boolean)
      storeIds.forEach((storeId: string) => {
        expect(storeId).toBe(storeA.id)
      })

      // Should NOT see Store B logs
      const logIds = data.map((log: { id: string }) => log.id)
      expect(logIds).not.toContain(logB1.id)
    })

    it('should allow Owner B to see only Store B logs', async () => {
      const client = await createAuthenticatedClient(ownerB)
       
      const clientAny = client as any

      const { data, error } = await clientAny
        .from('audit_logs')
        .select('id, store_id, action')
        .in('id', [logA1.id, logA2.id, logB1.id])

      expect(error).toBeNull()
      expect(data).toBeDefined()

      // Should see logB1 (their own action)
      const logIds = data.map((log: { id: string }) => log.id)
      expect(logIds).toContain(logB1.id)

      // Should NOT see Store A logs
      expect(logIds).not.toContain(logA1.id)
      expect(logIds).not.toContain(logA2.id)
    })

    it('should prevent Owner A from accessing Store B logs directly', async () => {
      const client = await createAuthenticatedClient(ownerA)
       
      const clientAny = client as any

      const { data } = await clientAny
        .from('audit_logs')
        .select('id, store_id')
        .eq('id', logB1.id)
        .single()

      // RLS should prevent this
      expect(data).toBeNull()
    })
  })

  describe('Role-Based Access', () => {
    it('should allow Manager to see logs for their store', async () => {
      const client = await createAuthenticatedClient(managerA)
       
      const clientAny = client as any

      const { data, error } = await clientAny
        .from('audit_logs')
        .select('id, store_id, action')
        .eq('store_id', storeA.id)

      expect(error).toBeNull()
      expect(data).toBeDefined()

      // Manager should see Store A logs
      const logIds = data.map((log: { id: string }) => log.id)
      expect(logIds).toContain(logA1.id)
      expect(logIds).toContain(logA2.id)
      expect(logIds).toContain(logStaffA.id)
    })

    it('should allow Staff to see their own audit logs', async () => {
      const client = await createAuthenticatedClient(staffA)
       
      const clientAny = client as any

      const { data, error } = await clientAny
        .from('audit_logs')
        .select('id, user_id, action')
        .eq('user_id', staffA.id)

      expect(error).toBeNull()
      expect(data).toBeDefined()

      // Should see their own log
      const logIds = data.map((log: { id: string }) => log.id)
      expect(logIds).toContain(logStaffA.id)

      // All logs should belong to this user
      data.forEach((log: { user_id: string }) => {
        expect(log.user_id).toBe(staffA.id)
      })
    })

    it('should prevent Staff from seeing other users audit logs', async () => {
      const client = await createAuthenticatedClient(staffA)
       
      const clientAny = client as any

      const { data, error } = await clientAny
        .from('audit_logs')
        .select('id, user_id')
        .in('id', [logA1.id, logA2.id]) // Owner and Manager logs

      expect(error).toBeNull()
      expect(data).toBeDefined()
      expect(data.length).toBe(0) // Should not see others' logs
    })
  })

  describe('Platform Admin Access', () => {
    it('should allow platform admin to see ALL audit logs across stores', async () => {
      const client = await createAuthenticatedClient(platformAdmin)
       
      const clientAny = client as any

      const { data, error } = await clientAny
        .from('audit_logs')
        .select('id, store_id, action')
        .in('id', [logA1.id, logA2.id, logB1.id, logStaffA.id])

      expect(error).toBeNull()
      expect(data).toBeDefined()
      expect(data.length).toBe(4) // All logs

      // Should see logs from both stores
      const storeIds = [...new Set(data.map((log: { store_id: string | null }) => log.store_id).filter(Boolean))]
      expect(storeIds).toContain(storeA.id)
      expect(storeIds).toContain(storeB.id)
    })
  })

  describe('Immutability', () => {
    it('should prevent Owner from updating audit logs', async () => {
      const client = await createAuthenticatedClient(ownerA)
       
      const clientAny = client as any

      const { data, error } = await clientAny
        .from('audit_logs')
        .update({ action: 'hacked.action' })
        .eq('id', logA1.id)
        .select()

      // RLS silently filters - no error, but 0 rows affected
      expect(error).toBeNull()
      expect(data).toEqual([])
    })

    it('should prevent Owner from deleting audit logs', async () => {
      const client = await createAuthenticatedClient(ownerA)
       
      const clientAny = client as any

      const { data, error } = await clientAny
        .from('audit_logs')
        .delete()
        .eq('id', logA1.id)
        .select()

      // RLS silently filters - no error, but 0 rows affected
      expect(error).toBeNull()
      expect(data).toEqual([])
    })

    it('should prevent Platform Admin from updating audit logs', async () => {
      const client = await createAuthenticatedClient(platformAdmin)
       
      const clientAny = client as any

      const { data, error } = await clientAny
        .from('audit_logs')
        .update({ action: 'admin.hacked' })
        .eq('id', logB1.id)
        .select()

      // RLS silently filters - no error, but 0 rows affected
      expect(error).toBeNull()
      expect(data).toEqual([])
    })

    it('should allow service role to insert audit logs', async () => {
       
      const adminAny = adminClient as any

      const { data, error } = await adminAny
        .from('audit_logs')
        .insert({
          user_id: ownerA.id,
          user_email: ownerA.email,
          action: 'test.action',
          action_category: 'test',
          store_id: storeA.id,
          resource_type: 'test',
          details: { test: true },
        })
        .select()
        .single()

      expect(error).toBeNull()
      expect(data).toBeDefined()

      // Clean up
      await adminAny
        .from('audit_logs')
        .delete()
        .eq('id', data.id)
    })
  })

  describe('Multi-Store Users', () => {
    it('should allow users with multiple stores to see logs from all their stores', async () => {
      // Create a user who is Manager at both stores
      const multiStoreUser = await createTestUser({
        email: 'multi-store-audit-rls@test.com',
        password: 'TestPass123!',
        role: 'Manager',
        storeId: storeA.id,
        cleanupFirst: true,
      })

      // Add them to Store B as well
      const client = await createAuthenticatedClient(ownerB)
       
      const clientAny = client as any
      await clientAny
        .from('store_users')
        .insert({
          store_id: storeB.id,
          user_id: multiStoreUser.id,
          role: 'Manager',
          is_billing_owner: false,
        })

      // Create a log for them in Store B
       
      const adminAny = adminClient as any
      const { data: multiLog } = await adminAny
        .from('audit_logs')
        .insert({
          user_id: multiStoreUser.id,
          user_email: multiStoreUser.email,
          action: 'multi.action',
          action_category: 'test',
          store_id: storeB.id,
          resource_type: 'test',
          details: { multi: true },
        })
        .select()
        .single()

      // Query as multi-store user
      const multiClient = await createAuthenticatedClient(multiStoreUser)
       
      const multiClientAny = multiClient as any
      const { data, error } = await multiClientAny
        .from('audit_logs')
        .select('id, store_id')
        .in('store_id', [storeA.id, storeB.id])

      expect(error).toBeNull()
      expect(data).toBeDefined()

      // Should see logs from both stores
      const storeIds = [...new Set(data.map((log: { store_id: string }) => log.store_id))]
      expect(storeIds).toContain(storeA.id)
      expect(storeIds).toContain(storeB.id)

      // Clean up
      await adminAny
        .from('audit_logs')
        .delete()
        .eq('id', multiLog.id)
      await deleteTestUser(multiStoreUser.id)
    })
  })
})
