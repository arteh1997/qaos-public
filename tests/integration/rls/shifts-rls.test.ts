/**
 * RLS Integration Tests: shifts
 *
 * Tests Row Level Security policies for shift scheduling and timecards.
 * Ensures users can only see shifts from their assigned stores.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import {
  createTestUser,
  createTestStore,
  createTestShift,
  createAuthenticatedClient,
  deleteTestUser,
  deleteTestStore,
  type TestUserCredentials,
  type TestStore,
} from '../../utils/rls-test-helpers'

describe('RLS: shifts', () => {
  let storeA: TestStore
  let storeB: TestStore
  let ownerA: TestUserCredentials
  let staffA: TestUserCredentials
  let ownerB: TestUserCredentials
  let staffB: TestUserCredentials
  let platformAdmin: TestUserCredentials
  let shiftA1: { id: string }
  let shiftA2: { id: string }
  let shiftB1: { id: string }

  beforeAll(async () => {
    // Create two separate stores
    storeA = await createTestStore({ name: 'Test Store A - Shifts RLS' })
    storeB = await createTestStore({ name: 'Test Store B - Shifts RLS' })

    // Create users at each store
    ownerA = await createTestUser({
      email: 'owner-a-shifts-rls@test.com',
      password: 'TestPass123!',
      role: 'Owner',
      storeId: storeA.id,
      cleanupFirst: true,
    })

    staffA = await createTestUser({
      email: 'staff-a-shifts-rls@test.com',
      password: 'TestPass123!',
      role: 'Staff',
      storeId: storeA.id,
      cleanupFirst: true,
    })

    ownerB = await createTestUser({
      email: 'owner-b-shifts-rls@test.com',
      password: 'TestPass123!',
      role: 'Owner',
      storeId: storeB.id,
      cleanupFirst: true,
    })

    staffB = await createTestUser({
      email: 'staff-b-shifts-rls@test.com',
      password: 'TestPass123!',
      role: 'Staff',
      storeId: storeB.id,
      cleanupFirst: true,
    })

    platformAdmin = await createTestUser({
      email: 'admin-shifts-rls@test.com',
      password: 'TestPass123!',
      role: 'Owner',
      isPlatformAdmin: true,
      cleanupFirst: true,
    })

    // Create shifts for each store
    shiftA1 = await createTestShift({
      storeId: storeA.id,
      userId: staffA.id,
      date: '2026-02-10',
      startTime: '09:00:00',
      endTime: '17:00:00',
    })

    shiftA2 = await createTestShift({
      storeId: storeA.id,
      userId: ownerA.id,
      date: '2026-02-11',
      startTime: '10:00:00',
      endTime: '18:00:00',
    })

    shiftB1 = await createTestShift({
      storeId: storeB.id,
      userId: staffB.id,
      date: '2026-02-10',
      startTime: '08:00:00',
      endTime: '16:00:00',
    })
  }, 30000)

  afterAll(async () => {
    // Clean up test data
    await deleteTestUser(ownerA.id)
    await deleteTestUser(staffA.id)
    await deleteTestUser(ownerB.id)
    await deleteTestUser(staffB.id)
    await deleteTestUser(platformAdmin.id)
    await deleteTestStore(storeA.id)
    await deleteTestStore(storeB.id)
  }, 30000)

  describe('Store Isolation', () => {
    it('should allow Owner A to see only Store A shifts', async () => {
      const client = await createAuthenticatedClient(ownerA)
       
      const clientAny = client as any

      const { data, error } = await clientAny
        .from('shifts')
        .select('id, store_id, user_id, start_time')
        .in('id', [shiftA1.id, shiftA2.id, shiftB1.id])

      expect(error).toBeNull()
      expect(data).toBeDefined()
      expect(data.length).toBe(2) // Only Store A shifts

      // All shifts should belong to Store A
      data.forEach((shift: { store_id: string }) => {
        expect(shift.store_id).toBe(storeA.id)
      })

      const shiftIds = data.map((s: { id: string }) => s.id).sort()
      expect(shiftIds).toEqual([shiftA1.id, shiftA2.id].sort())
    })

    it('should allow Owner B to see only Store B shifts', async () => {
      const client = await createAuthenticatedClient(ownerB)
       
      const clientAny = client as any

      const { data, error } = await clientAny
        .from('shifts')
        .select('id, store_id, user_id')
        .in('id', [shiftA1.id, shiftA2.id, shiftB1.id])

      expect(error).toBeNull()
      expect(data).toBeDefined()
      expect(data.length).toBe(1) // Only Store B shift

      expect(data[0].id).toBe(shiftB1.id)
      expect(data[0].store_id).toBe(storeB.id)
    })

    it('should prevent Owner A from querying Store B shifts directly', async () => {
      const client = await createAuthenticatedClient(ownerA)
       
      const clientAny = client as any

      const { data } = await clientAny
        .from('shifts')
        .select('id')
        .eq('id', shiftB1.id)
        .single()

      // RLS should prevent this
      expect(data).toBeNull()
    })

    it('should prevent Owner A from accessing Store B via store_id filter', async () => {
      const client = await createAuthenticatedClient(ownerA)
       
      const clientAny = client as any

      const { data, error } = await clientAny
        .from('shifts')
        .select('id, store_id')
        .eq('store_id', storeB.id)

      expect(error).toBeNull()
      expect(data).toBeDefined()
      expect(data.length).toBe(0) // Should return empty, not Store B's data
    })
  })

  describe('User Visibility', () => {
    it('should allow Staff to see shifts at their store', async () => {
      const client = await createAuthenticatedClient(staffA)
       
      const clientAny = client as any

      const { data, error } = await clientAny
        .from('shifts')
        .select('id, store_id, user_id')
        .eq('store_id', storeA.id)

      expect(error).toBeNull()
      expect(data).toBeDefined()
      expect(data.length).toBe(2) // Both Store A shifts

      // Staff should see all shifts at their store, including others' shifts
      const shiftIds = data.map((s: { id: string }) => s.id).sort()
      expect(shiftIds).toEqual([shiftA1.id, shiftA2.id].sort())
    })

    it('should prevent Staff from seeing shifts at other stores', async () => {
      const client = await createAuthenticatedClient(staffA)
       
      const clientAny = client as any

      const { data, error } = await clientAny
        .from('shifts')
        .select('id, store_id')
        .eq('store_id', storeB.id)

      expect(error).toBeNull()
      expect(data).toBeDefined()
      expect(data.length).toBe(0) // No Store B access
    })
  })

  describe('Role-Based Permissions', () => {
    it('should allow Owner/Manager to create shifts', async () => {
      const client = await createAuthenticatedClient(ownerA)
       
      const clientAny = client as any

      const { data, error } = await clientAny
        .from('shifts')
        .insert({
          store_id: storeA.id,
          user_id: staffA.id,
          start_time: '2026-02-12T09:00:00',
          end_time: '2026-02-12T17:00:00',
        })
        .select()
        .single()

      expect(error).toBeNull()
      expect(data).toBeDefined()
      expect(data.store_id).toBe(storeA.id)

      // Clean up
      await clientAny
        .from('shifts')
        .delete()
        .eq('id', data.id)
    })

    it('should prevent Owner from creating shifts in other stores', async () => {
      const client = await createAuthenticatedClient(ownerA)
       
      const clientAny = client as any

      const { error } = await clientAny
        .from('shifts')
        .insert({
          store_id: storeB.id, // Different store!
          user_id: staffB.id,
          start_time: '2026-02-12T09:00:00',
          end_time: '2026-02-12T17:00:00',
        })

      // Should fail - cannot create shifts in other stores
      expect(error).not.toBeNull()
    })

    it('should allow Owner/Manager to update shifts in their store', async () => {
      const client = await createAuthenticatedClient(ownerA)
       
      const clientAny = client as any

      const { data, error } = await clientAny
        .from('shifts')
        .update({ start_time: '2026-02-10T10:00:00' })
        .eq('id', shiftA1.id)
        .select()
        .single()

      expect(error).toBeNull()
      expect(data).toBeDefined()
      expect(data.start_time).toContain('10:00:00')

      // Restore
      await clientAny
        .from('shifts')
        .update({ start_time: '2026-02-10T09:00:00' })
        .eq('id', shiftA1.id)
    })

    it('should prevent Staff from creating shifts', async () => {
      const client = await createAuthenticatedClient(staffA)
       
      const clientAny = client as any

      const { error } = await clientAny
        .from('shifts')
        .insert({
          store_id: storeA.id,
          user_id: staffA.id,
          start_time: '2026-02-12T09:00:00',
          end_time: '2026-02-12T17:00:00',
        })

      // Should fail - Staff cannot create shifts
      expect(error).not.toBeNull()
    })

    it('should prevent Staff from updating shift schedules', async () => {
      const client = await createAuthenticatedClient(staffA)
       
      const clientAny = client as any

      const { error } = await clientAny
        .from('shifts')
        .update({ start_time: '2026-02-10T10:00:00' })
        .eq('id', shiftA1.id)

      // Should fail - Staff cannot update schedules
      expect(error).not.toBeNull()
    })

    it('should allow Staff to update their own clock-in/out times', async () => {
      const client = await createAuthenticatedClient(staffA)
       
      const clientAny = client as any

      // Note: This tests UPDATE permission - actual clock-in logic is in API
      // RLS should allow Staff to update clock_in_time/clock_out_time fields
      const { data, error } = await clientAny
        .from('shifts')
        .update({ clock_in_time: new Date().toISOString() })
        .eq('id', shiftA1.id)
        .eq('user_id', staffA.id) // Their own shift
        .select()
        .single()

      expect(error).toBeNull()
      expect(data).toBeDefined()
      expect(data.clock_in_time).not.toBeNull()

      // Restore
      await clientAny
        .from('shifts')
        .update({ clock_in_time: null })
        .eq('id', shiftA1.id)
    })
  })

  describe('Platform Admin Access', () => {
    it('should allow platform admin to see ALL shifts across stores', async () => {
      const client = await createAuthenticatedClient(platformAdmin)
       
      const clientAny = client as any

      const { data, error } = await clientAny
        .from('shifts')
        .select('id, store_id')
        .in('id', [shiftA1.id, shiftA2.id, shiftB1.id])

      expect(error).toBeNull()
      expect(data).toBeDefined()
      expect(data.length).toBe(3) // All shifts

      // Should see shifts from both stores
      const storeIds = [...new Set(data.map((s: { store_id: string }) => s.store_id))]
      expect(storeIds).toContain(storeA.id)
      expect(storeIds).toContain(storeB.id)
    })

    it('should allow platform admin to modify shifts in any store', async () => {
      const client = await createAuthenticatedClient(platformAdmin)
       
      const clientAny = client as any

      // Update shift in Store B (which admin is not a member of)
      const { data, error } = await clientAny
        .from('shifts')
        .update({ start_time: '2026-02-10T07:00:00' })
        .eq('id', shiftB1.id)
        .select()
        .single()

      expect(error).toBeNull()
      expect(data).toBeDefined()
      expect(data.start_time).toContain('07:00:00')

      // Restore
      await clientAny
        .from('shifts')
        .update({ start_time: '2026-02-10T08:00:00' })
        .eq('id', shiftB1.id)
    })
  })

  describe('Multi-Store Users', () => {
    it('should allow users with multiple stores to see shifts from all their stores', async () => {
      // Create a user who is Manager at both stores
      const multiStoreUser = await createTestUser({
        email: 'multi-store-shifts-rls@test.com',
        password: 'TestPass123!',
        role: 'Manager',
        storeId: storeA.id,
        cleanupFirst: true,
      })

      // Add them to Store B as well
       
      const client = await createAuthenticatedClient(ownerB)
       
      const clientAny = client as any
      const { data: insertData, error: insertError } = await clientAny
        .from('store_users')
        .insert({
          store_id: storeB.id,
          user_id: multiStoreUser.id,
          role: 'Manager',
          is_billing_owner: false,
        })
        .select()

      // Verify the insert succeeded
      expect(insertError).toBeNull()
      expect(insertData).toBeDefined()
      expect(insertData.length).toBe(1)

      // Now query shifts as the multi-store user
      const multiClient = await createAuthenticatedClient(multiStoreUser)
       
      const multiClientAny = multiClient as any
      const { data, error } = await multiClientAny
        .from('shifts')
        .select('id, store_id')
        .in('id', [shiftA1.id, shiftA2.id, shiftB1.id])

      expect(error).toBeNull()
      expect(data).toBeDefined()
      expect(data.length).toBe(3) // Should see all shifts from both stores

      // Should see shifts from both stores
      const storeIds = [...new Set(data.map((s: { store_id: string }) => s.store_id))]
      expect(storeIds).toContain(storeA.id)
      expect(storeIds).toContain(storeB.id)

      // Clean up
      await deleteTestUser(multiStoreUser.id)
    })
  })
})
