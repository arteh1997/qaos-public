/**
 * User Invitation Service
 *
 * Shared logic for inviting users to stores.
 * Separates "existing user" vs "new user" invitation flows.
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'
import { sendEmail, getInviteEmailHtml, getAddedToStoreEmailHtml } from '@/lib/email'
import { auditLog } from '@/lib/audit'
import { debugError } from '@/lib/debug'
import crypto from 'crypto'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
const INVITE_EXPIRY_HOURS = 1

export interface InviteUserData {
  email: string
  role: string
  storeId?: string
  storeIds?: string[]
}

export interface InviterContext {
  userId: string
  userEmail: string
}

interface StoreDetails {
  id: string
  name: string
}

interface InviterDetails {
  fullName: string
  email: string
}

/**
 * Get store details by ID
 */
export async function getStoreDetails(
  supabase: SupabaseClient,
  storeId: string
): Promise<StoreDetails | null> {
  const { data: store } = await supabase
    .from('stores')
    .select('id, name')
    .eq('id', storeId)
    .single()

  return store
}

/**
 * Get inviter's profile details
 */
export async function getInviterDetails(
  supabase: SupabaseClient,
  userId: string
): Promise<InviterDetails | null> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, email')
    .eq('id', userId)
    .single()

  if (!profile) return null

  return {
    fullName: profile.full_name,
    email: profile.email,
  }
}

/**
 * Handle invitation for existing user (add to store directly)
 */
export async function handleExistingUserInvite(
  supabase: SupabaseClient,
  inviteData: InviteUserData,
  existingUserId: string,
  inviterContext: InviterContext,
  request: NextRequest
): Promise<{ success: boolean; error?: string; storeIds?: string[] }> {
  const storeIdsToAdd = inviteData.storeIds || (inviteData.storeId ? [inviteData.storeId] : [])

  if (storeIdsToAdd.length === 0) {
    return { success: false, error: 'No store specified for invitation' }
  }

  // Check if user is already a member of these stores
  const { data: existingMemberships } = await supabase
    .from('store_users')
    .select('store_id')
    .eq('user_id', existingUserId)
    .in('store_id', storeIdsToAdd)

  const existingStoreIds = new Set(
    existingMemberships?.map((m: { store_id: string }) => m.store_id) || []
  )
  const newStoreIds = storeIdsToAdd.filter(id => !existingStoreIds.has(id))

  if (newStoreIds.length === 0) {
    return { success: false, error: 'This user is already a member of this store' }
  }

  // Add user to the new stores
  const insertData = newStoreIds.map(storeId => ({
    store_id: storeId,
    user_id: existingUserId,
    role: inviteData.role,
    invited_by: inviterContext.userId,
  }))

  const { error: insertError } = await supabase.from('store_users').insert(insertData)

  if (insertError) {
    debugError('UserInvitation', 'Error adding user to store:', insertError)
    return { success: false, error: 'Failed to add user to store' }
  }

  // Get store and inviter details for email
  let storeDetails: StoreDetails | null = null
  if (inviteData.storeId) {
    storeDetails = await getStoreDetails(supabase, inviteData.storeId)
  }

  const inviterDetails = await getInviterDetails(supabase, inviterContext.userId)
  const addedByName = inviterDetails?.fullName || inviterDetails?.email || 'A team member'

  // Send "added to store" notification email
  if (storeDetails) {
    const emailHtml = getAddedToStoreEmailHtml({
      storeName: storeDetails.name,
      role: inviteData.role,
      addedByName,
      loginUrl: `${APP_URL}/login`,
    })

    await sendEmail({
      to: inviteData.email,
      subject: `You've been added to ${storeDetails.name}`,
      html: emailHtml,
    })
  }

  // Audit log
  await auditLog(supabase, {
    userId: inviterContext.userId,
    userEmail: inviterContext.userEmail,
    action: 'user.add_to_store',
    storeId: inviteData.storeId || null,
    resourceType: 'store_users',
    details: {
      addedUserId: existingUserId,
      addedEmail: inviteData.email,
      role: inviteData.role,
      storeName: storeDetails?.name,
      storeIds: newStoreIds,
    },
    request,
  })

  return { success: true, storeIds: newStoreIds }
}

/**
 * Handle invitation for new user (create invite record)
 */
export async function handleNewUserInvite(
  supabase: SupabaseClient,
  inviteData: InviteUserData,
  inviterContext: InviterContext,
  request: NextRequest
): Promise<{ success: boolean; error?: string; expiresAt?: string }> {
  // Check if there's an existing pending invite for this email
  const { data: existingInvite } = await supabase
    .from('user_invites')
    .select('id, expires_at')
    .eq('email', inviteData.email.toLowerCase())
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .single()

  if (existingInvite) {
    return { success: false, error: 'An active invitation already exists for this email address' }
  }

  // Generate secure token
  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + INVITE_EXPIRY_HOURS * 60 * 60 * 1000)

  // Create the invite record
  const { error: insertError } = await supabase.from('user_invites').insert({
    email: inviteData.email.toLowerCase(),
    role: inviteData.role,
    store_id: inviteData.storeId || null,
    store_ids: inviteData.storeIds || [],
    token,
    invited_by: inviterContext.userId,
    expires_at: expiresAt.toISOString(),
  })

  if (insertError) {
    debugError('UserInvitation', 'Insert invite error:', insertError)
    return { success: false, error: 'Failed to create invitation' }
  }

  // Get store and inviter details for email
  let storeDetails: StoreDetails | null = null
  if (inviteData.storeId) {
    storeDetails = await getStoreDetails(supabase, inviteData.storeId)
  }

  const inviterDetails = await getInviterDetails(supabase, inviterContext.userId)
  const inviterName = inviterDetails?.fullName || inviterDetails?.email || 'A team member'

  // Send invitation email
  const onboardingUrl = `${APP_URL}/onboard?token=${token}`
  const emailHtml = getInviteEmailHtml({
    inviterName,
    role: inviteData.role,
    storeName: storeDetails?.name,
    onboardingUrl,
    expiresIn: `${INVITE_EXPIRY_HOURS} hour${INVITE_EXPIRY_HOURS > 1 ? 's' : ''}`,
  })

  const emailResult = await sendEmail({
    to: inviteData.email,
    subject: `You've been invited to join ${process.env.NEXT_PUBLIC_APP_NAME || 'Mr Fries Inventory'}`,
    html: emailHtml,
  })

  if (!emailResult.success) {
    // Delete the invite if email fails
    await supabase.from('user_invites').delete().eq('token', token)

    return { success: false, error: 'Failed to send invitation email. Please try again.' }
  }

  // Audit log the invitation
  await auditLog(supabase, {
    userId: inviterContext.userId,
    userEmail: inviterContext.userEmail,
    action: 'user.invite',
    storeId: inviteData.storeId || null,
    resourceType: 'user_invite',
    details: {
      invitedEmail: inviteData.email,
      role: inviteData.role,
      storeName: storeDetails?.name,
    },
    request,
  })

  return { success: true, expiresAt: expiresAt.toISOString() }
}
