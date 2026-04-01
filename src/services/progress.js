import { supabase } from './supabase';

// ── Weight ──

export async function saveWeight(clientId, date, weight) {
  const { error } = await supabase.from('weight_log')
    .upsert({ client_id: clientId, date, weight }, { onConflict: 'client_id,date' });
  return !error;
}

export async function fetchWeightLog(clientId) {
  const { data } = await supabase.from('weight_log')
    .select('date, weight').eq('client_id', clientId)
    .order('date', { ascending: true });
  return data || [];
}

// ── Measurements ──

export async function saveMeasurement(clientId, date, measurements) {
  const { error } = await supabase.from('measurements').upsert({
    client_id: clientId, date,
    weight: measurements.weight, waist: measurements.waist,
    chest: measurements.chest, arms: measurements.arms, thighs: measurements.thighs,
  }, { onConflict: 'client_id,date' });
  return !error;
}

export async function fetchMeasurements(clientId) {
  const { data } = await supabase.from('measurements')
    .select('*').eq('client_id', clientId)
    .order('date', { ascending: true });
  return data || [];
}

// ── Progress Photos ──

/**
 * Upload a progress photo. Replaces any existing photo for the same pose+date.
 * Photos from other dates are kept, so you build a weekly history.
 * Returns { url, date, pose, storage_path }.
 */
export async function uploadProgressPhoto(clientId, pose, dataUrl, date) {
  const uploadDate = date || new Date().toISOString().slice(0, 10);
  const base64 = dataUrl.split(',')[1];
  const ext = dataUrl.includes('image/png') ? 'png' : 'jpg';
  const path = `${clientId}/${pose}_${Date.now()}.${ext}`;

  // Decode base64
  const binaryStr = atob(base64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);

  const { error: uploadErr } = await supabase.storage
    .from('progress-photos').upload(path, bytes, {
      contentType: `image/${ext}`, upsert: true,
    });
  if (uploadErr) { console.error('Upload error:', uploadErr); return null; }

  // Signed URL (works even if bucket is not public)
  const { data: signedData, error: signErr } = await supabase.storage
    .from('progress-photos').createSignedUrl(path, 60 * 60 * 24 * 365); // 1 year
  const url = signedData?.signedUrl || null;
  if (!url) { console.error('Signed URL error:', signErr); return null; }

  // Table columns: id, client_id, pose, storage_path, date, created_at
  // Remove existing record for same pose+date only (keep other weeks)
  await supabase.from('progress_photos')
    .delete().eq('client_id', clientId).eq('pose', pose).eq('date', uploadDate);
  const { error: dbErr } = await supabase.from('progress_photos').insert({
    client_id: clientId, pose, storage_path: path, date: uploadDate,
  });
  if (dbErr) console.error('DB insert error:', dbErr);

  return { url, date: uploadDate, pose, storage_path: path };
}

/**
 * Fetch ALL progress photos for a client, sorted by date.
 * Returns an array: [{ pose, storage_path, date, url }, ...]
 * The UI groups them by week.
 */
export async function fetchProgressPhotos(clientId) {
  const { data } = await supabase.from('progress_photos')
    .select('pose, storage_path, date, created_at')
    .eq('client_id', clientId)
    .order('date', { ascending: true });
  if (!data || !data.length) return [];

  // Generate fresh signed URLs from storage paths
  const paths = data.filter(p => p.storage_path).map(p => p.storage_path);
  if (!paths.length) return [];

  const { data: signed } = await supabase.storage
    .from('progress-photos').createSignedUrls(paths, 60 * 60 * 24 * 7); // 7 days

  const signedMap = {};
  if (signed) {
    signed.forEach(s => { if (s.signedUrl) signedMap[s.path] = s.signedUrl; });
  }

  return data
    .map(p => ({
      pose: p.pose,
      storage_path: p.storage_path,
      date: p.date || (p.created_at ? p.created_at.slice(0, 10) : null),
      url: signedMap[p.storage_path] || null,
    }))
    .filter(p => p.url);
}
