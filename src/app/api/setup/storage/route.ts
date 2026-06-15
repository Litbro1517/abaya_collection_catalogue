import { NextResponse } from 'next/server';
import { supabase, STORAGE_BUCKET } from '@/lib/supabase';

/**
 * GET /api/setup/storage
 * Diagnoses Supabase Storage configuration and auto-creates the bucket if missing.
 */
export async function GET() {
  const diagnostics: Record<string, unknown> = {};

  // 1. Check environment variables
  const hasUrl = !!process.env.SUPABASE_URL && process.env.SUPABASE_URL !== 'https://your-project.supabase.co';
  const hasKey = !!process.env.SUPABASE_ANON_KEY && process.env.SUPABASE_ANON_KEY !== 'your-anon-key-here';

  diagnostics.envVars = {
    SUPABASE_URL: hasUrl ? `✅ Set (${process.env.SUPABASE_URL?.slice(0, 30)}...)` : '❌ Missing or placeholder',
    SUPABASE_ANON_KEY: hasKey ? `✅ Set (length: ${process.env.SUPABASE_ANON_KEY?.length})` : '❌ Missing or placeholder',
  };

  if (!hasUrl || !hasKey) {
    return NextResponse.json({
      status: 'error',
      message: 'Supabase environment variables are not configured.',
      diagnostics,
      action: 'Add SUPABASE_URL and SUPABASE_ANON_KEY to your .env file (local) or Vercel Environment Variables.',
    }, { status: 503 });
  }

  // 2. Check if bucket exists
  try {
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();

    if (listError) {
      diagnostics.bucketCheck = `❌ Error listing buckets: ${listError.message}`;
      return NextResponse.json({ status: 'error', diagnostics }, { status: 500 });
    }

    const bucketExists = buckets?.some(b => b.name === STORAGE_BUCKET);
    diagnostics.bucketExists = bucketExists ? `✅ Bucket "${STORAGE_BUCKET}" exists` : `❌ Bucket "${STORAGE_BUCKET}" does NOT exist`;

    // 3. Auto-create bucket if missing
    if (!bucketExists) {
      const { data: createData, error: createError } = await supabase.storage.createBucket(STORAGE_BUCKET, {
        public: true,
        fileSizeLimit: 2 * 1024 * 1024, // 2MB
        allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/x-icon', 'image/vnd.microsoft.icon', 'image/gif'],
      });

      if (createError) {
        diagnostics.bucketCreate = `❌ Failed to create bucket: ${createError.message}`;
        diagnostics.bucketCreateHint = 'You may need to create the bucket manually in the Supabase Dashboard → Storage → New Bucket (name: "assets", Public: ✅)';
      } else {
        diagnostics.bucketCreate = `✅ Bucket "${STORAGE_BUCKET}" created successfully (public: true)`;
      }
    } else {
      // Check if bucket is public
      const bucket = buckets?.find(b => b.name === STORAGE_BUCKET);
      diagnostics.bucketPublic = bucket?.public ? '✅ Bucket is public' : '⚠️ Bucket is NOT public — images won\'t be accessible';
    }

    // 4. Test upload capability
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
    } else {
      diagnostics.uploadTest = '✅ Upload test succeeded';

      // Get public URL
      const { data: urlData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(testPath);
      diagnostics.testPublicUrl = urlData.publicUrl;

      // Clean up test file
      await supabase.storage.from(STORAGE_BUCKET).remove([testPath]);
      diagnostics.cleanup = '✅ Test file cleaned up';
    }

  } catch (err) {
    diagnostics.exception = `❌ Unexpected error: ${err instanceof Error ? err.message : String(err)}`;
  }

  const allOk = typeof diagnostics.uploadTest === 'string' && diagnostics.uploadTest.startsWith('✅');

  return NextResponse.json({
    status: allOk ? 'ok' : 'error',
    message: allOk
      ? 'Supabase Storage is fully configured and working! Upload feature is ready.'
      : 'Supabase Storage needs attention — see diagnostics above.',
    diagnostics,
  });
}
