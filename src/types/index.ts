// ─── Column Types ─────────────────────────────────────────────────────────

export type ColumnType =
  | 'TEXT'
  | 'NUMBER'
  | 'CURRENCY'
  | 'IMAGE'
  | 'IMAGE_ARRAY'
  | 'SELECT'
  | 'MULTI_SELECT'
  | 'RELATION'
  | 'ARRAY'
  | 'BOOLEAN'
  | 'URL'
  | 'STATUS'
  | 'COLOR';

export const COLUMN_TYPE_OPTIONS: { value: ColumnType; label: string; icon: string }[] = [
  { value: 'TEXT', label: 'Texte', icon: 'Type' },
  { value: 'NUMBER', label: 'Nombre', icon: 'Hash' },
  { value: 'CURRENCY', label: 'Prix', icon: 'Banknote' },
  { value: 'IMAGE', label: 'Image', icon: 'Image' },
  { value: 'IMAGE_ARRAY', label: "Galerie d'images", icon: 'Images' },
  { value: 'SELECT', label: 'Sélection', icon: 'ChevronDown' },
  { value: 'MULTI_SELECT', label: 'Multi-sélection', icon: 'ListChecks' },
  { value: 'COLOR', label: 'Couleur', icon: 'Palette' },
  { value: 'RELATION', label: 'Relation', icon: 'Link' },
  { value: 'ARRAY', label: 'Groupe (Array)', icon: 'Layers' },
  { value: 'BOOLEAN', label: 'Oui/Non', icon: 'ToggleRight' },
  { value: 'URL', label: 'Lien', icon: 'ExternalLink' },
  { value: 'STATUS', label: 'Statut', icon: 'Activity' },
];

// ─── Data Source ──────────────────────────────────────────────────────────

export interface DataSource {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string;
  color: string;
  sourceType: string;
  sourceUrl: string | null;
  sheetId: string | null;
  sheetName: string | null;
  syncInterval: number;
  lastSyncedAt: string | null;
  googleSessionId: string | null;
  columns: Column[];
  rows: Row[];
  relations: Relation[];
  createdAt: string;
  updatedAt: string;
}

export interface Column {
  id: string;
  name: string;
  slug: string;
  type: ColumnType;
  dataSourceId: string;
  order: number;
  visible: boolean;
  required: boolean;
  config: ColumnConfig;
  width: number;
  createdAt: string;
  updatedAt: string;
}

export interface ColumnConfig {
  options?: string[];           // For SELECT, MULTI_SELECT
  sourceColumns?: string[];     // For ARRAY - slugs of columns to group
  targetTableId?: string;       // For RELATION
  targetColumnId?: string;      // For RELATION
  currencySymbol?: string;      // For CURRENCY
  imagePrefix?: string;         // For IMAGE - URL prefix
  trueLabel?: string;           // For BOOLEAN
  falseLabel?: string;          // For BOOLEAN
  // Gallery / IMAGE_ARRAY configuration
  gallerySource?: 'manual' | 'googlesheet' | 'url' | 'column'; // Source type for gallery images
  gallerySourceColumn?: string; // Slug of source column when gallerySource = 'column'
  gallerySeparator?: string;    // Separator for multi-image values (default: ',')
  galleryUrlPrefix?: string;    // URL prefix for gallery images
  statusLocked?: boolean;        // For STATUS - tracks if a row's status was manually overridden
  [key: string]: unknown;
}

export interface Row {
  id: string;
  dataSourceId: string;
  data: Record<string, unknown>;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface Relation {
  id: string;
  name: string;
  sourceTableId: string;
  sourceColumnId: string;
  targetTableId: string;
  type: 'manyToOne' | 'oneToMany' | 'manyToMany';
  createdAt: string;
}

// ─── Layout ───────────────────────────────────────────────────────────────

export interface Catalog {
  id: string;
  name: string;
  slug: string;
  published: boolean;
  sections: Section[];
  settings: CatalogSettings | null;
  createdAt: string;
  updatedAt: string;
}

export interface Section {
  id: string;
  catalogId: string;
  type: SectionType;
  title: string | null;
  subtitle: string | null;
  config: SectionConfig;
  order: number;
  visible: boolean;
  components: Component[];
  createdAt: string;
  updatedAt: string;
}

export type SectionType = 'collection' | 'hero' | 'featured' | 'text';

export interface SectionConfig {
  dataSourceId?: string;
  columnsPerRow?: number;
  cardStyle?: 'elevated' | 'flat' | 'bordered';
  showTitle?: boolean;
  showDescription?: boolean;
  showPrice?: boolean;
  filterColumn?: string;
  filterValue?: string;
  // Level 1: Collection mapping
  titleColumn?: string;       // Column slug for card title
  descriptionColumn?: string; // Column slug for card description
  coverColumn?: string;       // Column slug for cover image (Level 2)
  priceColumn?: string;       // Column slug for price
  // Level 3: Detail/Carousel
  carouselColumn?: string;    // ARRAY/IMAGE_ARRAY column slug for carousel
  detailColumns?: string[];   // Column slugs to show in detail view
  variantColumn?: string;     // Column slug for variant display (sizes)
  colorColumn?: string;       // Column slug for color swatches (COLOR type column)
  [key: string]: unknown;
}

export interface Component {
  id: string;
  sectionId: string;
  type: ComponentType;
  config: ComponentConfig;
  order: number;
  visible: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ComponentType = 'card' | 'carousel' | 'grid' | 'detail' | 'button' | 'text' | 'image';

export interface ComponentConfig {
  columnMapping?: Record<string, string>;
  style?: Record<string, string>;
  [key: string]: unknown;
}

// ─── Settings ─────────────────────────────────────────────────────────────

export interface CatalogSettings {
  id: string;
  catalogId: string;
  language: string;
  currency: string;
  whatsappNumber: string;
  messengerLink: string;
  emailContact: string;
  instagramHandle: string;
  facebookPage: string;
  tiktokHandle: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  fontFamily: string;
  enableZoom: boolean;
  enableSearch: boolean;
  enableSharing: boolean;
  conversionChannel: string;
  conversionMessage: string;
  brandGreenColor: string;
  destructiveColor: string;
  borderColor: string;
  customCSS: string;
  clientOverrides: Record<string, string> | null;
  favicon: string | null;
  logo: string | null;
  logoHeight: number | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Google Integration ──────────────────────────────────────────────────

export interface GoogleSession {
  id: string;
  email: string | null;
  name: string | null;
  picture: string | null;
  scope: string;
  createdAt: string;
  updatedAt: string;
}

export interface GoogleSheetInfo {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  webViewLink: string;
  thumbnailLink?: string;
  iconLink?: string;
  owners?: { displayName: string; emailAddress: string }[];
}

export interface GoogleSheetData {
  sheetId: string;
  sheetName: string;
  headers: string[];
  rows: string[][];
  detectedColumnTypes: ColumnType[];
  imageColumns: string[];
  totalRows: number;
}

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';

// ─── App State ────────────────────────────────────────────────────────────

export type AppView = 'preview' | 'builder' | 'dashboard';
export type Pillar = 'data' | 'layout' | 'settings';
export type SettingsTab = 'general' | 'appearance' | 'conversion' | 'display' | 'admin' | 'catalogue' | 'couleurs';

export interface ImportResult {
  success: boolean;
  dataSourceId?: string;
  rowsCreated?: number;
  columnsCreated?: number;
  error?: string;
}

// ─── API ──────────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  totalPages: number;
}
