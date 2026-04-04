import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://vnahttyexvtanbsezksp.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_1XL8uTWj1ZmsFS24AUx-IQ_edvHz8R9';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
export const IS_LIVE = !!SUPABASE_URL && !!SUPABASE_ANON_KEY;
