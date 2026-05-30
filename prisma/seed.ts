import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Seed categories
  const catAbaya = await prisma.category.upsert({
    where: { slug: 'abayas' },
    update: {},
    create: { nom: 'Abayas', slug: 'abayas', ordre: 1, active: true },
  });

  const catEnsemble = await prisma.category.upsert({
    where: { slug: 'ensembles' },
    update: {},
    create: { nom: 'Ensembles', slug: 'ensembles', ordre: 2, active: true },
  });

  const catRobe = await prisma.category.upsert({
    where: { slug: 'robes' },
    update: {},
    create: { nom: 'Robes', slug: 'robes', ordre: 3, active: true },
  });

  const catAccessoire = await prisma.category.upsert({
    where: { slug: 'accessoires' },
    update: {},
    create: { nom: 'Accessoires', slug: 'accessoires', ordre: 4, active: true },
  });

  // Seed products
  const products = [
    {
      nomProduit: 'Abaya Noire Élégance',
      prixVente: 450,
      prixAchat: 200,
      categorieId: catAbaya.id,
      description: 'Abaya noire en crêpe premium, coupe fluide et élégante avec des détails brodés dorés sur les manches.',
      couleurs: JSON.stringify([{ nom: 'Noir', hex: '#000000' }, { nom: 'Marine', hex: '#1A237E' }]),
      tailles: JSON.stringify(['S', 'M', 'L', 'XL']),
      imagePrincipale: null,
      imagesCarousel: JSON.stringify([]),
      canalCommande: 'whatsapp',
      stock: 15,
      disponible: true,
      featured: true,
      nOrdre: 1,
    },
    {
      nomProduit: 'Abaya Crème Royal',
      prixVente: 520,
      prixAchat: 250,
      categorieId: catAbaya.id,
      description: 'Abaya crème avec broderie dorée, idéale pour les occasions spéciales.',
      couleurs: JSON.stringify([{ nom: 'Crème', hex: '#FFFDD0' }, { nom: 'Beige', hex: '#F5F0E8' }]),
      tailles: JSON.stringify(['M', 'L', 'XL', 'XXL']),
      imagePrincipale: null,
      imagesCarousel: JSON.stringify([]),
      canalCommande: 'instagram',
      stock: 8,
      disponible: true,
      featured: true,
      nOrdre: 2,
    },
    {
      nomProduit: 'Ensemble Marrakech',
      prixVente: 680,
      prixAchat: 320,
      categorieId: catEnsemble.id,
      description: 'Ensemble deux pièces composé d\'une abaya et d\'un hijab assorti en tissu premium.',
      couleurs: JSON.stringify([{ nom: 'Bordeaux', hex: '#800020' }, { nom: 'Noir', hex: '#000000' }, { nom: 'Taupe', hex: '#483C32' }]),
      tailles: JSON.stringify(['S', 'M', 'L', 'XL']),
      imagePrincipale: null,
      imagesCarousel: JSON.stringify([]),
      canalCommande: 'whatsapp',
      stock: 12,
      disponible: true,
      featured: false,
      nOrdre: 3,
    },
    {
      nomProduit: 'Robe Modeste Fleurie',
      prixVente: 390,
      prixAchat: 180,
      categorieId: catRobe.id,
      description: 'Robe longue à motif floral discret, manches longues, coupe A élégante.',
      couleurs: JSON.stringify([{ nom: 'Rose', hex: '#F48FB1' }, { nom: 'Lavande', hex: '#9575CD' }]),
      tailles: JSON.stringify(['XS', 'S', 'M', 'L']),
      imagePrincipale: null,
      imagesCarousel: JSON.stringify([]),
      canalCommande: 'landing',
      lienCommande: 'https://example.com/robe-fleurie',
      stock: 20,
      disponible: true,
      featured: false,
      nOrdre: 4,
    },
    {
      nomProduit: 'Abaya Cachemire Dorée',
      prixVente: 750,
      prixAchat: 380,
      categorieId: catAbaya.id,
      description: 'Abaya en tissu cachemire avec finitions dorées, un luxe absolu pour les grandes occasions.',
      couleurs: JSON.stringify([{ nom: 'Or', hex: '#FFD600' }, { nom: 'Noir', hex: '#000000' }]),
      tailles: JSON.stringify(['S', 'M', 'L', 'XL', 'XXL']),
      imagePrincipale: null,
      imagesCarousel: JSON.stringify([]),
      canalCommande: 'email',
      stock: 5,
      disponible: true,
      featured: true,
      nOrdre: 5,
    },
    {
      nomProduit: 'Hijab Premium Soie',
      prixVente: 120,
      prixAchat: 50,
      categorieId: catAccessoire.id,
      description: 'Hijab en soie naturelle, texture douce et fluide, disponible en plusieurs couleurs.',
      couleurs: JSON.stringify([{ nom: 'Noir', hex: '#000000' }, { nom: 'Blanc', hex: '#FFFFFF' }, { nom: 'Caramel', hex: '#C9A84C' }, { nom: 'Rose', hex: '#F48FB1' }]),
      tailles: JSON.stringify(['Unique']),
      imagePrincipale: null,
      imagesCarousel: JSON.stringify([]),
      canalCommande: 'whatsapp',
      stock: 50,
      disponible: true,
      featured: false,
      nOrdre: 6,
    },
  ];

  for (const product of products) {
    await prisma.product.upsert({
      where: { nomProduit: product.nomProduit },
      update: {},
      create: product,
    });
  }

  console.log('Seed data created successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
