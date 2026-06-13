'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Search,
  Pencil,
  Trash2,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Loader2,
  MessageCircle,
  Instagram,
  ExternalLink,
  Mail,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { CANAUX } from '@/lib/constants';
import { useTranslation } from '@/lib/i18n';
import type { Product } from '@/types';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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

type SortField = 'nomProduit' | 'prixVente' | 'stock' | 'createdAt';
type SortDir = 'asc' | 'desc';

interface ProductTableProps {
  onEdit: (product: Product) => void;
}

export default function ProductTable({ onEdit }: ProductTableProps) {
  const { categories } = useAppStore();
  const { formatPrice } = useTranslation();

  // Filters
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [availableFilter, setAvailableFilter] = useState('all');

  // Data
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  // Sorting
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Bulk action
  const [bulkAction, setBulkAction] = useState<string | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);

  // Inline editing
  const [editingCell, setEditingCell] = useState<{ id: string; field: 'prixVente' | 'stock' } | null>(null);
  const [editValue, setEditValue] = useState('');

  const limit = 10;

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        admin: 'true',
        page: String(page),
        limit: String(limit),
      });
      if (search) params.set('search', search);
      if (categoryFilter !== 'all') params.set('category', categoryFilter);
      if (availableFilter === 'true') params.set('available', 'true');
      else if (availableFilter === 'false') params.set('available', 'false');

      const res = await fetch(`/api/products?${params}`);
      if (res.ok) {
        const json = await res.json();
        setProducts(json.data || []);
        setTotal(json.total || 0);
        setTotalPages(json.totalPages || 1);
      }
    } catch {
      toast.error('Erreur de chargement des produits');
    } finally {
      setLoading(false);
    }
  }, [page, search, categoryFilter, availableFilter]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [search, categoryFilter, availableFilter]);

  // Sorting
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ChevronsUpDown className="size-3.5 ml-1 opacity-40" />;
    return sortDir === 'asc' ? (
      <ChevronUp className="size-3.5 ml-1 text-gold" />
    ) : (
      <ChevronDown className="size-3.5 ml-1 text-gold" />
    );
  };

  const sortedProducts = [...products].sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1;
    switch (sortField) {
      case 'nomProduit':
        return a.nomProduit.localeCompare(b.nomProduit) * dir;
      case 'prixVente':
        return (a.prixVente - b.prixVente) * dir;
      case 'stock':
        return (a.stock - b.stock) * dir;
      case 'createdAt':
        return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * dir;
      default:
        return 0;
    }
  });

  // Selection
  const allSelected = products.length > 0 && products.every((p) => selectedIds.has(p.id));
  const someSelected = products.some((p) => selectedIds.has(p.id)) && !allSelected;

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(products.map((p) => p.id)));
    }
  };

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Toggle disponible
  const handleToggleDisponible = async (product: Product, checked: boolean) => {
    try {
      const res = await fetch(`/api/products/${product.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ disponible: checked }),
      });
      if (res.ok) {
        setProducts((prev) =>
          prev.map((p) => (p.id === product.id ? { ...p, disponible: checked } : p))
        );
      }
    } catch {
      toast.error('Erreur lors de la mise a jour');
    }
  };

  // Delete
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/products/${deleteTarget.id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Produit supprime');
        setProducts((prev) => prev.filter((p) => p.id !== deleteTarget.id));
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(deleteTarget.id);
          return next;
        });
        setTotal((prev) => prev - 1);
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

  // Inline editing
  const startEdit = (product: Product, field: 'prixVente' | 'stock') => {
    setEditingCell({ id: product.id, field });
    setEditValue(String(product[field]));
  };

  const saveEdit = async () => {
    if (!editingCell) return;
    const val = parseFloat(editValue);
    if (isNaN(val) || val < 0) {
      setEditingCell(null);
      return;
    }

    try {
      const res = await fetch(`/api/products/${editingCell.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [editingCell.field]: val }),
      });
      if (res.ok) {
        setProducts((prev) =>
          prev.map((p) =>
            p.id === editingCell.id ? { ...p, [editingCell.field]: val } : p
          )
        );
      }
    } catch {
      toast.error('Erreur de mise a jour');
    }
    setEditingCell(null);
  };

  // Bulk actions
  const handleBulkAction = async () => {
    if (!bulkAction || selectedIds.size === 0) return;
    setBulkLoading(true);

    try {
      const promises = Array.from(selectedIds).map(async (id) => {
        if (bulkAction === 'delete') {
          return fetch(`/api/products/${id}`, { method: 'DELETE' });
        } else {
          const disponible = bulkAction === 'activate';
          return fetch(`/api/products/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ disponible }),
          });
        }
      });

      await Promise.all(promises);

      toast.success(
        bulkAction === 'delete'
          ? `${selectedIds.size} produit(s) supprime(s)`
          : bulkAction === 'activate'
          ? `${selectedIds.size} produit(s) active(s)`
          : `${selectedIds.size} produit(s) desactive(s)`
      );

      setSelectedIds(new Set());
      fetchProducts();
    } catch {
      toast.error('Erreur lors de l\'action en masse');
    } finally {
      setBulkLoading(false);
      setBulkAction(null);
    }
  };

  // Canal icon helper
  const getCanalIcon = (canal: string) => {
    switch (canal) {
      case 'whatsapp': return <MessageCircle className="size-3.5" />;
      case 'instagram': return <Instagram className="size-3.5" />;
      case 'landing': return <ExternalLink className="size-3.5" />;
      case 'email': return <Mail className="size-3.5" />;
      default: return null;
    }
  };

  const getCanalColor = (canal: string) => {
    return CANAUX.find((c) => c.value === canal)?.color || '#8C8C8C';
  };

  return (
    <div className="space-y-4">
      {/* Filters Row */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un produit..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Categorie" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les categories</SelectItem>
            {categories
              .filter((c) => c.active)
              .sort((a, b) => a.ordre - b.ordre)
              .map((cat) => (
                <SelectItem key={cat.id} value={cat.slug}>
                  {cat.nom}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>

        <Select value={availableFilter} onValueChange={setAvailableFilter}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Disponibilite" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            <SelectItem value="true">Disponible</SelectItem>
            <SelectItem value="false">Non disponible</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Bulk Actions */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
          <span className="text-sm text-muted-foreground">
            {selectedIds.size} selectionne(s)
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => { setBulkAction('activate'); }}
            disabled={bulkLoading}
          >
            Activer
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => { setBulkAction('deactivate'); }}
            disabled={bulkLoading}
          >
            Desactiver
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => { setBulkAction('delete'); }}
            disabled={bulkLoading}
          >
            {bulkLoading && <Loader2 className="size-3.5 animate-spin" />}
            Supprimer
          </Button>
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="w-10">
                <Checkbox
                  checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                  onCheckedChange={toggleAll}
                />
              </TableHead>
              <TableHead className="w-16">Image</TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => handleSort('nomProduit')}>
                <span className="flex items-center">
                  Nom
                  <SortIcon field="nomProduit" />
                </span>
              </TableHead>
              <TableHead>Categorie</TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => handleSort('prixVente')}>
                <span className="flex items-center">
                  Prix vente
                  <SortIcon field="prixVente" />
                </span>
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => handleSort('stock')}>
                <span className="flex items-center">
                  Stock
                  <SortIcon field="stock" />
                </span>
              </TableHead>
              <TableHead>Disponible</TableHead>
              <TableHead>Canal</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              // Loading skeleton
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="size-4" /></TableCell>
                  <TableCell><Skeleton className="size-10 rounded" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-10" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : sortedProducts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                  Aucun produit trouve
                </TableCell>
              </TableRow>
            ) : (
              sortedProducts.map((product) => (
                <TableRow key={product.id} data-state={selectedIds.has(product.id) ? 'selected' : undefined}>
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.has(product.id)}
                      onCheckedChange={() => toggleOne(product.id)}
                    />
                  </TableCell>
                  <TableCell>
                    {product.imagePrincipale ? (
                      <img
                        src={product.imagePrincipale}
                        alt={product.nomProduit}
                        className="size-10 rounded object-cover"
                      />
                    ) : (
                      <div className="size-10 rounded bg-muted flex items-center justify-center text-xs text-muted-foreground">
                        --
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div>
                      <span className="font-medium text-sm">{product.nomProduit}</span>
                      {product.featured && (
                        <Badge variant="secondary" className="ml-2 text-[10px] bg-gold/10 text-gold border-gold/20">
                          Vedette
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {product.categorie?.nom || '--'}
                    </span>
                  </TableCell>
                  <TableCell>
                    {editingCell?.id === product.id && editingCell?.field === 'prixVente' ? (
                      <Input
                        type="number"
                        min={0}
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={saveEdit}
                        onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditingCell(null); }}
                        className="h-7 w-20 text-sm"
                        autoFocus
                      />
                    ) : (
                      <span
                        className="text-sm cursor-pointer hover:text-gold transition-colors"
                        onClick={() => startEdit(product, 'prixVente')}
                        title="Cliquer pour modifier"
                      >
                        {formatPrice(product.prixVente)}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {editingCell?.id === product.id && editingCell?.field === 'stock' ? (
                      <Input
                        type="number"
                        min={0}
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={saveEdit}
                        onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditingCell(null); }}
                        className="h-7 w-16 text-sm"
                        autoFocus
                      />
                    ) : (
                      <span
                        className={`text-sm cursor-pointer hover:text-gold transition-colors ${
                          product.stock === 0 ? 'text-destructive font-medium' : ''
                        }`}
                        onClick={() => startEdit(product, 'stock')}
                        title="Cliquer pour modifier"
                      >
                        {product.stock}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={product.disponible}
                      onCheckedChange={(checked) => handleToggleDisponible(product, checked)}
                    />
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className="gap-1.5 text-xs"
                      style={{
                        borderColor: getCanalColor(product.canalCommande),
                        color: getCanalColor(product.canalCommande),
                      }}
                    >
                      {getCanalIcon(product.canalCommande)}
                      {CANAUX.find((c) => c.value === product.canalCommande)?.label || product.canalCommande}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={() => onEdit(product)}
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
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {total} produit{total !== 1 ? 's' : ''} au total
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1 || loading}
          >
            Precedent
          </Button>
          <span className="text-sm text-muted-foreground px-2">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages || loading}
          >
            Suivant
          </Button>
        </div>
      </div>

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
              {deleting && <Loader2 className="size-4 animate-spin" />}
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Action Confirmation Dialog */}
      <AlertDialog open={!!bulkAction} onOpenChange={(open) => { if (!open) setBulkAction(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer l&apos;action</AlertDialogTitle>
            <AlertDialogDescription>
              {bulkAction === 'delete'
                ? `Etes-vous sur de vouloir supprimer ${selectedIds.size} produit(s) ? Cette action est irreversible.`
                : bulkAction === 'activate'
                ? `Activer ${selectedIds.size} produit(s) ?`
                : `Desactiver ${selectedIds.size} produit(s) ?`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkLoading}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkAction}
              disabled={bulkLoading}
              className={bulkAction === 'delete' ? 'bg-destructive text-white hover:bg-destructive/90' : ''}
            >
              {bulkLoading && <Loader2 className="size-4 animate-spin" />}
              Confirmer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
