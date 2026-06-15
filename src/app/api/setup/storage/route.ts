import { NextResponse } from 'next/server';
import { supabase, supabaseAdmin, STORAGE_BUCKET } from '@/lib/supabase';

/**
 * GET /api/setup/storage
 * Diagnoses Supabase Storage configuration and auto-creates the bucket if missing.
 * Uses service_role key (supabaseAdmin) to bypass RLS for bucket creation.
 */
export async function GET() {
  const diagnostics: Record<string, unknown> = {};

  // 1. Check environment variables
  const hasUrl = !!process.env.SUPABASE_URL && process.env.SUPABASE_URL !== 'https://your-project.supabase.co';
  const hasAnonKey = !!process.env.SUPABASE_ANON_KEY && process.env.SUPABASE_ANON_KEY !== 'your-anon-key-here';
  const hasServiceKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;

  diagnostics.envVars = {
    SUPABASE_URL: hasUrl ? `✅ Set (${process.env.SUPABASE_URL?.slice(0, 30)}...)` : '❌ Missing or placeholder',
    SUPABASE_ANON_KEY: hasAnonKey ? `✅ Set (length: ${process.env.SUPABASE_ANON_KEY?.length})` : '❌ Missing or placeholder',
    SUPABASE_SERVICE_ROLE_KEY: hasServiceKey ? `✅ Set (length: ${process.env.SUPABASE_SERVICE_ROLE_KEY?.length})` : '❌ Missing — required for bucket creation & server uploads (bypasses RLS)',
  };

  if (!hasUrl || !hasAnonKey) {
    return NextResponse.json({
      status: 'error',
      message: 'Supabase environment variables are not configured.',
      diagnostics,
      action: 'Add SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY to your .env file or Vercel Environment Variables.',
    }, { status: 503 });
  }

  if (!hasServiceKey) {
    return NextResponse.json({
      status: 'error',
      message: 'SUPABASE_SERVICE_ROLE_KEY is missing — needed to bypass RLS for bucket creation and server-side uploads.',
      diagnostics,
      action: 'Get it from: Supabase Dashboard → Settings → API → service_role key (secret). Add it to Vercel Environment Variables.',
    }, { status: 503 });
  }

  // 2. Check if bucket exists
  try {
    const { data: buckets, error: listError } = await supabaseAdmin.storage.listBuckets();

    if (listError) {
      diagnostics.bucketCheck = `❌ Error listing buckets: ${listError.message}`;
      return NextResponse.json({ status: 'error', diagnostics }, { status: 500 });
    }

    const bucketExists = buckets?.some(b => b.name === STORAGE_BUCKET);
    diagnostics.bucketExists = bucketExists ? `✅ Bucket "${STORAGE_BUCKET}" exists` : `❌ Bucket "${STORAGE_BUCKET}" does NOT exist`;

    // 3. Auto-create bucket if missing
    if (!bucketExists) {
      const { error: createError } = await supabaseAdmin.storage.createBucket(STORAGE_BUCKET, {
        public: true,
        fileSizeLimit: 2 * 1024 * 1024, // 2MB
        allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/x-icon', 'image/vnd.microsoft.icon', 'image/gif'],
      });

      if (createError) {
        diagnostics.bucketCreate = `❌ Failed to create bucket: ${createError.message}`;
        diagnostics.bucketCreateHint = 'Create it manually: Supabase Dashboard → Storage → New Bucket (name: "assets", Public: ✅)';
      } else {
        diagnostics.bucketCreate = `✅ Bucket "${STORAGE_BUCKET}" created successfully (public: true, 2MB limit)`;
      }
    } else {
      // Check if bucket is public
      const bucket = buckets?.find(b => b.name === STORAGE_BUCKET);
      diagnostics.bucketPublic = bucket?.public ? '✅ Bucket is public' : '⚠️ Bucket is NOT public — set it to public in Supabase Dashboard';
    }

    // 4. Test upload capability using admin client (bypasses RLS)
    const testPath = `branding/_diagnostic_test_${Date.now()}.txt`;
    const testBuffer = Buffer.from('supabase-storage-diagnostic-test');

    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .upload(testPath, testBuffer, {
        contentType: 'text/plain',
        upsert: true,
      });

    if (uploadError) {
      diagnostics.uploadTest = `❌ Upload test failed: ${uploadError.message}`;
    } else {
      diagnostics.uploadTest = '✅ Upload test succeeded';

      // Get public URL
      const { data: urlData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(testPath);
      diagnostics.testPublicUrl = urlData.publicUrl;

      // Clean up test file
      await supabaseAdmin.storage.from(STORAGE_BUCKET).remove([testPath]);
      diagnostics.cleanup = '✅ Test file cleaned up';
    }

  } catch (err) {
    diagnostics.exception = `❌ Unexpected error: ${err instanceof Error ? err.message : String(err)}`;
  }

  const allOk = typeof diagnostics.uploadTest === 'string' && diagnostics.uploadTest.startsWith('✅');

  return NextResponse.json({
    status: allOk ? 'ok' : 'error',
    message: allOk
      ? '✅ Supabase Storage is fully configured and working! Upload feature is ready.'
      : '❌ Supabase Storage needs attention — see diagnostics above.',
    diagnostics,
  });
}
