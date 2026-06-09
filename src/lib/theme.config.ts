/**
 * ═══════════════════════════════════════════════════════════════
 * ACTIVE THEME ENGINE — Règle du 80/20
 * ═══════════════════════════════════════════════════════════════
 *
 * 4 COULEURS PIVOTS → pilotent 80% du design
 * 3 EXCEPTIONS    → couleurs non-dérivables mathématiquement
 * ~85 VARIABLES DÉRIVÉES → calculées automatiquement
 */

// ─────────────────────────────────────────────────────────────
// 1. PIVOTS (Les 4 couleurs qui pilotent tout le site)
// ─────────────────────────────────────────────────────────────

export interface ThemePivots {
  /** Couleur principale (Or brand) — pilote --gold, accents, CTA, prix */
  primaryColor: string;    // Default: #C9A84C
  /** Couleur secondaire (Noir) — pilote --foreground, textes sombres */
  secondaryColor: string;  // Default: #1A1A1A
  /** Couleur d'accent (Beige) — pilote --secondary, --muted, surfaces */
  accentColor: string;     // Default: #F5F0E8
  /** Couleur de fond (Crème) — pilote --cream, --background, page bg */
  backgroundColor: string; // Default: #FAF8F5
}

// ─────────────────────────────────────────────────────────────
// 2. EXCEPTIONS (Couleurs non-dérivables)
// ─────────────────────────────────────────────────────────────

export interface ThemeExceptions {
  /** Vert foncé de marque — pilote --primary, sidebar, boutons save, badge "Nouveau" */
  brandGreenColor: string;     // Default: #1A3C34
  /** Couleur destructive — pilote --destructive, erreurs, badges rouges */
  destructiveColor: string;    // Default: #800020
  /** Couleur de bordure — pilote --border, --input, separators */
  borderColor: string;         // Default: #E8E2D9
}

// ─────────────────────────────────────────────────────────────
// 3. DEFAULTS (Valeurs initiales de la charte graphique)
// ─────────────────────────────────────────────────────────────

export const THEME_DEFAULTS: ThemePivots & ThemeExceptions = {
  primaryColor:    '#C9A84C',
  secondaryColor:  '#1A1A1A',
  accentColor:     '#F5F0E8',
  backgroundColor: '#FAF8F5',
  brandGreenColor: '#1A3C34',
  destructiveColor:'#800020',
  borderColor:     '#E8E2D9',
};

// ─────────────────────────────────────────────────────────────
// 4. COLOR UTILITIES
// ─────────────────────────────────────────────────────────────

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  };
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/** Lighten a hex color by amount (0-100) */
export function lighten(hex: string, amount: number): string {
  const { r, g, b } = hexToRgb(hex);
  const { h, s, l } = rgbToHsl(r, g, b);
  return hslToHex(h, s, Math.min(100, l + amount));
}

/** Darken a hex color by amount (0-100) */
export function darken(hex: string, amount: number): string {
  const { r, g, b } = hexToRgb(hex);
  const { h, s, l } = rgbToHsl(r, g, b);
  return hslToHex(h, s, Math.max(0, l - amount));
}

/** Return rgba string from hex + opacity (0-1) */
export function alpha(hex: string, opacity: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${opacity})`;
}

/** Compute contrast text (white or dark) based on relative luminance */
export function contrastText(hex: string): string {
  const { r, g, b } = hexToRgb(hex);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.55 ? '#111111' : '#FFFFFF';
}

/** Mix two hex colors (ratio 0-1, 0 = all color1, 1 = all color2) */
export function colorMix(hex1: string, hex2: string, ratio: number): string {
  const c1 = hexToRgb(hex1);
  const c2 = hexToRgb(hex2);
  const r = Math.round(c1.r * (1 - ratio) + c2.r * ratio);
  const g = Math.round(c1.g * (1 - ratio) + c2.g * ratio);
  const b = Math.round(c1.b * (1 - ratio) + c2.b * ratio);
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
}

// ─────────────────────────────────────────────────────────────
// 5. DERIVATION ENGINE — Computes ALL CSS variables from 7 inputs
// ─────────────────────────────────────────────────────────────

export interface ThemeVariables {
  [cssVarName: string]: string;
}

export function computeThemeVariables(
  pivots: Partial<ThemePivots>,
  exceptions: Partial<ThemeExceptions>
): ThemeVariables {
  const p = { ...THEME_DEFAULTS, ...pivots };
  const e = { ...THEME_DEFAULTS, ...exceptions };

  const gold = p.primaryColor;
  const noir = p.secondaryColor;
  const beige = p.accentColor;
  const cream = p.backgroundColor;
  const green = e.brandGreenColor;
  const destructive = e.destructiveColor;
  const borderBase = e.borderColor;

  const white = '#FFFFFF';
  const goldFg = contrastText(gold);
  const greenFg = contrastText(green);
  const beigeFg = contrastText(beige);
  const creamFg = contrastText(cream);
  const destrFg = contrastText(destructive);

  return {
    // ═══ SHADCN CORE (7 variables) ═══
    '--background':       cream,
    '--foreground':       noir,
    '--card':             white,
    '--card-foreground':  noir,
    '--popover':          white,
    '--popover-foreground': noir,
    '--primary':          green,
    '--primary-foreground': greenFg,
    '--secondary':        beige,
    '--secondary-foreground': noir,
    '--muted':            beige,
    '--muted-foreground': darken(noir, -30),   // ~#707070 from noir base
    '--accent':           beige,
    '--accent-foreground': noir,
    '--destructive':      destructive,
    '--border':           borderBase,
    '--input':            borderBase,
    '--ring':             gold,
    '--gold':             gold,
    '--gold-foreground':  goldFg,
    '--cream':            cream,

    // ═══ SIDEBAR (6 variables) ═══
    '--sidebar':                green,
    '--sidebar-foreground':     cream,
    '--sidebar-primary':        gold,
    '--sidebar-primary-foreground': goldFg,
    '--sidebar-accent':         darken(green, 8),   // #2D4A42 from #1A3C34
    '--sidebar-accent-foreground': cream,
    '--sidebar-border':         darken(green, 5),
    '--sidebar-ring':           gold,

    // ═══ CHART PALETTE (5 variables) ═══
    '--chart-1': gold,
    '--chart-2': green,
    '--chart-3': darken(gold, 20),        // Brown tone
    '--chart-4': '#F48FB1',               // Pink — standalone
    '--chart-5': colorMix(noir, gold, 0.5), // Brown-black

    // ═══ BACKGROUNDS (11 variables) ═══
    '--bg-page':         cream,
    '--bg-card':         white,
    '--bg-modal':        white,
    '--bg-secondary':    beige,
    '--bg-dark':         green,
    '--bg-hover':        alpha(noir, 0.04),
    '--bg-input-focus':  white,
    '--bg-carousel':     colorMix(cream, beige, 0.3),   // #f8f6f2 feel
    '--bg-skeleton':     colorMix(white, beige, 0.6),
    '--bg-toast':        lighten(green, 72),             // #f0faf0 feel
    '--bg-empty-state':  cream,

    // ═══ PRIMARY BUTTONS (12 variables) ═══
    '--btn-primary-bg':         green,
    '--btn-primary-text':       greenFg,
    '--btn-primary-hover-bg':   lighten(green, 8),
    '--btn-gold-bg':            gold,
    '--btn-gold-text':          goldFg,
    '--btn-gold-hover-bg':      lighten(gold, 8),
    '--btn-whatsapp-bg':        '#25D366',
    '--btn-whatsapp-text':      white,
    '--btn-whatsapp-disabled-bg': colorMix(beige, white, 0.5),
    '--btn-add-bg':             gold,
    '--btn-danger-text':        destructive,
    '--btn-cta-bg':             alpha(gold, 0.78),
    '--btn-cta-hover-bg':       alpha(gold, 0.88),
    '--btn-cta-disabled-bg':    alpha(darken(gold, 15), 0.45),
    '--btn-cta-disabled-text':  alpha(white, 0.8),

    // ═══ SECONDARY BUTTONS (12 variables) ═══
    '--btn-secondary-bg':       white,
    '--btn-secondary-text':     noir,
    '--btn-secondary-border':   alpha(gold, 0.25),
    '--btn-outline-gold-text':  gold,
    '--btn-outline-gold-border': alpha(gold, 0.3),
    '--btn-column-text':        gold,
    '--btn-column-hover-bg':    alpha(gold, 0.05),
    '--btn-sort-text':          gold,
    '--btn-sort-hover-bg':      alpha(gold, 0.1),
    '--btn-add-row-hover-border': gold,
    '--btn-add-row-hover-bg':   alpha(gold, 0.05),
    '--btn-icon-border':        colorMix(borderBase, noir, 0.3),   // #e0dbd3 feel
    '--btn-icon-hover-border':  gold,
    '--btn-icon-hover-bg':      alpha(gold, 0.05),
    '--btn-disconnect-border':  alpha(destructive, 0.2),
    '--btn-disconnect-text':    destructive,
    '--btn-disconnect-hover-bg': alpha(destructive, 0.05),

    // ═══ STATUS BADGES (26 variables) ═══
    '--badge-new-bg':           green,
    '--badge-new-dot':          '#4ade80',
    '--badge-epuise-bg':        alpha(noir, 0.7),
    '--badge-epuise-text':      white,
    '--badge-epuise-border':    alpha(noir, 0.3),
    '--badge-surcommande-bg':   alpha(colorMix(noir, gold, 0.5), 0.12),
    '--badge-surcommande-text': darken(gold, 25),            // #8B7355 feel
    '--badge-surcommande-border': alpha(gold, 0.25),
    '--badge-native-bg':        lighten(gold, 40),           // amber-100 feel
    '--badge-native-text':      darken(gold, 10),            // amber-700 feel
    '--badge-native-border':    lighten(gold, 30),           // amber-200 feel
    '--badge-instock-bg':       lighten(green, 68),          // emerald-50 feel
    '--badge-instock-text':     darken(green, 5),            // emerald-700 feel
    '--badge-instock-border':   lighten(green, 58),          // emerald-200 feel
    '--badge-lowstock-bg':      lighten(gold, 40),
    '--badge-lowstock-text':    darken(gold, 10),
    '--badge-outofstock-text':  destructive,
    '--badge-admin-bg':         lighten(green, 65),
    '--badge-admin-text':       darken(green, 5),
    '--badge-owner-bg':         lighten(gold, 40),
    '--badge-owner-text':       darken(gold, 15),
    '--badge-editor-bg':        '#E0F2FE',                   // Sky — standalone
    '--badge-editor-text':      '#0369A1',                   // Sky — standalone
    '--badge-suspended-bg':     alpha(destructive, 0.05),
    '--badge-suspended-text':   destructive,
    '--badge-count-bg':         alpha(green, 0.75),
    '--badge-count-text':       white,
    '--badge-filter-border':    alpha(gold, 0.4),
    '--badge-filter-bg':        alpha(gold, 0.05),
    '--badge-filter-text':      gold,

    // ═══ TEXT ELEMENTS (13 variables) ═══
    '--text-heading':    noir,
    '--text-subtitle':   darken(noir, -30),         // #777 feel
    '--text-price':      gold,
    '--text-label':      darken(noir, -30),          // #777 feel
    '--text-value':      noir,
    '--text-muted':      darken(noir, -25),          // #555 feel
    '--text-link':       darken(noir, -25),          // #808080 feel
    '--text-link-hover': noir,
    '--text-separator':  lighten(noir, -50),         // #ccc feel
    '--text-accent':     gold,
    '--text-disabled':   alpha(white, 0.8),
    '--text-success':    '#16a34a',                  // Green — functional, not derived
    '--text-error':      destructive,

    // ═══ CATALOG BUTTONS (4 variables) ═══
    '--btn-catalog-bg':   gold,
    '--btn-catalog-text': goldFg,
    '--btn-detail-bg':    noir,
    '--badge-product-bg': darken(green, 5),

    // ═══ DATATABLE (14 variables) ═══
    '--dt-header-sorted':        gold,
    '--dt-row-selected-border':  gold,
    '--dt-cell-selected-ring':   alpha(gold, 0.4),
    '--dt-pending-ring':         alpha(gold, 0.5),
    '--dt-pending-text':         gold,
    '--dt-pending-row-bg':       lighten(gold, 42),         // amber-50 feel
    '--dt-stock-ok-text':        green,
    '--dt-stock-low-text':       darken(gold, 10),
    '--dt-stock-out-text':       destructive,
    '--dt-subcolumn-border':     alpha(gold, 0.2),
    '--dt-lock-text':            alpha(gold, 0.7),
    '--dt-datasource-active-text': gold,
    '--dt-datasource-active-bg': alpha(gold, 0.1),
    '--dt-search-focus-border':  alpha(gold, 0.5),
    '--dt-search-focus-ring':    alpha(gold, 0.2),

    // ═══ PRODUCT PAGE (specific) ═══
    '--pp-chip-border':           colorMix(borderBase, noir, 0.3),   // #e0dbd3
    '--pp-chip-selected-bg':      green,
    '--pp-chip-selected-border':  green,
    '--pp-chip-hover-border':     gold,
    '--pp-chip-hover-bg':         alpha(gold, 0.05),
    '--pp-divider':               colorMix(cream, beige, 0.5),       // #f0ece5 feel
    '--pp-color-circle-selected-border': gold,
    '--pp-color-circle-selected-shadow': alpha(gold, 0.3),
    '--pp-color-circle-inner-shadow': alpha(noir, 0.08),
    '--pp-detail-label':          darken(noir, -30),
    '--pp-detail-value':          noir,

    // ═══ MISC ═══
    '--scrollbar-thumb':      alpha(gold, 0.25),
    '--scrollbar-thumb-hover': alpha(gold, 0.5),
  };
}

// ─────────────────────────────────────────────────────────────
// 6. VARIABLE NAME LIST (for Style panel reference)
// ─────────────────────────────────────────────────────────────

export const PIVOT_LABELS: Record<keyof ThemePivots, string> = {
  primaryColor:    'Couleur Principale (Or)',
  secondaryColor:  'Couleur Secondaire (Noir)',
  accentColor:     'Couleur d\'Accent (Beige)',
  backgroundColor: 'Couleur de Fond (Crème)',
};

export const EXCEPTION_LABELS: Record<keyof ThemeExceptions, string> = {
  brandGreenColor:  'Vert de Marque',
  destructiveColor: 'Couleur Destructive (Bordeaux)',
  borderColor:      'Couleur de Bordure',
};

export const PIVOT_DESCRIPTIONS: Record<keyof ThemePivots, string> = {
  primaryColor:    'Pilote l\'or brand, les accents, les prix, les focus rings, les highlights DataTable',
  secondaryColor:  'Pilote le texte foncé, les foregrounds, les boutons sombres',
  accentColor:     'Pilote les surfaces secondaires, les fonds muted, les badges beige',
  backgroundColor: 'Pilote le fond de page, les crèmes, les espaces vides',
};

export const EXCEPTION_DESCRIPTIONS: Record<keyof ThemeExceptions, string> = {
  brandGreenColor:  'Vert foncé (#1A3C34) — Sidebar, boutons save, badge "Nouveau", primary',
  destructiveColor: 'Bordeaux (#800020) — Erreurs, badges rouges, actions destructives',
  borderColor:      'Bordures (#E8E2D9) — Séparateurs, inputs, contours chauds',
};
