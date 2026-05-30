import { db } from './src/lib/db';

async function updateImages() {
  console.log('Updating product images...');

  const imageMap: Record<string, string> = {
    'Abaya Elite Noire': '/uploads/abaya-noire.png',
    'Abaya Royale Dorée': '/uploads/abaya-doree.png',
    'Ensemble Sahara Beige': '/uploads/ensemble-beige.png',
    'Ensemble Marrakech Gris': '/uploads/ensemble-gris.png',
    'Robe Orientale Bordeaux': '/uploads/robe-bordeaux.png',
    'Robe Casablanca Blanche': '/uploads/robe-blanche.png',
    'Kimono Zen Lavande': '/uploads/kimono-lavande.png',
    'Kimono Prestige Noir': '/uploads/kimono-noir.png',
    'Abaya Moderne Abricot': '/uploads/abaya-abricot.png',
    'Ensemble Fès Terracotta': '/uploads/ensemble-terracotta.png',
    'Robe Soirée Émeraude': '/uploads/robe-emeraude.png',
    'Abaya Classique Marine': '/uploads/abaya-marine.png',
  };

  for (const [nom, image] of Object.entries(imageMap)) {
    const result = await db.product.updateMany({
      where: { nomProduit: nom },
      data: { imagePrincipale: image },
    });
    console.log(`Updated ${nom}: ${result.count} product(s)`);
  }

  console.log('Done!');
}

updateImages()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
