import { NextResponse } from 'next/server';
import { supabase, STORAGE_BUCKET } from '@/lib/supabase';

/**
 * SQL script to run in Supabase Dashboard → SQL Editor
 * Creates the 'assets' bucket and sets up RLS policies for anon uploads.
 */
const SETUP_SQL = `
-- ═══════════════════════════════════════════════════════════
-- Supabase Storage Setup for Abaya Collection Catalog
-- Run this in: Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════

-- 1. Create the 'assets' bucket (public, 2MB limit, images only)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'assets',
  'assets',
  true,
  2097152,
  ARRAY['image/png','image/jpeg','image/webp','image/svg+xml','image/x-icon','image/vnd.microsoft.icon','image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- 2. Allow anyone to read files from the assets bucket
CREATE POLICY "Public read access" ON storage.objects
  FOR SELECT USING (bucket_id = 'assets');

-- 3. Allow anyone to upload files to the assets bucket
CREATE POLICY "Allow public uploads" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'assets');

-- 4. Allow anyone to update files (for upsert) in the assets bucket
CREATE POLICY "Allow public updates" ON storage.objects
  FOR UPDATE USING (bucket_id = 'assets');

-- 5. Allow anyone to delete files in the assets bucket
CREATE POLICY "Allow public deletes" ON storage.objects
  FOR DELETE USING (bucket_id = 'assets');
`;

/**
 * GET /api/setup/storage
 * Diagnoses Supabase Storage configuration.
 * Works with just the anon key — no service_role key required.
 */
export async function GET() {
  const diagnostics: Record<string, unknown> = {};

  // 1. Check environment variables
  const supabaseUrl = process.env.SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_ANON_KEY || '';
  const hasUrl = !!(supabaseUrl && supabaseUrl !== 'https://your-project.supabase.co');
  const hasAnonKey = !!(supabaseKey && supabaseKey !== 'your-anon-key-here');
  const hasServiceKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;

  diagnostics.envVars = {
    SUPABASE_URL: hasUrl ? `✅ Set (${supabaseUrl.slice(0, 35)}...)` : '❌ Missing or placeholder',
    SUPABASE_ANON_KEY: hasAnonKey ? `✅ Set (length: ${supabaseKey.length})` : '❌ Missing or placeholder',
    SUPABASE_SERVICE_ROLE_KEY: hasServiceKey
      ? `✅ Set (length: ${process.env.SUPABASE_SERVICE_ROLE_KEY!.length}) — admin uploads (bypasses RLS)`
      : '⚠️ Not set — uploads use anon key with RLS policies (run SQL setup script below)',
  };

  if (!hasUrl || !hasAnonKey) {
    return NextResponse.json({
      status: 'error',
      message: 'Supabase environment variables are not configured.',
      diagnostics,
      action: 'Add SUPABASE_URL and SUPABASE_ANON_KEY to your Vercel Environment Variables.',
    }, { status: 503 });
  }

  // 2. Check if bucket exists (using anon key — works if bucket is public or if RLS allows)
  try {
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();

    if (listError) {
      diagnostics.bucketCheck = `❌ Error listing buckets: ${listError.message}`;
      diagnostics.setupSQL = SETUP_SQL;
      return NextResponse.json({
        status: 'error',
        message: 'Cannot check Supabase Storage. You may need to run the setup SQL script.',
        diagnostics,
        setupInstructions: {
          step1: 'Go to your Supabase Dashboard → SQL Editor',
          step2: 'Copy the SQL from setupSQL field below',
          step3: 'Paste and run the SQL in the editor',
          step4: 'Refresh this endpoint to verify',
        },
        setupSQL: SETUP_SQL,
      }, { status: 500 });
    }

    const bucketExists = buckets?.some(b => b.name === STORAGE_BUCKET);
    diagnostics.bucketExists = bucketExists
      ? `✅ Bucket "${STORAGE_BUCKET}" exists`
      : `❌ Bucket "${STORAGE_BUCKET}" does NOT exist — run the setup SQL script`;

    if (bucketExists) {
      const bucket = buckets?.find(b => b.name === STORAGE_BUCKET);
      diagnostics.bucketPublic = bucket?.public
        ? '✅ Bucket is public'
        : '⚠️ Bucket is NOT public — set it to public in Supabase Dashboard → Storage';
    }

    // 3. Test upload capability (using anon key — depends on RLS policies)
    const testPath = `branding/_diagnostic_test_${Date.now()}.txt`;
    const testBuffer = Buffer.from('supabase-storage-diagnostic-test');

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(testPath, testBuffer, {
        contentType: 'text/plain',
        upsert: true,
      });

    if (uploadError) {
      diagnostics.uploadTest = `❌ Upload test failed: ${uploadError.message}`;
      diagnostics.uploadHint = 'This usually means RLS policies are not set up. Run the SQL setup script in Supabase Dashboard → SQL Editor.';
    } else {
      diagnostics.uploadTest = '✅ Upload test succeeded';

      // Get public URL
      const { data: urlData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(testPath);
      diagnostics.testPublicUrl = urlData.publicUrl;

      // Clean up test file
      const { error: removeError } = await supabase.storage.from(STORAGE_BUCKET).remove([testPath]);
      diagnostics.cleanup = removeError ? `⚠️ Cleanup failed: ${removeError.message}` : '✅ Test file cleaned up';
    }

  } catch (err) {
    diagnostics.exception = `❌ Unexpected error: ${err instanceof Error ? err.message : String(err)}`;
  }

  const allOk = typeof diagnostics.uploadTest === 'string' && diagnostics.uploadTest.startsWith('✅');

  const response: Record<string, unknown> = {
    status: allOk ? 'ok' : 'error',
    message: allOk
      ? '✅ Supabase Storage is fully configured and working! Upload feature is ready.'
      : '❌ Supabase Storage needs setup — see diagnostics and setupSQL below.',
    diagnostics,
  };

  // Always include setup SQL when things aren't working
  if (!allOk || !diagnostics.bucketExists?.toString().startsWith('✅')) {
    response.setupInstructions = {
      step1: 'Go to your Supabase Dashboard → SQL Editor (https://supabase.com/dashboard/project/ldvbfsnqgulynwxqwzau/sql)',
      step2: 'Click "New query"',
      step3: 'Copy the SQL from the setupSQL field below',
      step4: 'Paste and click "Run"',
      step5: 'Come back here and refresh to verify',
    };
    response.setupSQL = SETUP_SQL;
  }

  return NextResponse.json(response);
}
