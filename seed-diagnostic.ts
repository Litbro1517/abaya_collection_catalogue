/**
 * ═══ SEED DE DIAGNOSTIC — Recréer le scénario Relation ═══
 * 
 * Crée deux tables :
 * 1. "Products" (source) — avec une colonne RELATION "tes (copie)"
 * 2. "final Catalog_doss_Correct" (cible) — avec des lignes de catégories
 * 
 * Puis insère des lignes avec des valeurs Relation pour tester le lookup.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seed de diagnostic — Création du scénario Relation...\n');

  // ── 1. Créer la table CIBLE : "final Catalog_doss_Correct" ──
  const targetDs = await prisma.dataSource.create({
    data: {
      name: 'final Catalog_doss_Correct',
      slug: 'final_catalog_doss_correct',
      color: '#4CAF50',
      icon: 'Table',
    },
  });
  console.log(`✅ Table cible créée: "${targetDs.name}" (id: ${targetDs.id})`);

  // Colonnes de la table cible
  const targetColNom = await prisma.column.create({
    data: {
      name: 'Nom',
      slug: 'nom',
      type: 'TEXT',
      dataSourceId: targetDs.id,
      order: 0,
      visible: true,
    },
  });

  const targetColRef = await prisma.column.create({
    data: {
      name: 'Référence',
      slug: 'reference',
      type: 'TEXT',
      dataSourceId: targetDs.id,
      order: 1,
      visible: true,
    },
  });

  const targetColCouleur = await prisma.column.create({
    data: {
      name: 'Couleur',
      slug: 'couleur',
      type: 'TEXT',
      dataSourceId: targetDs.id,
      order: 2,
      visible: true,
    },
  });

  const targetColStatut = await prisma.column.create({
    data: {
      name: 'Statut',
      slug: 'statut',
      type: 'TEXT',
      dataSourceId: targetDs.id,
      order: 3,
      visible: true,
    },
  });

  console.log(`   Colonnes créées: Nom, Référence, Couleur, Statut`);

  // Lignes de la table cible — simulant des catégories/couleurs
  const targetRowsData = [
    { nom: 'Noir', reference: 'NOI-001', couleur: '#000000', statut: 'Disponible' },
    { nom: 'Blanc', reference: 'BLA-001', couleur: '#FFFFFF', statut: 'Disponible' },
    { nom: 'Beige', reference: 'BEG-001', couleur: '#F5F0E8', statut: 'Disponible' },
    { nom: 'Doré', reference: 'DOR-001', couleur: '#C9A84C', statut: 'Rupture' },
    { nom: 'Émeraude', reference: 'EME-001', couleur: '#50C878', statut: 'Disponible' },
    { nom: 'Bordeaux', reference: 'BOR-001', couleur: '#800020', statut: 'Disponible' },
    { nom: 'Marine', reference: 'MAR-001', couleur: '#000080', statut: 'Disponible' },
    { nom: '1', reference: 'NUM-001', couleur: '#333333', statut: 'Disponible' },
  ];

  const createdTargetRows: { id: string; data: Record<string, unknown> }[] = [];
  for (let i = 0; i < targetRowsData.length; i++) {
    const row = await prisma.row.create({
      data: {
        dataSourceId: targetDs.id,
        data: targetRowsData[i],
        order: i,
      },
    });
    createdTargetRows.push({ id: row.id, data: targetRowsData[i] });
  }
  console.log(`   ${createdTargetRows.length} lignes créées dans la table cible`);

  // ── 2. Créer la table SOURCE : "Products" ──
  const sourceDs = await prisma.dataSource.create({
    data: {
      name: 'Products',
      slug: 'products',
      color: '#C9A84C',
      icon: 'Table',
    },
  });
  console.log(`\n✅ Table source créée: "${sourceDs.name}" (id: ${sourceDs.id})`);

  // Colonnes de la table source
  const srcColRef = await prisma.column.create({
    data: {
      name: 'Référence',
      slug: 'reference',
      type: 'TEXT',
      dataSourceId: sourceDs.id,
      order: 0,
      visible: true,
    },
  });

  const srcColNom = await prisma.column.create({
    data: {
      name: 'Nom',
      slug: 'nom',
      type: 'TEXT',
      dataSourceId: sourceDs.id,
      order: 1,
      visible: true,
    },
  });

  const srcColPrix = await prisma.column.create({
    data: {
      name: 'Prix',
      slug: 'prix',
      type: 'CURRENCY',
      dataSourceId: sourceDs.id,
      order: 2,
      visible: true,
      config: { currencySymbol: 'DH' },
    },
  });

  // SCÉNARIO A : Colonne RELATION avec targetColumnId REMPLI (correct)
  const srcColRelGood = await prisma.column.create({
    data: {
      name: 'Couleur (relation correcte)',
      slug: 'couleur_rel_good',
      type: 'RELATION',
      dataSourceId: sourceDs.id,
      order: 3,
      visible: true,
      config: {
        targetTableId: targetDs.id,
        targetColumnId: 'nom',        // ← PIVOT KEY = valeur de la colonne "nom"
        sourceColumn: 'couleur_rel_good',
      },
    },
  });

  // SCÉNARIO B : Colonne RELATION avec targetColumnId VIDE (cassé — ancien comportement)
  const srcColRelBad = await prisma.column.create({
    data: {
      name: 'tes (copie)',
      slug: 'tes_copie',
      type: 'RELATION',
      dataSourceId: sourceDs.id,
      order: 4,
      visible: true,
      config: {
        targetTableId: targetDs.id,
        targetColumnId: '',           // ← VIDE! pivotKey = tRow.id (UUID)
        sourceColumn: '',
      },
    },
  });

  console.log(`   Colonnes créées: Référence, Nom, Prix, Couleur (rel ✓), tes (copie) (rel ✗)`);

  // ── 3. Insérer des lignes source avec VALEURS TEXTE dans les colonnes Relation ──
  // Simule ce que l'utilisateur a tapé manuellement ou importé
  const sourceRowsData = [
    {
      reference: 'AB-001',
      nom: 'Abaya Noire Classique',
      prix: 1200,
      couleur_rel_good: 'Noir',       // ← Texte humain = correspond à targetCol "nom"
      tes_copie: 'Noir',              // ← Texte humain mais targetColumnId VIDE → ne matchera pas UUID
    },
    {
      reference: 'AB-002',
      nom: 'Abaya Dorée Luxe',
      prix: 2500,
      couleur_rel_good: 'Doré',
      tes_copie: 'Doré',
    },
    {
      reference: 'AB-003',
      nom: 'Robe Émeraude',
      prix: 1800,
      couleur_rel_good: 'Émeraude',
      tes_copie: 'Émeraude',
    },
    {
      reference: 'AB-004',
      nom: 'Ensemble Marine',
      prix: 1500,
      couleur_rel_good: 'Marine',
      tes_copie: 'Marine',
    },
    {
      reference: 'AB-005',
      nom: 'Abaya Bordeaux',
      prix: 1350,
      couleur_rel_good: 'Bordeaux',
      tes_copie: '1',                 // ← Test avec valeur numérique textuelle
    },
  ];

  for (let i = 0; i < sourceRowsData.length; i++) {
    await prisma.row.create({
      data: {
        dataSourceId: sourceDs.id,
        data: sourceRowsData[i],
        order: i,
      },
    });
  }
  console.log(`   ${sourceRowsData.length} lignes créées dans la table source`);

  // ── 4. Afficher le résumé critique ──
  console.log('\n════════════════════════════════════════════════════════════');
  console.log('RÉSUMÉ DU SCÉNARIO CRÉÉ :');
  console.log('');
  console.log('Table CIBLE: "final Catalog_doss_Correct"');
  console.log('  Ligne 1: id=' + createdTargetRows[0].id + ', nom="Noir"');
  console.log('  Ligne 2: id=' + createdTargetRows[1].id + ', nom="Blanc"');
  console.log('  ...');
  console.log('');
  console.log('Colonne "couleur_rel_good" (targetColumnId="nom"):');
  console.log('  → relationLookupMap construit: pivotKey = tData["nom"] = "Noir", "Blanc", etc.');
  console.log('  → Valeur stockée dans cellule: "Noir"');
  console.log('  → Lookup: "Noir" === "Noir" → ✅ MATCH');
  console.log('');
  console.log('Colonne "tes (copie)" (targetColumnId=""):');
  console.log('  → relationLookupMap construit: pivotKey = tRow.id = "cmqb..." (UUID Prisma)');
  console.log('  → Valeur stockée dans cellule: "Noir"');
  console.log('  → Lookup: "Noir" === "cmqb..." → ❌ NO MATCH → affiche "—"');
  console.log('════════════════════════════════════════════════════════════');
}

main()
  .catch(e => { console.error('ERREUR:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
