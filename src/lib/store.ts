import { create } from 'zustand';
import type { DataSource, Column, Row, Catalog, Section, CatalogSettings, Pillar, AppView, SettingsTab, Relation, GoogleSession, GoogleSheetInfo, SyncStatus } from '@/types';

// ── localStorage helpers for sidebar persistence ──
const LS_SIDEBAR_COLLAPSED = 'abaya_sidebarCollapsed';
const LS_DATA_PANEL_COLLAPSED = 'abaya_dataPanelCollapsed';
const LS_CLIENT_LOCALE = 'abaya_clientLocale';

function readBoolLS(key: string, fallback: boolean): boolean {
  if (typeof window === 'undefined') return fallback;
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v === 'true';
  } catch {
    return fallback;
  }
}

interface AppState {
  // ── Navigation ──
  view: AppView;
  setView: (view: AppView) => void;
  pillar: Pillar;
  setPillar: (pillar: Pillar) => void;
  settingsTab: SettingsTab;
  setSettingsTab: (tab: SettingsTab) => void;

  // ── Auth ──
  isAdmin: boolean;
  setIsAdmin: (v: boolean) => void;
  adminUser: { id: string; email: string; name: string | null; picture: string | null; role: string } | null;
  setAdminUser: (admin: AppState['adminUser']) => void;
  showLoginModal: boolean;
  setShowLoginModal: (v: boolean) => void;

  // ── Google Integration ──
  googleSession: GoogleSession | null;
  setGoogleSession: (s: GoogleSession | null) => void;
  googleSheets: GoogleSheetInfo[];
  setGoogleSheets: (s: GoogleSheetInfo[]) => void;
  showGoogleSheetsBrowser: boolean;
  setShowGoogleSheetsBrowser: (v: boolean) => void;
  syncStatus: SyncStatus;
  setSyncStatus: (s: SyncStatus) => void;
  syncMessage: string;
  setSyncMessage: (m: string) => void;

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

  // ── Client Locale (independent of admin settings) ──
  clientLocale: string;
  setClientLocale: (locale: string) => void;

  // ── UI State ──
  loading: boolean;
  setLoading: (v: boolean) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (v: boolean) => void;
  dataPanelCollapsed: boolean;
  setDataPanelCollapsed: (v: boolean) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  // ── Navigation ──
  view: 'builder',
  setView: (view) => set({ view }),
  pillar: 'data',
  setPillar: (pillar) => set({ pillar }),
  settingsTab: 'general',
  setSettingsTab: (settingsTab) => set({ settingsTab }),

  // ── Auth ──
  isAdmin: false,
  setIsAdmin: (isAdmin) => set({ isAdmin }),
  adminUser: null,
  setAdminUser: (adminUser) => set({ adminUser }),
  showLoginModal: false,
  setShowLoginModal: (showLoginModal) => set({ showLoginModal }),

  // ── Google Integration ──
  googleSession: null,
  setGoogleSession: (googleSession) => set({ googleSession }),
  googleSheets: [],
  setGoogleSheets: (googleSheets) => set({ googleSheets }),
  showGoogleSheetsBrowser: false,
  setShowGoogleSheetsBrowser: (showGoogleSheetsBrowser) => set({ showGoogleSheetsBrowser }),
  syncStatus: 'idle',
  setSyncStatus: (syncStatus) => set({ syncStatus }),
  syncMessage: '',
  setSyncMessage: (syncMessage) => set({ syncMessage }),

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

  // ── Client Locale ──
  clientLocale: typeof window !== 'undefined' ? (localStorage.getItem(LS_CLIENT_LOCALE) || 'fr') : 'fr',
  setClientLocale: (clientLocale) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(LS_CLIENT_LOCALE, clientLocale);
    }
    set({ clientLocale });
  },

  // ── UI State ──
  loading: false,
  setLoading: (loading) => set({ loading }),
  sidebarCollapsed: readBoolLS(LS_SIDEBAR_COLLAPSED, false),
  setSidebarCollapsed: (sidebarCollapsed) => {
    try { localStorage.setItem(LS_SIDEBAR_COLLAPSED, String(sidebarCollapsed)); } catch {}
    set({ sidebarCollapsed });
  },
  dataPanelCollapsed: readBoolLS(LS_DATA_PANEL_COLLAPSED, false),
  setDataPanelCollapsed: (dataPanelCollapsed) => {
    try { localStorage.setItem(LS_DATA_PANEL_COLLAPSED, String(dataPanelCollapsed)); } catch {}
    set({ dataPanelCollapsed });
  },
}));
