/**
 * MANDAT D'EXPLORATION — Tranchement de preuves (Piste A + Piste B)
 * scripts/trace-line25-vercel-preview.ts
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Exécute le traçage contre le déploiement Vercel preview (code instrumenté)
 * pour capturer la raison exacte d'échec (Piste A).
 *
 * Puis teste le proxy authentifié /api/google/image-proxy (Piste B).
 */

const PREVIEW = 'https://abaya-collection-catalogue-9dum-r0g3yshbb.vercel.app';
const ADMIN_EMAIL = 'gotonewjamail@gmail.com';
const ADMIN_PASSWORD = 'abayachic2024';

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║  TRANCHEMENT DE PREUVES — Vercel Preview (code instrumenté)      ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝');
  console.log(`Preview URL: ${PREVIEW}`);
  console.log();

  // ════════════════════════════════════════════════════════════════════
  // ÉTAPE 1 : Login admin
  // ════════════════════════════════════════════════════════════════════
  console.log('━━━ ÉTAPE 1 : Login admin ━━━');
  const loginRes = await fetch(`${PREVIEW}/api/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  const setCookie = loginRes.headers.get('set-cookie') || '';
  const tokenMatch = setCookie.match(/admin_token=([^;]+)/);
  const adminToken = tokenMatch ? tokenMatch[1] : '';
  console.log(`  Status: ${loginRes.status} | Token: ${adminToken ? '✅' : '❌'}`);
  if (!adminToken) { console.error('Pas de token'); process.exit(1); }

  // ════════════════════════════════════════════════════════════════════
  // ÉTAPE 2 : Récupérer DS ID + row 25
  // ════════════════════════════════════════════════════════════════════
  console.log('\n━━━ ÉTAPE 2 : Récupérer row 25 ━━━');
  const catRes = await fetch(`${PREVIEW}/api/catalog`);
  const catBody = await catRes.json();
  const DS_ID = catBody.data?.sections?.[0]?.config?.dataSourceId;
  const dsRes = await fetch(`${PREVIEW}/api/datasources/${DS_ID}`, {
    headers: { Cookie: `admin_token=${adminToken}` },
  });
  const dsBody = await dsRes.json();
  const row25 = dsBody.data?.rows?.find((r: { order: number }) => r.order === 25);
  console.log(`  DS_ID: ${DS_ID}`);
  console.log(`  Row 25: ${row25?.id}`);

  // ════════════════════════════════════════════════════════════════════
  // PISTE A : POST cdn-migrate (image-de-garde) → capturer le reason
  // ════════════════════════════════════════════════════════════════════
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('━  PISTE A : Réponse Google Drive sur Vercel (reason field)  ━');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const payload = {
    dataSourceId: DS_ID,
    columnSlug: 'image-de-garde',
    columnType: 'IMAGE',
    rowIds: [row25.id],
  };
  console.log('  Payload:', JSON.stringify(payload));

  const migrateRes = await fetch(`${PREVIEW}/api/catalog/media/cdn-migrate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: `admin_token=${adminToken}` },
    body: JSON.stringify(payload),
  });
  console.log(`  HTTP Status: ${migrateRes.status}`);
  const migrateBody = await migrateRes.json();
  console.log('  Response (full JSON):');
  console.log(JSON.stringify(migrateBody, null, 2));

  // Analyse du reason
  const results = migrateBody?.data?.results || [];
  for (const r of results) {
    console.log(`\n  ┌─── RÉSULTAT ───`);
    console.log(`  │ fileId: ${r.fileId}`);
    console.log(`  │ status: ${r.status}`);
    if (r.reason) {
      console.log(`  │ reason: ${r.reason}`);
      console.log(`  │`);
      console.log(`  │ ═══ ANALYSE ═══`);
      if (r.reason.includes('download_failed')) {
        console.log('  │ → PISTE A CONFIRMÉE : le download Drive échoue sur Vercel');
        console.log('  │ → Google Drive renvoie un status non-200 à Vercel');
      } else if (r.reason.includes('upload_failed')) {
        console.log('  │ → L\'upload Supabase échoue (mais on sait déjà que ça fonctionne)');
      }
    } else {
      console.log('  │ reason: (non fourni — code non instrumenté ?)');
    }
    console.log('  └────────────────');
  }

  // ════════════════════════════════════════════════════════════════════
  // PISTE A (suite) : Tester directement le download lh3 depuis Vercel
  // ════════════════════════════════════════════════════════════════════
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('━  PISTE A (direct) : Test download lh3 depuis Vercel preview   ━');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  On ne peut pas faire un fetch direct lh3 depuis ce script (CLI local).');
  console.log('  Mais on peut tester si Vercel peut atteindre lh3 via une route proxy.');
  console.log('  Le reason field capturé ci-dessus contient déjà le status HTTP.');
  console.log('  Si reason contient "download_failed: HTTP 403" ou "HTTP 429" → Piste A confirmée');
  console.log('  Si reason contient "download_failed: HTTP 200" → le body était HTML (Piste A variante)');

  // ════════════════════════════════════════════════════════════════════
  // PISTE B : Tester le proxy authentifié /api/google/image-proxy
  // ════════════════════════════════════════════════════════════════════
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('━  PISTE B : Test proxy authentifié /api/google/image-proxy    ━');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  const FID = '1By7Q7Sbhy8h5Fpxs2JJQD_xM9GOx9iaw';
  const proxyUrl = `${PREVIEW}/api/google/image-proxy?id=${FID}&sz=800`;
  console.log(`  URL proxy: ${proxyUrl}`);
  console.log("  (route server-side qui fetch lh3 avec gestion d'erreurs)");

  const proxyRes = await fetch(proxyUrl);
  console.log(`  HTTP Status: ${proxyRes.status}`);
  console.log(`  Content-Type: ${proxyRes.headers.get('content-type')}`);
  const proxyLen = proxyRes.headers.get('content-length');
  console.log(`  Content-Length: ${proxyLen || '(chunked)'}`);

  if (proxyRes.ok) {
    const proxyBuffer = await proxyRes.arrayBuffer();
    const buf = Buffer.from(proxyBuffer);
    console.log(`  Buffer size: ${buf.length} bytes (${(buf.length/1024).toFixed(1)} KiB)`);
    // Check magic bytes
    if (buf.slice(0,4).toString('hex') === '89504e47') {
      console.log('  ✅ PNG binaire reçu via proxy — PISTE B FONCTIONNE');
    } else if (buf.slice(0,2).toString('hex') === 'ffd8') {
      console.log('  ✅ JPEG binaire reçu via proxy — PISTE B FONCTIONNE');
    } else if (buf.slice(0,1).toString() === '<') {
      console.log('  ⚠️ HTML reçu via proxy — proxy retourne aussi du HTML');
      console.log(`  Body (first 200 chars): ${buf.toString('utf-8', 0, Math.min(200, buf.length))}`);
    } else {
      console.log(`  Magic bytes: ${buf.slice(0,8).toString('hex')}`);
      console.log(`  Body (first 200 chars): ${buf.toString('utf-8', 0, Math.min(200, buf.length))}`);
    }
  } else {
    console.log('  ❌ Proxy a échoué');
    const errText = await proxyRes.text();
    console.log(`  Body: ${errText.slice(0, 200)}`);
  }

  // ════════════════════════════════════════════════════════════════════
  // PISTE B (suite) : Test lh3 direct depuis Vercel (via route API custom)
  // ════════════════════════════════════════════════════════════════════
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('━  PISTE B (direct) : Test lh3 direct depuis Vercel (proxy)    ━');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  // On utilise le proxy comme route intermédiaire pour vérifier si Vercel
  // peut atteindre lh3 directement
  console.log('  Test: GET /api/google/image-proxy?id=FID&sz=800 (depuis Vercel preview)');
  console.log('  Si le proxy retourne une image → Vercel PEUT atteindre lh3');
  console.log('  Si le proxy retourne une erreur → Vercel NE PEUT PAS atteindre lh3');

  // ════════════════════════════════════════════════════════════════════
  // CONCLUSION
  // ════════════════════════════════════════════════════════════════════
  console.log('\n\n════════════════════════════════════════════════════════════');
  console.log('═══ CONCLUSION DU TRANCHEMENT ═══');
  console.log('════════════════════════════════════════════════════════════');

  const failedResult = results.find((r: { status: string }) => r.status === 'failed');
  if (failedResult?.reason) {
    if (failedResult.reason.includes('download_failed')) {
      console.log('\n  PISTE A : CONFIRMÉE ✅');
      console.log('  → Le download Drive échoue sur Vercel');
      console.log(`  → Raison brute: ${failedResult.reason}`);
      if (failedResult.reason.includes('HTTP 403')) {
        console.log('  → Google Drive retourne 403 Forbidden (blocage IP ou quota)');
      } else if (failedResult.reason.includes('HTTP 429')) {
        console.log('  → Google Drive retourne 429 Too Many Requests (quota dépassé)');
      } else if (failedResult.reason.includes('HTTP 200')) {
        console.log('  → Google Drive retourne 200 MAIS le body n\'est pas une image (HTML ?)');
      } else if (failedResult.reason.includes('HTTP 404')) {
        console.log('  → Google Drive retourne 404 Not Found (fichier supprimé/privé)');
      }
      console.log('\n  PISTE B : ' + (proxyRes.ok ? 'CONFIRMÉE ✅' : 'INVALIDÉE ❌'));
      if (proxyRes.ok) {
        console.log('  → Le proxy authentifié /api/google/image-proxy fonctionne sur Vercel');
        console.log('  → Solution : basculer le download vers le proxy au lieu de lh3 direct');
      }
    } else if (failedResult.reason.includes('upload_failed')) {
      console.log("\n  L'\u00e9chec est \u00e0 l'UPLOAD Supabase, pas au download");
      console.log(`  → Raison: ${failedResult.reason}`);
    }
  } else if (results.length > 0 && results[0].status === 'migrated') {
    console.log('\n  ⚠️ Migration RÉUSSIE sur le preview !');
    console.log('  → Le problème ne se reproduit pas sur le preview Vercel');
    console.log('  → Hypothèse : le fileId est déjà en bucket (HEAD check bypass)');
  }

  console.log('\n═══ FIN DU TRANCHEMENT ═══');
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
