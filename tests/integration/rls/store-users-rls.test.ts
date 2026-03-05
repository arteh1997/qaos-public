/**
 * RLS Integration Tests: store_users
 *
 * Tests Row Level Security policies for store team member access.
 * Ensures users can only see team members from their own stores.
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

describe('RLS: store_users', () => {
  let storeA: TestStore
  let storeB: TestStore
  let ownerA: TestUserCredentials
  let managerA: TestUserCredentials
  let staffA: TestUserCredentials
  let ownerB: TestUserCredentials
  let staffB: TestUserCredentials
  let platformAdmin: TestUserCredentials

  beforeAll(async () => {
    // Create two separate stores
    storeA = await createTestStore({ name: 'Test Store A - Users RLS' })
    storeB = await createTestStore({ name: 'Test Store B - Users RLS' })

    // Create users at Store A
    ownerA = await createTestUser({
      email: 'owner-a-users-rls@test.com',
      password: 'TestPass123!',
      role: 'Owner',
      storeId: storeA.id,
      cleanupFirst: true,
    })

    managerA = await createTestUser({
      email: 'manager-a-users-rls@test.com',
      password: 'TestPass123!',
      role: 'Manager',
      storeId: storeA.id,
      cleanupFirst: true,
    })

    staffA = await createTestUser({
      email: 'staff-a-users-rls@test.com',
      password: 'TestPass123!',
      role: 'Staff',
      storeId: storeA.id,
      cleanupFirst: true,
    })

    // Create users at Store B
    ownerB = await createTestUser({
      email: 'owner-b-users-rls@test.com',
      password: 'TestPass123!',
      role: 'Owner',
      storeId: storeB.id,
      cleanupFirst: true,
    })

    staffB = await createTestUser({
      email: 'staff-b-users-rls@test.com',
      password: 'TestPass123!',
      role: 'Staff',
      storeId: storeB.id,
      cleanupFirst: true,
    })

    // Create platform admin
    platformAdmin = await createTestUser({
      email: 'admin-users-rls@test.com',
      password: 'TestPass123!',
      role: 'Owner',
      isPlatformAdmin: true,
      cleanupFirst: true,
    })
  }, 30000)

  afterAll(async () => {
    // Clean up test data
    await deleteTestUser(ownerA.id)
    await deleteTestUser(managerA.id)
    await deleteTestUser(staffA.id)
    await deleteTestUser(ownerB.id)
    await deleteTestUser(staffB.id)
    await deleteTestUser(platformAdmin.id)
    await deleteTestStore(storeA.id)
    await deleteTestStore(storeB.id)
  }, 30000)

  describe('Store Isolation', () => {
    it('should allow Owner A to see only Store A team members', async () => {
      const client = await createAuthenticatedClient(ownerA)
       
      const clientAny = client as any

      const { data, error } = await clientAny
        .from('store_users')
        .select('id, user_id, store_id, role')
        .eq('store_id', storeA.id)

      expect(error).toBeNull()
      expect(data).toBeDefined()
      expect(data.length).toBe(3) // Owner, Manager, Staff

      // All memberships should be for Store A
      data.forEach((membership: { store_id: string }) => {
        expect(membership.store_id).toBe(storeA.id)
      })

      // Should see all three team members
      const userIds = data.map((m: { user_id: string }) => m.user_id).sort()
      expect(userIds).toEqual([ownerA.id, managerA.id, staffA.id].sort())
    })

    it('should prevent Owner A from seeing Store B team members', async () => {
      const client = await createAuthenticatedClient(ownerA)
       
      const clientAny = client as any

      const { data, error } = await clientAny
        .from('store_users')
        .select('id, user_id, store_id')
        .eq('store_id', storeB.id)

      expect(error).toBeNull()
      expect(data).toBeDefined()
      expect(data.length).toBe(0) // Should return empty, not Store B's data
    })

    it('should prevent Owner A from querying specific Store B membership', async () => {
      // First, get a Store B membership ID using admin
       
      const adminAny = adminClient as any
      const { data: storeBMemberships } = await adminAny
        .from('store_users')
        .select('id')
        .eq('store_id', storeB.id)
        .eq('user_id', ownerB.id)
        .single()

      const storeBMembershipId = storeBMemberships.id

      // Try to query it as Owner A
      const client = await createAuthenticatedClient(ownerA)
       
      const clientAny = client as any

      const { data, error } = await clientAny
        .from('store_users')
        .select('id, user_id, store_id')
        .eq('id', storeBMembershipId)
        .single()

      // RLS should prevent this
      expect(data).toBeNull()
    })

    it('should allow Staff to see team members from their store', async () => {
      const client = await createAuthenticatedClient(staffA)
       
      const clientAny = client as any

      const { data, error } = await clientAny
        .from('store_users')
        .select('user_id, role')
        .eq('store_id', storeA.id)

      expect(error).toBeNull()
      expect(data).toBeDefined()
      expect(data.length).toBe(3)

      // Should see same team as Owner A
      const userIds = data.map((m: { user_id: string }) => m.user_id).sort()
      expect(userIds).toEqual([ownerA.id, managerA.id, staffA.id].sort())
    })
  })

  describe('Role-Based Permissions', () => {
    it('should allow Owner to add team members to their store', async () => {
      const client = await createAuthenticatedClient(ownerA)
       
      const clientAny = client as any

      // Create a new test user (not in any store yet)
      const newUser = await createTestUser({
        email: 'new-member-rls@test.com',
        password: 'TestPass123!',
        role: 'Staff',
        cleanupFirst: true,
      })

      // Owner A should be able to add them to Store A
      const { data, error } = await clientAny
        .from('store_users')
        .insert({
          store_id: storeA.id,
          user_id: newUser.id,
          role: 'Staff',
          is_billing_owner: false,
        })
        .select()
        .single()

      expect(error).toBeNull()
      expect(data).toBeDefined()
      expect(data.store_id).toBe(storeA.id)
      expect(data.user_id).toBe(newUser.id)

      // Clean up
      await clientAny
        .from('store_users')
        .delete()
        .eq('id', data.id)
      await deleteTestUser(newUser.id)
    })

    it('should prevent Owner from adding members to other stores', async () => {
      const client = await createAuthenticatedClient(ownerA)
       
      const clientAny = client as any

      // Create a new user
      const newUser = await createTestUser({
        email: 'new-member-cross-rls@test.com',
        password: 'TestPass123!',
        role: 'Staff',
        cleanupFirst: true,
      })

      // Owner A should NOT be able to add them to Store B
      const { error } = await clientAny
        .from('store_users')
        .insert({
          store_id: storeB.id, // Different store!
          user_id: newUser.id,
          role: 'Staff',
          is_billing_owner: false,
        })

      // Should fail - cannot add to other stores
      expect(error).not.toBeNull()

      // Clean up
      await deleteTestUser(newUser.id)
    })

    it('should allow Manager to view team members', async () => {
      const client = await createAuthenticatedClient(managerA)
       
      const clientAny = client as any

      const { data, error } = await clientAny
        .from('store_users')
        .select('user_id, role')
        .eq('store_id', storeA.id)

      expect(error).toBeNull()
      expect(data).toBeDefined()
      expect(data.length).toBe(3)
    })

    it('should allow Manager to add team members', async () => {
      const client = await createAuthenticatedClient(managerA)
       
      const clientAny = client as any

      // Create a new user
      const newUser = await createTestUser({
        email: 'new-member-manager-rls@test.com',
        password: 'TestPass123!',
        role: 'Staff',
        cleanupFirst: true,
      })

      // Manager should be able to add team members
      const { data, error } = await clientAny
        .from('store_users')
        .insert({
          store_id: storeA.id,
          user_id: newUser.id,
          role: 'Staff',
          is_billing_owner: false,
        })
        .select()
        .single()

      expect(error).toBeNull()
      expect(data).toBeDefined()

      // Clean up
      await clientAny
        .from('store_users')
        .delete()
        .eq('id', data.id)
      await deleteTestUser(newUser.id)
    })

    it('should prevent Staff from adding team members', async () => {
      const client = await createAuthenticatedClient(staffA)
       
      const clientAny = client as any

      // Create a new user
      const newUser = await createTestUser({
        email: 'new-member-staff-rls@test.com',
        password: 'TestPass123!',
        role: 'Staff',
        cleanupFirst: true,
      })

      // Staff should NOT be able to add team members
      const { error } = await clientAny
        .from('store_users')
        .insert({
          store_id: storeA.id,
          user_id: newUser.id,
          role: 'Staff',
          is_billing_owner: false,
        })

      // Should fail - Staff cannot manage users
      expect(error).not.toBeNull()

      // Clean up
      await deleteTestUser(newUser.id)
    })
  })

  describe('Platform Admin Access', () => {
    it('should allow platform admin to see ALL store memberships', async () => {
      const client = await createAuthenticatedClient(platformAdmin)
       
      const clientAny = client as any

      const { data, error } = await clientAny
        .from('store_users')
        .select('user_id, store_id, role')
        .in('store_id', [storeA.id, storeB.id])

      expect(error).toBeNull()
      expect(data).toBeDefined()
      expect(data.length).toBeGreaterThanOrEqual(5) // At least 3 for Store A + 2 for Store B

      // Should see memberships from both stores
      const storeIds = [...new Set(data.map((m: { store_id: string }) => m.store_id))]
      expect(storeIds).toContain(storeA.id)
      expect(storeIds).toContain(storeB.id)
    })

    it('should allow platform admin to modify memberships in any store', async () => {
      const client = await createAuthenticatedClient(platformAdmin)
       
      const clientAny = client as any

      // Get Staff B's membership
      const { data: membership } = await clientAny
        .from('store_users')
        .select('id')
        .eq('user_id', staffB.id)
        .eq('store_id', storeB.id)
        .single()

      // Update it (even though admin is not in Store B)
      const { data, error } = await clientAny
        .from('store_users')
        .update({ role: 'Manager' })
        .eq('id', membership.id)
        .select()
        .single()

      expect(error).toBeNull()
      expect(data).toBeDefined()
      expect(data.role).toBe('Manager')

      // Restore
      await clientAny
        .from('store_users')
        .update({ role: 'Staff' })
        .eq('id', membership.id)
    })
  })

  describe('Self-Management', () => {
    it('should allow users to view their own memberships', async () => {
      const client = await createAuthenticatedClient(ownerA)
       
      const clientAny = client as any

      const { data, error } = await clientAny
        .from('store_users')
        .select('store_id, role, is_billing_owner')
        .eq('user_id', ownerA.id)

      expect(error).toBeNull()
      expect(data).toBeDefined()
      expect(data.length).toBeGreaterThan(0)

      // Should include Store A membership
      const storeIds = data.map((m: { store_id: string }) => m.store_id)
      expect(storeIds).toContain(storeA.id)
    })
  })
})
