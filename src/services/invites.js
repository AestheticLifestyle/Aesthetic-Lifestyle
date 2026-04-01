import { supabase } from './supabase';

// ── Generate a short readable invite code ──
function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1 confusion
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// ── Coach: Create a new invite code ──
export async function createInviteCode(coachId, { label = '', maxUses = 1, expiresInDays = null } = {}) {
  const code = generateCode();
  const expires_at = expiresInDays
    ? new Date(Date.now() + expiresInDays * 86400000).toISOString()
    : null;

  const { data, error } = await supabase
    .from('invite_codes')
    .insert({
      coach_id: coachId,
      code,
      label,
      max_uses: maxUses,
      expires_at,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ── Coach: List all their invite codes ──
export async function fetchInviteCodes(coachId) {
  const { data, error } = await supabase
    .from('invite_codes')
    .select('*')
    .eq('coach_id', coachId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

// ── Coach: Deactivate a code ──
export async function deactivateInviteCode(codeId) {
  const { error } = await supabase
    .from('invite_codes')
    .update({ active: false })
    .eq('id', codeId);
  if (error) throw error;
}

// ── Client: Validate an invite code ──
export async function validateInviteCode(code) {
  const { data, error } = await supabase
    .from('invite_codes')
    .select('*')
    .eq('code', code.toUpperCase().trim())
    .eq('active', true)
    .single();

  if (error || !data) return { valid: false, error: 'Invalid invite code' };

  // Check expiry
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return { valid: false, error: 'This invite code has expired' };
  }

  // Check usage limit
  if (data.used_count >= data.max_uses) {
    return { valid: false, error: 'This invite code has already been used' };
  }

  return { valid: true, invite: data };
}

// ── Client: Redeem an invite code (link to coach) ──
export async function redeemInviteCode(clientId, code) {
  // 1. Validate
  const { valid, invite, error: valError } = await validateInviteCode(code);
  if (!valid) return { success: false, error: valError };

  // 2. Check if already linked to this coach
  const { data: existing } = await supabase
    .from('coach_clients')
    .select('id')
    .eq('coach_id', invite.coach_id)
    .eq('client_id', clientId)
    .single();

  if (existing) {
    return { success: false, error: 'You are already connected to this coach' };
  }

  // 3. Check if already linked to ANY coach
  const { data: anyLink } = await supabase
    .from('coach_clients')
    .select('id')
    .eq('client_id', clientId)
    .limit(1)
    .single();

  if (anyLink) {
    return { success: false, error: 'You are already linked to a coach. Disconnect first to switch coaches.' };
  }

  // 4. Create the link
  const { error: insertError } = await supabase
    .from('coach_clients')
    .insert({
      coach_id: invite.coach_id,
      client_id: clientId,
    });

  if (insertError) return { success: false, error: insertError.message };

  // 5. Increment used_count
  await supabase
    .from('invite_codes')
    .update({ used_count: invite.used_count + 1 })
    .eq('id', invite.id);

  return { success: true, coachId: invite.coach_id };
}

// ── Client: Check if linked to a coach ──
export async function getMyCoachLink(clientId) {
  const { data } = await supabase
    .from('coach_clients')
    .select('coach_id')
    .eq('client_id', clientId)
    .limit(1)
    .single();

  return data?.coach_id || null;
}

// ── Client: Get coach name ──
export async function getCoachName(coachId) {
  const { data } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', coachId)
    .single();

  return data?.full_name || 'Your Coach';
}

// ── Client: Disconnect from coach ──
export async function disconnectFromCoach(clientId) {
  const { error } = await supabase
    .from('coach_clients')
    .delete()
    .eq('client_id', clientId);

  if (error) throw error;
}
