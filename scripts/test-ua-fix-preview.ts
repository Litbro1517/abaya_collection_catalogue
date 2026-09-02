/**
 * Test du correctif User-Agent sur Vercel Preview (c3e46f4)
 * scripts/test-ua-fix-preview.ts
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 1. Login admin
 * 2. Supprimer le WebP du bucket (pour forcer le download lh3)
 * 3. POST /api/catalog/media/cdn-migrate pour row 25 image-de-garde
 * 4. Capturer le résultat (migrated vs failed)
 */

const PREVIEW = 'https://abaya-collection-catalogue-9dum-3y3lk3por.vercel.app';
const ADMIN_EMAIL = 'gotonewjamail@gmail.com';
const ADMIN_PASSWORD = 'abayachic2024';
const SUPABASE_URL = 'https://ldvbfsnqgulynwxqwzau.supabase.co';
const TARGET_FILEID = '1By7Q7Sbhy8h5Fpxs2JJQD_xM9GOx9iaw';

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  TEST CORRECTIF User-Agent — Vercel Preview (c3e46f4)        ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log();

  // Étape 1 : Login
  console.log('━━━ ÉTAPE 1 : Login admin ━━━');
  const loginRes = await fetch(`${PREVIEW}/api/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  const setCookie = loginRes.headers.get('set-cookie') || '';
  const tokenMatch = setCookie.match(/admin_token=([^;]+)/);
  const adminToken = tokenMatch ? tokenMatch[1] : '';
  console.log(`  Token: ${adminToken ? '✅' : '❌'}`);
  if (!adminToken) process.exit(1);

  // Étape 2 : Supprimer le WebP du bucket (pour forcer le download lh3)
  console.log('\n━━━ ÉTAPE 2 : Supprimer le WebP du bucket (forcer download lh3) ━━━');
  const serviceKey = await fetchSupabaseServiceKey();
  const deleteRes = await fetch(
    `${SUPABASE_URL}/storage/v1/object/assets/media/${TARGET_FILEID}.webp`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${serviceKey}` },
    }
  );
  console.log(`  Delete status: ${deleteRes.status}`);
  const deleteBody = await deleteRes.text();
  console.log(`  Response: ${deleteBody.slice(0, 100)}`);

  // Vérifier HEAD publique
  const headRes = await fetch(
    `${SUPABASE_URL}/storage/v1/object/public/assets/media/${TARGET_FILEID}.webp`,
    { method: 'HEAD' }
  );
  console.log(`  HEAD après delete: ${headRes.status} (doit être 404)`);

  // Étape 3 : Récupérer DS_ID + row 25
  console.log('\n━━━ ÉTAPE 3 : Récupérer row 25 ━━━');
  const catRes = await fetch(`${PREVIEW}/api/catalog`);
  const catBody = await catRes.json();
  const DS_ID = catBody.data?.sections?.[0]?.config?.dataSourceId;
  const dsRes = await fetch(`${PREVIEW}/api/datasources/${DS_ID}`, {
    headers: { Cookie: `admin_token=${adminToken}` },
  });
  const dsBody = await dsRes.json();
  const row25 = dsBody.data?.rows?.find((r: { order: number }) => r.order === 25);
  console.log(`  DS_ID: ${DS_ID}`);
  console.log(`  Row 25 ID: ${row25?.id}`);

  // Vérifier l'état actuel de image-de-garde
  const igBefore = String(row25?.data?.['image-de-garde'] || '');
  console.log(`  image-de-garde (avant): ${igBefore.slice(0, 80)}`);

  // Étape 4 : POST cdn-migrate
  console.log('\n━━━ ÉTAPE 4 : POST /api/catalog/media/cdn-migrate ━━━');
  const payload = {
    dataSourceId: DS_ID,
    columnSlug: 'image-de-garde',
    columnType: 'IMAGE',
    rowIds: [row25.id],
  };
  console.log(`  Payload: ${JSON.stringify(payload)}`);

  const migrateStart = Date.now();
  const migrateRes = await fetch(`${PREVIEW}/api/catalog/media/cdn-migrate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: `admin_token=${adminToken}` },
    body: JSON.stringify(payload),
  });
  const migrateTime = Date.now() - migrateStart;
  const migrateBody = await migrateRes.json();

  console.log(`  HTTP: ${migrateRes.status} | Time: ${migrateTime}ms`);
  console.log(`  Response:`);
  console.log(JSON.stringify(migrateBody, null, 2));

  // Étape 5 : Analyse
  console.log('\n━━━ ÉTAPE 5 : Analyse ━━━');
  const data = migrateBody?.data;
  if (data) {
    console.log(`  Migrated: ${data.migrated ?? 0}`);
    console.log(`  Failed: ${data.failed ?? 0}`);
    console.log(`  Conflicts: ${data.conflicts ?? 0}`);

    if (data.migrated > 0) {
      console.log('\n  ✅✅✅ SUCCÈS — Le correctif User-Agent FONCTIONNE ! ✅✅✅');
      console.log('  → Le fetch() avec User-Agent a réussi à télécharger depuis lh3');
      console.log('  → Sharp a converti le PNG en WebP');
      console.log('  → L\'upload Supabase a réussi');
      console.log('  → La cellule DB a été mise à jour avec l\'URL CDN');

      // Vérifier la DB
      const dsRes2 = await fetch(`${PREVIEW}/api/datasources/${DS_ID}`, {
        headers: { Cookie: `admin_token=${adminToken}` },
      });
      const dsBody2 = await dsRes2.json();
      const row25After = dsBody2.data?.rows?.find((r: { order: number }) => r.order === 25);
      const igAfter = String(row25After?.data?.['image-de-garde'] || '');
      console.log(`\n  image-de-garde (après): ${igAfter.slice(0, 80)}`);
      if (igAfter.includes('supabase.co')) {
        console.log('  → CDN Supabase ✅ — DB mise à jour avec succès !');
      }
    } else if (data.failed > 0) {
      console.log('\n  ❌ ÉCHEC — Le correctif ne suffit pas');
      const failedResult = data.results?.[0];
      if (failedResult?.reason) {
        console.log(`  Reason: ${failedResult.reason}`);
      }
    } else {
      console.log('\n  ⚠️ total=0 — aucune URL à migrer (cellule déjà en CDN ?)');
    }
  }

  console.log('\n═══ FIN DU TEST ═══');
}

async function fetchSupabaseServiceKey(): Promise<string> {
  const res = await fetch('https://api.supabase.com/v1/projects/ldvbfsnqgulynwxqwzau/api-keys', {
    headers: { Authorization: 'Bearer sbp_21406eaa633efa370983e352ccc091a2b20d095d' },
  });
  const data = await res.json();
  const key = data.find((k: { name: string }) => k.name === 'service_role');
  return key?.api_key || '';
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
