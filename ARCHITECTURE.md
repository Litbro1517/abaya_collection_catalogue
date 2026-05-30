# Glide-Like Catalog Builder — Architecture Plan

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Prisma Schema — Complete](#2-prisma-schema--complete)
3. [API Route Structure](#3-api-route-structure)
4. [Component Hierarchy](#4-component-hierarchy)
5. [Zustand State Management](#5-zustand-state-management)
6. [Data Flow Diagrams](#6-data-flow-diagrams)
7. [Key Implementation Strategies](#7-key-implementation-strategies)
8. [Migration Path from Current Codebase](#8-migration-path-from-current-codebase)

---

## 1. Architecture Overview

### The Three-Pillar Model

```
+-----------------------------------------------------------+
|                    CATALOG BUILDER                         |
|                                                            |
|  +-------------+  +-------------+  +--------------------+  |
|  |   PILLAR 1  |  |   PILLAR 2  |  |     PILLAR 3       |  |
|  |    DATA     |  |   LAYOUT    |  |     SETTINGS       |  |
|  |             |  |             |  |                     |  |
|  | DataSources |  | Collections |  | Language (FR/EN/AR) |  |
|  | Columns     |  | Components  |  | Admin Access        |  |
|  | Rows        |  | Mappings    |  | Color Theme         |  |
|  | Relations   |  | Preview     |  | Publication         |  |
|  | Arrays      |  |             |  | Sharing             |  |
|  +-------------+  +-------------+  +--------------------+  |
|                                                            |
+----------------------------|-------------------------------+
                             |
                    +--------v--------+
                    |  PUBLIC CATALOG  |
                    |  (Read-Only)     |
                    |  Renders from    |
                    |  Layout + Data   |
                    +------------------+
```

### Core Design Principle: Separation of Schema from Storage

The fundamental insight is that **user-defined columns are metadata**, and **row data is a JSON blob keyed by column IDs**. This avoids the need for ALTER TABLE on every column change and makes SQLite viable.

```
Traditional:  ALTER TABLE products ADD COLUMN color TEXT;
Our approach:  columns table (metadata) + rows table (JSON data blob)
```

---

## 2. Prisma Schema — Complete

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

// ═══════════════════════════════════════════════════════════════
// PILLAR 1: DATA — Dynamic Data Sources, Columns, Rows
// ═══════════════════════════════════════════════════════════════

/// A user-defined table (e.g., "Products", "Colors", "Categories")
model DataSource {
  id          String    @id @default(cuid())
  name        String    @unique          // "Products", "Colors", etc.
  slug        String    @unique          // URL-safe identifier
  icon        String    @default("table") // Lucide icon name
  color       String    @default("#6366f1") // Accent color for UI
  sortOrder   Int       @default(0)      // Display order in sidebar
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  // Relations
  columns     Column[]
  rows        Row[]
  sourceOf    Relation[] @relation("SourceTable")   // This table is the source in a relation
  targetOf    Relation[] @relation("TargetTable")   // This table is the target in a relation

  @@map("data_sources")
}

/// A column definition within a DataSource — pure metadata
model Column {
  id           String     @id @default(cuid())
  dataSourceId String
  name         String                       // "Price", "Image URL", etc.
  slug         String                       // URL-safe: "price", "image_url"
  type         ColumnType  @default(TEXT)
  sortOrder    Int        @default(0)       // Display order in table
  required     Boolean    @default(false)   // Is this column required?
  visible      Boolean    @default(true)    // Show in table view?
  defaultValue String?                      // JSON-encoded default value

  // For ARRAY type: which child columns compose this array
  arrayChildIds String?                     // JSON array of column IDs: ["col_1","col_2","col_3"]

  // For RELATION type: which table/column this links to
  relationId   String?                      // FK to Relation record (if type = RELATION)

  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt

  dataSource   DataSource @relation(fields: [dataSourceId], references: [id], onDelete: Cascade)

  @@unique([dataSourceId, slug])
  @@map("columns")
}

/// Column types — determines how data is stored, validated, and rendered
enum ColumnType {
  TEXT          // Short text (single line)
  LONG_TEXT     // Multi-line text / description
  NUMBER        // Numeric (int or float)
  CURRENCY      // Number formatted as price
  IMAGE         // Single image URL
  IMAGE_ARRAY   // JSON array of image URLs (standalone, not composed)
  COLOR         // Color swatch: JSON { name, hex }
  BOOLEAN       // true/false
  DATE          // ISO date string
  URL           // Web URL
  PHONE         // Phone number
  EMAIL         // Email address
  SELECT        // Single select from predefined options
  MULTI_SELECT  // Multi select from predefined options
  ARRAY         // Virtual column composed of other columns (arrayChildIds)
  RELATION      // Links to a row in another DataSource
}

/// A row of data — stores all cell values in a single JSON object keyed by column ID
model Row {
  id           String     @id @default(cuid())
  dataSourceId String
  data         String     // JSON: { "col_abc123": "value1", "col_def456": 42, ... }
  sortOrder    Int        @default(0)
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt

  dataSource   DataSource @relation(fields: [dataSourceId], references: [id], onDelete: Cascade)

  @@map("rows")
}

/// A relation between two DataSources (like a foreign key)
model Relation {
  id             String     @id @default(cuid())
  name           String                       // "Product → Category"
  sourceColumnId String                       // The column in source table that holds the reference
  sourceTableId  String                       // The source DataSource
  targetTableId  String                       // The target DataSource
  type           RelationType @default(MANY_TO_ONE)

  sourceColumn   Column     @relation(fields: [sourceColumnId], references: [id], onDelete: Cascade)
  sourceTable    DataSource @relation("SourceTable", fields: [sourceTableId], references: [id], onDelete: Cascade)
  targetTable    DataSource @relation("TargetTable", fields: [targetTableId], references: [id], onDelete: Cascade)

  @@map("relations")
}

enum RelationType {
  MANY_TO_ONE    // Many rows in source → one row in target (e.g., products → category)
  ONE_TO_MANY    // One row in source → many rows in target (e.g., category → products)
  MANY_TO_MANY   // Junction (future: via junction table)
}

/// Select options for SELECT/MULTI_SELECT column types
model SelectOption {
  id         String   @id @default(cuid())
  columnId   String
  label      String
  value      String   // Stored value (can differ from label)
  color      String?  // Hex color for the tag
  sortOrder  Int      @default(0)

  column     Column   @relation(fields: [columnId], references: [id], onDelete: Cascade)

  @@unique([columnId, value])
  @@map("select_options")
}

// ═══════════════════════════════════════════════════════════════
// PILLAR 2: LAYOUT — Visual Editor Configuration
// ═══════════════════════════════════════════════════════════════

/// A catalog — the top-level entity that ties data + layout + settings
model Catalog {
  id          String    @id @default(cuid())
  name        String    @default("Mon Catalogue")
  slug        String    @unique @default(cuid())
  published   Boolean   @default(false)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  // Relations
  pages       Page[]
  settings    CatalogSettings?
  theme       Theme?

  @@map("catalogs")
}

/// A page within a catalog (e.g., "Home", "All Products", "About")
model Page {
  id          String    @id @default(cuid())
  catalogId   String
  name        String                       // "Home", "Products", "About"
  slug        String                       // "home", "products", "about"
  route       String                       // "/" , "/products", "/about"
  sortOrder   Int       @default(0)
  isHome      Boolean   @default(false)    // Landing page?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  catalog     Catalog   @relation(fields: [catalogId], references: [id], onDelete: Cascade)
  sections    Section[]

  @@unique([catalogId, slug])
  @@map("pages")
}

/// A section on a page — the fundamental layout unit
model Section {
  id         String      @id @default(cuid())
  pageId     String
  type       SectionType
  config     String      @default("{}") // JSON: section-level config (padding, background, etc.)
  sortOrder  Int         @default(0)
  visible    Boolean     @default(true)
  createdAt  DateTime    @default(now())
  updatedAt  DateTime    @updatedAt

  page       Page        @relation(fields: [pageId], references: [id], onDelete: Cascade)
  components Component[]

  @@map("sections")
}

enum SectionType {
  HERO            // Hero banner with image + text
  COLLECTION      // Grid/list of items from a DataSource
  DETAIL_VIEW     // Full product detail (carousel, variants, etc.)
  RICH_TEXT       // Free text block
  IMAGE_BANNER    // Full-width image
  SEPARATOR       // Visual divider
  CAROUSEL_SECTION // Horizontal scroll of items
}

/// A component within a section — maps data columns to UI elements
model Component {
  id         String    @id @default(cuid())
  sectionId  String
  type       ComponentType
  mappings   String    @default("{}") // JSON: { title: "col_abc", description: "col_def", ... }
  style      String    @default("{}") // JSON: { fontSize: "lg", borderRadius: "md", ... }
  sortOrder  Int       @default(0)
  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt

  section    Section   @relation(fields: [sectionId], references: [id], onDelete: Cascade)

  @@map("components")
}

enum ComponentType {
  // Level 1 — Collection level
  CARD_GRID         // Grid of product cards
  CARD_LIST         // List of product cards (horizontal)
  TABLE_VIEW        // Tabular display

  // Level 2 — Card presentation
  CARD_COVER        // Card with cover image (used within CARD_GRID)
  CARD_INLINE       // Card with inline image

  // Level 3 — Detail view
  IMAGE_CAROUSEL    // Carousel of images (from array column)
  COLOR_SWATCHES    // Grid of color swatches
  VARIANT_SELECTOR  // Size/variant picker
  FIELD_DISPLAY     // Single field display (label + value)
  ACTION_BUTTON     // CTA button (WhatsApp, etc.)
  RELATED_ITEMS     // Related items from a relation

  // Misc
  SEARCH_BAR        // Search input
  FILTER_BAR        // Category/filter chips
  BREADCRUMB        // Navigation breadcrumb
}

// ═══════════════════════════════════════════════════════════════
// PILLAR 3: SETTINGS
// ═══════════════════════════════════════════════════════════════

/// Catalog-level settings (one-to-one with Catalog)
model CatalogSettings {
  id                String   @id @default(cuid())
  catalogId         String   @unique

  // Language
  language          String   @default("fr")  // "fr", "en", "ar"
  rtl               Boolean  @default(false) // Auto-set if language is "ar"

  // Admin access
  adminPassword     String?                    // Hashed password
  sessionSecret     String?                    // For JWT signing

  // Publication
  isPublished       Boolean  @default(false)
  publishedAt       DateTime?
  customDomain      String?

  // Conversion links
  whatsappNumber    String?
  messengerLink     String?
  instagramLink     String?
  emailContact      String?

  // Features
  imageZoom         Boolean  @default(true)
  allowProductAdd   Boolean  @default(false)  // Can visitors suggest products?
  showSearch        Boolean  @default(true)
  showFilter        Boolean  @default(true)

  // Layout
  itemsPerRow       Int      @default(2)      // Mobile: 2, Desktop: configurable
  cardStyle         String   @default("cover") // "cover" | "inline" | "minimal"
  detailLayout      String   @default("sheet") // "sheet" | "page" | "modal"

  // Sharing
  shareTitle        String?
  shareDescription  String?
  shareImage        String?                    // OG image URL

  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  catalog           Catalog  @relation(fields: [catalogId], references: [id], onDelete: Cascade)

  @@map("catalog_settings")
}

/// Theme customization
model Theme {
  id              String   @id @default(cuid())
  catalogId       String   @unique

  primaryColor    String   @default("#C9A84C")    // Gold
  secondaryColor  String   @default("#1a1a1a")
  accentColor     String   @default("#C9A84C")
  backgroundColor String   @default("#ffffff")
  cardBackground  String   @default("#ffffff")
  textColor       String   @default("#1a1a1a")
  mutedColor      String   @default("#6b7280")
  borderRadius    String   @default("lg")         // "none" | "sm" | "md" | "lg" | "xl" | "full"
  fontFamily      String   @default("Playfair Display")
  bodyFont        String   @default("Inter")

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  catalog         Catalog  @relation(fields: [catalogId], references: [id], onDelete: Cascade)

  @@map("themes")
}

/// Admin sessions
model AdminSession {
  id        String   @id @default(cuid())
  token     String   @unique
  createdAt DateTime @default(now())
  expiresAt DateTime
}

/// Key-value settings (for global app config)
model Settings {
  key   String @id
  value String @default("")
}
```

### Schema Design Rationale

| Decision | Why |
|----------|-----|
| **Row.data is JSON string** | SQLite doesn't support JSON columns natively in Prisma, but `String` works fine with `JSON.parse/stringify`. Columns are metadata; rows are a flat JSON blob keyed by `columnId`. |
| **Column.arrayChildIds is JSON** | An ARRAY column groups multiple real columns. The `arrayChildIds` field stores `["col_a","col_b","col_c"]` so we know which sub-columns to compose. |
| **Relation is a first-class entity** | Instead of burying FK info inside column config, Relations are their own table. This makes validation, resolution, and future many-to-many easier. |
| **Component.mappings is JSON** | Each component type has different mapping needs. `CARD_GRID` maps `{ title, description, coverImage }`, while `IMAGE_CAROUSEL` maps `{ images }`. Storing as flexible JSON avoids a table per component type. |
| **Catalog → Page → Section → Component** | Four-level nesting mirrors how visual editors work. This is the same pattern Glide uses: App → Screen → Container → Element. |
| **CatalogSettings is 1:1** | Separate model avoids bloating the Catalog model. One-to-one via `@unique` on `catalogId`. |
| **Theme is separate** | Theme values change independently and may be swapped/shared in future. |

---

## 3. API Route Structure

```
src/app/api/
├── auth/
│   ├── route.ts              # POST login, GET session check, DELETE logout
│
├── data-sources/
│   ├── route.ts              # GET (list), POST (create)
│   ├── [id]/
│   │   ├── route.ts          # GET, PATCH, DELETE a DataSource
│   │   ├── columns/
│   │   │   ├── route.ts      # GET (list columns), POST (add column)
│   │   │   ├── [columnId]/
│   │   │   │   └── route.ts  # PATCH, DELETE a column
│   │   ├── rows/
│   │   │   ├── route.ts      # GET (list rows, paginated), POST (add row)
│   │   │   ├── [rowId]/
│   │   │   │   └── route.ts  # GET, PATCH, DELETE a row
│   │   ├── import/
│   │   │   └── route.ts      # POST CSV import
│   │   ├── export/
│   │   │   └── route.ts      # GET CSV export
│   │   └── relations/
│   │       ├── route.ts      # GET, POST relations for this source
│   │       ├── [relationId]/
│   │       │   └── route.ts  # PATCH, DELETE a relation
│
├── catalogs/
│   ├── route.ts              # GET (list), POST (create)
│   ├── [catalogId]/
│   │   ├── route.ts          # GET, PATCH, DELETE
│   │   ├── pages/
│   │   │   ├── route.ts      # GET, POST
│   │   │   ├── [pageId]/
│   │   │   │   ├── route.ts  # GET, PATCH, DELETE
│   │   │   │   ├── sections/
│   │   │   │   │   ├── route.ts       # GET, POST
│   │   │   │   │   ├── [sectionId]/
│   │   │   │   │   │   ├── route.ts   # GET, PATCH, DELETE
│   │   │   │   │   │   ├── components/
│   │   │   │   │   │   │   ├── route.ts       # GET, POST
│   │   │   │   │   │   │   ├── [componentId]/
│   │   │   │   │   │   │   │   └── route.ts   # GET, PATCH, DELETE
│   │   ├── settings/
│   │   │   └── route.ts      # GET, PATCH catalog settings
│   │   ├── theme/
│   │   │   └── route.ts      # GET, PATCH theme
│   │   ├── publish/
│   │   │   └── route.ts      # POST publish, DELETE unpublish
│   │   ├── share/
│   │   │   └── route.ts      # GET share link/QR data
│
├── upload/
│   └── route.ts              # POST image upload (multipart)
│
├── public/
│   └── [catalogSlug]/
│       ├── route.ts          # GET full catalog data for public rendering
│       ├── data/
│       │   └── [dataSourceSlug]/
│       │       └── route.ts  # GET rows for a data source (public, paginated)
│       └── product/
│           └── [rowId]/
│               └── route.ts  # GET single row with resolved relations
```

### Key API Endpoints Detail

#### CSV Import (`POST /api/data-sources/[id]/import`)

```
Input:  FormData with CSV file
Process:
  1. Parse CSV headers → create Column records (auto-detect type: TEXT/NUMBER/IMAGE)
  2. Parse CSV rows → create Row records with data JSON keyed by column IDs
  3. Return: { imported: N, columns: [...], errors: [...] }
```

#### Public Catalog Data (`GET /api/public/[catalogSlug]`)

```
Returns:
{
  catalog: { name, slug, theme, settings },
  pages: [
    {
      name, slug, route,
      sections: [
        {
          type, config,
          components: [
            { type, mappings, style }
          ]
        }
      ]
    }
  ],
  dataSources: {  // only the ones referenced by components
    [slug]: {
      columns: [...],
      rows: [...]  // first page
    }
  }
}
```

---

## 4. Component Hierarchy

### 4.1 Admin Builder — Three-Pillar Layout

```
<BuilderLayout>
├── <BuilderSidebar>              // Left: pillar navigation
│   ├── <PillarNav>
│   │   ├── <NavItem icon="database" label="Data" />
│   │   ├── <NavItem icon="layout"   label="Layout" />
│   │   └── <NavItem icon="settings" label="Settings" />
│   └── <DataSourceList />        // Quick access to tables (below nav)
│
├── <BuilderMain>                 // Center: active pillar content
│   │
│   ├── DATA PILLAR:
│   │   ├── <DataSourceManager>   // List/manage all data sources
│   │   │   ├── <DataSourceCard>  // Summary card per table
│   │   │   └── <ImportCSVModal>  // CSV import wizard
│   │   │
│   │   └── <DataSourceEditor>    // Single table editor
│   │       ├── <ColumnHeader>    // Column headers with type badges
│   │       │   ├── <ColumnNameCell>
│   │       │   ├── <ColumnTypeCell>
│   │       │   └── <ColumnActionsMenu>  // Edit, delete, add relation/array
│   │       ├── <TableGrid>       // Inline-editable data grid
│   │       │   ├── <TableHeader>
│   │       │   └── <TableRow>
│   │       │       └── <TableCell>  // Editable cell (renders per column type)
│   │       ├── <AddColumnDropdown>   // "+" button to add column
│   │       └── <RelationPanel>       // Manage relations for this table
│   │           ├── <RelationCard>
│   │           └── <CreateRelationDialog>
│   │
│   ├── LAYOUT PILLAR:
│   │   ├── <PageManager>         // Page list + add page
│   │   │   └── <PageCard>
│   │   │
│   │   └── <PageEditor>          // Visual editor for a page
│   │       ├── <SectionList>     // Vertical list of sections
│   │       │   └── <SectionBlock>
│   │       │       ├── <SectionConfigBar>  // Section-level settings
│   │       │       └── <ComponentList>
│   │       │           └── <ComponentBlock>
│   │       │               ├── <ComponentConfig>  // Column mapping dropdowns
│   │       │               └── <ComponentPreview> // Mini preview
│   │       └── <AddSectionMenu>   // Add section type
│   │
│   └── SETTINGS PILLAR:
│       ├── <LanguageSettings>
│       ├── <AdminAccessSettings>
│       ├── <ThemeEditor>
│       │   ├── <ColorPicker>      // For each theme color
│       │   ├── <FontSelector>
│       │   └── <BorderRadiusSelector>
│       ├── <PublicationControls>
│       ├── <SharingSettings>
│       └── <ConversionLinks>
│
└── <BuilderPreview>               // Right: live preview pane (collapsible)
    ├── <PreviewFrame>             // iframe or inline renderer
    └── <PreviewToolbar>           // Desktop/tablet/mobile toggle
```

### 4.2 Public Catalog Renderer

```
<CatalogRenderer>
├── <CatalogProvider>              // Provides catalog config + theme context
│   ├── <ThemeProvider>            // CSS variables from Theme model
│   └── <LanguageProvider>         // i18n context
│
├── <CatalogHeader>                // Catalog name, search, navigation
│
├── <PageRenderer>                 // Renders a Page by iterating Sections
│   └── <SectionRenderer>         // Switch on SectionType
│       ├── <HeroSection>
│       ├── <CollectionSection>    // THE MAIN ONE
│       │   ├── <CollectionQuery>  // Fetches + filters rows
│       │   ├── <CardGrid>         // Maps rows → cards
│       │   │   └── <ProductCard>  // Renders one row using mappings
│       │   │       ├── <CardCover>    // Cover image from mapped column
│       │   │       ├── <CardTitle>    // Title from mapped column
│       │   │       └── <CardDesc>     // Description from mapped column
│       │   └── <FilterBar>       // Category chips, sort
│       │
│       ├── <DetailSection>        // Full detail view
│       │   ├── <ImageCarousel>    // From array column mapping
│       │   ├── <FieldDisplay>     // Key-value pairs
│       │   ├── <ColorSwatches>   // Color variant display
│       │   ├── <VariantSelector>  // Size/model picker
│       │   └── <ActionButtons>    // WhatsApp, Messenger
│       │
│       ├── <RichTextSection>
│       ├── <ImageBannerSection>
│       └── <SeparatorSection>
│
└── <CatalogFooter>
```

### 4.3 Three-Level Layout Configuration Components

These are the key UI components for the Layout pillar:

```
Level 1: Collection Config
┌──────────────────────────────────────────────────┐
│  COLLECTION: "Products"                          │
│                                                  │
│  Data Source:  [Products  ▼]  ← dropdown         │
│  Display as:   [Card Grid  ▼]                    │
│                                                  │
│  Column Mappings:                                │
│    Title:       [nomProduit  ▼]  ← column pick   │
│    Subtitle:    [categorie   ▼]                   │
│    Description: [description ▼]                   │
│    Cover Image: [imagePrincipale ▼]               │
│    Price:       [prixVente   ▼]                   │
│                                                  │
│  Filter by:     [categorie   ▼]  ← column pick   │
│  Sort by:       [nOrdre      ▼]  ← column pick   │
└──────────────────────────────────────────────────┘

Level 2: Cover Selection
┌──────────────────────────────────────────────────┐
│  COVER IMAGE CONFIG                              │
│                                                  │
│  Cover column: [imagePrincipale ▼]  ← single col │
│  Fallback:     [imagesCarousel[0] ▼]             │
│  Aspect ratio: [3:4 ▼]                           │
│  Border radius: [lg ▼]                           │
└──────────────────────────────────────────────────┘

Level 3: Carousel/Detail
┌──────────────────────────────────────────────────┐
│  DETAIL VIEW CONFIG                              │
│                                                  │
│  Image carousel: [imagesCarousel ▼] ← array col  │
│  Color variants:  [couleurs      ▼]              │
│  Size variants:   [tailles       ▼]              │
│  Extra fields:                                    │
│    + [Add Field]                                  │
│      Label: "Prix"  Column: [prixVente ▼]        │
│      Label: "Stock" Column: [stock    ▼]         │
│                                                  │
│  Action button:                                  │
│    Channel: [WhatsApp ▼]                         │
│    Phone:   [whatsappNumber from settings]        │
└──────────────────────────────────────────────────┘
```

---

## 5. Zustand State Management

### 5.1 Store Architecture — Slice Pattern

```
src/lib/stores/
├── builder-store.ts      // Main builder state (active pillar, active catalog)
├── data-store.ts         // DataSources, columns, rows cache
├── layout-store.ts       // Pages, sections, components
├── settings-store.ts     // Catalog settings, theme
├── catalog-store.ts      // Public catalog rendering state
└── index.ts              // Re-exports + combined selectors
```

### 5.2 Builder Store (Core Navigation)

```typescript
// src/lib/stores/builder-store.ts
import { create } from 'zustand';

type Pillar = 'data' | 'layout' | 'settings';

interface BuilderState {
  // Which pillar is active
  activePillar: Pillar;
  setActivePillar: (pillar: Pillar) => void;

  // Which catalog are we editing
  activeCatalogId: string | null;
  setActiveCatalogId: (id: string) => void;

  // Which data source is being edited (within Data pillar)
  activeDataSourceId: string | null;
  setActiveDataSourceId: (id: string | null) => void;

  // Which page is being edited (within Layout pillar)
  activePageId: string | null;
  setActivePageId: (id: string | null) => void;

  // Preview panel
  showPreview: boolean;
  setShowPreview: (v: boolean) => void;
  previewDevice: 'desktop' | 'tablet' | 'mobile';
  setPreviewDevice: (d: 'desktop' | 'tablet' | 'mobile') => void;

  // Global loading
  loading: boolean;
  setLoading: (v: boolean) => void;
}
```

### 5.3 Data Store (Pillar 1)

```typescript
// src/lib/stores/data-store.ts
interface DataState {
  // All data sources for the active catalog
  dataSources: DataSource[];
  setDataSources: (ds: DataSource[]) => void;

  // Columns for the active data source
  columns: Column[];
  setColumns: (cols: Column[]) => void;

  // Rows for the active data source (paginated)
  rows: Row[];
  setRows: (rows: Row[]) => void;
  totalRows: number;
  setTotalRows: (n: number) => void;
  rowPage: number;
  setRowPage: (n: number) => void;

  // Relations for the active data source
  relations: Relation[];
  setRelations: (rels: Relation[]) => void;

  // Optimistic updates
  upsertRow: (row: Row) => void;          // Update or insert in local cache
  removeRow: (rowId: string) => void;
  upsertColumn: (col: Column) => void;
  removeColumn: (colId: string) => void;

  // Dirty tracking for inline edits
  dirtyCells: Map<string, string>;  // `${rowId}:${colId}` → new value
  markDirty: (rowId: string, colId: string, value: string) => void;
  flushDirty: () => Promise<void>;   // Batch save all dirty cells
}
```

### 5.4 Layout Store (Pillar 2)

```typescript
// src/lib/stores/layout-store.ts
interface LayoutState {
  // Pages for the active catalog
  pages: Page[];
  setPages: (pages: Page[]) => void;

  // Sections for the active page
  sections: Section[];
  setSections: (sections: Section[]) => void;

  // Components for a specific section
  componentsBySection: Record<string, Component[]>;
  setComponentsForSection: (sectionId: string, components: Component[]) => void;

  // Active editing target
  activeSectionId: string | null;
  setActiveSectionId: (id: string | null) => void;
  activeComponentId: string | null;
  setActiveComponentId: (id: string | null) => void;

  // Column mapping helpers
  getAvailableColumns: (dataSourceId: string) => Column[];
  getArrayColumns: (dataSourceId: string) => Column[];  // Only ARRAY type
  getRelationColumns: (dataSourceId: string) => Column[];  // Only RELATION type
}
```

### 5.5 Settings Store (Pillar 3)

```typescript
// src/lib/stores/settings-store.ts
interface SettingsState {
  settings: CatalogSettings | null;
  setSettings: (s: CatalogSettings) => void;
  updateSetting: <K extends keyof CatalogSettings>(key: K, value: CatalogSettings[K]) => void;

  theme: Theme | null;
  setTheme: (t: Theme) => void;
  updateThemeColor: (key: keyof Theme, value: string) => void;

  // Auth
  isAdmin: boolean;
  setIsAdmin: (v: boolean) => void;
}
```

### 5.6 Public Catalog Store

```typescript
// src/lib/stores/catalog-store.ts
interface CatalogState {
  // Full catalog data loaded from /api/public/[slug]
  catalog: CatalogConfig | null;
  setCatalog: (c: CatalogConfig) => void;

  // Current page
  currentPageSlug: string;
  setCurrentPageSlug: (slug: string) => void;

  // Data for the active collection (fetched lazily)
  collectionData: Record<string, Row[]>;  // dataSourceSlug → rows
  loadCollectionData: (dataSourceSlug: string, page?: number) => Promise<void>;

  // Selected row for detail view
  selectedRowId: string | null;
  setSelectedRowId: (id: string | null) => void;
  showDetail: boolean;
  setShowDetail: (v: boolean) => void;

  // Resolved detail data (with relations expanded)
  detailData: Record<string, unknown> | null;

  // Search & filter
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  activeFilter: string | null;
  setActiveFilter: (f: string | null) => void;
}
```

---

## 6. Data Flow Diagrams

### 6.1 CSV Import Flow

```
User drops CSV file
        │
        ▼
[Frontend: ImportCSVModal]
        │  POST /api/data-sources/[id]/import
        │  FormData { file }
        ▼
[API: import/route.ts]
        │
        ├── 1. Read CSV with papaparse
        │      Parse headers → detect types
        │        - If header contains "image"/"photo"/"img" → IMAGE
        │        - If header contains "price"/"prix"/"cost"  → CURRENCY
        │        - If all values are numeric                  → NUMBER
        │        - Otherwise                                  → TEXT
        │
        ├── 2. Create DataSource (if new) or use existing
        │
        ├── 3. Create Column records
        │      for each CSV header:
        │        db.column.create({ name, slug, type, dataSourceId })
        │
        ├── 4. Create Row records
        │      for each CSV row:
        │        const data = {};
        │        for each header/column:
        │          data[column.id] = csvRow[header];
        │        db.row.create({ dataSourceId, data: JSON.stringify(data) })
        │
        └── 5. Return { imported: N, columns: [...], skipped: M }
                │
                ▼
[Frontend: Update data-store]
        │  setColumns(newColumns)
        │  setRows(newRows)
        ▼
[TableGrid re-renders]
```

### 6.2 Layout Configuration Flow

```
User clicks "Layout" pillar
        │
        ▼
[BuilderMain shows PageManager]
        │
        User clicks a Page → setActivePageId(pageId)
        │
        ▼
[PageEditor loads]
        │  GET /api/catalogs/[id]/pages/[pageId]
        │  Returns: { sections: [...], components: [...] }
        ▼
[SectionList renders sections]
        │
        User clicks a Collection section
        │
        ▼
[ComponentConfig panel opens]
        │
        ├── Data Source dropdown → lists all DataSources
        │   User selects "Products"
        │   → Component.mappings.dataSourceId = "ds_products"
        │
        ├── Column Mapping dropdowns → lists columns from selected DataSource
        │   "Title" → [nomProduit ▼]
        │   "Description" → [description ▼]
        │   "Cover Image" → [imagePrincipale ▼]
        │   "Price" → [prixVente ▼]
        │
        └── Auto-save: PATCH /api/catalogs/[id]/pages/[pid]/sections/[sid]/components/[cid]
                { mappings: { dataSourceId, title: "col_abc", ... } }
                │
                ▼
[Preview pane updates in real-time]
        │  Reads component.mappings
        │  Fetches sample rows from DataSource
        │  Renders <ProductCard> with mapped columns
        ▼
```

### 6.3 Public Catalog Rendering Flow

```
Visitor opens /c/[catalogSlug]
        │
        ▼
[Server Component: CatalogPage]
        │  GET /api/public/[catalogSlug]
        │  Returns full catalog config
        ▼
[CatalogProvider initializes catalog-store]
        │
        ├── Sets theme as CSS variables
        │     document.documentElement.style.setProperty('--primary', theme.primaryColor)
        │
        ├── Sets language context
        │     if (settings.language === 'ar') document.dir = 'rtl'
        │
        └── Renders <PageRenderer>
                │
                ▼
[PageRenderer iterates sections]
        │
        For each section:
        │
        ├── HERO → <HeroSection config={section.config} />
        │
        ├── COLLECTION → <CollectionSection>
        │     │
        │     ├── Reads component.mappings to know:
        │     │   - dataSourceId → which table to query
        │     │   - title → which column is the title
        │     │   - coverImage → which column is the image
        │     │   - price → which column is the price
        │     │
        │     ├── Fetches rows: GET /api/public/[slug]/data/[dataSourceSlug]
        │     │
        │     └── Renders <CardGrid>
        │           For each row:
        │             <ProductCard
        │               title={row.data[mappings.title]}
        │               image={row.data[mappings.coverImage]}
        │               price={row.data[mappings.price]}
        │               onClick → setSelectedRowId(row.id)
        │             />
        │
        └── DETAIL → <DetailSection>
              │
              │  When selectedRowId is set:
              │
              ├── GET /api/public/[slug]/product/[rowId]
              │   Returns row data with relations resolved:
              │   {
              │     ...row.data,
              │     _relations: {
              │       "col_category": { name: "Abayas", ... },  // resolved
              │     }
              │   }
              │
              ├── Renders <ImageCarousel>
              │   images = row.data[mappings.carouselColumn]  // array column → [url1, url2, ...]
              │
              ├── Renders <ColorSwatches>
              │   colors = row.data[mappings.colorColumn]     // [{name, hex}, ...]
              │
              ├── Renders <VariantSelector>
              │   variants = row.data[mappings.variantColumn] // ["S", "M", "L", ...]
              │
              └── Renders <ActionButtons>
                    channel = settings.whatsappNumber
                    message = `Hi, I'm interested in ${row.data[mappings.title]}`
```

### 6.4 Inline Cell Edit Flow

```
User clicks cell in TableGrid
        │
        ▼
[TableCell becomes editable]
        │  User types new value
        │  onBlur or Enter
        ▼
[data-store.markDirty(rowId, colId, newValue)]
        │  Adds to dirtyCells map
        │  Optimistically updates local row data
        ▼
[Debounced flushDirty() — 500ms after last edit]
        │
        ▼
[PATCH /api/data-sources/[id]/rows/[rowId]]
        │  { data: { [colId]: newValue } }
        │
        ▼
[API merges into existing row.data JSON]
        │  const existing = JSON.parse(row.data);
        │  existing[colId] = newValue;
        │  await db.row.update({ data: JSON.stringify(existing) });
        ▼
[Response confirms → remove from dirtyCells]
```

### 6.5 Array Column Resolution Flow

```
User creates ARRAY column "Image Gallery"
        │  arrayChildIds: ["col_img1", "col_img2", "col_img3"]
        │
        ▼
When rendering a row's "Image Gallery" column:
        │
        ▼
[resolveArrayColumn(row, arrayColumn)]
        │
        const childIds = JSON.parse(arrayColumn.arrayChildIds);
        const values = childIds.map(id => row.data[id]).filter(Boolean);
        // values = ["https://img1.jpg", "https://img2.jpg", "https://img3.jpg"]
        │
        ▼
[ImageCarousel receives values as slides]
```

### 6.6 Relation Resolution Flow

```
DataSource "Products" has column "categorie" of type RELATION
        │  relationId → Relation {
        │    sourceColumnId: "col_categorie",
        │    sourceTableId: "ds_products",
        │    targetTableId: "ds_categories",
        │    type: MANY_TO_ONE
        │  }
        │
        ▼
When rendering a product row:
        │
        row.data["col_categorie"] = "row_xyz789"  // stores target row ID
        │
        ▼
[resolveRelation(row, relationColumn)]
        │
        const targetRowId = row.data[relationColumn.id];
        const targetRow = await db.row.findUnique({ where: { id: targetRowId } });
        const targetColumns = await db.column.findMany({
          where: { dataSourceId: relation.targetTableId }
        });
        const resolved = {};
        for (const col of targetColumns) {
          resolved[col.slug] = JSON.parse(targetRow.data)[col.id];
        }
        // resolved = { name: "Abayas", slug: "abayas", image: "..." }
        │
        ▼
[Frontend receives _relations: { col_categorie: { name: "Abayas", ... } }]
```

---

## 7. Key Implementation Strategies

### 7.1 Dynamic Column Rendering Strategy

Each `ColumnType` maps to a cell renderer and a cell editor:

```typescript
// src/lib/column-renderers.tsx
const CellRenderer: Record<ColumnType, React.FC<CellRendererProps>> = {
  TEXT:        ({ value }) => <span>{value}</span>,
  LONG_TEXT:   ({ value }) => <p className="line-clamp-2">{value}</p>,
  NUMBER:      ({ value }) => <span className="tabular-nums">{value}</span>,
  CURRENCY:    ({ value, settings }) => <span>{formatCurrency(value, settings)}</span>,
  IMAGE:       ({ value }) => value ? <img src={value} className="size-10 rounded object-cover" /> : <Placeholder />,
  IMAGE_ARRAY: ({ value }) => <ImageThumbnailGrid images={JSON.parse(value || '[]')} />,
  COLOR:       ({ value }) => {
    const c = JSON.parse(value || '{}');
    return <div className="flex items-center gap-2">
      <div className="size-4 rounded-full" style={{ background: c.hex }} />
      <span>{c.name}</span>
    </div>;
  },
  BOOLEAN:     ({ value }) => <Checkbox checked={value === 'true'} />,
  SELECT:      ({ value, column }) => <Badge>{value}</Badge>,
  ARRAY:       ({ value, column, allColumns, row }) => {
    // Compose from child columns
    const childIds = JSON.parse(column.arrayChildIds || '[]');
    const values = childIds.map(id => row.data[id]).filter(Boolean);
    return <ImageThumbnailGrid images={values} />;
  },
  RELATION:    ({ value, column }) => {
    // Show linked row's display name (fetched separately)
    return <span className="text-primary underline">{value}</span>;
  },
  // ... etc
};
```

### 7.2 Inline Table Editor (TanStack Table + shadcn)

```typescript
// src/components/builder/data/TableGrid.tsx
// Uses @tanstack/react-table for virtual scrolling + column management
// Each cell renders <CellEditor> based on ColumnType
// Debounced save on blur/enter via data-store.markDirty + flushDirty

const table = useReactTable({
  data: rows.map(r => ({ ...JSON.parse(r.data), _id: r.id, _sortOrder: r.sortOrder })),
  columns: columns.map(col => ({
    id: col.id,
    header: col.name,
    accessorKey: col.id,
    cell: ({ row, getValue }) => (
      <CellEditor
        column={col}
        value={getValue()}
        rowId={row.original._id}
        onChange={(val) => markDirty(row.original._id, col.id, val)}
      />
    ),
  })),
});
```

### 7.3 CSV Import with Type Detection

```typescript
// src/app/api/data-sources/[id]/import/route.ts
import Papa from 'papaparse';

function detectColumnType(header: string, values: string[]): ColumnType {
  const h = header.toLowerCase();
  if (/image|img|photo|picture|pic/.test(h)) return 'IMAGE';
  if (/price|prix|cost|montant|amount/.test(h)) return 'CURRENCY';
  if (/color|couleur|colour/.test(h)) return 'COLOR';
  if (/stock|quantity|quantité/.test(h)) return 'NUMBER';
  if (/available|disponible|active/.test(h)) return 'BOOLEAN';
  if (/description|desc|detail/.test(h)) return 'LONG_TEXT';

  // Heuristic: if 80%+ values are numeric
  const numericCount = values.filter(v => !isNaN(Number(v)) && v.trim() !== '').length;
  if (numericCount / values.length > 0.8) return 'NUMBER';

  return 'TEXT';
}
```

### 7.4 Theme as CSS Variables (Runtime)

```typescript
// src/components/public/CatalogProvider.tsx
function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.style.setProperty('--color-primary', theme.primaryColor);
  root.style.setProperty('--color-secondary', theme.secondaryColor);
  root.style.setProperty('--color-accent', theme.accentColor);
  root.style.setProperty('--color-bg', theme.backgroundColor);
  root.style.setProperty('--color-card', theme.cardBackground);
  root.style.setProperty('--color-text', theme.textColor);
  root.style.setProperty('--color-muted', theme.mutedColor);
  root.style.setProperty('--font-heading', theme.fontFamily);
  root.style.setProperty('--font-body', theme.bodyFont);
  root.style.setProperty('--radius', theme.borderRadius);
}
```

### 7.5 Column-to-Component Mapping Resolution

This is the core rendering engine. Given a component's `mappings` JSON and a row's `data` JSON, resolve what to display:

```typescript
// src/lib/resolve-mappings.ts
interface MappingConfig {
  dataSourceId: string;
  title?: string;        // column ID
  subtitle?: string;     // column ID
  description?: string;  // column ID
  coverImage?: string;   // column ID
  price?: string;        // column ID
  carouselImages?: string;  // column ID (must be ARRAY or IMAGE_ARRAY type)
  colorVariants?: string;   // column ID
  sizeVariants?: string;    // column ID
  filterBy?: string;        // column ID (for category filter)
  sortBy?: string;          // column ID
}

function resolveCardData(mapping: MappingConfig, row: Row, columns: Column[]) {
  const data = JSON.parse(row.data);
  const colMap = Object.fromEntries(columns.map(c => [c.id, c]));

  return {
    id: row.id,
    title: data[mapping.title ?? ''] ?? '',
    subtitle: resolveValue(data, mapping.subtitle, colMap),
    description: resolveValue(data, mapping.description, colMap),
    coverImage: resolveValue(data, mapping.coverImage, colMap),
    price: mapping.price ? {
      value: Number(data[mapping.price] ?? 0),
      currency: colMap[mapping.price]?.type === 'CURRENCY',
    } : null,
  };
}

function resolveDetailData(mapping: MappingConfig, row: Row, columns: Column[]) {
  const data = JSON.parse(row.data);
  const colMap = Object.fromEntries(columns.map(c => [c.id, c]));
  const card = resolveCardData(mapping, row, columns);

  // Resolve array columns
  const carouselImages = mapping.carouselImages
    ? resolveArrayColumn(data, mapping.carouselImages, colMap)
    : [];

  const colorVariants = mapping.colorVariants
    ? JSON.parse(data[mapping.colorVariants] || '[]')
    : [];

  const sizeVariants = mapping.sizeVariants
    ? JSON.parse(data[mapping.sizeVariants] || '[]')
    : [];

  return { ...card, carouselImages, colorVariants, sizeVariants };
}

function resolveArrayColumn(
  data: Record<string, unknown>,
  arrayColumnId: string,
  colMap: Record<string, Column>
): string[] {
  const col = colMap[arrayColumnId];
  if (!col) return [];

  if (col.type === 'IMAGE_ARRAY') {
    return JSON.parse((data[arrayColumnId] as string) || '[]');
  }

  if (col.type === 'ARRAY') {
    const childIds: string[] = JSON.parse(col.arrayChildIds || '[]');
    return childIds.map(id => data[id]).filter(Boolean) as string[];
  }

  return [];
}
```

### 7.6 Public Catalog Server-Side Rendering Strategy

For SEO and performance, the public catalog should use Next.js Server Components where possible:

```typescript
// src/app/c/[catalogSlug]/page.tsx (Server Component)
export default async function CatalogPage({ params }: { params: { catalogSlug: string } }) {
  const catalog = await getCatalogWithLayout(params.catalogSlug);
  if (!catalog || !catalog.settings?.isPublished) notFound();

  // Pre-fetch data for the home page's collection sections
  const homePage = catalog.pages.find(p => p.isHome);
  const collectionSections = homePage?.sections.filter(s => s.type === 'COLLECTION') ?? [];

  const preloadedData: Record<string, Row[]> = {};
  for (const section of collectionSections) {
    const gridComponent = section.components.find(c => c.type === 'CARD_GRID');
    if (gridComponent) {
      const dsId = JSON.parse(gridComponent.mappings).dataSourceId;
      preloadedData[dsId] = await db.row.findMany({
        where: { dataSourceId: dsId },
        take: 50,
        orderBy: { sortOrder: 'asc' },
      });
    }
  }

  return (
    <CatalogProvider catalog={catalog} preloadedData={preloadedData}>
      <PageRenderer page={homePage} />
    </CatalogProvider>
  );
}
```

### 7.7 Debounced Batch Save for Inline Editing

```typescript
// src/lib/stores/data-store.ts (excerpt)
let flushTimeout: NodeJS.Timeout | null = null;

markDirty: (rowId, colId, value) => {
  set(state => {
    const newDirty = new Map(state.dirtyCells);
    newDirty.set(`${rowId}:${colId}`, value);

    // Optimistic local update
    const newRows = state.rows.map(r => {
      if (r.id !== rowId) return r;
      const data = JSON.parse(r.data);
      data[colId] = value;
      return { ...r, data: JSON.stringify(data) };
    });

    return { dirtyCells: newDirty, rows: newRows };
  });

  // Debounce flush
  if (flushTimeout) clearTimeout(flushTimeout);
  flushTimeout = setTimeout(() => get().flushDirty(), 500);
},

flushDirty: async () => {
  const { dirtyCells, rows } = get();
  if (dirtyCells.size === 0) return;

  // Group by rowId
  const byRow = new Map<string, Record<string, string>>();
  for (const [key, value] of dirtyCells) {
    const [rowId, colId] = key.split(':');
    if (!byRow.has(rowId)) byRow.set(rowId, {});
    byRow.get(rowId)![colId] = value;
  }

  // Batch PATCH each row
  await Promise.all(
    Array.from(byRow.entries()).map(([rowId, updates]) =>
      fetch(`/api/data-sources/${get().activeDataSourceId}/rows/${rowId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: updates }),
      })
    )
  );

  set({ dirtyCells: new Map() });
},
```

### 7.8 Relation Resolution on the API Side

```typescript
// src/app/api/public/[catalogSlug]/product/[rowId]/route.ts
export async function GET(req: NextRequest, { params }: { params: { rowId: string } }) {
  const row = await db.row.findUnique({ where: { id: params.rowId } });
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const data = JSON.parse(row.data);

  // Resolve all RELATION columns
  const columns = await db.column.findMany({
    where: { dataSourceId: row.dataSourceId, type: 'RELATION' },
    include: { relation: true },
  });

  const resolvedRelations: Record<string, any> = {};

  for (const col of columns) {
    if (!col.relation) continue;
    const targetRowId = data[col.id];
    if (!targetRowId) continue;

    const targetRow = await db.row.findUnique({ where: { id: targetRowId } });
    if (!targetRow) continue;

    const targetColumns = await db.column.findMany({
      where: { dataSourceId: col.relation.targetTableId },
    });

    const targetData = JSON.parse(targetRow.data);
    const resolved: Record<string, any> = {};
    for (const tc of targetColumns) {
      resolved[tc.slug] = targetData[tc.id];
    }
    resolvedRelations[col.id] = resolved;
  }

  return NextResponse.json({
    ...data,
    _id: row.id,
    _relations: resolvedRelations,
  });
}
```

---

## 8. Migration Path from Current Codebase

### Phase 1: Schema Migration (Week 1)

The existing `Product`, `Category` tables remain functional while we add the new dynamic schema alongside them:

1. **Add new models** to `schema.prisma` (all the models above)
2. **Run `prisma db push`** — SQLite is additive, no data loss
3. **Create migration script** (`scripts/migrate-to-dynamic.ts`) that:
   - Creates a `DataSource` for "Products" and "Categories"
   - Creates `Column` records matching existing Product/Category fields
   - Migrates all Product rows into the `Row` table with JSON data
   - Creates a `Relation` linking Products → Categories
   - Creates default `Catalog`, `Page`, `Section`, `Component` records

```typescript
// scripts/migrate-to-dynamic.ts (pseudocode)
async function migrate() {
  // 1. Create DataSources
  const productsDS = await db.dataSource.create({ data: { name: 'Products', slug: 'products' } });
  const categoriesDS = await db.dataSource.create({ data: { name: 'Categories', slug: 'categories' } });

  // 2. Create Columns for Products
  const productColumns = [
    { name: 'Nom du produit', slug: 'nom-produit', type: 'TEXT', required: true },
    { name: 'Prix de vente', slug: 'prix-vente', type: 'CURRENCY', required: true },
    { name: 'Description', slug: 'description', type: 'LONG_TEXT' },
    { name: 'Couleurs', slug: 'couleurs', type: 'IMAGE_ARRAY' },  // Stored as JSON
    { name: 'Tailles', slug: 'tailles', type: 'MULTI_SELECT' },
    { name: 'Image principale', slug: 'image-principale', type: 'IMAGE' },
    { name: 'Images carousel', slug: 'images-carousel', type: 'IMAGE_ARRAY' },
    { name: 'Catégorie', slug: 'categorie', type: 'RELATION' },
    { name: 'Stock', slug: 'stock', type: 'NUMBER' },
    { name: 'Disponible', slug: 'disponible', type: 'BOOLEAN' },
    { name: 'Vedette', slug: 'vedette', type: 'BOOLEAN' },
  ];

  const createdColumns = {};
  for (const col of productColumns) {
    createdColumns[col.slug] = await db.column.create({
      data: { ...col, dataSourceId: productsDS.id }
    });
  }

  // 3. Create Columns for Categories
  const categoryColumns = [
    { name: 'Nom', slug: 'nom', type: 'TEXT', required: true },
    { name: 'Image', slug: 'image', type: 'IMAGE' },
  ];

  // 4. Migrate Category rows
  const oldCategories = await db.category.findMany();
  const categoryRowMap = {};
  for (const cat of oldCategories) {
    const row = await db.row.create({
      data: {
        dataSourceId: categoriesDS.id,
        data: JSON.stringify({
          [createdCatColumns['nom'].id]: cat.nom,
          [createdCatColumns['image'].id]: '', // if exists
        }),
      }
    });
    categoryRowMap[cat.id] = row.id;
  }

  // 5. Create Relation
  await db.relation.create({
    data: {
      name: 'Product → Category',
      sourceColumnId: createdColumns['categorie'].id,
      sourceTableId: productsDS.id,
      targetTableId: categoriesDS.id,
      type: 'MANY_TO_ONE',
    }
  });

  // 6. Migrate Product rows
  const oldProducts = await db.product.findMany();
  for (const prod of oldProducts) {
    await db.row.create({
      data: {
        dataSourceId: productsDS.id,
        data: JSON.stringify({
          [createdColumns['nom-produit'].id]: prod.nomProduit,
          [createdColumns['prix-vente'].id]: prod.prixVente,
          [createdColumns['description'].id]: prod.description,
          [createdColumns['image-principale'].id]: prod.imagePrincipale,
          [createdColumns['images-carousel'].id]: prod.imagesCarousel,
          [createdColumns['couleurs'].id]: prod.couleurs,
          [createdColumns['tailles'].id]: prod.tailles,
          [createdColumns['categorie'].id]: categoryRowMap[prod.categorieId] || null,
          [createdColumns['stock'].id]: prod.stock,
          [createdColumns['disponible'].id]: prod.disponible,
          [createdColumns['vedette'].id]: prod.featured,
        }),
      }
    });
  }

  // 7. Create default Catalog with Layout
  const catalog = await db.catalog.create({ data: { name: 'Abaya Chic Collection' } });
  // ... create Page, Sections, Components with mappings referencing column IDs
}
```

### Phase 2: Builder UI (Week 2-3)

1. Create the three-pillar sidebar layout
2. Build Data pillar: DataSourceManager + DataSourceEditor (table grid)
3. Build Layout pillar: PageManager + PageEditor + ComponentConfig
4. Build Settings pillar: All settings forms
5. Build the Preview pane

### Phase 3: Public Renderer (Week 3-4)

1. Create `/c/[catalogSlug]` route
2. Build CatalogProvider + ThemeProvider + LanguageProvider
3. Build SectionRenderer with all section types
4. Build CollectionSection with dynamic column mapping resolution
5. Build DetailSection with carousel, color swatches, variant selector
6. Add search, filter, sharing, WhatsApp integration

### Phase 4: Polish & Remove Legacy (Week 4)

1. Remove old `Product`/`Category` models from schema
2. Remove old admin/gallery components
3. Redirect `/` → `/c/default-catalog` or `/builder`
4. Add image upload with Sharp processing
5. Performance optimization (virtual scrolling, image lazy loading)

---

## Appendix A: Directory Structure

```
src/
├── app/
│   ├── api/
│   │   ├── auth/route.ts
│   │   ├── data-sources/
│   │   │   ├── route.ts
│   │   │   ├── [id]/
│   │   │   │   ├── route.ts
│   │   │   │   ├── columns/
│   │   │   │   │   ├── route.ts
│   │   │   │   │   └── [columnId]/route.ts
│   │   │   │   ├── rows/
│   │   │   │   │   ├── route.ts
│   │   │   │   │   └── [rowId]/route.ts
│   │   │   │   ├── import/route.ts
│   │   │   │   ├── export/route.ts
│   │   │   │   └── relations/
│   │   │   │       ├── route.ts
│   │   │   │       └── [relationId]/route.ts
│   │   ├── catalogs/
│   │   │   ├── route.ts
│   │   │   ├── [catalogId]/
│   │   │   │   ├── route.ts
│   │   │   │   ├── pages/
│   │   │   │   │   ├── route.ts
│   │   │   │   │   └── [pageId]/
│   │   │   │   │       ├── route.ts
│   │   │   │   │       └── sections/
│   │   │   │   │           ├── route.ts
│   │   │   │   │           └── [sectionId]/
│   │   │   │   │               ├── route.ts
│   │   │   │   │               └── components/
│   │   │   │   │                   ├── route.ts
│   │   │   │   │                   └── [componentId]/route.ts
│   │   │   │   ├── settings/route.ts
│   │   │   │   ├── theme/route.ts
│   │   │   │   ├── publish/route.ts
│   │   │   │   └── share/route.ts
│   │   ├── public/
│   │   │   └── [catalogSlug]/
│   │   │       ├── route.ts
│   │   │       ├── data/[dataSourceSlug]/route.ts
│   │   │       └── product/[rowId]/route.ts
│   │   └── upload/route.ts
│   │
│   ├── builder/                    # Builder pages (protected)
│   │   ├── layout.tsx
│   │   └── [catalogId]/
│   │       └── page.tsx
│   │
│   ├── c/                          # Public catalog (SSR)
│   │   └── [catalogSlug]/
│   │       ├── page.tsx
│   │       └── product/[rowId]/page.tsx
│   │
│   ├── layout.tsx
│   └── globals.css
│
├── components/
│   ├── builder/                    # Builder (admin) components
│   │   ├── BuilderLayout.tsx
│   │   ├── BuilderSidebar.tsx
│   │   ├── BuilderMain.tsx
│   │   ├── BuilderPreview.tsx
│   │   ├── data/                   # Pillar 1 components
│   │   │   ├── DataSourceManager.tsx
│   │   │   ├── DataSourceEditor.tsx
│   │   │   ├── TableGrid.tsx
│   │   │   ├── CellEditor.tsx
│   │   │   ├── AddColumnDropdown.tsx
│   │   │   ├── ImportCSVModal.tsx
│   │   │   └── RelationPanel.tsx
│   │   ├── layout/                 # Pillar 2 components
│   │   │   ├── PageManager.tsx
│   │   │   ├── PageEditor.tsx
│   │   │   ├── SectionList.tsx
│   │   │   ├── SectionBlock.tsx
│   │   │   ├── ComponentConfig.tsx
│   │   │   ├── ComponentPreview.tsx
│   │   │   └── AddSectionMenu.tsx
│   │   └── settings/               # Pillar 3 components
│   │       ├── LanguageSettings.tsx
│   │       ├── AdminAccessSettings.tsx
│   │       ├── ThemeEditor.tsx
│   │       ├── PublicationControls.tsx
│   │       ├── SharingSettings.tsx
│   │       └── ConversionLinks.tsx
│   │
│   ├── public/                     # Public catalog renderer components
│   │   ├── CatalogProvider.tsx
│   │   ├── ThemeProvider.tsx
│   │   ├── LanguageProvider.tsx
│   │   ├── CatalogHeader.tsx
│   │   ├── CatalogFooter.tsx
│   │   ├── PageRenderer.tsx
│   │   ├── SectionRenderer.tsx
│   │   ├── sections/
│   │   │   ├── HeroSection.tsx
│   │   │   ├── CollectionSection.tsx
│   │   │   ├── DetailSection.tsx
│   │   │   ├── RichTextSection.tsx
│   │   │   └── ImageBannerSection.tsx
│   │   ├── ProductCard.tsx
│   │   ├── ImageCarousel.tsx
│   │   ├── ColorSwatches.tsx
│   │   ├── VariantSelector.tsx
│   │   ├── ActionButtons.tsx
│   │   └── ImageZoom.tsx
│   │
│   └── ui/                         # shadcn/ui (unchanged)
│
├── lib/
│   ├── db.ts                       # Prisma client singleton
│   ├── utils.ts                    # cn() etc.
│   ├── constants.ts
│   ├── resolve-mappings.ts         # Column→UI resolution engine
│   ├── column-renderers.tsx        # CellRenderer per ColumnType
│   ├── csv-parser.ts               # PapaParse wrapper + type detection
│   ├── format.ts                   # Currency, date formatters
│   ├── i18n/                       # Internationalization
│   │   ├── fr.ts
│   │   ├── en.ts
│   │   └── ar.ts
│   └── stores/
│       ├── builder-store.ts
│       ├── data-store.ts
│       ├── layout-store.ts
│       ├── settings-store.ts
│       ├── catalog-store.ts
│       └── index.ts
│
└── types/
    ├── index.ts                    # Shared types
    ├── builder.ts                  # Builder-specific types
    └── catalog.ts                  # Public catalog types
```

## Appendix B: Dependencies to Add

```json
{
  "papaparse": "^5.4.1",        // CSV parsing
  "@types/papaparse": "^5.3.14", // CSV types
  "bcryptjs": "^2.4.3",          // Password hashing
  "@types/bcryptjs": "^2.4.6",
  "nanoid": "^5.0.7",            // Short IDs for slugs
  "zod": "^4.0.2"                // Already present — for API validation
}
```

## Appendix C: Key Type Definitions

```typescript
// src/types/builder.ts

export interface DataSource {
  id: string;
  name: string;
  slug: string;
  icon: string;
  color: string;
  sortOrder: number;
  columnCount?: number;
  rowCount?: number;
}

export interface Column {
  id: string;
  dataSourceId: string;
  name: string;
  slug: string;
  type: ColumnType;
  sortOrder: number;
  required: boolean;
  visible: boolean;
  defaultValue: string | null;
  arrayChildIds: string | null;   // JSON array of column IDs
  relationId: string | null;
}

export interface Row {
  id: string;
  dataSourceId: string;
  data: Record<string, any>;     // Parsed from JSON
  sortOrder: number;
}

export interface Relation {
  id: string;
  name: string;
  sourceColumnId: string;
  sourceTableId: string;
  targetTableId: string;
  type: 'MANY_TO_ONE' | 'ONE_TO_MANY' | 'MANY_TO_MANY';
}

export interface Section {
  id: string;
  pageId: string;
  type: SectionType;
  config: Record<string, any>;
  sortOrder: number;
  visible: boolean;
  components: Component[];
}

export interface Component {
  id: string;
  sectionId: string;
  type: ComponentType;
  mappings: ComponentMappings;
  style: Record<string, any>;
  sortOrder: number;
}

// The mapping shape varies by component type
export interface CollectionMappings {
  dataSourceId: string;
  title?: string;
  subtitle?: string;
  description?: string;
  coverImage?: string;
  price?: string;
  filterBy?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface DetailMappings {
  carouselImages?: string;    // Array column ID
  colorVariants?: string;     // Column ID
  sizeVariants?: string;      // Column ID
  extraFields?: Array<{
    label: string;
    columnId: string;
  }>;
  actionChannel?: 'whatsapp' | 'messenger' | 'email' | 'link';
}
```
