import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn(
    '[Supabase] Missing SUPABASE_URL or SUPABASE_ANON_KEY — uploads will use local fallback. ' +
    'Please add them to your .env file for cloud storage.'
  );
}

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.warn(
    '[Supabase] Missing SUPABASE_SERVICE_ROLE_KEY — bucket auto-creation and server uploads may fail due to RLS. ' +
    'Add it to your .env file from: Supabase Dashboard → Settings → API → service_role key'
  );
}

/**
 * Public client — uses anon key, subject to RLS policies.
 * Use for: reading public URLs, client-side operations.
 */
export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Admin client — uses service_role key, bypasses RLS.
 * Use for: server-side uploads, bucket creation/management.
 * Falls back to anon client if service_role key is not set.
 */
export const supabaseAdmin: SupabaseClient = SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  : supabase;

/** Bucket name used for brand assets (logo, favicon, etc.) */
export const STORAGE_BUCKET = 'assets';
