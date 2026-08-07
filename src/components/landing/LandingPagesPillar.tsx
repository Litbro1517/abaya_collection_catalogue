'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Edit3, ExternalLink, Loader2, FileText, ImageIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PromptCopyBlock } from './PromptCopyBlock';
import { ImagePickerModal } from './ImagePickerModal';
import { useAppStore } from '@/lib/store';
import { useTranslation } from '@/lib/i18n';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  PROMPT_IA_CODE, GUIDE_ADMIN_CODE_IA,
  DIRECTIVES_CANVA, GUIDE_ADMIN_CANVA,
} from './promptConstants';

interface LandingPageData {
  id?: string;
  title: string;
  slug: string;
  type: 'IMAGE_CANVA' | 'CODE_IA';
  productId: string;
  desktopImageUrl: string | null;
  mobileImageUrl: string | null;
  showCtaTop: boolean;
  ctaTopText: string | null;
  showCtaMiddle: boolean;
  ctaMiddleText: string | null;
  showCtaBottom: boolean;
  ctaBottomText: string | null;
  htmlContent: string | null;
  active: boolean;
}

const EMPTY_PAGE: LandingPageData = {
  title: '', slug: '', type: 'IMAGE_CANVA', productId: '',
  desktopImageUrl: null, mobileImageUrl: null,
  showCtaTop: true, ctaTopText: 'Commander Maintenant',
  showCtaMiddle: true, ctaMiddleText: "Profiter de l'Offre",
  showCtaBottom: true, ctaBottomText: 'Valider ma Commande',
  htmlContent: null, active: true,
};

interface ProductOption {
  id: string;
  title: string;
  price: string;
  dataSourceName: string;
}

// ── Extract <img> tags from HTML via regex ──
function extractImgTags(html: string): { src: string; fullMatch: string }[] {
  const regex = /<img\s+[^>]*src=["']([^"']+)["'][^>]*>/gi;
  const results: { src: string; fullMatch: string }[] = [];
  let match;
  while ((match = regex.exec(html)) !== null) {
    results.push({ src: match[1], fullMatch: match[0] });
  }
  return results;
}

export function LandingPagesPillar() {
  const { t } = useTranslation();
  const { settings } = useAppStore();
  const [pages, setPages] = useState<LandingPageData[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<LandingPageData | null>(null);
  const [saving, setSaving] = useState(false);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  // VG39: Image picker modal state
  const [imagePickerOpen, setImagePickerOpen] = useState(false);
  const [imagePickerTarget, setImagePickerTarget] = useState<'desktop' | 'mobile' | 'asset' | null>(null);
  const [assetReplacementIndex, setAssetReplacementIndex] = useState<number>(-1);

  const fetchPages = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/landing-pages');
      const data = await res.json();
      setPages(data.data || []);
    } catch {
      toast.error('Erreur lors du chargement des landing pages');
    } finally {
      setLoading(false);
    }
  }, []);

  // VG39: Fetch all products for the <select> dropdown
  const fetchProducts = useCallback(async () => {
    setProductsLoading(true);
    try {
      const res = await fetch('/api/landing-pages/products');
      const data = await res.json();
      setProducts(data.data || []);
    } catch {
      // Silent fail
    } finally {
      setProductsLoading(false);
    }
  }, []);

  useEffect(() => { fetchPages(); }, [fetchPages]);

  // Fetch products when editor opens
  useEffect(() => {
    if (editing) fetchProducts();
  }, [editing, fetchProducts]);

  const handleSave = async () => {
    if (!editing) return;
    if (!editing.title || !editing.slug || !editing.productId) {
      toast.error('Titre, slug et produit sont obligatoires');
      return;
    }
    setSaving(true);
    try {
      const method = editing.id ? 'PUT' : 'POST';
      const url = editing.id ? `/api/landing-pages/${editing.id}` : '/api/landing-pages';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        toast.error(data.error || 'Erreur');
        return;
      }
      toast.success(editing.id ? 'Landing page mise à jour' : 'Landing page créée');
      setEditing(null);
      fetchPages();
    } catch {
      toast.error('Erreur réseau');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cette landing page ?')) return;
    try {
      await fetch(`/api/landing-pages/${id}`, { method: 'DELETE' });
      toast.success('Landing page supprimée');
      fetchPages();
    } catch {
      toast.error('Erreur');
    }
  };

  const handleToggleActive = async (page: LandingPageData) => {
    if (!page.id) return;
    try {
      await fetch(`/api/landing-pages/${page.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !page.active }),
      });
      fetchPages();
    } catch {
      toast.error('Erreur');
    }
  };

  // VG39: Handle image picker selection
  const handleImageSelect = (url: string) => {
    if (!editing) return;
    if (imagePickerTarget === 'desktop') {
      setEditing({ ...editing, desktopImageUrl: url });
    } else if (imagePickerTarget === 'mobile') {
      setEditing({ ...editing, mobileImageUrl: url });
    } else if (imagePickerTarget === 'asset' && assetReplacementIndex >= 0 && editing.htmlContent) {
      // Replace the src in the HTML for the detected asset
      const detectedImages = extractImgTags(editing.htmlContent);
      const targetImg = detectedImages[assetReplacementIndex];
      if (targetImg) {
        const escaped = targetImg.src.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const updated = editing.htmlContent.replace(
          new RegExp(`src=["']${escaped}["']`, 'gi'),
          `src="${url}"`
        );
        setEditing({ ...editing, htmlContent: updated });
      }
    }
    setImagePickerTarget(null);
    setAssetReplacementIndex(-1);
  };

  // ── Editor view ──
  if (editing) {
    const detectedImages = editing.type === 'CODE_IA' && editing.htmlContent
      ? extractImgTags(editing.htmlContent) : [];

    return (
      <>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              {editing.id ? 'Modifier la Landing Page' : 'Nouvelle Landing Page'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Basic fields */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Titre *</Label>
                <Input value={editing.title} onChange={e => setEditing({ ...editing, title: e.target.value })} placeholder="Collection Abaya Soie" />
              </div>
              <div>
                <Label>Slug URL *</Label>
                <Input value={editing.slug} onChange={e => setEditing({ ...editing, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })} placeholder="collection-abaya-soie" />
                <p className="text-xs text-muted-foreground mt-1">URL: /lp/{editing.slug || 'votre-slug'}</p>
              </div>
            </div>

            {/* VG39: Product selector — <select> dropdown replacing broken autocomplete */}
            <div>
              <Label>Produit associé *</Label>
              {productsLoading ? (
                <div className="flex items-center gap-2 py-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">Chargement des produits...</span>
                </div>
              ) : (
                <select
                  value={editing.productId}
                  onChange={e => setEditing({ ...editing, productId: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md bg-white text-sm"
                >
                  <option value="">— Sélectionner un produit —</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.title}{p.price ? ` (${p.price})` : ''} — {p.dataSourceName}
                    </option>
                  ))}
                </select>
              )}
              {editing.productId && (
                <p className="text-xs text-green-600 mt-1">✓ Produit sélectionné</p>
              )}
            </div>

            {/* Type selector */}
            <div>
              <Label>Type d'importation</Label>
              <Tabs value={editing.type} onValueChange={v => setEditing({ ...editing, type: v as 'IMAGE_CANVA' | 'CODE_IA' })}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="IMAGE_CANVA">🖼️ Image (Canva)</TabsTrigger>
                  <TabsTrigger value="CODE_IA">🤖 Code IA</TabsTrigger>
                </TabsList>

                {/* ── MODE IMAGE CANVA ── */}
                <TabsContent value="IMAGE_CANVA" className="space-y-4 mt-4">
                  <PromptCopyBlock title="Directives Visuelles & Charte" content={DIRECTIVES_CANVA} variant="guide" />
                  <PromptCopyBlock title="Guide Administrateur" content={GUIDE_ADMIN_CANVA} variant="guide" />

                  {/* VG39: Image picker buttons replacing ImageUploader */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Visuel Desktop (horizontal)</Label>
                      <div className="space-y-2">
                        {editing.desktopImageUrl && (
                          <img src={editing.desktopImageUrl} alt="Desktop" className="w-full h-32 object-cover rounded-lg border" />
                        )}
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={() => { setImagePickerTarget('desktop'); setImagePickerOpen(true); }}
                        >
                          <ImageIcon className="w-4 h-4 mr-2" />
                          {editing.desktopImageUrl ? 'Changer l\'image' : 'Choisir depuis la Médiathèque'}
                        </Button>
                      </div>
                    </div>
                    <div>
                      <Label>Visuel Mobile (vertical 1080x1920)</Label>
                      <div className="space-y-2">
                        {editing.mobileImageUrl && (
                          <img src={editing.mobileImageUrl} alt="Mobile" className="w-full h-32 object-cover rounded-lg border" />
                        )}
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={() => { setImagePickerTarget('mobile'); setImagePickerOpen(true); }}
                        >
                          <ImageIcon className="w-4 h-4 mr-2" />
                          {editing.mobileImageUrl ? 'Changer l\'image' : 'Choisir depuis la Médiathèque'}
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* CTA toggles */}
                  <div className="space-y-3 p-3 border rounded-lg">
                    <h4 className="text-sm font-semibold">Boutons CTA (Extincteurs)</h4>
                    {([
                      { key: 'Top', label: 'Haut de page' },
                      { key: 'Middle', label: 'Milieu de page' },
                      { key: 'Bottom', label: 'Bas de page' },
                    ] as const).map(({ key, label }) => (
                      <div key={key} className="flex items-center gap-3">
                        <Switch
                          checked={editing[`showCta${key}` as keyof LandingPageData] as boolean}
                          onCheckedChange={v => setEditing({ ...editing, [`showCta${key}`]: v })}
                        />
                        <span className="text-sm flex-1">{label}</span>
                        <Input
                          value={(editing[`cta${key}Text` as keyof LandingPageData] as string) || ''}
                          onChange={e => setEditing({ ...editing, [`cta${key}Text`]: e.target.value })}
                          className="w-48"
                          placeholder="Texte du bouton"
                        />
                      </div>
                    ))}
                  </div>
                </TabsContent>

                {/* ── MODE CODE IA ── */}
                <TabsContent value="CODE_IA" className="space-y-4 mt-4">
                  <PromptCopyBlock title="Prompt IA — Copiez ce prompt pour générer votre Landing Page" content={PROMPT_IA_CODE} variant="prompt" />
                  <PromptCopyBlock title="Guide Administrateur" content={GUIDE_ADMIN_CODE_IA} variant="guide" />

                  <div>
                    <Label>Code HTML / Tailwind</Label>
                    <Textarea
                      value={editing.htmlContent || ''}
                      onChange={e => setEditing({ ...editing, htmlContent: e.target.value })}
                      placeholder="Collez ici le code HTML généré par l'IA..."
                      rows={12}
                      className="font-mono text-xs"
                    />
                  </div>

                  {/* VG39: Asset replacement via ImagePickerModal */}
                  {detectedImages.length > 0 && (
                    <div className="space-y-2 p-3 border rounded-lg">
                      <h4 className="text-sm font-semibold">Images détectées ({detectedImages.length})</h4>
                      {detectedImages.map((img, idx) => (
                        <div key={idx} className="flex items-center gap-3 p-2 border rounded">
                          <img src={img.src} alt="" className="w-12 h-12 object-cover rounded" onError={e => (e.target as HTMLImageElement).style.display = 'none'} />
                          <span className="text-xs text-muted-foreground flex-1 truncate">{img.src}</span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => { setImagePickerTarget('asset'); setAssetReplacementIndex(idx); setImagePickerOpen(true); }}
                          >
                            <ImageIcon className="w-3 h-3 mr-1" />
                            Remplacer
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>

            {/* Active toggle */}
            <div className="flex items-center gap-3">
              <Switch checked={editing.active} onCheckedChange={v => setEditing({ ...editing, active: v })} />
              <Label>Page active (publiée)</Label>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {editing.id ? 'Mettre à jour' : 'Créer'}
              </Button>
              <Button variant="outline" onClick={() => setEditing(null)}>Annuler</Button>
            </div>
          </CardContent>
        </Card>

        {/* VG39: Image Picker Modal */}
        <ImagePickerModal
          open={imagePickerOpen}
          onClose={() => { setImagePickerOpen(false); setImagePickerTarget(null); }}
          onSelect={handleImageSelect}
        />
      </>
    );
  }

  // ── List view ──
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Landing Pages
          </CardTitle>
          <Button size="sm" onClick={() => setEditing({ ...EMPTY_PAGE })}>
            <Plus className="w-4 h-4 mr-1" /> Nouvelle
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : pages.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Aucune landing page. Cliquez sur "Nouvelle" pour en créer une.</p>
        ) : (
          <div className="space-y-2">
            {pages.map(page => (
              <div key={page.id} className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/30">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{page.title}</span>
                    <span className={cn('text-xs px-2 py-0.5 rounded-full', page.type === 'IMAGE_CANVA' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700')}>
                      {page.type === 'IMAGE_CANVA' ? '🖼️ Canva' : '🤖 Code IA'}
                    </span>
                  </div>
                  <a href={`/lp/${page.slug}`} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-1">
                    /lp/{page.slug} <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <Switch checked={page.active} onCheckedChange={() => handleToggleActive(page)} />
                <Button size="icon" variant="ghost" onClick={() => setEditing(page)}>
                  <Edit3 className="w-4 h-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => handleDelete(page.id!)}>
                  <Trash2 className="w-4 h-4 text-red-500" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
