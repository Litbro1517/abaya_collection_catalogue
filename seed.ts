import { db } from './src/lib/db';

async function seed() {
  console.log('Seeding database...');

  // Create categories
  const categories = await Promise.all([
    db.category.upsert({
      where: { slug: 'abaya' },
      update: {},
      create: { nom: 'Abaya', slug: 'abaya', ordre: 1, active: true },
    }),
    db.category.upsert({
      where: { slug: 'ensemble' },
      update: {},
      create: { nom: 'Ensemble', slug: 'ensemble', ordre: 2, active: true },
    }),
    db.category.upsert({
      where: { slug: 'robe' },
      update: {},
      create: { nom: 'Robe', slug: 'robe', ordre: 3, active: true },
    }),
    db.category.upsert({
      where: { slug: 'kimono' },
      update: {},
      create: { nom: 'Kimono', slug: 'kimono', ordre: 4, active: true },
    }),
  ]);

  console.log(`Created ${categories.length} categories`);

  // Create products
  const products = [
    {
      nomProduit: 'Abaya Elite Noire',
      prixVente: 450,
      prixAchat: 200,
      categorieId: categories[0].id,
      description: 'Abaya elegante en crepe premium, coupe fluide et raffinee. Parfaite pour les occasions speciales et les sorties quotidiennes.',
      couleurs: JSON.stringify([{ nom: 'Noir', hex: '#000000' }]),
      tailles: JSON.stringify(['S', 'M', 'L', 'XL']),
      imagePrincipale: null,
      imagesCarousel: JSON.stringify([]),
      canalCommande: 'whatsapp',
      lienCommande: null,
      stock: 15,
      nOrdre: 1,
      disponible: true,
      featured: true,
    },
    {
      nomProduit: 'Abaya Royale Dorée',
      prixVente: 680,
      prixAchat: 320,
      categorieId: categories[0].id,
      description: 'Abaya luxueuse avec broderie dorée, tissu Nidha de haute qualité. Un chef-d\'oeuvre pour les grandes occasions.',
      couleurs: JSON.stringify([{ nom: 'Noir', hex: '#000000' }, { nom: 'Beige', hex: '#F5F0E8' }]),
      tailles: JSON.stringify(['M', 'L', 'XL']),
      imagePrincipale: null,
      imagesCarousel: JSON.stringify([]),
      canalCommande: 'whatsapp',
      lienCommande: null,
      stock: 8,
      nOrdre: 2,
      disponible: true,
      featured: true,
    },
    {
      nomProduit: 'Ensemble Sahara Beige',
      prixVente: 520,
      prixAchat: 250,
      categorieId: categories[1].id,
      description: 'Ensemble deux pieces compose d\'une tunique fluide et d\'un pantalon large. Tissu léger et confortable, ideal pour toutes les saisons.',
      couleurs: JSON.stringify([{ nom: 'Beige', hex: '#F5F0E8' }, { nom: 'Caramel', hex: '#C9A84C' }]),
      tailles: JSON.stringify(['S', 'M', 'L', 'XL', 'XXL']),
      imagePrincipale: null,
      imagesCarousel: JSON.stringify([]),
      canalCommande: 'whatsapp',
      lienCommande: null,
      stock: 12,
      nOrdre: 3,
      disponible: true,
      featured: true,
    },
    {
      nomProduit: 'Ensemble Marrakech Gris',
      prixVente: 580,
      prixAchat: 280,
      categorieId: categories[1].id,
      description: 'Ensemble élégant avec veste longue et jupe évasée. Style sophistiqué inspiré de l\'architecture marocaine.',
      couleurs: JSON.stringify([{ nom: 'Gris', hex: '#808080' }, { nom: 'Taupe', hex: '#483C32' }]),
      tailles: JSON.stringify(['S', 'M', 'L', 'XL']),
      imagePrincipale: null,
      imagesCarousel: JSON.stringify([]),
      canalCommande: 'instagram',
      lienCommande: null,
      stock: 6,
      nOrdre: 4,
      disponible: true,
      featured: false,
    },
    {
      nomProduit: 'Robe Orientale Bordeaux',
      prixVente: 620,
      prixAchat: 300,
      categorieId: categories[2].id,
      description: 'Robe longue avec ceinture agrafée, détails dorés au col. Tissu satiné de qualité supérieure, coupe flatteuse.',
      couleurs: JSON.stringify([{ nom: 'Bordeaux', hex: '#800020' }, { nom: 'Marine', hex: '#1A237E' }]),
      tailles: JSON.stringify(['S', 'M', 'L', 'XL']),
      imagePrincipale: null,
      imagesCarousel: JSON.stringify([]),
      canalCommande: 'whatsapp',
      lienCommande: null,
      stock: 10,
      nOrdre: 5,
      disponible: true,
      featured: true,
    },
    {
      nomProduit: 'Robe Casablanca Blanche',
      prixVente: 550,
      prixAchat: 260,
      categorieId: categories[2].id,
      description: 'Robe blanche épurée avec broderie subtile au poignet. L\'élégance dans sa forme la plus simple.',
      couleurs: JSON.stringify([{ nom: 'Blanc', hex: '#FFFFFF' }, { nom: 'Crème', hex: '#FFFDD0' }]),
      tailles: JSON.stringify(['XS', 'S', 'M', 'L']),
      imagePrincipale: null,
      imagesCarousel: JSON.stringify([]),
      canalCommande: 'whatsapp',
      lienCommande: null,
      stock: 7,
      nOrdre: 6,
      disponible: true,
      featured: false,
    },
    {
      nomProduit: 'Kimono Zen Lavande',
      prixVente: 380,
      prixAchat: 170,
      categorieId: categories[3].id,
      description: 'Kimono léger et fluide, parfait pour la maison ou les sorties décontractées. Tissu viscole doux et respirant.',
      couleurs: JSON.stringify([{ nom: 'Lavande', hex: '#9575CD' }, { nom: 'Rose', hex: '#F48FB1' }]),
      tailles: JSON.stringify(['S', 'M', 'L', 'XL', 'Unique']),
      imagePrincipale: null,
      imagesCarousel: JSON.stringify([]),
      canalCommande: 'instagram',
      lienCommande: null,
      stock: 20,
      nOrdre: 7,
      disponible: true,
      featured: false,
    },
    {
      nomProduit: 'Kimono Prestige Noir',
      prixVente: 490,
      prixAchat: 230,
      categorieId: categories[3].id,
      description: 'Kimono de cérémonie avec détails dorés, manches larges et ceinture assortie. Pour les soirées et événements spéciaux.',
      couleurs: JSON.stringify([{ nom: 'Noir', hex: '#000000' }, { nom: 'Or', hex: '#FFD600' }]),
      tailles: JSON.stringify(['M', 'L', 'XL']),
      imagePrincipale: null,
      imagesCarousel: JSON.stringify([]),
      canalCommande: 'whatsapp',
      lienCommande: null,
      stock: 5,
      nOrdre: 8,
      disponible: true,
      featured: true,
    },
    {
      nomProduit: 'Abaya Moderne Abricot',
      prixVente: 420,
      prixAchat: 190,
      categorieId: categories[0].id,
      description: 'Abaya contemporaine avec coupe A-line et poches latérales. Tissu doux et confortable, parfait pour le quotidien.',
      couleurs: JSON.stringify([{ nom: 'Abricot', hex: '#FBCEB1' }, { nom: 'Beige', hex: '#F5F0E8' }]),
      tailles: JSON.stringify(['S', 'M', 'L', 'XL', 'XXL']),
      imagePrincipale: null,
      imagesCarousel: JSON.stringify([]),
      canalCommande: 'whatsapp',
      lienCommande: null,
      stock: 14,
      nOrdre: 9,
      disponible: true,
      featured: false,
    },
    {
      nomProduit: 'Ensemble Fès Terracotta',
      prixVente: 560,
      prixAchat: 270,
      categorieId: categories[1].id,
      description: 'Ensemble trois pièces inspiré de l\'artisanat fassi. Tunique brodée, gilet et pantalon large. Un hommage au savoir-faire marocain.',
      couleurs: JSON.stringify([{ nom: 'Terracotta', hex: '#C0644A' }, { nom: 'Chocolat', hex: '#4E342E' }]),
      tailles: JSON.stringify(['M', 'L', 'XL']),
      imagePrincipale: null,
      imagesCarousel: JSON.stringify([]),
      canalCommande: 'email',
      lienCommande: null,
      stock: 4,
      nOrdre: 10,
      disponible: true,
      featured: false,
    },
    {
      nomProduit: 'Robe Soirée Émeraude',
      prixVente: 750,
      prixAchat: 380,
      categorieId: categories[2].id,
      description: 'Robe de soirée luxueuse en satin émeraude, avec ceinture cristallisée et manches cloches. Pour les événements les plus prestigieux.',
      couleurs: JSON.stringify([{ nom: 'Vert', hex: '#2E7D32' }, { nom: 'Noir', hex: '#000000' }]),
      tailles: JSON.stringify(['S', 'M', 'L']),
      imagePrincipale: null,
      imagesCarousel: JSON.stringify([]),
      canalCommande: 'whatsapp',
      lienCommande: null,
      stock: 3,
      nOrdre: 11,
      disponible: true,
      featured: true,
    },
    {
      nomProduit: 'Abaya Classique Marine',
      prixVente: 390,
      prixAchat: 180,
      categorieId: categories[0].id,
      description: 'Abaya classique en Nidha marine, coupe droite et épurée. Un essentiel de la garde-robe islamique.',
      couleurs: JSON.stringify([{ nom: 'Marine', hex: '#1A237E' }]),
      tailles: JSON.stringify(['S', 'M', 'L', 'XL', 'XXL']),
      imagePrincipale: null,
      imagesCarousel: JSON.stringify([]),
      canalCommande: 'whatsapp',
      lienCommande: null,
      stock: 18,
      nOrdre: 12,
      disponible: true,
      featured: false,
    },
  ];

  // Clear existing products first
  await db.product.deleteMany({});

  for (const product of products) {
    await db.product.create({ data: product });
  }

  console.log(`Created ${products.length} products`);

  // Create default settings
  await db.settings.upsert({
    where: { key: 'maintenanceMode' },
    update: {},
    create: { key: 'maintenanceMode', value: 'false' },
  });
  await db.settings.upsert({
    where: { key: 'maintenanceMessage' },
    update: {},
    create: { key: 'maintenanceMessage', value: 'Site en maintenance, revenez bientôt.' },
  });
  await db.settings.upsert({
    where: { key: 'whatsappNumber' },
    update: {},
    create: { key: 'whatsappNumber', value: '212600000000' },
  });
  await db.settings.upsert({
    where: { key: 'shopName' },
    update: {},
    create: { key: 'shopName', value: 'Abaya Chic Collection' },
  });

  console.log('Seed complete!');
}

seed()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
