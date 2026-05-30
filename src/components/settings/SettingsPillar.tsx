'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '@/lib/store';
import type { CatalogSettings } from '@/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Globe, Palette, Share2, Monitor, Shield, Save, Loader2,
  MessageCircle, ExternalLink, Mail, Instagram, Copy, Check, Sheet, Key
} from 'lucide-react';
import { toast } from 'sonner';

export function SettingsPillar() {
  const { settings, setSettings } = useAppStore();
  const [local, setLocal] = useState<CatalogSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [googleClientId, setGoogleClientId] = useState('');
  const [googleClientSecret, setGoogleClientSecret] = useState('');
  const [googleCredsLoaded, setGoogleCredsLoaded] = useState(false);
  const [googleCredsSaving, setGoogleCredsSaving] = useState(false);

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

  if (!local) {
    return <div className="flex items-center justify-center h-full text-muted-foreground">Chargement...</div>;
  }

  const presetColors = [
    { name: 'Or', value: '#C9A84C' },
    { name: 'Charbon', value: '#1A1A1A' },
    { name: 'Émeraude', value: '#2E7D32' },
    { name: 'Bordeaux', value: '#800020' },
    { name: 'Bleu Marine', value: '#1A237E' },
    { name: 'Terracotta', value: '#C0644A' },
    { name: 'Lavande', value: '#9575CD' },
    { name: 'Moutarde', value: '#F9A825' },
    { name: 'Rose', value: '#F48FB1' },
    { name: 'Crème', value: '#FAF8F5' },
  ];

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

        <Tabs defaultValue="general" className="space-y-4">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="general" className="text-xs gap-1"><Globe className="w-3 h-3" /> Général</TabsTrigger>
            <TabsTrigger value="appearance" className="text-xs gap-1"><Palette className="w-3 h-3" /> Style</TabsTrigger>
            <TabsTrigger value="conversion" className="text-xs gap-1"><Share2 className="w-3 h-3" /> Partage</TabsTrigger>
            <TabsTrigger value="display" className="text-xs gap-1"><Monitor className="w-3 h-3" /> Affichage</TabsTrigger>
            <TabsTrigger value="admin" className="text-xs gap-1"><Shield className="w-3 h-3" /> Admin</TabsTrigger>
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

          {/* Apparence */}
          <TabsContent value="appearance">
            <Card>
              <CardHeader><CardTitle className="text-sm">Apparence</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {(['primaryColor', 'secondaryColor', 'accentColor', 'backgroundColor'] as const).map(field => (
                  <div key={field}>
                    <Label className="text-xs">
                      {field === 'primaryColor' ? 'Couleur principale' :
                       field === 'secondaryColor' ? 'Couleur secondaire' :
                       field === 'accentColor' ? 'Couleur d\'accent' : 'Couleur de fond'}
                    </Label>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex gap-1.5 flex-wrap">
                        {presetColors.map(c => (
                          <button
                            key={c.value}
                            className={`w-6 h-6 rounded-full border-2 transition-all ${local[field] === c.value ? 'border-foreground scale-110' : 'border-transparent'}`}
                            style={{ backgroundColor: c.value }}
                            onClick={() => updateField(field, c.value)}
                            title={c.name}
                          />
                        ))}
                      </div>
                      <Input
                        value={local[field]}
                        onChange={e => updateField(field, e.target.value)}
                        className="w-24 h-8 text-xs"
                      />
                    </div>
                  </div>
                ))}
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

              <Card>
                <CardHeader><CardTitle className="text-sm">Mot de passe Administrateur</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-xs">Mot de passe actuel</Label>
                    <Input type="password" className="h-9" placeholder="••••••••" />
                  </div>
                  <div>
                    <Label className="text-xs">Nouveau mot de passe</Label>
                    <Input type="password" className="h-9" placeholder="••••••••" />
                  </div>
                  <div>
                    <Label className="text-xs">Confirmer le mot de passe</Label>
                    <Input type="password" className="h-9" placeholder="••••••••" />
                  </div>
                  <Button size="sm" onClick={() => toast.info('Fonctionnalité à venir')}>Changer le mot de passe</Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
