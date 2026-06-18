import { createClient, SupabaseClient } from '@supabase/supabase-js';

/** Bucket name used for brand assets (logo, favicon, etc.) */
export const STORAGE_BUCKET = 'assets';

// ── Lazy Supabase clients (avoid crash when env vars are absent) ──

let _supabase: SupabaseClient | null = null;
let _supabaseAdmin: SupabaseClient | null = null;
let _checked = false;

function _initClients() {
  if (_checked) return;
  _checked = true;

  const url = process.env.SUPABASE_URL || '';
  const anonKey = process.env.SUPABASE_ANON_KEY || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!url || !anonKey) {
    console.warn(
      '[Supabase] Missing SUPABASE_URL or SUPABASE_ANON_KEY — uploads will use local fallback. ' +
      'Please add them to your .env file for cloud storage.'
    );
    return;
  }

  if (!serviceKey) {
    console.warn(
      '[Supabase] Missing SUPABASE_SERVICE_ROLE_KEY — bucket auto-creation and server uploads may fail due to RLS. ' +
      'Add it to your .env file from: Supabase Dashboard → Settings → API → service_role key'
    );
  }

  try {
    _supabase = createClient(url, anonKey);
    _supabaseAdmin = serviceKey ? createClient(url, serviceKey) : _supabase;
  } catch {
    _supabase = null;
    _supabaseAdmin = null;
  }
}

/**
 * Public client — uses anon key, subject to RLS policies.
 * Use for: reading public URLs, client-side operations.
 * Returns null when Supabase env vars are not configured.
 */
export function getSupabase(): SupabaseClient | null {
  _initClients();
  return _supabase;
}

/**
 * Admin client — uses service_role key, bypasses RLS.
 * Use for: server-side uploads, bucket creation/management.
 * Falls back to anon client if service_role key is not set.
 * Returns null when Supabase env vars are not configured.
 */
export function getSupabaseAdmin(): SupabaseClient | null {
  _initClients();
  return _supabaseAdmin;
}
