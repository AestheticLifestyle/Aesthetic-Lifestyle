import { supabase } from './supabase';

// ── Fetch all available supplements (global + coach's custom ones) ──
export async function fetchSupplementsList(coachId) {
  const { data, error } = await supabase
    .from('supplements')
    .select('*')
    .or(`is_global.eq.true,coach_id.eq.${coachId}`)
    .order('category')
    .order('name');
  return data || [];
}

// ── Fetch supplements assigned to a client ──
export async function fetchClientSupplements(clientId) {
  const { data, error } = await supabase
    .from('client_supplements')
    .select('*')
    .eq('client_id', clientId)
    .eq('is_active', true)
    .order('sort_order')
    .order('created_at');
  return data || [];
}

// ── Save / assign a supplement to a client ──
export async function assignSupplement(clientId, coachId, supplement) {
  const { data, error } = await supabase
    .from('client_supplements')
    .insert({
      client_id: clientId,
      coach_id: coachId,
      supplement_id: supplement.supplement_id || null,
      name: supplement.name,
      dosage: supplement.dosage || '',
      timing: supplement.timing || 'morning',
      notes: supplement.notes || '',
      sort_order: supplement.sort_order || 0,
    })
    .select('*');
  if (error) {
    console.error('[assignSupplement] error:', error);
    return { ok: false, error: error.message };
  }
  return { ok: true, data: data?.[0] };
}

// ── Update an existing client supplement ──
export async function updateClientSupplement(id, updates) {
  const { error } = await supabase
    .from('client_supplements')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) {
    console.error('[updateClientSupplement] error:', error);
    return false;
  }
  return true;
}

// ── Remove (deactivate) a supplement from client ──
export async function removeClientSupplement(id) {
  const { error } = await supabase
    .from('client_supplements')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) {
    console.error('[removeClientSupplement] error:', error);
    return false;
  }
  return true;
}

// ── Add a custom supplement to the master list ──
export async function addCustomSupplement(coachId, name, category = 'custom') {
  const { data, error } = await supabase
    .from('supplements')
    .insert({
      coach_id: coachId,
      name,
      category,
      is_global: false,
    })
    .select('*');
  if (error) {
    console.error('[addCustomSupplement] error:', error);
    return { ok: false, error: error.message };
  }
  return { ok: true, data: data?.[0] };
}
