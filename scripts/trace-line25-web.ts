/**
 * MANDAT D'INVESTIGATION — Traçage Web/API en temps réel (Ligne 25 — Khimar Haf)
 * scripts/trace-line25-web.ts
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Simule le flux EXACT du frontend DataTable.tsx :
 *   1. Login admin (POST /api/auth) → capture cookie admin_token
 *   2. Fetch datasource → trouver row 25 (Khimar Haf) ID
 *   3. POST /api/catalog/media/cdn-migrate avec le payload exact du frontend
 *   4. Capturer : status HTTP, headers, body, timing
 *
 * Usage : bun run scripts/trace-line25-web.ts
 */

const PROD = 'https://abaya-collection-catalogue-9dum.vercel.app';
const ADMIN_EMAIL = 'gotonewjamail@gmail.com';
const ADMIN_PASSWORD = 'abayachic2024';

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║  TRAÇAGE WEB/API — Ligne 25 (Khimar Haf)                         ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝');
  console.log();

  // ════════════════════════════════════════════════════════════════════
  // ÉTAPE 1 : Login admin (identique à AdminLoginPage.tsx L.24)
  // ════════════════════════════════════════════════════════════════════
  console.log('━━━ ÉTAPE 1 : Login admin (POST /api/auth) ━━━');
  const loginStart = Date.now();
  const loginRes = await fetch(`${PROD}/api/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  const loginTime = Date.now() - loginStart;

  // Capturer le cookie admin_token depuis Set-Cookie
  const setCookie = loginRes.headers.get('set-cookie') || '';
  const tokenMatch = setCookie.match(/admin_token=([^;]+)/);
  const adminToken = tokenMatch ? tokenMatch[1] : '';

  console.log(`  Status: ${loginRes.status}`);
  console.log(`  Time: ${loginTime}ms`);
  console.log(`  Set-Cookie present: ${tokenMatch ? '✅ YES' : '❌ NO'}`);
  console.log(`  admin_token: ${adminToken ? adminToken.slice(0, 20) + '...' : '❌ MANQUANT'}`);

  if (!adminToken) {
    console.error('❌ Pas de token admin — abandon');
    process.exit(1);
  }

  const loginBody = await loginRes.json();
  console.log(`  Authenticated: ${loginBody.data?.authenticated ? '✅ YES' : '❌ NO'}`);
  console.log(`  Admin: ${loginBody.data?.admin?.email} (role: ${loginBody.data?.admin?.role})`);

  // ════════════════════════════════════════════════════════════════════
  // ÉTAPE 2 : Fetch datasource → trouver row 25 (Khimar Haf)
  // ════════════════════════════════════════════════════════════════════
  console.log('\n━━━ ÉTAPE 2 : Fetch datasource (GET /api/catalog → DS ID) ━━━');

  // D'abord récupérer le DS ID via /api/catalog
  const catRes = await fetch(`${PROD}/api/catalog`);
  const catBody = await catRes.json();
  const sections = catBody.data?.sections || [];
  const DS_ID = sections[0]?.config?.dataSourceId;

  if (!DS_ID) {
    console.error('❌ Impossible de récupérer le dataSourceId depuis /api/catalog');
    process.exit(1);
  }
  console.log(`  DataSource ID: ${DS_ID}`);

  const dsRes = await fetch(`${PROD}/api/datasources/${DS_ID}`, {
    headers: { Cookie: `admin_token=${adminToken}` },
  });
  console.log(`  Status: ${dsRes.status}`);

  if (!dsRes.ok) {
    console.error('❌ Impossible de fetch le datasource');
    process.exit(1);
  }

  const dsBody = await dsRes.json();
  const rows = dsBody.data?.rows || [];
  const row25 = rows.find((r: { order: number }) => r.order === 25);

  if (!row25) {
    console.error('❌ Row 25 (order=25) non trouvée');
    console.log('Rows disponibles:', rows.map((r: { order: number }) => r.order).join(', '));
    process.exit(1);
  }

  console.log(`  Row 25 trouvé: id=${row25.id}`);
  console.log(`  Title: ${row25.data?.nomproduitdocx || '(sans titre)'}`);
  console.log(`  image-de-garde: ${String(row25.data?.['image-de-garde'] || '').slice(0, 80)}`);

  // ════════════════════════════════════════════════════════════════════
  // ÉTAPE 3 : POST /api/catalog/media/cdn-migrate (payload exact du frontend)
  // ════════════════════════════════════════════════════════════════════
  console.log('\n━━━ ÉTAPE 3 : POST /api/catalog/media/cdn-migrate (row 25) ━━━');

  // Le frontend envoie EXACTEMENT ce payload (DataTable.tsx L.1609-1614)
  const payload = {
    dataSourceId: DS_ID,
    columnSlug: 'image-de-garde',
    columnType: 'IMAGE',
    rowIds: [row25.id],
  };

  console.log('  Payload JSON (identique au frontend) :');
  console.log(JSON.stringify(payload, null, 2));

  const migrateStart = Date.now();
  const migrateRes = await fetch(`${PROD}/api/catalog/media/cdn-migrate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `admin_token=${adminToken}`,
    },
    body: JSON.stringify(payload),
  });
  const migrateTime = Date.now() - migrateStart;

  // Capturer TOUT : status, headers, body
  console.log(`\n  ┌─── RÉPONSE HTTP ───`);
  console.log(`  │ Status: ${migrateRes.status} ${migrateRes.statusText}`);
  console.log(`  │ Time: ${migrateTime}ms`);
  console.log(`  │ Content-Type: ${migrateRes.headers.get('content-type')}`);

  const responseText = await migrateRes.text();
  console.log(`  │ Body length: ${responseText.length} chars`);

  let responseBody: unknown;
  try {
    responseBody = JSON.parse(responseText);
    console.log(`  │ Body (JSON):`);
    console.log(JSON.stringify(responseBody, null, 2).split('\n').map((l: string) => `  │ ${l}`).join('\n'));
  } catch {
    console.log(`  │ Body (raw): ${responseText.slice(0, 500)}`);
  }

  console.log(`  └────────────────────`);

  // ════════════════════════════════════════════════════════════════════
  // ÉTAPE 4 : Analyse de la réponse
  // ════════════════════════════════════════════════════════════════════
  console.log('\n━━━ ÉTAPE 4 : Analyse de la réponse ━━━');

  if (migrateRes.status === 401) {
    console.log('  ❌ 401 Unauthorized — le middleware a rejeté la requête (admin_token invalide ou expiré)');
    console.log('  → Le cookie admin_token est-il correctement transmis ?');
  } else if (migrateRes.status === 400) {
    console.log('  ❌ 400 Bad Request — le payload est rejeté par la route');
    const errBody = responseBody as { error?: string };
    console.log(`  → Erreur: ${errBody?.error || '(pas de message)'}`);
  } else if (migrateRes.status === 500) {
    console.log('  ❌ 500 Internal Server Error — crash côté serveur');
    const errBody = responseBody as { error?: string };
    console.log(`  → Erreur: ${errBody?.error || '(pas de message)'}`);
  } else if (migrateRes.ok) {
    const data = (responseBody as { data?: { migrated?: number; failed?: number; conflicts?: number; results?: unknown[] } }).data;
    if (data) {
      console.log(`  ✅ ${migrateRes.status} OK`);
      console.log(`  → Migrated: ${data.migrated ?? 0}`);
      console.log(`  → Failed: ${data.failed ?? 0}`);
      console.log(`  → Conflicts: ${data.conflicts ?? 0}`);
      console.log(`  → Results count: ${data.results?.length ?? 0}`);

      if (data.results && Array.isArray(data.results)) {
        console.log('\n  ─── Détail des results ───');
        for (const r of data.results) {
          const result = r as { fileId?: string; status?: string; cdnUrl?: string };
          console.log(`    fileId: ${result.fileId?.slice(0, 30)} | status: ${result.status} | cdnUrl: ${result.cdnUrl?.slice(0, 60) || 'N/A'}`);
        }
      }

      if ((data.failed ?? 0) > 0) {
        console.log('\n  ⚠️ Des images ont échoué — check le détail des results ci-dessus');
      }
      if ((data.migrated ?? 0) === 0 && (data.failed ?? 0) === 0 && (data.conflicts ?? 0) === 0) {
        console.log('\n  ⚠️ Aucune image migrée, aucun échec, aucun conflit → "Aucune image à migrer"');
        console.log('  → Hypothèse : la cellule image-de-garde ne contient pas d\'URL Drive extractable');
      }
    }
  } else {
    console.log(`  ⚠️ Status inattendu: ${migrateRes.status}`);
  }

  // ════════════════════════════════════════════════════════════════════
  // ÉTAPE 5 : Vérifier l'état de la DB après migration
  // ════════════════════════════════════════════════════════════════════
  console.log("\n━━━ ÉTAPE 5 : Vérifier l'état DB après migration ━━━");
  const dsRes2 = await fetch(`${PROD}/api/datasources/${DS_ID}`, {
    headers: { Cookie: `admin_token=${adminToken}` },
  });
  const dsBody2 = await dsRes2.json();
  const row25After = dsBody2.data?.rows?.find((r: { order: number }) => r.order === 25);
  const igAfter = String(row25After?.data?.['image-de-garde'] || '');

  console.log(`  image-de-garde après migration: ${igAfter.slice(0, 80)}`);
  if (igAfter.includes('supabase.co')) {
    console.log('  ✅ URL CDN Supabase — migration RÉUSSIE !');
  } else if (igAfter.includes('image-proxy')) {
    console.log('  ❌ URL proxy Drive — migration a échoué ou n\'a pas été appliquée');
  } else {
    console.log(`  ⚠️ État inattendu: ${igAfter.slice(0, 60)}`);
  }

  // ════════════════════════════════════════════════════════════════════
  // ÉTAPE 6 : Tester aussi la colonne groupe_images (IMAGE_ARRAY)
  // ════════════════════════════════════════════════════════════════════
  console.log('\n━━━ ÉTAPE 6 : Test colonne groupe_images (IMAGE_ARRAY) ━━━');
  const payloadGI = {
    dataSourceId: DS_ID,
    columnSlug: 'groupe_images',
    columnType: 'IMAGE_ARRAY',
    rowIds: [row25.id],
  };
  console.log('  Payload:', JSON.stringify(payloadGI, null, 2).split('\n').map(l => `  ${l}`).join('\n'));

  const giRes = await fetch(`${PROD}/api/catalog/media/cdn-migrate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `admin_token=${adminToken}`,
    },
    body: JSON.stringify(payloadGI),
  });

  console.log(`  Status: ${giRes.status} ${giRes.statusText}`);
  const giText = await giRes.text();
  try {
    const giBody = JSON.parse(giText);
    console.log('  Response:', JSON.stringify(giBody, null, 2).split('\n').map(l => `  ${l}`).join('\n'));
  } catch {
    console.log('  Response (raw):', giText.slice(0, 300));
  }

  console.log('\n═══ FIN DU TRAÇAGE ═══');
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
