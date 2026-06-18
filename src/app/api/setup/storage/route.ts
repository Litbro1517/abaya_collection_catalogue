import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getSupabase, STORAGE_BUCKET } from '@/lib/supabase';

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
      : '⚠️ Not set — uploads use anon key with RLS policies',
  };

  if (!hasUrl || !hasAnonKey) {
    return NextResponse.json({
      status: 'error',
      message: 'Supabase environment variables are not configured.',
      diagnostics,
      action: 'Add SUPABASE_URL and SUPABASE_ANON_KEY to your Vercel Environment Variables.',
    }, { status: 503 });
  }

  // Get lazy-initialized client
  const sb = getSupabase();
  if (!sb) {
    return NextResponse.json({
      status: 'error',
      message: 'Supabase client not available. Check environment variables.',
      diagnostics,
    }, { status: 503 });
  }

  // 2. Check if bucket exists (using anon key — works if bucket is public or if RLS allows)
  try {
    const { data: buckets, error: listError } = await sb.storage.listBuckets();

    if (listError) {
      diagnostics.bucketCheck = `❌ Error listing buckets: ${listError.message}`;
      diagnostics.setupSQL = SETUP_SQL;
      return NextResponse.json({
        status: 'error',
        message: 'Cannot check Supabase Storage. You may need to run the setup SQL script.',
        diagnostics,
        setupSQL: SETUP_SQL,
      }, { status: 500 });
    }

    const bucketExists = buckets?.some(b => b.name === STORAGE_BUCKET);
    diagnostics.bucketExists = bucketExists
      ? `✅ Bucket "${STORAGE_BUCKET}" exists`
      : `❌ Bucket "${STORAGE_BUCKET}" does NOT exist — run setup (POST /api/setup/storage) or SQL script`;

    if (bucketExists) {
      const bucket = buckets?.find(b => b.name === STORAGE_BUCKET);
      diagnostics.bucketPublic = bucket?.public
        ? '✅ Bucket is public'
        : '⚠️ Bucket is NOT public — set it to public in Supabase Dashboard → Storage';
    }

    // 3. Test upload capability (using anon key — depends on RLS policies)
    const testPath = `branding/_diagnostic_test_${Date.now()}.txt`;
    const testBuffer = Buffer.from('supabase-storage-diagnostic-test');

    const { error: uploadError } = await sb.storage
      .from(STORAGE_BUCKET)
      .upload(testPath, testBuffer, {
        contentType: 'text/plain',
        upsert: true,
      });

    if (uploadError) {
      diagnostics.uploadTest = `❌ Upload test failed: ${uploadError.message}`;
      diagnostics.uploadHint = 'RLS policies are not set up. Run setup (POST /api/setup/storage with service_role key) or SQL script in Supabase Dashboard.';
    } else {
      diagnostics.uploadTest = '✅ Upload test succeeded';

      // Get public URL
      const { data: urlData } = sb.storage.from(STORAGE_BUCKET).getPublicUrl(testPath);
      diagnostics.testPublicUrl = urlData.publicUrl;

      // Clean up test file
      const { error: removeError } = await sb.storage.from(STORAGE_BUCKET).remove([testPath]);
      diagnostics.cleanup = removeError ? `⚠️ Cleanup failed: ${removeError.message}` : '✅ Test file cleaned up';
    }

  } catch (err) {
    diagnostics.exception = `❌ Unexpected error: ${err instanceof Error ? err.message : String(err)}`;
  }

  const allOk = typeof diagnostics.uploadTest === 'string' && (diagnostics.uploadTest as string).startsWith('✅');

  const response: Record<string, unknown> = {
    status: allOk ? 'ok' : 'error',
    message: allOk
      ? '✅ Supabase Storage is fully configured and working! Upload feature is ready.'
      : '❌ Supabase Storage needs setup. Use POST /api/setup/storage with your service_role key, or run the SQL script manually.',
    diagnostics,
  };

  // Always include setup SQL when things aren't working
  if (!allOk) {
    response.autoSetup = {
      method: 'POST',
      url: '/api/setup/storage',
      body: { serviceRoleKey: 'YOUR_SUPABASE_SERVICE_ROLE_KEY' },
      description: 'Send a POST request with your service_role key to automatically create the bucket and set up RLS policies.',
    };
    response.manualSetup = {
      description: 'Run the SQL script below in your Supabase Dashboard → SQL Editor',
      url: 'https://supabase.com/dashboard/project/ldvbfsnqgulynwxqwzau/sql',
      steps: [
        '1. Open the SQL Editor URL above',
        '2. Click "New query"',
        '3. Copy the SQL from setupSQL field below',
        '4. Paste and click "Run"',
        '5. Refresh this endpoint to verify',
      ],
    };
    response.setupSQL = SETUP_SQL;
  }

  return NextResponse.json(response);
}

/**
 * POST /api/setup/storage
 * Automatically creates the Supabase Storage bucket and RLS policies.
 * Accepts a service_role key in the request body (used temporarily, not stored).
 *
 * Body: { "serviceRoleKey": "eyJ..." or "sb_secret_..." }
 */
export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.SUPABASE_URL || '';
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

  if (!supabaseUrl || supabaseUrl === 'https://your-project.supabase.co' || !supabaseAnonKey || supabaseAnonKey === 'your-anon-key-here') {
    return NextResponse.json({
      status: 'error',
      message: 'Supabase URL and ANON_KEY must be configured as environment variables first.',
    }, { status: 503 });
  }

  let serviceRoleKey: string;
  try {
    const body = await request.json();
    serviceRoleKey = body.serviceRoleKey;
    if (!serviceRoleKey || typeof serviceRoleKey !== 'string') {
      return NextResponse.json({
        status: 'error',
        message: 'Missing "serviceRoleKey" in request body. Get it from: Supabase Dashboard → Settings → API → service_role key',
      }, { status: 400 });
    }
  } catch {
    return NextResponse.json({
      status: 'error',
      message: 'Invalid JSON body. Send: { "serviceRoleKey": "YOUR_SERVICE_ROLE_KEY" }',
    }, { status: 400 });
  }

  const results: Record<string, unknown> = {};
  let adminClient: SupabaseClient;

  try {
    adminClient = createClient(supabaseUrl, serviceRoleKey);
  } catch {
    return NextResponse.json({
      status: 'error',
      message: 'Failed to create Supabase admin client. Check your service_role key.',
    }, { status: 400 });
  }

  // Step 1: Create the bucket
  try {
    const { data: buckets, error: listError } = await adminClient.storage.listBuckets();

    if (listError) {
      results.bucketList = `❌ Error listing buckets: ${listError.message}`;
      return NextResponse.json({ status: 'error', message: 'Failed to list buckets', results }, { status: 500 });
    }

    const bucketExists = buckets?.some(b => b.name === STORAGE_BUCKET);

    if (bucketExists) {
      results.bucket = `✅ Bucket "${STORAGE_BUCKET}" already exists`;
    } else {
      const { error: createError } = await adminClient.storage.createBucket(STORAGE_BUCKET, {
        public: true,
        fileSizeLimit: 2 * 1024 * 1024, // 2MB
        allowedMimeTypes: [
          'image/png', 'image/jpeg', 'image/webp', 'image/svg+xml',
          'image/x-icon', 'image/vnd.microsoft.icon', 'image/gif',
        ],
      });

      if (createError) {
        results.bucketCreate = `❌ Failed to create bucket: ${createError.message}`;
        return NextResponse.json({ status: 'error', message: 'Bucket creation failed', results }, { status: 500 });
      }

      results.bucket = `✅ Bucket "${STORAGE_BUCKET}" created successfully (public: true, 2MB limit, images only)`;
    }
  } catch (err) {
    results.bucketError = `❌ Bucket setup error: ${err instanceof Error ? err.message : String(err)}`;
    return NextResponse.json({ status: 'error', results }, { status: 500 });
  }

  // Step 2: Create RLS policies via direct API call
  try {
    const sqlResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: SETUP_SQL }),
    });

    if (sqlResponse.ok) {
      results.policies = '✅ RLS policies created via RPC';
    } else {
      results.policies = '⚠️ Could not auto-create RLS policies via API. You need to run the SQL script manually in Supabase Dashboard → SQL Editor.';
      results.setupSQL = SETUP_SQL;
    }
  } catch {
    results.policies = '⚠️ Could not auto-create RLS policies. Run the SQL script manually in Supabase Dashboard → SQL Editor.';
    results.setupSQL = SETUP_SQL;
  }

  // Step 3: Test upload with anon key (to verify RLS policies are working)
  try {
    const sb = getSupabase();
    if (!sb) {
      results.uploadTest = '❌ Supabase client not available for upload test';
    } else {
      const testPath = `branding/_setup_test_${Date.now()}.txt`;
      const testBuffer = Buffer.from('supabase-storage-setup-test');

      const { error: uploadError } = await sb.storage
        .from(STORAGE_BUCKET)
        .upload(testPath, testBuffer, {
          contentType: 'text/plain',
          upsert: true,
        });

      if (uploadError) {
        results.uploadTest = `❌ Upload test failed: ${uploadError.message}`;
        results.uploadHint = 'RLS policies are not yet configured. Run the SQL script in Supabase Dashboard → SQL Editor to complete setup.';
        results.setupSQL = SETUP_SQL;
      } else {
        results.uploadTest = '✅ Upload test succeeded with anon key — RLS policies are working!';

        // Get public URL
        const { data: urlData } = sb.storage.from(STORAGE_BUCKET).getPublicUrl(testPath);
        results.testPublicUrl = urlData.publicUrl;

        // Clean up
        await sb.storage.from(STORAGE_BUCKET).remove([testPath]);
        results.cleanup = '✅ Test file cleaned up';
      }
    }
  } catch (err) {
    results.uploadTestError = `❌ Upload test error: ${err instanceof Error ? err.message : String(err)}`;
  }

  const allOk = typeof results.uploadTest === 'string' && (results.uploadTest as string).startsWith('✅');

  return NextResponse.json({
    status: allOk ? 'ok' : 'partial',
    message: allOk
      ? '✅ Supabase Storage is fully configured! Upload feature is ready. You do NOT need the service_role key anymore — uploads work with the anon key.'
      : '⚠️ Bucket created but RLS policies need to be set up. Run the SQL script in Supabase Dashboard → SQL Editor.',
    results,
    ...(allOk ? {} : { setupSQL: SETUP_SQL }),
  });
}
