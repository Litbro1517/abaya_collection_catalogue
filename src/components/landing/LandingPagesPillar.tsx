'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Edit3, Eye, EyeOff, ExternalLink, Loader2, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ImageUploader from '@/components/admin/ImageUploader';
import { PromptCopyBlock } from './PromptCopyBlock';
import { useAppStore } from '@/lib/store';
import { useTranslation } from '@/lib/i18n';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  PROMPT_IA_CODE, GUIDE_ADMIN_CODE_IA,
  DIRECTIVES_CANVA, GUIDE_ADMIN_CANVA,
} from './promptConstants';

type Lang = 'fr' | 'en' | 'ar';

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
  const [productSearch, setProductSearch] = useState('');
  const [searchResults, setSearchResults] = useState<{ id: string; title: string; price: string }[]>([]);

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

  useEffect(() => { fetchPages(); }, [fetchPages]);

  // Product search
  useEffect(() => {
    if (!productSearch.trim()) { setSearchResults([]); return; }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/catalog?search=${encodeURIComponent(productSearch)}`);
        const data = await res.json();
        // Flatten sections to get all products
        const products: { id: string; title: string; price: string }[] = [];
        if (data.data?.sections) {
          for (const sec of data.data.sections) {
            if (sec.rows) {
              for (const row of sec.rows) {
                const d = row.data;
                products.push({
                  id: row.id,
                  title: d?.titre || d?.title || 'Sans titre',
                  price: d?.['prix-test'] || d?.prix || '',
                });
              }
            }
          }
        }
        setSearchResults(products.slice(0, 10));
      } catch {
        // Silent fail
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [productSearch]);

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

  // ── Editor view ──
  if (editing) {
    const detectedImages = editing.type === 'CODE_IA' && editing.htmlContent
      ? extractImgTags(editing.htmlContent) : [];

    return (
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

          {/* Product search */}
          <div>
            <Label>Produit associé *</Label>
            <Input
              value={productSearch}
              onChange={e => setProductSearch(e.target.value)}
              placeholder="Rechercher un produit..."
            />
            {searchResults.length > 0 && (
              <div className="mt-2 border rounded-lg max-h-48 overflow-y-auto">
                {searchResults.map(p => (
                  <button
                    key={p.id}
                    onClick={() => { setEditing({ ...editing, productId: p.id }); setProductSearch(`${p.title} (${p.price})`); setSearchResults([]); }}
                    className="w-full text-left px-3 py-2 hover:bg-muted/50 border-b last:border-0 text-sm"
                  >
                    <span className="font-medium">{p.title}</span>
                    {p.price && <span className="text-muted-foreground ml-2">{p.price}</span>}
                  </button>
                ))}
              </div>
            )}
            {editing.productId && (
              <p className="text-xs text-green-600 mt-1">✓ Produit sélectionné: {editing.productId.substring(0, 8)}...</p>
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
                {/* Prompt blocks */}
                <PromptCopyBlock title="Directives Visuelles & Charte" content={DIRECTIVES_CANVA} variant="guide" />
                <PromptCopyBlock title="Guide Administrateur" content={GUIDE_ADMIN_CANVA} variant="guide" />

                {/* Dual image upload */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Visuel Desktop (horizontal)</Label>
                    <ImageUploader
                      value={editing.desktopImageUrl || ''}
                      onChange={url => setEditing({ ...editing, desktopImageUrl: url })}
                    />
                  </div>
                  <div>
                    <Label>Visuel Mobile (vertical 1080x1920)</Label>
                    <ImageUploader
                      value={editing.mobileImageUrl || ''}
                      onChange={url => setEditing({ ...editing, mobileImageUrl: url })}
                    />
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
                {/* Prompt blocks */}
                <PromptCopyBlock title="Prompt IA — Copiez ce prompt pour générer votre Landing Page" content={PROMPT_IA_CODE} variant="prompt" />
                <PromptCopyBlock title="Guide Administrateur" content={GUIDE_ADMIN_CODE_IA} variant="guide" />

                {/* HTML code textarea */}
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

                {/* Asset replacement panel */}
                {detectedImages.length > 0 && (
                  <div className="space-y-2 p-3 border rounded-lg">
                    <h4 className="text-sm font-semibold">Images détectées ({detectedImages.length})</h4>
                    {detectedImages.map((img, idx) => (
                      <div key={idx} className="flex items-center gap-3 p-2 border rounded">
                        <img src={img.src} alt="" className="w-12 h-12 object-cover rounded" onError={e => (e.target as HTMLImageElement).style.display = 'none'} />
                        <span className="text-xs text-muted-foreground flex-1 truncate">{img.src}</span>
                        <ImageUploader
                          value=""
                          onChange={newUrl => {
                            const escaped = img.src.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                            const updated = editing.htmlContent?.replace(
                              new RegExp(`src=["']${escaped}["']`, 'gi'),
                              `src="${newUrl}"`
                            );
                            setEditing({ ...editing, htmlContent: updated || null });
                          }}
                        />
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
                <Button size="icon" variant="ghost" onClick={() => { setEditing(page); setProductSearch(''); }}>
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
