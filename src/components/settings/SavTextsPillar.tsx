'use client';

/**
 * SavTextsPillar (VG36.3 Chantier 3)
 *
 * Admin panel for editing the SAV (Service Après-Vente) texts shown on the PDP:
 *   - delivery: "Méthode de livraison et paiement" (open colis before paying)
 *   - aftersales: "Service après-vente" (échange 24-48h)
 *
 * Multilingual: FR / EN / AR with dictionary fallback when fields are empty.
 * Modeled on TrustGuaranteesPillar.tsx — same props pattern (local/updateField/handleSave).
 */

import { useState } from 'react';
import type { CatalogSettings, SavTextsConfig, SavLang, SavSection } from '@/types';
import { useTranslation } from '@/lib/i18n';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Truck, Headphones, Save, Loader2 } from 'lucide-react';

const SECTIONS: ReadonlyArray<{ key: SavSection; Icon: typeof Truck; label: string }> = [
  { key: 'delivery', Icon: Truck, label: 'Livraison' },
  { key: 'aftersales', Icon: Headphones, label: 'SAV' },
];

function buildDefaultConfig(): SavTextsConfig {
  const empty = { title: '', description: '' };
  return {
    delivery: { fr: { ...empty }, en: { ...empty }, ar: { ...empty } },
    aftersales: { fr: { ...empty }, en: { ...empty }, ar: { ...empty } },
  };
}

interface Props {
  local: CatalogSettings;
  updateField: (key: string, value: unknown) => void;
  handleSave: (updates?: Partial<CatalogSettings>) => Promise<void>;
  saving: boolean;
}

export function SavTextsPillar({ local, updateField, handleSave, saving }: Props) {
  const { t } = useTranslation();
  const [lang, setLang] = useState<SavLang>('fr');

  const config: SavTextsConfig = local.savTexts ?? buildDefaultConfig();

  const updateConfig = (newConfig: SavTextsConfig) => {
    updateField('savTexts', newConfig);
  };

  const updateItem = (section: SavSection, field: 'title' | 'description', value: string) => {
    const langItem = config[section]?.[lang] ?? { title: '', description: '' };
    updateConfig({
      ...config,
      [section]: {
        ...(config[section] ?? buildDefaultConfig()[section]),
        [lang]: { ...langItem, [field]: value },
      },
    });
  };

  const handleSaveSav = async () => {
    await handleSave({ savTexts: config });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Truck className="w-4 h-4" />
          Textes SAV &amp; Livraison
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Modifiez les textes de réassurance affichés sous la fiche produit. Laissez vide pour utiliser le dictionnaire par défaut.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Language selector */}
        <Tabs value={lang} onValueChange={(v) => setLang(v as SavLang)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="fr" className="text-xs">Français</TabsTrigger>
            <TabsTrigger value="en" className="text-xs">English</TabsTrigger>
            <TabsTrigger value="ar" className="text-xs">العربية</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Editable sections */}
        {SECTIONS.map(({ key, Icon, label }) => {
          const item = config[key]?.[lang] ?? { title: '', description: '' };
          return (
            <div key={key} className="space-y-2 p-3 rounded-lg border">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Icon className="w-4 h-4" />
                {label}
              </div>
              <Input
                placeholder={`Titre (${lang.toUpperCase()})`}
                value={item.title}
                onChange={(e) => updateItem(key, 'title', e.target.value)}
              />
              <Textarea
                placeholder={`Description (${lang.toUpperCase()})`}
                value={item.description}
                onChange={(e) => updateItem(key, 'description', e.target.value)}
                rows={3}
              />
            </div>
          );
        })}

        <Button onClick={handleSaveSav} disabled={saving} className="w-full">
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {t('common.saving') || 'Enregistrement...'}
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              {t('common.save') || 'Enregistrer'}
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
