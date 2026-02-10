#!/usr/bin/env tsx
/**
 * Verify RLS policies work correctly for authenticated users
 * Run with: npx tsx scripts/verify-rls-policies.ts
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

async function verifyRLS() {
  console.log('🔍 Verifying RLS Policies...\n')

  // Create client as authenticated user
  const supabase = createClient(supabaseUrl, supabaseAnonKey)

  // Sign in as a test user (you'll need to create one or use existing)
  const testEmail = 'test-rls@example.com'
  const testPassword = 'TestPassword123!'

  console.log(`📝 Signing in as ${testEmail}...`)

  // Try to sign in (if user doesn't exist, this will fail - that's ok)
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: testEmail,
    password: testPassword,
  })

  if (authError) {
    console.log('❌ User not found. Creating test user...')
    // For this script to work, you'd need to create the user first
    console.log('Please create a test user in your Supabase dashboard first.')
    return
  }

  console.log('✅ Signed in successfully\n')

  // Test 1: Try to update an audit log (should return 0 rows affected)
  console.log('📋 Test 1: Attempting to UPDATE audit_logs (should affect 0 rows)...')

  const { data: auditLogs } = await supabase.from('audit_logs').select('id').limit(1).single()

  if (auditLogs) {
    const { data: updateData, error: updateError, count } = await supabase
      .from('audit_logs')
      .update({ details: { modified: true } })
      .eq('id', auditLogs.id)
      .select()

    console.log('  error:', updateError)
    console.log('  data:', updateData)
    console.log('  count:', count)

    if (!updateError && (!updateData || updateData.length === 0)) {
      console.log('✅ PASS: UPDATE was silently filtered by RLS (0 rows affected)\n')
    } else if (updateError) {
      console.log('✅ PASS: UPDATE threw an error (policy blocked it)\n')
    } else {
      console.log('❌ FAIL: UPDATE succeeded when it should have been blocked\n')
    }
  }

  // Test 2: Try to delete an audit log (should return 0 rows affected)
  console.log('📋 Test 2: Attempting to DELETE audit_logs (should affect 0 rows)...')

  if (auditLogs) {
    const { data: deleteData, error: deleteError, count } = await supabase
      .from('audit_logs')
      .delete()
      .eq('id', auditLogs.id)
      .select()

    console.log('  error:', deleteError)
    console.log('  data:', deleteData)
    console.log('  count:', count)

    if (!deleteError && (!deleteData || deleteData.length === 0)) {
      console.log('✅ PASS: DELETE was silently filtered by RLS (0 rows affected)\n')
    } else if (deleteError) {
      console.log('✅ PASS: DELETE threw an error (policy blocked it)\n')
    } else {
      console.log('❌ FAIL: DELETE succeeded when it should have been blocked\n')
    }
  }

  await supabase.auth.signOut()
  console.log('✅ Verification complete!')
}

verifyRLS().catch(console.error)
