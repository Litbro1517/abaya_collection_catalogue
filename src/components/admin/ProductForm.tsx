'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2, ExternalLink, MessageCircle, Instagram, Mail } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { TAILLES_DISPONIBLES, CANAUX, MAX_CAROUSEL_IMAGES, normalizeCouleurKey, COULEURS_DEFAULTS } from '@/lib/constants';
import { useTranslation } from '@/lib/i18n';
import type { Couleur, Canal, ProductFormValues } from '@/types';
import ImageUploader from './ImageUploader';

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function ProductForm() {
  const { currency } = useTranslation();
  const {
    showProductForm,
    setShowProductForm,
    editingProduct,
    setEditingProduct,
    categories,
    setProducts,
  } = useAppStore();

  const isEditing = !!editingProduct;

  // Form state
  const [nomProduit, setNomProduit] = useState('');
  const [categorieId, setCategorieId] = useState('');
  const [description, setDescription] = useState('');
  const [prixVente, setPrixVente] = useState<number>(0);
  const [prixAchat, setPrixAchat] = useState<number | null>(null);
  const [tailles, setTailles] = useState<string[]>([]);
  const [couleurs, setCouleurs] = useState<Couleur[]>([]);
  const [imagePrincipale, setImagePrincipale] = useState('');
  const [imagesCarousel, setImagesCarousel] = useState<string[]>([]);
  const [canalCommande, setCanalCommande] = useState<Canal>('whatsapp');
  const [lienCommande, setLienCommande] = useState('');
  const [stock, setStock] = useState<number>(0);
  const [nOrdre, setNOrdre] = useState<number>(0);
  const [disponible, setDisponible] = useState(true);
  const [featured, setFeatured] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reset form when opening/closing or switching edit product
  useEffect(() => {
    if (showProductForm && editingProduct) {
      setNomProduit(editingProduct.nomProduit);
      setCategorieId(editingProduct.categorieId || '');
      setDescription(editingProduct.description || '');
      setPrixVente(editingProduct.prixVente);
      setPrixAchat(editingProduct.prixAchat);
      setTailles(editingProduct.tailles || []);
      setCouleurs(editingProduct.couleurs || []);
      setImagePrincipale(editingProduct.imagePrincipale || '');
      setImagesCarousel(editingProduct.imagesCarousel || []);
      setCanalCommande(editingProduct.canalCommande);
      setLienCommande(editingProduct.lienCommande || '');
      setStock(editingProduct.stock);
      setNOrdre(editingProduct.nOrdre);
      setDisponible(editingProduct.disponible);
      setFeatured(editingProduct.featured);
    } else if (showProductForm && !editingProduct) {
      setNomProduit('');
      setCategorieId('');
      setDescription('');
      setPrixVente(0);
      setPrixAchat(null);
      setTailles([]);
      setCouleurs([]);
      setImagePrincipale('');
      setImagesCarousel([]);
      setCanalCommande('whatsapp');
      setLienCommande('');
      setStock(0);
      setNOrdre(0);
      setDisponible(true);
      setFeatured(false);
    }
    setErrors({});
  }, [showProductForm, editingProduct]);

  const handleTailleToggle = (taille: string) => {
    setTailles((prev) =>
      prev.includes(taille)
        ? prev.filter((t) => t !== taille)
        : [...prev, taille]
    );
  };

  const handleAddCouleur = () => {
    setCouleurs((prev) => [...prev, { nom: '', hex: '#000000' }]);
  };

  const handleRemoveCouleur = (index: number) => {
    setCouleurs((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCouleurNomChange = (index: number, nom: string) => {
    setCouleurs((prev) => {
      const updated = [...prev];
      const key = normalizeCouleurKey(nom);
      const autoHex = COULEURS_DEFAULTS[key];
      updated[index] = {
        ...updated[index],
        nom,
        ...(autoHex ? { hex: autoHex } : {}),
      };
      return updated;
    });
  };

  const handleCouleurHexChange = (index: number, hex: string) => {
    setCouleurs((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], hex };
      return updated;
    });
  };

  const handleCarouselImageChange = (index: number, url: string) => {
    setImagesCarousel((prev) => {
      const updated = [...prev];
      if (url) {
        updated[index] = url;
      } else {
        updated.splice(index, 1);
      }
      return updated;
    });
  };

  const addCarouselSlot = () => {
    if (imagesCarousel.length < MAX_CAROUSEL_IMAGES) {
      setImagesCarousel((prev) => [...prev, '']);
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!nomProduit.trim()) newErrors.nomProduit = 'Le nom est requis';
    if (prixVente <= 0) newErrors.prixVente = 'Le prix doit etre superieur a 0';
    if (canalCommande === 'landing' && !lienCommande.trim()) {
      newErrors.lienCommande = 'Le lien est requis pour la page produit';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const refreshProducts = useCallback(async () => {
    try {
      const res = await fetch('/api/products?admin=true&limit=100');
      if (res.ok) {
        const json = await res.json();
        setProducts(json.data || []);
      }
    } catch {
      // Silent fail
    }
  }, [setProducts]);

  const handleSubmit = async () => {
    if (!validate()) return;

    setSubmitting(true);

    const payload: ProductFormValues = {
      nomProduit: nomProduit.trim(),
      categorieId,
      description: description.trim(),
      prixVente,
      prixAchat,
      couleurs: couleurs.filter((c) => c.nom.trim()),
      tailles,
      imagePrincipale,
      imagesCarousel: imagesCarousel.filter(Boolean),
      canalCommande,
      lienCommande: lienCommande.trim(),
      stock,
      nOrdre,
      disponible,
      featured,
    };

    try {
      const url = isEditing ? `/api/products/${editingProduct!.id}` : '/api/products';
      const method = isEditing ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!res.ok) {
        toast.error(json.error || 'Erreur lors de la sauvegarde');
        return;
      }

      toast.success(
        isEditing ? 'Produit modifie avec succes' : 'Produit cree avec succes'
      );

      await refreshProducts();
      handleClose();
    } catch {
      toast.error('Erreur de connexion');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setShowProductForm(false);
    setEditingProduct(null);
  };

  const getCanalIcon = (canal: string) => {
    switch (canal) {
      case 'whatsapp': return <MessageCircle className="size-4" />;
      case 'instagram': return <Instagram className="size-4" />;
      case 'landing': return <ExternalLink className="size-4" />;
      case 'email': return <Mail className="size-4" />;
      default: return null;
    }
  };

  const getCanalPreviewText = () => {
    switch (canalCommande) {
      case 'whatsapp': return 'Commander via WhatsApp';
      case 'instagram': return 'Commander via Instagram';
      case 'landing': return 'Voir la page produit';
      case 'email': return 'Commander par email';
      default: return '';
    }
  };

  return (
    <Sheet open={showProductForm} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-xl lg:max-w-2xl p-0 flex flex-col">
        <SheetHeader className="px-6 pt-6 pb-2">
          <SheetTitle className="font-[family-name:var(--font-playfair)] text-xl">
            {isEditing ? 'Modifier le produit' : 'Nouveau produit'}
          </SheetTitle>
          <SheetDescription>
            {isEditing
              ? 'Modifiez les informations du produit ci-dessous.'
              : 'Remplissez les informations pour creer un nouveau produit.'}
          </SheetDescription>
        </SheetHeader>

        <Separator />

        <ScrollArea className="flex-1">
          <div className="px-6 py-4 space-y-6">

            {/* Section 1 - Informations de base */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
                Informations de base
              </h3>

              <div className="space-y-2">
                <Label htmlFor="nomProduit">Nom du produit *</Label>
                <Input
                  id="nomProduit"
                  value={nomProduit}
                  onChange={(e) => setNomProduit(e.target.value)}
                  placeholder="Ex: Abaya Elite Noire"
                  className={errors.nomProduit ? 'border-destructive' : ''}
                />
                {errors.nomProduit && (
                  <p className="text-xs text-destructive">{errors.nomProduit}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Categorie</Label>
                <Select value={categorieId} onValueChange={setCategorieId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selectionner une categorie" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucune categorie</SelectItem>
                    {categories
                      .filter((c) => c.active)
                      .sort((a, b) => a.ordre - b.ordre)
                      .map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.nom}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Description du produit..."
                  rows={3}
                />
              </div>
            </div>

            <Separator />

            {/* Section 2 - Prix */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
                Prix
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="prixVente">Prix de vente *</Label>
                  <div className="relative">
                    <Input
                      id="prixVente"
                      type="number"
                      min={0}
                      value={prixVente || ''}
                      onChange={(e) => setPrixVente(parseFloat(e.target.value) || 0)}
                      className={errors.prixVente ? 'border-destructive pr-10' : 'pr-10'}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                      {currency}
                    </span>
                  </div>
                  {errors.prixVente && (
                    <p className="text-xs text-destructive">{errors.prixVente}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="prixAchat">Prix d&apos;achat</Label>
                  <div className="relative">
                    <Input
                      id="prixAchat"
                      type="number"
                      min={0}
                      value={prixAchat ?? ''}
                      onChange={(e) => setPrixAchat(e.target.value ? parseFloat(e.target.value) : null)}
                      className="pr-10"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                      {currency}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Prive - non visible publiquement
                  </p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Section 3 - Variantes */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
                Variantes
              </h3>

              {/* Tailles */}
              <div className="space-y-2">
                <Label>Tailles</Label>
                <div className="flex flex-wrap gap-2">
                  {TAILLES_DISPONIBLES.map((taille) => (
                    <label
                      key={taille}
                      className="flex items-center gap-1.5 cursor-pointer rounded-md border px-3 py-1.5 text-sm transition-colors hover:bg-muted/50 has-[button[data-state=checked]]:border-gold has-[button[data-state=checked]]:bg-gold/10"
                    >
                      <Checkbox
                        checked={tailles.includes(taille)}
                        onCheckedChange={() => handleTailleToggle(taille)}
                      />
                      {taille}
                    </label>
                  ))}
                </div>
              </div>

              {/* Couleurs */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Couleurs</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleAddCouleur}
                    className="text-gold hover:text-gold/80"
                  >
                    <Plus className="size-3.5" />
                    Ajouter une couleur
                  </Button>
                </div>

                {couleurs.length === 0 && (
                  <p className="text-xs text-muted-foreground py-2">
                    Aucune couleur ajoutee
                  </p>
                )}

                <div className="space-y-2">
                  {couleurs.map((couleur, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Input
                        value={couleur.nom}
                        onChange={(e) => handleCouleurNomChange(index, e.target.value)}
                        placeholder="Nom"
                        className="flex-1 h-8 text-sm"
                      />
                      <div className="relative">
                        <input
                          type="color"
                          value={couleur.hex}
                          onChange={(e) => handleCouleurHexChange(index, e.target.value)}
                          className="size-8 cursor-pointer rounded border border-input p-0.5"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => handleRemoveCouleur(index)}
                        aria-label="Supprimer la couleur"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <Separator />

            {/* Section 4 - Images */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
                Images
              </h3>

              <div className="space-y-2">
                <Label>Image principale</Label>
                <ImageUploader
                  value={imagePrincipale}
                  onChange={setImagePrincipale}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Images carousel ({imagesCarousel.filter(Boolean).length}/{MAX_CAROUSEL_IMAGES})</Label>
                  {imagesCarousel.length < MAX_CAROUSEL_IMAGES && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={addCarouselSlot}
                      className="text-gold hover:text-gold/80"
                    >
                      <Plus className="size-3.5" />
                      Ajouter
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {imagesCarousel.map((img, index) => (
                    <ImageUploader
                      key={index}
                      value={img}
                      onChange={(url) => handleCarouselImageChange(index, url)}
                    />
                  ))}
                  {/* Show remaining empty slots indicator */}
                  {imagesCarousel.length < MAX_CAROUSEL_IMAGES && (
                    <div className="flex items-center justify-center h-32 rounded-lg border-2 border-dashed border-border text-xs text-muted-foreground">
                      {imagesCarousel.filter(Boolean).length}/{MAX_CAROUSEL_IMAGES}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <Separator />

            {/* Section 5 - Canal de commande */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
                Canal de commande
              </h3>

              <RadioGroup
                value={canalCommande}
                onValueChange={(v) => setCanalCommande(v as Canal)}
                className="grid grid-cols-2 gap-3"
              >
                {CANAUX.map((canal) => (
                  <label
                    key={canal.value}
                    className="flex items-center gap-2.5 rounded-md border px-3 py-2.5 cursor-pointer transition-colors hover:bg-muted/50 has-[button[data-state=checked]]:border-gold has-[button[data-state=checked]]:bg-gold/5"
                  >
                    <RadioGroupItem value={canal.value} />
                    <span
                      className="size-2 rounded-full shrink-0"
                      style={{ backgroundColor: canal.color }}
                    />
                    <span className="text-sm">{canal.label}</span>
                  </label>
                ))}
              </RadioGroup>

              {canalCommande === 'landing' && (
                <div className="space-y-2">
                  <Label htmlFor="lienCommande">Lien de la page produit *</Label>
                  <Input
                    id="lienCommande"
                    type="url"
                    value={lienCommande}
                    onChange={(e) => setLienCommande(e.target.value)}
                    placeholder="https://..."
                    className={errors.lienCommande ? 'border-destructive' : ''}
                  />
                  {errors.lienCommande && (
                    <p className="text-xs text-destructive">{errors.lienCommande}</p>
                  )}
                </div>
              )}

              {/* Preview */}
              <div className="rounded-lg border border-border p-3 bg-muted/30">
                <p className="text-[10px] text-muted-foreground mb-2 uppercase tracking-wider">
                  Apercu du bouton
                </p>
                <Button
                  type="button"
                  className="gap-2"
                  style={{
                    backgroundColor: CANAUX.find((c) => c.value === canalCommande)?.color,
                    color: canalCommande === 'email' ? '#FFFFFF' : '#FFFFFF',
                  }}
                  size="sm"
                >
                  {getCanalIcon(canalCommande)}
                  {getCanalPreviewText()}
                </Button>
              </div>
            </div>

            <Separator />

            {/* Section 6 - Parametres */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
                Parametres
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="stock">Stock</Label>
                  <Input
                    id="stock"
                    type="number"
                    min={0}
                    value={stock}
                    onChange={(e) => setStock(parseInt(e.target.value) || 0)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="nOrdre">Numero d&apos;ordre</Label>
                  <Input
                    id="nOrdre"
                    type="number"
                    min={0}
                    value={nOrdre}
                    onChange={(e) => setNOrdre(parseInt(e.target.value) || 0)}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label>Disponible</Label>
                  <p className="text-xs text-muted-foreground">
                    Le produit sera visible dans la boutique
                  </p>
                </div>
                <Switch
                  checked={disponible}
                  onCheckedChange={setDisponible}
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label>Produit vedette</Label>
                  <p className="text-xs text-muted-foreground">
                    Mettre en avant sur la page d&apos;accueil
                  </p>
                </div>
                <Switch
                  checked={featured}
                  onCheckedChange={setFeatured}
                />
              </div>
            </div>

            {/* Spacer for bottom */}
            <div className="h-4" />
          </div>
        </ScrollArea>

        <Separator />

        {/* Footer with buttons */}
        <div className="flex items-center justify-end gap-3 p-4 bg-background">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={submitting}
          >
            Annuler
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="bg-gold text-gold-foreground hover:bg-gold/90"
          >
            {submitting && <Loader2 className="size-4 animate-spin" />}
            Enregistrer
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
