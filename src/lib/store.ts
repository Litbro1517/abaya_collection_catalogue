import { create } from 'zustand';
import type { DataSource, Column, Row, Catalog, Section, CatalogSettings, Pillar, AppView, Relation } from '@/types';

interface AppState {
  // ── Navigation ──
  view: AppView;
  setView: (view: AppView) => void;
  pillar: Pillar;
  setPillar: (pillar: Pillar) => void;

  // ── Auth ──
  isAdmin: boolean;
  setIsAdmin: (v: boolean) => void;
  showLoginModal: boolean;
  setShowLoginModal: (v: boolean) => void;

  // ── Data Pillar ──
  dataSources: DataSource[];
  setDataSources: (ds: DataSource[]) => void;
  activeDataSourceId: string | null;
  setActiveDataSourceId: (id: string | null) => void;
  activeDataSource: () => DataSource | null;
  columns: Column[];
  setColumns: (cols: Column[]) => void;
  rows: Row[];
  setRows: (rows: Row[]) => void;
  relations: Relation[];
  setRelations: (rels: Relation[]) => void;
  showImportModal: boolean;
  setShowImportModal: (v: boolean) => void;
  showColumnModal: boolean;
  setShowColumnModal: (v: boolean) => void;
  showRelationModal: boolean;
  setShowRelationModal: (v: boolean) => void;
  editingColumn: Column | null;
  setEditingColumn: (col: Column | null) => void;

  // ── Layout Pillar ──
  catalog: Catalog | null;
  setCatalog: (cat: Catalog | null) => void;
  activeSectionId: string | null;
  setActiveSectionId: (id: string | null) => void;
  showSectionConfig: boolean;
  setShowSectionConfig: (v: boolean) => void;
  editingSection: Section | null;
  setEditingSection: (s: Section | null) => void;
  detailProductId: string | null;
  setDetailProductId: (id: string | null) => void;

  // ── Settings ──
  settings: CatalogSettings | null;
  setSettings: (s: CatalogSettings | null) => void;

  // ── UI State ──
  loading: boolean;
  setLoading: (v: boolean) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (v: boolean) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  // ── Navigation ──
  view: 'builder',
  setView: (view) => set({ view }),
  pillar: 'data',
  setPillar: (pillar) => set({ pillar }),

  // ── Auth ──
  isAdmin: false,
  setIsAdmin: (isAdmin) => set({ isAdmin }),
  showLoginModal: false,
  setShowLoginModal: (showLoginModal) => set({ showLoginModal }),

  // ── Data Pillar ──
  dataSources: [],
  setDataSources: (dataSources) => set({ dataSources }),
  activeDataSourceId: null,
  setActiveDataSourceId: (activeDataSourceId) => set({ activeDataSourceId }),
  activeDataSource: () => {
    const state = get();
    return state.dataSources.find(ds => ds.id === state.activeDataSourceId) || null;
  },
  columns: [],
  setColumns: (columns) => set({ columns }),
  rows: [],
  setRows: (rows) => set({ rows }),
  relations: [],
  setRelations: (relations) => set({ relations }),
  showImportModal: false,
  setShowImportModal: (showImportModal) => set({ showImportModal }),
  showColumnModal: false,
  setShowColumnModal: (showColumnModal) => set({ showColumnModal }),
  showRelationModal: false,
  setShowRelationModal: (showRelationModal) => set({ showRelationModal }),
  editingColumn: null,
  setEditingColumn: (editingColumn) => set({ editingColumn }),

  // ── Layout Pillar ──
  catalog: null,
  setCatalog: (catalog) => set({ catalog }),
  activeSectionId: null,
  setActiveSectionId: (activeSectionId) => set({ activeSectionId }),
  showSectionConfig: false,
  setShowSectionConfig: (showSectionConfig) => set({ showSectionConfig }),
  editingSection: null,
  setEditingSection: (editingSection) => set({ editingSection }),
  detailProductId: null,
  setDetailProductId: (detailProductId) => set({ detailProductId }),

  // ── Settings ──
  settings: null,
  setSettings: (settings) => set({ settings }),

  // ── UI State ──
  loading: false,
  setLoading: (loading) => set({ loading }),
  sidebarCollapsed: false,
  setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
}));
