// ─── Primitives ───────────────────────────────────────────────────────────────

export type Canal = 'whatsapp' | 'instagram' | 'landing' | 'email';

export interface Couleur {
  nom: string;
  hex: string;
}

// ─── Entités base de données ──────────────────────────────────────────────────

export interface Category {
  id: string;
  nom: string;
  slug: string;
  ordre: number;
  active: boolean;
}

export interface Product {
  id: string;
  nOrdre: number;
  nomProduit: string;
  prixVente: number;
  prixAchat: number | null;
  categorieId: string | null;
  description: string | null;
  couleurs: Couleur[];
  tailles: string[];
  imagePrincipale: string | null;
  imagesCarousel: string[];
  canalCommande: Canal;
  lienCommande: string | null;
  stock: number;
  disponible: boolean;
  featured: boolean;
  createdAt: string;
  updatedAt: string;
  categorie?: Category | null;
}

export interface Settings {
  maintenanceMode: boolean;
  maintenanceMessage: string;
}

// ─── Formulaires ──────────────────────────────────────────────────────────────

export interface ProductFormValues {
  nomProduit: string;
  categorieId: string;
  description: string;
  prixVente: number;
  prixAchat: number | null;
  couleurs: Couleur[];
  tailles: string[];
  imagePrincipale: string;
  imagesCarousel: string[];
  canalCommande: Canal;
  lienCommande: string;
  stock: number;
  nOrdre: number;
  disponible: boolean;
  featured: boolean;
}

// ─── API ──────────────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
}
