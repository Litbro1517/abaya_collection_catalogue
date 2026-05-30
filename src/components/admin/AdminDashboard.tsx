'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  ShoppingBag,
  CheckCircle,
  Star,
  Package,
  Plus,
  ArrowLeft,
  Pencil,
  Trash2,
  List,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { formatPrice } from '@/lib/constants';
import type { Product } from '@/types';

import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';

import ProductForm from './ProductForm';
import ProductTable from './ProductTable';

export default function AdminDashboard() {
  const {
    setView,
    products,
    setProducts,
    categories,
    setShowProductForm,
    setEditingProduct,
    loading,
    setLoading,
  } = useAppStore();

  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);
  const productMgmtRef = useRef<HTMLDivElement>(null);

  // Fetch products on mount
  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/products?admin=true&limit=100');
        if (res.ok) {
          const json = await res.json();
          setProducts(json.data || []);
        }
      } catch {
        toast.error('Erreur de chargement');
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, [setProducts, setLoading]);

  // Stats calculations
  const totalProducts = products.length;
  const availableProducts = products.filter((p) => p.disponible).length;
  const featuredProducts = products.filter((p) => p.featured).length;
  const totalStock = products.reduce((sum, p) => sum + p.stock, 0);

  // Recent products (last 10, sorted by creation date)
  const recentProducts = [...products]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 10);

  // Toggle disponible
  const handleToggleDisponible = async (product: Product, checked: boolean) => {
    try {
      const res = await fetch(`/api/products/${product.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ disponible: checked }),
      });
      if (res.ok) {
        setProducts(
          products.map((p) => (p.id === product.id ? { ...p, disponible: checked } : p))
        );
      }
    } catch {
      toast.error('Erreur lors de la mise a jour');
    }
  };

  // Edit product
  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setShowProductForm(true);
  };

  // Delete product
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/products/${deleteTarget.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        toast.success('Produit supprime');
        setProducts(products.filter((p) => p.id !== deleteTarget.id));
      } else {
        toast.error('Erreur lors de la suppression');
      }
    } catch {
      toast.error('Erreur de connexion');
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  // Get category name
  const getCategoryName = (categorieId: string | null) => {
    if (!categorieId) return '--';
    const cat = categories.find((c) => c.id === categorieId);
    return cat?.nom || '--';
  };

  const scrollToProductMgmt = () => {
    productMgmtRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Stat cards data
  const stats = [
    {
      title: 'Total produits',
      value: totalProducts,
      icon: ShoppingBag,
      color: 'text-gold',
      bgColor: 'bg-gold/10',
    },
    {
      title: 'Produits disponibles',
      value: availableProducts,
      icon: CheckCircle,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
    },
    {
      title: 'Produits vedettes',
      value: featuredProducts,
      icon: Star,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
    },
    {
      title: 'Stock total',
      value: totalStock,
      icon: Package,
      color: 'text-slate-600',
      bgColor: 'bg-slate-50',
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-card border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="font-[family-name:var(--font-playfair)] text-2xl sm:text-3xl font-bold tracking-tight">
              Tableau de bord
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Gestion de la collection Abaya Chic
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => setView('gallery')}
            className="gap-2"
          >
            <ArrowLeft className="size-4" />
            <span className="hidden sm:inline">Retour a la boutique</span>
            <span className="sm:hidden">Retour</span>
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
        {/* Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <Card key={stat.title} className="relative overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {stat.title}
                </CardTitle>
                <div className={`size-8 rounded-lg ${stat.bgColor} flex items-center justify-center`}>
                  <stat.icon className={`size-4 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tabular-nums">{stat.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            onClick={() => {
              setEditingProduct(null);
              setShowProductForm(true);
            }}
            className="gap-2 bg-gold text-gold-foreground hover:bg-gold/90"
          >
            <Plus className="size-4" />
            Ajouter un produit
          </Button>
          <Button
            variant="outline"
            onClick={scrollToProductMgmt}
            className="gap-2"
          >
            <List className="size-4" />
            Voir tous les produits
          </Button>
        </div>

        <Separator />

        {/* Derniers produits section */}
        <section>
          <h2 className="font-[family-name:var(--font-playfair)] text-xl font-semibold mb-4">
            Derniers produits
          </h2>

          {loading ? (
            <div className="rounded-lg border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Image</TableHead>
                    <TableHead>Nom</TableHead>
                    <TableHead className="hidden md:table-cell">Categorie</TableHead>
                    <TableHead>Prix</TableHead>
                    <TableHead className="hidden sm:table-cell">Stock</TableHead>
                    <TableHead>Disponible</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="size-10 rounded" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell className="hidden sm:table-cell"><Skeleton className="h-4 w-10" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-10" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : recentProducts.length === 0 ? (
            <div className="text-center py-12 rounded-lg border bg-card">
              <ShoppingBag className="size-10 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground">Aucun produit pour le moment</p>
              <Button
                className="mt-4 bg-gold text-gold-foreground hover:bg-gold/90 gap-2"
                onClick={() => {
                  setEditingProduct(null);
                  setShowProductForm(true);
                }}
              >
                <Plus className="size-4" />
                Creer votre premier produit
              </Button>
            </div>
          ) : (
            <div className="rounded-lg border bg-card overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="w-16">Image</TableHead>
                    <TableHead>Nom</TableHead>
                    <TableHead className="hidden md:table-cell">Categorie</TableHead>
                    <TableHead>Prix</TableHead>
                    <TableHead className="hidden sm:table-cell">Stock</TableHead>
                    <TableHead>Disponible</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentProducts.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell>
                        {product.imagePrincipale ? (
                          <img
                            src={product.imagePrincipale}
                            alt={product.nomProduit}
                            className="w-10 h-[53px] rounded object-cover"
                          />
                        ) : (
                          <div className="w-10 h-[53px] rounded bg-muted flex items-center justify-center text-xs text-muted-foreground">
                            --
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div>
                          <span className="font-medium text-sm line-clamp-1">{product.nomProduit}</span>
                          {product.featured && (
                            <Badge variant="secondary" className="ml-1.5 text-[9px] bg-gold/10 text-gold border-gold/20">
                              Vedette
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <span className="text-sm text-muted-foreground">
                          {getCategoryName(product.categorieId)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm font-medium">
                          {formatPrice(product.prixVente)}
                        </span>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <span className={`text-sm ${product.stock === 0 ? 'text-destructive font-medium' : ''}`}>
                          {product.stock}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={product.disponible}
                          onCheckedChange={(checked) => handleToggleDisponible(product, checked)}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            onClick={() => handleEdit(product)}
                            aria-label="Modifier"
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-muted-foreground hover:text-destructive"
                            onClick={() => setDeleteTarget(product)}
                            aria-label="Supprimer"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </section>

        <Separator />

        {/* Product Management Section */}
        <section ref={productMgmtRef}>
          <h2 className="font-[family-name:var(--font-playfair)] text-xl font-semibold mb-4">
            Gestion des produits
          </h2>
          <ProductTable onEdit={handleEdit} />
        </section>
      </main>

      {/* Product Form Sheet */}
      <ProductForm />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Etes-vous sur de vouloir supprimer &quot;{deleteTarget?.nomProduit}&quot; ?
              Cette action est irreversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
