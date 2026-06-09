'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '@/lib/store';
import type { CatalogSettings, SettingsTab } from '@/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { AdminUserManager } from '@/components/settings/AdminUserManager';
import { ColorMapManager } from '@/components/settings/ColorMapManager';
import {
  Globe, Palette, Share2, Monitor, Shield, Save, Loader2,
  MessageCircle, ExternalLink, Mail, Instagram, Copy, Check, Key,
  BookOpen, Trash2, Plus, RotateCcw
} from 'lucide-react';
import { toast } from 'sonner';
import {
  THEME_DEFAULTS,
  PIVOT_LABELS,
  EXCEPTION_LABELS,
  PIVOT_DESCRIPTIONS,
  EXCEPTION_DESCRIPTIONS,
} from '@/lib/theme.config';
import type { ThemePivots, ThemeExceptions } from '@/lib/theme.config';

// ─── Catalogue types ─────────────────────────────────────────────────────
interface CatItem {
  id: string;
  slug: string;
  label: string;
  visible: boolean;
  ordre: number;
  subCategories: SubCatItem[];
}

interface SubCatItem {
  id: string;
  slug: string;
  label: string;
  visible: boolean;
  ordre: number;
  categoryId: string;
  category?: { id: string; slug: string; label: string };
}

function generateSlug(label: string): string {
  return label
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function SettingsPillar() {
  const { settings, setSettings, adminUser, settingsTab, setSettingsTab } = useAppStore();
  const [local, setLocal] = useState<CatalogSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [googleClientId, setGoogleClientId] = useState('');
  const [googleClientSecret, setGoogleClientSecret] = useState('');
  const [googleCredsLoaded, setGoogleCredsLoaded] = useState(false);
  const [googleCredsSaving, setGoogleCredsSaving] = useState(false);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);

  // ─── Catalogue tab state ──────────────────────────────────────────────
  const [categories, setCategories] = useState<CatItem[]>([]);
  const [subCategories, setSubCategories] = useState<SubCatItem[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [catLoading, setCatLoading] = useState(false);
  const [subLoading, setSubLoading] = useState(false);
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editingCatLabel, setEditingCatLabel] = useState('');
  const [editingSubId, setEditingSubId] = useState<string | null>(null);
  const [editingSubLabel, setEditingSubLabel] = useState('');
  const [newCatLabel, setNewCatLabel] = useState('');
  const [newSubLabel, setNewSubLabel] = useState('');
  const [showNewCat, setShowNewCat] = useState(false);
  const [showNewSub, setShowNewSub] = useState(false);
  const [productCounts, setProductCounts] = useState<Record<string, number>>({});
  const [productCountsLoaded, setProductCountsLoaded] = useState(false);

  useEffect(() => {
    if (settings) setLocal(settings);
  }, [settings]);

  // Load Google credentials
  useEffect(() => {
    if (!googleCredsLoaded) {
      fetch('/api/google/credentials')
        .then(res => res.ok ? res.json() : null)
        .then(json => {
          if (json?.data) {
            setGoogleClientId(json.data.clientId || '');
            setGoogleClientSecret(json.data.clientSecret ? '••••••••' : '');
          }
          setGoogleCredsLoaded(true);
        })
        .catch(() => setGoogleCredsLoaded(true));
    }
  }, [googleCredsLoaded]);

  const loadSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/catalog/settings');
      if (res.ok) {
        const json = await res.json();
        if (json.data) setSettings(json.data);
      }
    } catch {}
  }, [setSettings]);

  useEffect(() => {
    if (!settings) loadSettings();
  }, [settings, loadSettings]);

  // ─── Catalogue: Load categories ─────────────────────────────────────
  const loadCategories = useCallback(async () => {
    setCatLoading(true);
    try {
      const res = await fetch('/api/categories');
      if (res.ok) {
        const json = await res.json();
        setCategories(json.data || []);
      }
    } catch {
      toast.error('Erreur lors du chargement des catégories');
    } finally {
      setCatLoading(false);
    }
  }, []);

  // ─── Catalogue: Load subcategories for selected parent ──────────────
  const loadSubCategories = useCallback(async (categoryId: string) => {
    setSubLoading(true);
    try {
      const res = await fetch(`/api/subcategories?categoryId=${categoryId}`);
      if (res.ok) {
        const json = await res.json();
        setSubCategories(json.data || []);
      }
    } catch {
      toast.error('Erreur lors du chargement des sous-catégories');
    } finally {
      setSubLoading(false);
    }
  }, []);

  // ─── Catalogue: Load product counts ─────────────────────────────────
  const loadProductCounts = useCallback(async () => {
    try {
      const dsRes = await fetch('/api/datasources');
      if (!dsRes.ok) return;
      const dsJson = await dsRes.json();
      const dsList: { id: string }[] = dsJson.data || [];

      const counts: Record<string, number> = {};

      for (const ds of dsList) {
        const rowsRes = await fetch(`/api/datasources/${ds.id}/rows?limit=1000`);
        if (!rowsRes.ok) continue;
        const rowsJson = await rowsRes.json();
        const rows: { data: unknown }[] = rowsJson.data || [];

        for (const row of rows) {
          const data = row.data as Record<string, unknown> | null;
          if (data) {
            if (data.__category__ && typeof data.__category__ === 'string') {
              counts[data.__category__] = (counts[data.__category__] || 0) + 1;
            }
            if (data.__sub_category__ && typeof data.__sub_category__ === 'string') {
              counts[data.__sub_category__] = (counts[data.__sub_category__] || 0) + 1;
            }
          }
        }
      }

      setProductCounts(counts);
      setProductCountsLoaded(true);
    } catch {
      // Silent fail for product counts
    }
  }, []);

  // Load categories & product counts on mount
  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    if (!productCountsLoaded) {
      loadProductCounts();
    }
  }, [productCountsLoaded, loadProductCounts]);

  // Load subcategories when parent is selected
  useEffect(() => {
    if (selectedCategoryId) {
      loadSubCategories(selectedCategoryId);
    } else {
      setSubCategories([]);
    }
  }, [selectedCategoryId, loadSubCategories]);

  // Auto-select first category
  useEffect(() => {
    if (categories.length > 0 && !selectedCategoryId) {
      setSelectedCategoryId(categories[0].id);
    }
  }, [categories, selectedCategoryId]);

  // ─── Catalogue: Add category ────────────────────────────────────────
  const addCategory = async () => {
    if (!newCatLabel.trim()) {
      toast.error('Le nom est requis');
      return;
    }
    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: newCatLabel.trim(),
          slug: generateSlug(newCatLabel.trim()),
          ordre: categories.length + 1,
        }),
      });
      if (res.ok) {
        const json = await res.json();
        setCategories(prev => [...prev, json.data]);
        setNewCatLabel('');
        setShowNewCat(false);
        toast.success('Catégorie ajoutée');
      } else {
        const json = await res.json();
        toast.error(json.error || 'Erreur');
      }
    } catch {
      toast.error('Erreur de connexion');
    }
  };

  // ─── Catalogue: Add subcategory ─────────────────────────────────────
  const addSubCategory = async () => {
    if (!newSubLabel.trim()) {
      toast.error('Le nom est requis');
      return;
    }
    if (!selectedCategoryId) return;
    try {
      const parentCat = categories.find(c => c.id === selectedCategoryId);
      const prefix = parentCat ? parentCat.slug + '-' : '';
      const res = await fetch('/api/subcategories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: newSubLabel.trim(),
          slug: prefix + generateSlug(newSubLabel.trim()),
          categoryId: selectedCategoryId,
          ordre: subCategories.length + 1,
        }),
      });
      if (res.ok) {
        const json = await res.json();
        setSubCategories(prev => [...prev, json.data]);
        // Also update nested subCategories in categories state
        setCategories(prev =>
          prev.map(c =>
            c.id === selectedCategoryId
              ? { ...c, subCategories: [...(c.subCategories || []), json.data] }
              : c
          )
        );
        setNewSubLabel('');
        setShowNewSub(false);
        toast.success('Sous-catégorie ajoutée');
      } else {
        const json = await res.json();
        toast.error(json.error || 'Erreur');
      }
    } catch {
      toast.error('Erreur de connexion');
    }
  };

  // ─── Catalogue: Save category label (inline edit) ───────────────────
  const saveCatLabel = async (id: string) => {
    const trimmed = editingCatLabel.trim();
    if (!trimmed) {
      setEditingCatId(null);
      return;
    }
    // Optimistic update
    setCategories(prev => prev.map(c => (c.id === id ? { ...c, label: trimmed } : c)));
    setEditingCatId(null);
    try {
      const res = await fetch('/api/categories', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, label: trimmed }),
      });
      if (res.ok) {
        toast.success('Catégorie renommée');
      } else {
        const json = await res.json();
        toast.error(json.error || 'Erreur');
        loadCategories();
      }
    } catch {
      toast.error('Erreur de connexion');
      loadCategories();
    }
  };

  // ─── Catalogue: Save subcategory label (inline edit) ────────────────
  const saveSubLabel = async (id: string) => {
    const trimmed = editingSubLabel.trim();
    if (!trimmed) {
      setEditingSubId(null);
      return;
    }
    // Optimistic update
    setSubCategories(prev => prev.map(s => (s.id === id ? { ...s, label: trimmed } : s)));
    setEditingSubId(null);
    try {
      const res = await fetch('/api/subcategories', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, label: trimmed }),
      });
      if (res.ok) {
        toast.success('Sous-catégorie renommée');
      } else {
        const json = await res.json();
        toast.error(json.error || 'Erreur');
        if (selectedCategoryId) loadSubCategories(selectedCategoryId);
      }
    } catch {
      toast.error('Erreur de connexion');
      if (selectedCategoryId) loadSubCategories(selectedCategoryId);
    }
  };

  // ─── Catalogue: Toggle category visibility ──────────────────────────
  const toggleCatVisible = async (id: string, visible: boolean) => {
    setCategories(prev => prev.map(c => (c.id === id ? { ...c, visible } : c)));
    try {
      const res = await fetch('/api/categories', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, visible }),
      });
      if (res.ok) {
        toast.success(visible ? 'Catégorie visible' : 'Catégorie masquée');
      } else {
        const json = await res.json();
        toast.error(json.error || 'Erreur');
        loadCategories();
      }
    } catch {
      toast.error('Erreur de connexion');
      loadCategories();
    }
  };

  // ─── Catalogue: Toggle subcategory visibility ───────────────────────
  const toggleSubVisible = async (id: string, visible: boolean) => {
    setSubCategories(prev => prev.map(s => (s.id === id ? { ...s, visible } : s)));
    try {
      const res = await fetch('/api/subcategories', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, visible }),
      });
      if (res.ok) {
        toast.success(visible ? 'Sous-catégorie visible' : 'Sous-catégorie masquée');
      } else {
        const json = await res.json();
        toast.error(json.error || 'Erreur');
        if (selectedCategoryId) loadSubCategories(selectedCategoryId);
      }
    } catch {
      toast.error('Erreur de connexion');
      if (selectedCategoryId) loadSubCategories(selectedCategoryId);
    }
  };

  // ─── Catalogue: Delete category ─────────────────────────────────────
  const deleteCategory = async (id: string) => {
    try {
      const res = await fetch(`/api/categories?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setCategories(prev => prev.filter(c => c.id !== id));
        if (selectedCategoryId === id) {
          setSelectedCategoryId('');
        }
        toast.success('Catégorie supprimée');
        loadProductCounts();
      } else {
        const json = await res.json();
        if (res.status === 403) {
          toast.error(json.error || 'Impossible de supprimer : des produits sont associés');
          loadProductCounts();
        } else {
          toast.error(json.error || 'Erreur');
        }
      }
    } catch {
      toast.error('Erreur de connexion');
    }
  };

  // ─── Catalogue: Delete subcategory ──────────────────────────────────
  const deleteSubCategory = async (id: string) => {
    try {
      const res = await fetch(`/api/subcategories?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setSubCategories(prev => prev.filter(s => s.id !== id));
        setCategories(prev =>
          prev.map(c => ({
            ...c,
            subCategories: (c.subCategories || []).filter(s => s.id !== id),
          }))
        );
        toast.success('Sous-catégorie supprimée');
        loadProductCounts();
      } else {
        const json = await res.json();
        if (res.status === 403) {
          toast.error(json.error || 'Impossible de supprimer : des produits sont associés');
          loadProductCounts();
        } else {
          toast.error(json.error || 'Erreur');
        }
      }
    } catch {
      toast.error('Erreur de connexion');
    }
  };

  const handleSave = async (updates?: Partial<CatalogSettings>) => {
    const data = updates || local;
    if (!data) return;
    setSaving(true);
    try {
      const res = await fetch('/api/catalog/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          setSettings(json.data);
          setLocal(json.data);
        }
        toast.success('Paramètres sauvegardés');
        // Trigger ThemeInjector to refresh CSS variables instantly
        window.dispatchEvent(new CustomEvent('theme-updated'));
      }
    } catch {
      toast.error('Erreur de sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const updateField = (key: string, value: unknown) => {
    if (!local) return;
    const updated = { ...local, [key]: value };
    setLocal(updated);
  };

  const copyShareLink = () => {
    navigator.clipboard.writeText(window.location.origin);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Lien copié !');
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('Veuillez remplir tous les champs');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('Le nouveau mot de passe doit contenir au moins 8 caractères');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Les mots de passe ne correspondent pas');
      return;
    }
    setPasswordSaving(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (res.ok) {
        toast.success('Mot de passe modifié avec succès');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        const json = await res.json();
        toast.error(json.error || 'Erreur lors du changement de mot de passe');
      }
    } catch {
      toast.error('Erreur de connexion');
    } finally {
      setPasswordSaving(false);
    }
  };

  if (!local) {
    return <div className="flex items-center justify-center h-full text-muted-foreground">Chargement...</div>;
  }

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Paramètres</h2>
          <Button size="sm" className="gap-1.5" onClick={() => handleSave()} disabled={saving}>
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Sauvegarder
          </Button>
        </div>

        <Tabs value={settingsTab} onValueChange={(v) => setSettingsTab(v as SettingsTab)} className="space-y-4">
          <TabsList className="grid w-full grid-cols-7">
            <TabsTrigger value="general" className="text-xs gap-1"><Globe className="w-3 h-3" /> Général</TabsTrigger>
            <TabsTrigger value="appearance" className="text-xs gap-1"><Palette className="w-3 h-3" /> Style</TabsTrigger>
            <TabsTrigger value="conversion" className="text-xs gap-1"><Share2 className="w-3 h-3" /> Partage</TabsTrigger>
            <TabsTrigger value="display" className="text-xs gap-1"><Monitor className="w-3 h-3" /> Affichage</TabsTrigger>
            <TabsTrigger value="admin" className="text-xs gap-1"><Shield className="w-3 h-3" /> Admin</TabsTrigger>
            <TabsTrigger value="catalogue" className="text-xs gap-1"><BookOpen className="w-3 h-3" /> Catalogue</TabsTrigger>
            <TabsTrigger value="couleurs" className="text-xs gap-1"><Palette className="w-3 h-3" /> Couleurs</TabsTrigger>
          </TabsList>

          {/* Général */}
          <TabsContent value="general">
            <Card>
              <CardHeader><CardTitle className="text-sm">Général</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-xs">Langue</Label>
                  <Select value={local.language} onValueChange={v => updateField('language', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fr">Français</SelectItem>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="ar">العربية</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Devise</Label>
                  <Select value={local.currency} onValueChange={v => updateField('currency', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MAD">MAD (درهم)</SelectItem>
                      <SelectItem value="EUR">EUR (€)</SelectItem>
                      <SelectItem value="USD">USD ($)</SelectItem>
                      <SelectItem value="GBP">GBP (£)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Apparence — Active Theme Engine Dashboard */}
          <TabsContent value="appearance">
            <div className="space-y-4">

              {/* ═══ Palette Principale (4 Pivots) ═══ */}
              <Card>
                <CardHeader>
                  <div>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Palette className="w-4 h-4" style={{ color: 'var(--gold)' }} />
                      Palette Principale
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      4 couleurs pivots — pilotent 80% du design par dérivation automatique
                    </p>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {([
                    'primaryColor',
                    'secondaryColor',
                    'accentColor',
                    'backgroundColor',
                  ] as const).map((field) => {
                    const defaultVal = THEME_DEFAULTS[field];
                    const label = PIVOT_LABELS[field];
                    const desc = PIVOT_DESCRIPTIONS[field];
                    const currentVal = (local as Record<string, string>)[field] || defaultVal;
                    const isModified = currentVal !== defaultVal;

                    return (
                      <div key={field} className="space-y-1">
                        <Label className="text-xs font-medium">{label}</Label>
                        <p className="text-[10px] text-muted-foreground leading-tight">{desc}</p>
                        <div className="flex items-center gap-2">
                          {/* Reference circle — shows the original default color */}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div
                                className="w-6 h-6 rounded-full border-2 shrink-0 cursor-default"
                                style={{
                                  backgroundColor: defaultVal,
                                  borderColor: isModified ? 'var(--border)' : 'var(--gold)',
                                  boxShadow: isModified ? 'none' : '0 0 0 2px var(--gold)',
                                }}
                              />
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs">
                              Référence : {defaultVal}
                            </TooltipContent>
                          </Tooltip>

                          {/* Current color preview */}
                          <div
                            className="w-6 h-6 rounded-full border shrink-0"
                            style={{
                              backgroundColor: currentVal,
                              borderColor: 'var(--border)',
                            }}
                          />

                          {/* Hex input with validation */}
                          <Input
                            value={currentVal}
                            onChange={(e) => {
                              const val = e.target.value;
                              updateField(field, val);
                            }}
                            onBlur={(e) => {
                              // Auto-prepend # if missing
                              let val = e.target.value.trim();
                              if (val && !val.startsWith('#')) val = '#' + val;
                              // Validate hex format
                              if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
                                updateField(field, val);
                              } else if (val && !/^#[0-9A-Fa-f]{0,6}$/.test(val)) {
                                toast.error('Format hex invalide — utilisez #RRGGBB');
                              }
                            }}
                            className="w-24 h-8 text-xs font-mono"
                            placeholder="#RRGGBB"
                            maxLength={7}
                          />

                          {/* Reset button */}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 shrink-0"
                                disabled={!isModified}
                                onClick={() => updateField(field, defaultVal)}
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs">
                              Restaurer {defaultVal}
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              {/* ═══ Couleurs Avancées (3 Exceptions) ═══ */}
              <Card>
                <CardHeader>
                  <div>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Palette className="w-4 h-4" style={{ color: 'var(--primary)' }} />
                      Couleurs Avancées
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      3 exceptions non-dérivables — couleurs fonctionnelles spécifiques
                    </p>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {([
                    'brandGreenColor',
                    'destructiveColor',
                    'borderColor',
                  ] as const).map((field) => {
                    const defaultVal = THEME_DEFAULTS[field];
                    const label = EXCEPTION_LABELS[field];
                    const desc = EXCEPTION_DESCRIPTIONS[field];
                    const currentVal = (local as Record<string, string>)[field] || defaultVal;
                    const isModified = currentVal !== defaultVal;

                    return (
                      <div key={field} className="space-y-1">
                        <Label className="text-xs font-medium">{label}</Label>
                        <p className="text-[10px] text-muted-foreground leading-tight">{desc}</p>
                        <div className="flex items-center gap-2">
                          {/* Reference circle */}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div
                                className="w-6 h-6 rounded-full border-2 shrink-0 cursor-default"
                                style={{
                                  backgroundColor: defaultVal,
                                  borderColor: isModified ? 'var(--border)' : 'var(--gold)',
                                  boxShadow: isModified ? 'none' : '0 0 0 2px var(--gold)',
                                }}
                              />
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs">
                              Référence : {defaultVal}
                            </TooltipContent>
                          </Tooltip>

                          {/* Current color preview */}
                          <div
                            className="w-6 h-6 rounded-full border shrink-0"
                            style={{
                              backgroundColor: currentVal,
                              borderColor: 'var(--border)',
                            }}
                          />

                          {/* Hex input */}
                          <Input
                            value={currentVal}
                            onChange={(e) => updateField(field, e.target.value)}
                            onBlur={(e) => {
                              let val = e.target.value.trim();
                              if (val && !val.startsWith('#')) val = '#' + val;
                              if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
                                updateField(field, val);
                              } else if (val && !/^#[0-9A-Fa-f]{0,6}$/.test(val)) {
                                toast.error('Format hex invalide — utilisez #RRGGBB');
                              }
                            }}
                            className="w-24 h-8 text-xs font-mono"
                            placeholder="#RRGGBB"
                            maxLength={7}
                          />

                          {/* Reset button */}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 shrink-0"
                                disabled={!isModified}
                                onClick={() => updateField(field, defaultVal)}
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs">
                              Restaurer {defaultVal}
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              {/* ═══ Police & CSS ═══ */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Police & CSS</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-xs">Police</Label>
                    <Select value={local.fontFamily} onValueChange={v => updateField('fontFamily', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="inter">Inter</SelectItem>
                        <SelectItem value="playfair">Playfair Display</SelectItem>
                        <SelectItem value="roboto">Roboto</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">CSS personnalisé</Label>
                    <Textarea
                      value={local.customCSS}
                      onChange={e => updateField('customCSS', e.target.value)}
                      className="h-24 font-mono text-xs"
                      placeholder="/* Votre CSS personnalisé */"
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Conversion & Partage */}
          <TabsContent value="conversion">
            <Card>
              <CardHeader><CardTitle className="text-sm">Conversion & Partage</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-xs">Canal de conversion</Label>
                  <Select value={local.conversionChannel} onValueChange={v => updateField('conversionChannel', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="whatsapp"><div className="flex items-center gap-2"><MessageCircle className="w-3 h-3 text-green-600" /> WhatsApp</div></SelectItem>
                      <SelectItem value="messenger"><div className="flex items-center gap-2"><MessageCircle className="w-3 h-3 text-blue-600" /> Messenger</div></SelectItem>
                      <SelectItem value="landing"><div className="flex items-center gap-2"><ExternalLink className="w-3 h-3" /> Landing Page</div></SelectItem>
                      <SelectItem value="email"><div className="flex items-center gap-2"><Mail className="w-3 h-3" /> Email</div></SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Numéro WhatsApp</Label>
                  <Input value={local.whatsappNumber} onChange={e => updateField('whatsappNumber', e.target.value)} placeholder="212600000000" />
                </div>
                <div>
                  <Label className="text-xs">Lien Messenger</Label>
                  <Input value={local.messengerLink} onChange={e => updateField('messengerLink', e.target.value)} placeholder="https://m.me/..." />
                </div>
                <div>
                  <Label className="text-xs">Email de contact</Label>
                  <Input value={local.emailContact} onChange={e => updateField('emailContact', e.target.value)} placeholder="contact@example.com" />
                </div>
                <div>
                  <Label className="text-xs">Instagram</Label>
                  <Input value={local.instagramHandle} onChange={e => updateField('instagramHandle', e.target.value)} placeholder="@votre_compte" />
                </div>
                <div>
                  <Label className="text-xs">Message de conversion</Label>
                  <Textarea
                    value={local.conversionMessage}
                    onChange={e => updateField('conversionMessage', e.target.value)}
                    className="h-20 text-xs"
                    placeholder="Bonjour, je souhaite commander : {product}"
                  />
                </div>
                <div>
                  <Label className="text-xs">Lien de partage</Label>
                  <div className="flex items-center gap-2">
                    <Input value={typeof window !== 'undefined' ? window.location.origin : ''} readOnly className="h-9 text-xs" />
                    <Button size="sm" variant="outline" onClick={copyShareLink} className="gap-1.5">
                      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      {copied ? 'Copié' : 'Copier'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Affichage */}
          <TabsContent value="display">
            <Card>
              <CardHeader><CardTitle className="text-sm">Affichage</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <label className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Zoom sur images</p>
                    <p className="text-xs text-muted-foreground">Permettre le zoom en cliquant sur les images</p>
                  </div>
                  <Switch checked={local.enableZoom} onCheckedChange={v => updateField('enableZoom', v)} />
                </label>
                <label className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Recherche</p>
                    <p className="text-xs text-muted-foreground">Activer la barre de recherche</p>
                  </div>
                  <Switch checked={local.enableSearch} onCheckedChange={v => updateField('enableSearch', v)} />
                </label>
                <label className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Partage</p>
                    <p className="text-xs text-muted-foreground">Boutons de partage sur les produits</p>
                  </div>
                  <Switch checked={local.enableSharing} onCheckedChange={v => updateField('enableSharing', v)} />
                </label>
                <div className="pt-4 border-t">
                  <label className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Publier le catalogue</p>
                      <p className="text-xs text-muted-foreground">Rendre le catalogue visible publiquement</p>
                    </div>
                    <Switch checked={false} onCheckedChange={v => toast.info(v ? 'Catalogue publié !' : 'Catalogue dépublié')} />
                  </label>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Admin */}
          <TabsContent value="admin">
            <div className="space-y-4">

              {/* User Management Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    Gestion des accès
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <AdminUserManager />
                </CardContent>
              </Card>

              {/* Google OAuth Card */}
              <Card>
                <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Key className="w-4 h-4" /> Google OAuth</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-xs text-muted-foreground">
                    Pour connecter Google Sheets et Google Drive, vous devez configurer un projet Google Cloud
                    et obtenir des identifiants OAuth. <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="text-gold underline">Créer des identifiants</a>
                  </p>
                  <div>
                    <Label className="text-xs">Client ID</Label>
                    <Input
                      value={googleClientId}
                      onChange={e => setGoogleClientId(e.target.value)}
                      placeholder="xxxxxxxxxxxx.apps.googleusercontent.com"
                      className="h-9 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Client Secret</Label>
                    <Input
                      type="password"
                      value={googleClientSecret}
                      onChange={e => setGoogleClientSecret(e.target.value)}
                      placeholder="GOCSPX-xxxxxxxxxxxxxxxx"
                      className="h-9 text-xs"
                    />
                  </div>
                  <Button
                    size="sm"
                    className="gap-1.5"
                    disabled={googleCredsSaving}
                    onClick={async () => {
                      setGoogleCredsSaving(true);
                      try {
                        const res = await fetch('/api/google/credentials', {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            clientId: googleClientId,
                            clientSecret: googleClientSecret === '••••••••' ? undefined : googleClientSecret,
                          }),
                        });
                        if (res.ok) {
                          toast.success('Identifiants Google sauvegardés');
                        } else {
                          toast.error('Erreur lors de la sauvegarde');
                        }
                      } catch {
                        toast.error('Erreur de connexion');
                      } finally {
                        setGoogleCredsSaving(false);
                      }
                    }}
                  >
                    {googleCredsSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    Sauvegarder les identifiants
                  </Button>
                </CardContent>
              </Card>

              {/* Password Change Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Key className="w-4 h-4" />
                    Mon mot de passe
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-xs text-muted-foreground">
                    Modifiez votre mot de passe personnel. Si vous vous connectez uniquement via Google, cette section ne s&apos;applique pas.
                  </p>
                  <div>
                    <Label className="text-xs">Mot de passe actuel</Label>
                    <Input
                      type="password"
                      value={currentPassword}
                      onChange={e => setCurrentPassword(e.target.value)}
                      className="h-9 text-xs"
                      placeholder="••••••••"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Nouveau mot de passe</Label>
                    <Input
                      type="password"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      className="h-9 text-xs"
                      placeholder="Min. 8 caractères"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Confirmer le mot de passe</Label>
                    <Input
                      type="password"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      className="h-9 text-xs"
                      placeholder="Retapez le nouveau mot de passe"
                      onKeyDown={e => { if (e.key === 'Enter') handleChangePassword(); }}
                    />
                  </div>
                  <Button
                    size="sm"
                    className="gap-1.5"
                    onClick={handleChangePassword}
                    disabled={passwordSaving || !currentPassword || !newPassword || !confirmPassword}
                  >
                    {passwordSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Key className="w-3.5 h-3.5" />}
                    Changer le mot de passe
                  </Button>
                </CardContent>
              </Card>

              {/* Current session info */}
              {adminUser && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Session actuelle</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gold/10 flex items-center justify-center text-gold text-xs font-medium">
                        {(adminUser.name || adminUser.email)[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{adminUser.name || adminUser.email.split('@')[0]}</p>
                        <p className="text-xs text-muted-foreground">{adminUser.email}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* Catalogue */}
          <TabsContent value="catalogue">
            <div className="space-y-4">

              {/* Slot 1 — Grandes Catégories (Niveau 1) */}
              <Card>
                <CardHeader>
                  <div>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <BookOpen className="w-4 h-4" style={{ color: '#C9A84C' }} />
                      Grandes Catégories
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">Niveau 1 — Navigation principale</p>
                  </div>
                </CardHeader>
                <CardContent className="space-y-1">
                  {catLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    </div>
                  ) : categories.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-8">Aucune catégorie</p>
                  ) : (
                    categories.map((cat) => {
                      const count = productCounts[cat.slug] || 0;
                      return (
                        <div
                          key={cat.id}
                          className={`flex items-center gap-2 p-2 rounded-md border transition-all duration-200 ${
                            !cat.visible ? 'opacity-40' : ''
                          }`}
                        >
                          <span className="text-[10px] text-muted-foreground w-5 text-center font-mono">
                            {cat.ordre}
                          </span>
                          {editingCatId === cat.id ? (
                            <Input
                              value={editingCatLabel}
                              onChange={e => setEditingCatLabel(e.target.value)}
                              onBlur={() => saveCatLabel(cat.id)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') saveCatLabel(cat.id);
                                if (e.key === 'Escape') setEditingCatId(null);
                              }}
                              className="h-7 text-xs flex-1"
                              autoFocus
                            />
                          ) : (
                            <span
                              className="text-sm flex-1 cursor-pointer hover:opacity-70 transition-opacity select-none"
                              style={{ color: '#C9A84C' }}
                              onDoubleClick={() => {
                                setEditingCatId(cat.id);
                                setEditingCatLabel(cat.label);
                              }}
                              title="Double-cliquer pour renommer"
                            >
                              {cat.label}
                            </span>
                          )}
                          <Badge variant="secondary" className="text-[10px] h-5 px-1.5 shrink-0">
                            {count}
                          </Badge>
                          <Switch
                            checked={cat.visible}
                            onCheckedChange={v => toggleCatVisible(cat.id, v)}
                            className="scale-75 origin-center"
                          />
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-red-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed"
                                  disabled={count > 0}
                                  onClick={() => deleteCategory(cat.id)}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </span>
                            </TooltipTrigger>
                            {count > 0 && (
                              <TooltipContent side="left">
                                Impossible : {count} produit{count !== 1 ? 's' : ''} associé{count !== 1 ? 's' : ''}
                              </TooltipContent>
                            )}
                          </Tooltip>
                        </div>
                      );
                    })
                  )}

                  {showNewCat ? (
                    <div className="flex items-center gap-2 p-2 border border-dashed rounded-md mt-2" style={{ borderColor: '#C9A84C' }}>
                      <Input
                        value={newCatLabel}
                        onChange={e => setNewCatLabel(e.target.value)}
                        placeholder="Nom de la catégorie"
                        className="h-7 text-xs flex-1"
                        autoFocus
                        onKeyDown={e => {
                          if (e.key === 'Enter') addCategory();
                          if (e.key === 'Escape') { setShowNewCat(false); setNewCatLabel(''); }
                        }}
                      />
                      <Button
                        size="sm"
                        className="h-7 text-xs gap-1 text-white"
                        onClick={addCategory}
                        style={{ backgroundColor: '#C9A84C' }}
                      >
                        <Plus className="w-3 h-3" /> OK
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        onClick={() => { setShowNewCat(false); setNewCatLabel(''); }}
                      >
                        Annuler
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-xs gap-1 border-dashed mt-2"
                      onClick={() => setShowNewCat(true)}
                      style={{ borderColor: '#C9A84C', color: '#C9A84C' }}
                    >
                      <Plus className="w-3 h-3" /> Ajouter
                    </Button>
                  )}
                </CardContent>
              </Card>

              {/* Slot 2 — Sous-catégories (Niveau 2) */}
              <Card>
                <CardHeader>
                  <div>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <BookOpen className="w-4 h-4" style={{ color: '#C9A84C' }} />
                      Sous-catégories
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">Niveau 2 — Filtres contextuels</p>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Sélectionner une catégorie parente" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map(cat => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {!selectedCategoryId ? (
                    <p className="text-xs text-muted-foreground text-center py-8">
                      Sélectionnez une catégorie parente
                    </p>
                  ) : subLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    </div>
                  ) : subCategories.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-8">
                      Aucune sous-catégorie
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {subCategories.map((sub) => {
                        const count = productCounts[sub.slug] || 0;
                        return (
                          <div
                            key={sub.id}
                            className={`flex items-center gap-2 p-2 rounded-md border transition-all duration-200 ${
                              !sub.visible ? 'opacity-40' : ''
                            }`}
                          >
                            <span className="text-[10px] text-muted-foreground w-5 text-center font-mono">
                              {sub.ordre}
                            </span>
                            {editingSubId === sub.id ? (
                              <Input
                                value={editingSubLabel}
                                onChange={e => setEditingSubLabel(e.target.value)}
                                onBlur={() => saveSubLabel(sub.id)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') saveSubLabel(sub.id);
                                  if (e.key === 'Escape') setEditingSubId(null);
                                }}
                                className="h-7 text-xs flex-1"
                                autoFocus
                              />
                            ) : (
                              <span
                                className="text-sm flex-1 cursor-pointer hover:opacity-70 transition-opacity select-none"
                                style={{ color: '#C9A84C' }}
                                onDoubleClick={() => {
                                  setEditingSubId(sub.id);
                                  setEditingSubLabel(sub.label);
                                }}
                                title="Double-cliquer pour renommer"
                              >
                                {sub.label}
                              </span>
                            )}
                            <Badge variant="secondary" className="text-[10px] h-5 px-1.5 shrink-0">
                              {count}
                            </Badge>
                            <Switch
                              checked={sub.visible}
                              onCheckedChange={v => toggleSubVisible(sub.id, v)}
                              className="scale-75 origin-center"
                            />
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-flex">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-red-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed"
                                    disabled={count > 0}
                                    onClick={() => deleteSubCategory(sub.id)}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </span>
                              </TooltipTrigger>
                              {count > 0 && (
                                <TooltipContent side="left">
                                  Impossible : {count} produit{count !== 1 ? 's' : ''} associé{count !== 1 ? 's' : ''}
                                </TooltipContent>
                              )}
                            </Tooltip>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {selectedCategoryId && (
                    showNewSub ? (
                      <div className="flex items-center gap-2 p-2 border border-dashed rounded-md mt-2" style={{ borderColor: '#C9A84C' }}>
                        <Input
                          value={newSubLabel}
                          onChange={e => setNewSubLabel(e.target.value)}
                          placeholder="Nom de la sous-catégorie"
                          className="h-7 text-xs flex-1"
                          autoFocus
                          onKeyDown={e => {
                            if (e.key === 'Enter') addSubCategory();
                            if (e.key === 'Escape') { setShowNewSub(false); setNewSubLabel(''); }
                          }}
                        />
                        <Button
                          size="sm"
                          className="h-7 text-xs gap-1 text-white"
                          onClick={addSubCategory}
                          style={{ backgroundColor: '#C9A84C' }}
                        >
                          <Plus className="w-3 h-3" /> OK
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs"
                          onClick={() => { setShowNewSub(false); setNewSubLabel(''); }}
                        >
                          Annuler
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full text-xs gap-1 border-dashed mt-2"
                        onClick={() => setShowNewSub(true)}
                        style={{ borderColor: '#C9A84C', color: '#C9A84C' }}
                      >
                        <Plus className="w-3 h-3" /> Ajouter
                      </Button>
                    )
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Couleurs */}
          <TabsContent value="couleurs">
            <ColorMapManager />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
