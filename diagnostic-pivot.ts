/**
 * ═══ DIAGNOSTIC D'ALIGNEMENT DES PIVOTS RELATION ═══
 * 
 * Objectif : Valider scientifiquement ce qui est stocké dans row.data
 * pour les colonnes RELATION, et ce que relationLookupMap compare en mémoire.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  DIAGNOSTIC D\'ALIGNEMENT DES PIVOTS — BASE SQLITE          ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  // ── ÉTAPE 1 : Lister toutes les sources de données ──
  const allDataSources = await prisma.dataSource.findMany({
    include: { columns: { orderBy: { order: 'asc' } } },
    orderBy: { createdAt: 'asc' },
  });

  console.log('═══ ÉTAPE 1 : Sources de données existantes ═══\n');
  for (const ds of allDataSources) {
    const relCols = ds.columns.filter(c => c.type === 'RELATION');
    console.log(`📦 "${ds.name}" (id: ${ds.id})`);
    console.log(`   Slug: ${ds.slug}`);
    console.log(`   Colonnes: ${ds.columns.length} total, ${relCols.length} RELATION`);
    if (relCols.length > 0) {
      for (const rc of relCols) {
        const cfg = rc.config as Record<string, unknown>;
        console.log(`   ┗━ 🔗 "${rc.name}" (slug: ${rc.slug})`);
        console.log(`      config.targetTableId  = ${JSON.stringify(cfg.targetTableId ?? '(vide)')}`);
        console.log(`      config.targetColumnId = ${JSON.stringify(cfg.targetColumnId ?? '(vide)')}`);
        console.log(`      config.sourceColumn   = ${JSON.stringify(cfg.sourceColumn ?? '(vide)')}`);
        console.log(`      config.targetTable    = ${JSON.stringify(cfg.targetTable ?? '(vide)')}`);
      }
    }
  }

  // ── ÉTAPE 2 : Trouver les colonnes RELATION et extraire les lignes source ──
  console.log('\n═══ ÉTAPE 2 : Extraction des lignes SOURCE (row.data brut) ═══\n');

  for (const ds of allDataSources) {
    const relCols = ds.columns.filter(c => c.type === 'RELATION');
    if (relCols.length === 0) continue;

    const rows = await prisma.row.findMany({
      where: { dataSourceId: ds.id },
      take: 5,
      orderBy: { order: 'asc' },
    });

    console.log(`\n📦 Source: "${ds.name}" — ${rows.length} lignes échantillonnées`);

    for (const rc of relCols) {
      const cfg = rc.config as Record<string, unknown>;
      const targetTableId = (cfg.targetTableId as string) || (cfg.targetTable as string) || '';
      const targetColumnId = (cfg.targetColumnId as string) || '';
      const sourceColumn = (cfg.sourceColumn as string) || '';

      console.log(`\n  🔗 Colonne RELATION: "${rc.name}" (slug: ${rc.slug})`);
      console.log(`     targetTableId  = ${targetTableId || '(VIDE — PROBLÈME!)'}`);
      console.log(`     targetColumnId = ${targetColumnId || '(VIDE — pivotKey = tRow.id UUID!)'}`);
      console.log(`     sourceColumn   = ${sourceColumn || '(vide)'}`);

      for (const row of rows) {
        const data = row.data as Record<string, unknown>;
        const cellValue = data[rc.slug];
        const sourcePivotValue = sourceColumn ? data[sourceColumn] : undefined;

        if (cellValue !== undefined && cellValue !== null && String(cellValue).trim() !== '') {
          console.log(`\n     ┌─ Ligne source (id: ${row.id})`);
          console.log(`     │  row.data["${rc.slug}"] = ${JSON.stringify(cellValue)}`);
          console.log(`     │  Type JavaScript: ${typeof cellValue}`);
          console.log(`     │  Longueur: ${String(cellValue).length}`);
          if (sourceColumn) {
            console.log(`     │  sourceColumn("${sourceColumn}") = ${JSON.stringify(sourcePivotValue)}`);
          }
          console.log(`     │  JSON complet row.data =`);
          // Pretty print the full data, but truncate if too long
          const dataStr = JSON.stringify(data, null, 2);
          const lines = dataStr.split('\n');
          for (const line of lines.slice(0, 30)) {
            console.log(`     │    ${line}`);
          }
          if (lines.length > 30) console.log(`     │    ... (${lines.length - 30} lignes omises)`);
          console.log(`     └─`);
        }
      }
    }
  }

  // ── ÉTAPE 3 : Extraire les lignes CIBLE ──
  console.log('\n═══ ÉTAPE 3 : Extraction des lignes CIBLE (table référencée) ═══\n');

  for (const ds of allDataSources) {
    const relCols = ds.columns.filter(c => c.type === 'RELATION');
    for (const rc of relCols) {
      const cfg = rc.config as Record<string, unknown>;
      const targetTableId = (cfg.targetTableId as string) || (cfg.targetTable as string) || '';
      const targetColumnId = (cfg.targetColumnId as string) || '';

      if (!targetTableId || targetTableId === 'self') {
        console.log(`\n  🔗 "${rc.name}": auto-référence (self) — lignes cible = lignes source`);
        continue;
      }

      // Find the target data source
      const targetDs = allDataSources.find(d => d.id === targetTableId);
      if (!targetDs) {
        console.log(`\n  🔗 "${rc.name}": ⚠️ Table cible introuvable (id: ${targetTableId})`);
        continue;
      }

      const targetRows = await prisma.row.findMany({
        where: { dataSourceId: targetTableId },
        take: 5,
        orderBy: { order: 'asc' },
      });

      console.log(`\n  🎯 Table cible: "${targetDs.name}" (id: ${targetDs.id})`);
      console.log(`     Colonne pivot cible (targetColumnId): ${targetColumnId || '(VIDE — utilisation de tRow.id UUID)'}`);
      console.log(`     Nombre de lignes: ${targetRows.length} échantillonnées`);

      for (const tRow of targetRows) {
        const tData = tRow.data as Record<string, unknown>;
        const pivotKey = targetColumnId
          ? String(tData[targetColumnId] ?? '')
          : tRow.id;

        // Find the best label
        const textCol = targetDs.columns.find(c => c.type === 'TEXT' && c.visible && !c.slug.startsWith('__'));
        const label = textCol ? String(tData[textCol.slug] ?? '').trim() : '';

        console.log(`     ┌─ Ligne cible (id: ${tRow.id})`);
        console.log(`     │  pivotKey utilisé par relationLookupMap = ${JSON.stringify(pivotKey)}`);
        console.log(`     │  Type du pivotKey: ${targetColumnId ? 'TEXTE HUMAIN (valeur colonne)' : 'UUID MACHINE (Prisma id)'}`);
        if (targetColumnId) {
          console.log(`     │  colonne "${targetColumnId}" = ${JSON.stringify(tData[targetColumnId])}`);
        }
        console.log(`     │  label (findBestLabel) = ${JSON.stringify(label)}`);
        console.log(`     └─`);
      }
    }
  }

  // ── ÉTAPE 4 : VERDICT — Comparaison des clés ──
  console.log('\n═══ ÉTAPE 4 : VERDICT — Alignement des pivots ═══\n');

  for (const ds of allDataSources) {
    const relCols = ds.columns.filter(c => c.type === 'RELATION');
    for (const rc of relCols) {
      const cfg = rc.config as Record<string, unknown>;
      const targetTableId = (cfg.targetTableId as string) || (cfg.targetTable as string) || '';
      const targetColumnId = (cfg.targetColumnId as string) || '';

      if (!targetTableId || targetTableId === 'self') continue;

      const targetDs = allDataSources.find(d => d.id === targetTableId);
      if (!targetDs) continue;

      // Get source rows with non-empty relation values
      const sourceRows = await prisma.row.findMany({
        where: { dataSourceId: ds.id },
        take: 3,
      });

      const targetRows = await prisma.row.findMany({
        where: { dataSourceId: targetTableId },
      });

      // Build the lookup map as relationLookupMap would
      const lookup: Record<string, string> = {};
      for (const tRow of targetRows) {
        const tData = tRow.data as Record<string, unknown>;
        const pivotKey = targetColumnId
          ? String(tData[targetColumnId] ?? '')
          : tRow.id;
        const textCol = targetDs.columns.find(c => c.type === 'TEXT' && c.visible && !c.slug.startsWith('__'));
        const label = textCol ? String(tData[textCol.slug] ?? '').trim() : pivotKey;
        if (pivotKey && label) lookup[pivotKey] = label;
      }

      console.log(`🔗 Relation: "${rc.name}" → "${targetDs.name}"`);
      console.log(`   targetColumnId = ${JSON.stringify(targetColumnId) || '(VIDE)'}`);
      console.log(`   Lookup map construite (${Object.keys(lookup).length} entrées):`);

      // Show first 10 entries of the lookup map
      const entries = Object.entries(lookup).slice(0, 10);
      for (const [key, val] of entries) {
        console.log(`     "${key}" → "${val}"`);
      }
      if (Object.keys(lookup).length > 10) {
        console.log(`     ... et ${Object.keys(lookup).length - 10} autres entrées`);
      }

      // Now test: for each source row, does the cell value match a lookup key?
      console.log(`\n   ══ Test de correspondance source → lookup ══`);
      let matchCount = 0;
      let mismatchCount = 0;
      for (const sRow of sourceRows) {
        const sData = sRow.data as Record<string, unknown>;
        const cellValue = String(sData[rc.slug] ?? '').trim();
        if (!cellValue) continue;

        const matched = lookup[cellValue];
        if (matched !== undefined) {
          console.log(`   ✅ cellValue="${cellValue}" → trouvé: "${matched}"`);
          matchCount++;
        } else {
          console.log(`   ❌ cellValue="${cellValue}" → NON TROUVÉ dans le lookup`);
          // Show closest keys for debugging
          const keys = Object.keys(lookup);
          const closeKeys = keys.filter(k => 
            k.toLowerCase().includes(cellValue.toLowerCase()) || 
            cellValue.toLowerCase().includes(k.toLowerCase())
          );
          if (closeKeys.length > 0) {
            console.log(`      Clés proches: ${closeKeys.slice(0, 5).map(k => `"${k}"`).join(', ')}`);
          }
          mismatchCount++;
        }
      }

      if (matchCount + mismatchCount > 0) {
        const verdict = mismatchCount === 0 ? '✅ ALIGNÉ' : mismatchCount === matchCount + mismatchCount ? '❌ DÉSALIGNÉ TOTAL' : '⚠️ PARTIELLEMENT ALIGNÉ';
        console.log(`\n   VERDICT: ${verdict} (${matchCount} correspondances / ${matchCount + mismatchCount} testés)`);
        if (mismatchCount > 0) {
          console.log(`   CAUSE: La valeur stockée dans row.data["${rc.slug}"] ne correspond à aucune clé du lookup.`);
          console.log(`   SOLUTION: Soit remplir targetColumnId, soit aligner les valeurs stockées avec les clés du lookup.`);
        }
      } else {
        console.log(`   ℹ️ Aucune ligne source avec une valeur non-vide pour cette colonne`);
      }
      console.log('');
    }
  }

  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  FIN DU DIAGNOSTIC                                          ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
}

main()
  .catch(e => { console.error('ERREUR FATALE:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
