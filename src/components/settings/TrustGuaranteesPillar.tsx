'use client';

import { useState } from 'react';
import type { ComponentType, CSSProperties } from 'react';
import { useTranslation } from '@/lib/i18n';
import type { CatalogSettings, TrustGuaranteesConfig, TrustGuaranteeItem, GuaranteeKey } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Truck, Banknote, ShieldCheck, RefreshCw, Headphones, Save, Loader2, Eye, EyeOff } from 'lucide-react';

type Lang = 'fr' | 'en' | 'ar';

type IconType = ComponentType<{ className?: string; style?: CSSProperties; strokeWidth?: number }>;

const GUARANTEE_META: ReadonlyArray<{ key: GuaranteeKey; Icon: IconType }> = [
  { key: 'livraison', Icon: Truck },
  { key: 'paiement', Icon: Banknote },
  { key: 'qualite', Icon: ShieldCheck },
  { key: 'retour', Icon: RefreshCw },
  { key: 'sav', Icon: Headphones },
];

// Default config: isVisible=true, all fields empty (→ dictionary fallback)
function buildDefaultConfig(): TrustGuaranteesConfig {
  const emptyItem: TrustGuaranteeItem = { title: '', description: '' };
  const emptyLang = { fr: emptyItem, en: emptyItem, ar: emptyItem };
  return {
    isVisible: true,
    items: {
      livraison: { fr: { ...emptyItem }, en: { ...emptyItem }, ar: { ...emptyItem } },
      paiement: { fr: { ...emptyItem }, en: { ...emptyItem }, ar: { ...emptyItem } },
      qualite: { fr: { ...emptyItem }, en: { ...emptyItem }, ar: { ...emptyItem } },
      retour: { fr: { ...emptyItem }, en: { ...emptyItem }, ar: { ...emptyItem } },
      sav: { fr: { ...emptyItem }, en: { ...emptyItem }, ar: { ...emptyItem } },
    },
  };
}

interface Props {
  local: CatalogSettings;
  updateField: (key: string, value: unknown) => void;
  handleSave: (updates?: Partial<CatalogSettings>) => Promise<void>;
  saving: boolean;
}

export function TrustGuaranteesPillar({ local, updateField, handleSave, saving }: Props) {
  const { t } = useTranslation();
  const [lang, setLang] = useState<Lang>('fr');

  // Ensure config always has a valid shape (fallback to default if null/malformed)
  const config: TrustGuaranteesConfig = local.trustGuarantees ?? buildDefaultConfig();

  const updateConfig = (newConfig: TrustGuaranteesConfig) => {
    updateField('trustGuarantees', newConfig);
  };

  const toggleVisible = (checked: boolean) => {
    updateConfig({ ...config, isVisible: checked });
  };

  const updateItem = (key: GuaranteeKey, field: 'title' | 'description', value: string) => {
    const langItem = config.items[key]?.[lang] ?? { title: '', description: '' };
    updateConfig({
      ...config,
      items: {
        ...config.items,
        [key]: {
          ...(config.items[key] ?? { fr: { title: '', description: '' }, en: { title: '', description: '' }, ar: { title: '', description: '' } }),
          [lang]: { ...langItem, [field]: value },
        },
      },
    });
  };

  const handleSaveTrust = async () => {
    await handleSave({ trustGuarantees: config });
  };

  const isRtl = lang === 'ar';

  return (
    <div className="space-y-5">
      {/* ── Toggle: Afficher / Cacher ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            {config.isVisible ? <Eye className="w-4 h-4 text-gold" /> : <EyeOff className="w-4 h-4 text-muted-foreground" />}
            {t('trust.admin.sectionTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="trust-visible" className="text-xs font-medium cursor-pointer">
                {t('trust.admin.toggleLabel')}
              </Label>
              <p className="text-[10px] text-muted-foreground">
                {t('trust.admin.toggleDesc')}
              </p>
            </div>
            <Switch
              id="trust-visible"
              checked={config.isVisible}
              onCheckedChange={toggleVisible}
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Language tabs (FR / EN / AR) ── */}
      <div>
        <Label className="text-xs font-medium mb-2 block">{t('trust.admin.editLang')}</Label>
        <Tabs value={lang} onValueChange={(v) => setLang(v as Lang)}>
          <TabsList className="grid grid-cols-3 w-full max-w-[240px]">
            <TabsTrigger value="fr" className="text-xs">FR</TabsTrigger>
            <TabsTrigger value="en" className="text-xs">EN</TabsTrigger>
            <TabsTrigger value="ar" className="text-xs">عربي</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* ── 4 guarantees × 2 fields ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {GUARANTEE_META.map(({ key, Icon }) => {
          // P0 FIX: defensive access — legacy configs (pre-VG34) may not have 'sav' key
          const item = config.items[key]?.[lang] ?? { title: '', description: '' };
          const defaultTitle = t(`trust.${key}.title`);
          const defaultDesc = t(`trust.${key}.desc`);
          return (
            <Card key={key}>
              <CardContent className="space-y-3 pt-4">
                {/* Header: icon + default label */}
                <div className="flex items-center gap-2 pb-1">
                  <Icon className="w-4 h-4 shrink-0" style={{ color: '#C9A84C' }} strokeWidth={1.5} />
                  <span className="text-sm font-semibold" style={{ color: '#3D3D3D' }}>
                    {defaultTitle}
                  </span>
                  <span className="text-[10px] text-muted-foreground ml-auto">{t('trust.admin.default')}</span>
                </div>

                {/* Title input */}
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">{t('trust.admin.fieldTitle')}</Label>
                  <Input
                    value={item.title}
                    onChange={(e) => updateItem(key, 'title', e.target.value)}
                    placeholder={defaultTitle}
                    dir={isRtl ? 'rtl' : 'ltr'}
                    className="h-8 text-xs"
                  />
                </div>

                {/* Description textarea */}
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">{t('trust.admin.fieldDesc')}</Label>
                  <Textarea
                    value={item.description}
                    onChange={(e) => updateItem(key, 'description', e.target.value)}
                    placeholder={defaultDesc}
                    dir={isRtl ? 'rtl' : 'ltr'}
                    rows={3}
                    className="text-xs resize-y"
                  />
                </div>

                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  {t('trust.admin.emptyHint')}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ── Save button ── */}
      <div className="flex justify-end pt-2">
        <Button onClick={handleSaveTrust} disabled={saving} size="sm" className="gap-1.5">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {t('trust.admin.save')}
        </Button>
      </div>
    </div>
  );
}
