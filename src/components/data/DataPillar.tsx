'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAppStore } from '@/lib/store';
import type { DataSource, Column } from '@/types';
import { DataTable } from './DataTable';
import { ImportCSVDialog } from './ImportCSVDialog';
import { ColumnEditorDialog } from './ColumnEditorDialog';
import { GoogleSheetsBrowser } from './GoogleSheetsBrowser';
import { GoogleConnectPanel } from './GoogleConnectPanel';
import { SyncStatusIndicator } from './SyncStatusIndicator';
import { ColumnVisibilityDropdown } from './ColumnVisibilityDropdown';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Plus, Upload, Download, Link2, Sheet, RefreshCw, HardDrive,
  Trash2, Pencil, MoreVertical, Search, Filter, ArrowUpDown,
  ArrowUp, ArrowDown, X, Type, Hash, Banknote, Image as ImageIcon, Images,
  ChevronDown, ListChecks, Layers, ToggleRight, ExternalLink, Link2 as LinkIcon,
  Clock, Calendar, ChevronRight, Minus, Activity, ArrowRightLeft,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// Column type icon mapping for filter/sort popovers
const COL_TYPE_ICON: Record<string, React.ReactNode> = {
  TEXT: <Type className="w-3 h-3" />,
  NUMBER: <Hash className="w-3 h-3" />,
  CURRENCY: <Banknote className="w-3 h-3" />,
  IMAGE: <ImageIcon className="w-3 h-3" />,
  IMAGE_ARRAY: <Images className="w-3 h-3" />,
  SELECT: <ChevronDown className="w-3 h-3" />,
  MULTI_SELECT: <ListChecks className="w-3 h-3" />,
  RELATION: <LinkIcon className="w-3 h-3" />,
  ARRAY: <Layers className="w-3 h-3" />,
  BOOLEAN: <ToggleRight className="w-3 h-3" />,
  URL: <ExternalLink className="w-3 h-3" />,
  STATUS: <Activity className="w-3 h-3" />,
};

// ── Operator definitions by column type ────────────────────────────────────
interface OperatorDef {
  value: string;
  label: string;
  needsValue: boolean;
}

const OPERATORS_BY_TYPE: Record<string, OperatorDef[]> = {
  TEXT: [
    { value: 'equals', label: 'Égal à', needsValue: true },
    { value: 'doesn\'t_equal', label: 'N\'est pas égal à', needsValue: true },
    { value: 'contains', label: 'Contient', needsValue: true },
    { value: 'doesn\'t_contain', label: 'Ne contient pas', needsValue: true },
    { value: 'is_empty', label: 'Est vide', needsValue: false },
    { value: 'is_not_empty', label: 'N\'est pas vide', needsValue: false },
  ],
  NUMBER: [
    { value: 'equals', label: 'Égal à', needsValue: true },
    { value: 'doesn\'t_equal', label: 'N\'est pas égal à', needsValue: true },
    { value: 'is_less_than', label: 'Inférieur à', needsValue: true },
    { value: 'is_greater_than', label: 'Supérieur à', needsValue: true },
    { value: 'is_less_or_equal', label: 'Inférieur ou égal à', needsValue: true },
    { value: 'is_greater_or_equal', label: 'Supérieur ou égal à', needsValue: true },
    { value: 'is_empty', label: 'Est vide', needsValue: false },
    { value: 'is_not_empty', label: 'N\'est pas vide', needsValue: false },
  ],
  CURRENCY: [
    { value: 'equals', label: 'Égal à', needsValue: true },
    { value: 'doesn\'t_equal', label: 'N\'est pas égal à', needsValue: true },
    { value: 'is_less_than', label: 'Inférieur à', needsValue: true },
    { value: 'is_greater_than', label: 'Supérieur à', needsValue: true },
    { value: 'is_less_or_equal', label: 'Inférieur ou égal à', needsValue: true },
    { value: 'is_greater_or_equal', label: 'Supérieur ou égal à', needsValue: true },
    { value: 'is_empty', label: 'Est vide', needsValue: false },
    { value: 'is_not_empty', label: 'N\'est pas vide', needsValue: false },
  ],
  BOOLEAN: [
    { value: 'is_true', label: 'Est vrai', needsValue: false },
    { value: 'is_false', label: 'Est faux', needsValue: false },
    { value: 'is_empty', label: 'Est vide', needsValue: false },
    { value: 'is_not_empty', label: 'N\'est pas vide', needsValue: false },
  ],
  SELECT: [
    { value: 'equals', label: 'Égal à', needsValue: true },
    { value: 'doesn\'t_equal', label: 'N\'est pas égal à', needsValue: true },
    { value: 'contains', label: 'Contient', needsValue: true },
    { value: 'is_empty', label: 'Est vide', needsValue: false },
    { value: 'is_not_empty', label: 'N\'est pas vide', needsValue: false },
  ],
  MULTI_SELECT: [
    { value: 'equals', label: 'Égal à', needsValue: true },
    { value: 'doesn\'t_equal', label: 'N\'est pas égal à', needsValue: true },
    { value: 'contains', label: 'Contient', needsValue: true },
    { value: 'is_empty', label: 'Est vide', needsValue: false },
    { value: 'is_not_empty', label: 'N\'est pas vide', needsValue: false },
  ],
  IMAGE: [
    { value: 'is_empty', label: 'Est vide', needsValue: false },
    { value: 'is_not_empty', label: 'N\'est pas vide', needsValue: false },
    { value: 'contains', label: 'Contient', needsValue: true },
  ],
  IMAGE_ARRAY: [
    { value: 'is_empty', label: 'Est vide', needsValue: false },
    { value: 'is_not_empty', label: 'N\'est pas vide', needsValue: false },
    { value: 'contains', label: 'Contient', needsValue: true },
  ],
  URL: [
    { value: 'is_empty', label: 'Est vide', needsValue: false },
    { value: 'is_not_empty', label: 'N\'est pas vide', needsValue: false },
    { value: 'contains', label: 'Contient', needsValue: true },
  ],
  RELATION: [
    { value: 'is_empty', label: 'Est vide', needsValue: false },
    { value: 'is_not_empty', label: 'N\'est pas vide', needsValue: false },
    { value: 'contains', label: 'Contient', needsValue: true },
  ],
  ARRAY: [
    { value: 'is_empty', label: 'Est vide', needsValue: false },
    { value: 'is_not_empty', label: 'N\'est pas vide', needsValue: false },
    { value: 'contains', label: 'Contient', needsValue: true },
  ],
  STATUS: [
    { value: 'equals', label: 'Égal à', needsValue: true },
    { value: 'doesn\'t_equal', label: 'N\'est pas égal à', needsValue: true },
    { value: 'is_empty', label: 'Est vide', needsValue: false },
    { value: 'is_not_empty', label: 'N\'est pas vide', needsValue: false },
    { value: 'is_nouveau', label: '🟢 Nouveau', needsValue: false },
    { value: 'is_courant', label: '🔵 Courant', needsValue: false },
  ],
};

function getOperatorsForType(colType: string): OperatorDef[] {
  return OPERATORS_BY_TYPE[colType] || OPERATORS_BY_TYPE.TEXT;
}

// ── Filter / Sort types ────────────────────────────────────────────────────
export interface FilterConfig {
  columnSlug: string;
  columnName: string;
  columnType: string;
  operator: string;
  value: string;
}

export interface SortConfig {
  columnSlug: string;
  columnName: string;
  direction: 'asc' | 'desc';
}

// ── Filter logic ───────────────────────────────────────────────────────────
function applyFilter(val: unknown, filter: FilterConfig): boolean {
  const { operator, value: filterValue } = filter;

  // For operators that need a value, pass all rows if no value is provided yet
  const needsValueOperators = ['equals', "doesn't_equal", 'contains', "doesn't_contain", 'is_less_than', 'is_greater_than', 'is_less_or_equal', 'is_greater_or_equal'];
  if (needsValueOperators.includes(operator) && !filterValue.trim()) {
    return true; // Don't filter until user provides a value
  }

  switch (operator) {
    case 'equals':
      return String(val ?? '').toLowerCase() === filterValue.toLowerCase();
    case 'doesn\'t_equal':
      return String(val ?? '').toLowerCase() !== filterValue.toLowerCase();
    case 'contains':
      return String(val ?? '').toLowerCase().includes(filterValue.toLowerCase());
    case 'doesn\'t_contain':
      return !String(val ?? '').toLowerCase().includes(filterValue.toLowerCase());
    case 'is_empty':
      return val === null || val === undefined || val === '';
    case 'is_not_empty':
      return val !== null && val !== undefined && val !== '';
    case 'is_less_than':
      return Number(val) < Number(filterValue);
    case 'is_greater_than':
      return Number(val) > Number(filterValue);
    case 'is_less_or_equal':
      return Number(val) <= Number(filterValue);
    case 'is_greater_or_equal':
      return Number(val) >= Number(filterValue);
    case 'is_true':
      return val === true || val === 'true';
    case 'is_false':
      return val === false || val === 'false';
    case 'is_nouveau':
      return String(val ?? '').toLowerCase() === 'nouveau';
    case 'is_courant':
      return String(val ?? '').toLowerCase() === 'courant';
    default:
      return true;
  }
}

export function DataPillar() {
  const {
    activeDataSourceId,
    setActiveDataSourceId,
    dataSources,
    setDataSources,
    columns,
    setColumns,
    rows,
    setRows,
    showImportModal,
    setShowImportModal,
    showColumnModal,
    setShowColumnModal,
    showGoogleSheetsBrowser,
    setShowGoogleSheetsBrowser,
    setSyncStatus,
    setSyncMessage,
  } = useAppStore();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newColor, setNewColor] = useState('#C9A84C');
  const [loading, setLoading] = useState(false);
  const [showUrlDialog, setShowUrlDialog] = useState(false);
  const [manualUrl, setManualUrl] = useState('');

  // Table management states
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [showDeleteTableDialog, setShowDeleteTableDialog] = useState(false);

  // Toolbar states
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<FilterConfig[]>([]);
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);

  // Popover open states
  const [filterPopoverOpen, setFilterPopoverOpen] = useState(false);
  const [sortPopoverOpen, setSortPopoverOpen] = useState(false);

  // Filter popover internal state
  const [filterSearch, setFilterSearch] = useState('');
  const [activeFilterColSlug, setActiveFilterColSlug] = useState<string | null>(null);

  // Sort popover internal state
  const [sortSearch, setSortSearch] = useState('');

  // Pending status changes (local only, not yet synced to DB)
  const [pendingStatusChanges, setPendingStatusChanges] = useState<Record<string, { statut: string; locked: boolean }>>({});

  const colors = ['#C9A84C', '#1A1A1A', '#D32F2F', '#2E7D32', '#1565C0', '#8B4513', '#F48FB1', '#483C32'];

  // Active data source
  const activeDs = dataSources.find(d => d.id === activeDataSourceId);
  const hasGoogleSheet = !!activeDs?.sheetId;

  // ── Filtered + sorted rows ──────────────────────────────────────────────
  const filteredRows = useMemo(() => {
    let result = rows;

    // Text search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(row => {
        const data = row.data as Record<string, unknown>;
        return Object.values(data).some(val => {
          if (val === null || val === undefined) return false;
          return String(val).toLowerCase().includes(q);
        });
      });
    }

    // Column filters with operators
    if (filters.length > 0) {
      result = result.filter(row => {
        const data = row.data as Record<string, unknown>;
        return filters.every(f => {
          let val = data[f.columnSlug];
          // STATUS columns: always read from __statut__ and overlay pending
          const filterCol = columns.find(c => c.slug === f.columnSlug);
          if (filterCol?.type === 'STATUS' || f.columnSlug === '__statut__') {
            const pending = pendingStatusChanges?.[row.id];
            val = pending?.statut ?? data.__statut__;
          }
          return applyFilter(val, f);
        });
      });
    }

    // Sort
    if (sortConfig) {
      result = [...result].sort((a, b) => {
        // Special sort: by creation date (Nouveau/Courant presets)
        if (sortConfig.columnSlug === '__created_desc__') {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        if (sortConfig.columnSlug === '__created_asc__') {
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        }

        // Special sort: by Statut (Nouveau first, then Courant)
        if (sortConfig.columnSlug === '__statut__') {
          const aStatut = (a.data as Record<string, unknown>).__statut__ || 'Courant';
          const bStatut = (b.data as Record<string, unknown>).__statut__ || 'Courant';
          const cmp = aStatut === 'Nouveau' ? (bStatut === 'Nouveau' ? 0 : -1) : 1;
          return sortConfig.direction === 'asc' ? cmp : -cmp;
        }

        // Regular column sort
        const aData = a.data as Record<string, unknown>;
        const bData = b.data as Record<string, unknown>;
        const aVal = aData[sortConfig.columnSlug];
        const bVal = bData[sortConfig.columnSlug];

        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;

        const aStr = String(aVal);
        const bStr = String(bVal);

        // Try numeric comparison
        const aNum = Number(aVal);
        const bNum = Number(bVal);
        if (!isNaN(aNum) && !isNaN(bNum)) {
          return sortConfig.direction === 'asc' ? aNum - bNum : bNum - aNum;
        }

        return sortConfig.direction === 'asc'
          ? aStr.localeCompare(bStr)
          : bStr.localeCompare(aStr);
      });
    }

    return result;
  }, [rows, searchQuery, filters, sortConfig, pendingStatusChanges, columns]);

  // ── Filter helpers ──────────────────────────────────────────────────────

  const addOrUpdateFilter = (col: Column, operator: string, value: string) => {
    const opDef = getOperatorsForType(col.type).find(o => o.value === operator);
    if (!opDef) return;

    // For value-needing operators with empty value, still add the filter
    // but it won't actually filter rows until a value is provided
    // (applyFilter handles this by matching empty filter value against all rows)

    const effectiveSlug = col.type === 'STATUS' ? '__statut__' : col.slug;
    setFilters(prev => {
      const existing = prev.findIndex(f => f.columnSlug === effectiveSlug);
      const newFilter: FilterConfig = {
        columnSlug: effectiveSlug,
        columnName: col.name,
        columnType: col.type,
        operator,
        value,
      };
      if (existing >= 0) {
        const next = [...prev];
        next[existing] = newFilter;
        return next;
      }
      return [...prev, newFilter];
    });
  };

  const removeFilter = (columnSlug: string) => {
    const col = columns.find(c => c.slug === columnSlug);
    const effectiveSlug = col?.type === 'STATUS' ? '__statut__' : columnSlug;
    setFilters(prev => prev.filter(f => f.columnSlug !== effectiveSlug));
    if (activeFilterColSlug === columnSlug) {
      setActiveFilterColSlug(null);
    }
  };

  const clearAllFilters = () => {
    setFilters([]);
    setActiveFilterColSlug(null);
  };

  // ── Sort helpers ────────────────────────────────────────────────────────

  const cycleSort = (col: Column) => {
    setSortConfig(prev => {
      if (!prev || prev.columnSlug !== col.slug) {
        return { columnSlug: col.slug, columnName: col.name, direction: 'asc' };
      }
      if (prev.direction === 'asc') {
        return { columnSlug: col.slug, columnName: col.name, direction: 'desc' };
      }
      // Third click: remove sort
      return null;
    });
  };

  const setSortDirect = (colSlug: string, colName: string, direction: 'asc' | 'desc') => {
    setSortConfig({ columnSlug: colSlug, columnName: colName, direction });
  };

  const clearSort = () => {
    setSortConfig(null);
  };

  // ── Pending status change helpers ──────────────────────────────────────

  const handleLocalStatusChange = (rowId: string, newStatut: string) => {
    // Do NOT update the store rows — changes are held in pending state only.
    // The store will be refreshed from DB only after sync button is clicked.
    // DataTable reads pendingStatusChanges as overlay to display the pending value.
    setPendingStatusChanges(prev => ({
      ...prev,
      [rowId]: { statut: newStatut, locked: prev[rowId]?.locked ?? !!(rows.find(r => r.id === rowId)?.data as Record<string, unknown>).__statut_locked__ }
    }));
  };

  const handleLocalLockToggle = (rowId: string, currentLocked: boolean) => {
    // Do NOT update the store rows — changes are held in pending state only.
    // The store will be refreshed from DB only after sync button is clicked.
    setPendingStatusChanges(prev => ({
      ...prev,
      [rowId]: {
        statut: prev[rowId]?.statut ?? String((rows.find(r => r.id === rowId)?.data as Record<string, unknown>).__statut__ || 'Courant'),
        locked: !currentLocked
      }
    }));
  };

  // ── Filtered columns for popovers ───────────────────────────────────────

  const visibleColumns = useMemo(() => columns.filter(c => c.visible), [columns]);

  const filteredColumnsForFilter = useMemo(() => {
    if (!filterSearch.trim()) return visibleColumns;
    const q = filterSearch.toLowerCase();
    return visibleColumns.filter(c => c.name.toLowerCase().includes(q) || c.type.toLowerCase().includes(q));
  }, [visibleColumns, filterSearch]);

  const filteredColumnsForSort = useMemo(() => {
    if (!sortSearch.trim()) return visibleColumns;
    const q = sortSearch.toLowerCase();
    return visibleColumns.filter(c => c.name.toLowerCase().includes(q) || c.type.toLowerCase().includes(q));
  }, [visibleColumns, sortSearch]);

  // ── Get current filter for a column ─────────────────────────────────────
  const getFilterForColumn = (colSlug: string): FilterConfig | undefined => {
    // For STATUS columns, check both the original slug and __statut__
    const col = columns.find(c => c.slug === colSlug);
    if (col?.type === 'STATUS') {
      return filters.find(f => f.columnSlug === '__statut__' || f.columnSlug === colSlug);
    }
    return filters.find(f => f.columnSlug === colSlug);
  };

  // ── Operator label for display ──────────────────────────────────────────
  const getOperatorLabel = (colType: string, operator: string): string => {
    const ops = getOperatorsForType(colType);
    return ops.find(o => o.value === operator)?.label || operator;
  };

  // Load data sources
  const loadDataSources = useCallback(async () => {
    try {
      const res = await fetch('/api/datasources');
      if (res.ok) {
        const json = await res.json();
        setDataSources(json.data || []);
      }
    } catch {
      // silent
    }
  }, [setDataSources]);

  useEffect(() => {
    loadDataSources();
  }, [loadDataSources]);

  // Load columns and rows when active data source changes
  const loadDataSourceData = useCallback(async () => {
    if (!activeDataSourceId) return;
    setLoading(true);
    try {
      const metaRes = await fetch(`/api/datasources/${activeDataSourceId}?mode=meta`);
      if (metaRes.ok) {
        const metaJson = await metaRes.json();
        if (metaJson.data) {
          setColumns(metaJson.data.columns || []);
        }
      }
      const rowsRes = await fetch(`/api/datasources/${activeDataSourceId}/rows?limit=50`);
      if (rowsRes.ok) {
        const rowsJson = await rowsRes.json();
        setRows(rowsJson.data || []);
      }
    } catch (err) {
      console.error('Failed to load data source:', err);
      toast.error('Erreur de chargement des données');
    } finally {
      setLoading(false);
    }
  }, [activeDataSourceId, setColumns, setRows]);

  useEffect(() => {
    loadDataSourceData();
  }, [loadDataSourceData]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      const res = await fetch('/api/datasources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, description: newDesc, color: newColor, sourceType: 'manual' }),
      });
      if (res.ok) {
        toast.success('Table créée avec succès');
        setShowCreateDialog(false);
        setNewName('');
        setNewDesc('');
        loadDataSources();
      }
    } catch {
      toast.error('Erreur lors de la création');
    }
  };

  const handleRenameTable = async () => {
    if (!activeDataSourceId || !renameValue.trim()) return;
    try {
      const res = await fetch(`/api/datasources/${activeDataSourceId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: renameValue.trim() }),
      });
      if (res.ok) {
        toast.success('Table renommée');
        loadDataSources();
        setShowRenameDialog(false);
      }
    } catch {
      toast.error('Erreur de renommage');
    }
  };

  const handleDeleteTable = async () => {
    if (!activeDataSourceId) return;
    try {
      const res = await fetch(`/api/datasources/${activeDataSourceId}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Table supprimée');
        setActiveDataSourceId(null);
        loadDataSources();
        setShowDeleteTableDialog(false);
      }
    } catch {
      toast.error('Erreur de suppression');
    }
  };

  const handleExport = async () => {
    if (!activeDataSourceId) return;
    try {
      const res = await fetch(`/api/datasources/${activeDataSourceId}/export`);
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${activeDs?.name || 'catalogue'}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Export réussi');
      }
    } catch {
      toast.error('Erreur d\'export');
    }
  };

  /**
   * ━━━ DELTA SYNC — "Synchroniser" dropdown button handler ━━━
   * Uses delta reconciliation: only inserts missing rows by "#" column
   * Auto-initializes: Statut="Courant", Disponibilité=OFF, Visibilité=Visible
   * NEVER overwrites existing data
   */
  const handleSyncGoogleSheet = async () => {
    if (!activeDataSourceId) return;
    const ds = dataSources.find(d => d.id === activeDataSourceId);
    if (!ds?.sheetId) return;

    setSyncStatus('syncing');
    setSyncMessage('Synchronisation Delta en cours...');
    try {
      const res = await fetch('/api/google/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sheetId: ds.sheetId, dataSourceId: ds.id, mode: 'delta' }),
      });
      if (res.ok) {
        const json = await res.json();
        const data = json.data;
        setSyncStatus('success');

        if (data.rowsCreated > 0) {
          setSyncMessage(`Delta: ${data.rowsCreated} nouveau(x) produit(s) ajouté(s), ${data.rowsSkipped} existant(s) préservé(s)`);
          toast.success(`Synchronisation Delta: ${data.rowsCreated} nouveau(x) produit(s)`, {
            description: `Statut=Courant · Disponibilité=Épuisé · Visibilité=Visible 👁️`,
          });
        } else {
          setSyncMessage('Catalogue à jour — aucun nouveau produit');
          toast.info('Catalogue à jour', {
            description: 'Aucun nouveau produit à ajouter depuis Google Sheets',
          });
        }

        loadDataSourceData();
        loadDataSources();
        setTimeout(() => setSyncStatus('idle'), 3000);
      } else {
        const json = await res.json();
        setSyncStatus('error');
        setSyncMessage(json.error || 'Erreur de synchronisation');
        toast.error(json.error || 'Erreur de synchronisation Delta');
        setTimeout(() => setSyncStatus('idle'), 5000);
      }
    } catch {
      setSyncStatus('error');
      setSyncMessage('Erreur de connexion');
      toast.error('Erreur de connexion');
      setTimeout(() => setSyncStatus('idle'), 5000);
    }
  };

  const handleManualUrlImport = async () => {
    if (!manualUrl.trim()) return;
    const match = manualUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
    if (!match) {
      toast.error('URL de Google Sheets invalide');
      return;
    }
    const sheetId = match[1];
    setSyncStatus('syncing');
    setSyncMessage('Importation en cours...');
    try {
      const res = await fetch('/api/google/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sheetId,
          dataSourceName: 'Google Sheet (public)',
        }),
      });
      if (res.ok) {
        setSyncStatus('success');
        setSyncMessage('Données importées');
        toast.success('Données importées avec succès');
        setShowUrlDialog(false);
        setManualUrl('');
        loadDataSources();
        setTimeout(() => setSyncStatus('idle'), 3000);
      } else {
        const json = await res.json();
        setSyncStatus('error');
        setSyncMessage(json.error || 'Erreur d\'importation');
        toast.error(json.error || 'Erreur d\'importation');
        setTimeout(() => setSyncStatus('idle'), 5000);
      }
    } catch {
      setSyncStatus('error');
      setSyncMessage('Erreur de connexion');
      setTimeout(() => setSyncStatus('idle'), 5000);
    }
  };

  // Column visibility toggle
  const handleToggleColumnVisibility = async (col: Column) => {
    try {
      await fetch(`/api/datasources/${activeDataSourceId}/columns/${col.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visible: !col.visible }),
      });
      loadDataSourceData();
      toast.success(col.visible ? 'Colonne masquée' : 'Colonne affichée');
    } catch {
      toast.error('Erreur');
    }
  };

  const handleShowAllColumns = async () => {
    const hiddenCols = columns.filter(c => !c.visible);
    try {
      await Promise.all(
        hiddenCols.map(col =>
          fetch(`/api/datasources/${activeDataSourceId}/columns/${col.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ visible: true }),
          })
        )
      );
      loadDataSourceData();
      toast.success(`${hiddenCols.length} colonne(s) affichée(s)`);
    } catch {
      toast.error('Erreur');
    }
  };

  const handleHideAllColumns = async () => {
    const visibleCols = columns.filter(c => c.visible);
    try {
      await Promise.all(
        visibleCols.map(col =>
          fetch(`/api/datasources/${activeDataSourceId}/columns/${col.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ visible: false }),
          })
        )
      );
      loadDataSourceData();
      toast.success(`${visibleCols.length} colonne(s) masquée(s)`);
    } catch {
      toast.error('Erreur');
    }
  };

  return (
    <div className="flex h-full">
      {/* Left: Data source list */}
      <div className="w-64 border-r border-border bg-card overflow-y-auto shrink-0">
        <div className="p-3 space-y-3">
          {/* Google Connect Panel */}
          <GoogleConnectPanel />

          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Tables de données</h2>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setShowCreateDialog(true)}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          {/* Data source list with delete option */}
          <div className="space-y-1">
            {dataSources.length === 0 && (
              <div className="text-center py-6 text-muted-foreground">
                <HardDrive className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-xs">Aucune table</p>
                <p className="text-[10px] mt-1">Créez ou importez une table</p>
              </div>
            )}
            {dataSources.map(ds => (
              <div
                key={ds.id}
                className={`group flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-all ${
                  activeDataSourceId === ds.id
                    ? 'bg-gold/10 border border-gold/20'
                    : 'hover:bg-muted border border-transparent'
                }`}
                onClick={() => setActiveDataSourceId(ds.id)}
              >
                <div
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: ds.color }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <p className="text-sm font-medium truncate">{ds.name}</p>
                    {ds.sheetId && (
                      <Sheet className="w-3 h-3 text-green-600 shrink-0" title="Google Sheets" />
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    {(ds as DataSource & { columnCount?: number; rowCount?: number }).rowCount ?? 0} lignes
                  </p>
                </div>
                {/* Delete table button */}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Trash2 className="w-3 h-3 text-destructive" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Supprimer « {ds.name} » ?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Cette action supprimera la table et toutes ses données (colonnes et lignes). Cette action est irréversible.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive text-white hover:bg-destructive/90"
                        onClick={async () => {
                          await fetch(`/api/datasources/${ds.id}`, { method: 'DELETE' });
                          if (activeDataSourceId === ds.id) setActiveDataSourceId(null);
                          loadDataSources();
                          toast.success('Table supprimée');
                        }}
                      >
                        Supprimer
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right: Data table + toolbar */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {activeDataSourceId && activeDs && (
          <>
            {/* ── Table name row ── */}
            <div className="h-10 border-b border-border bg-card shrink-0 px-4 flex items-center gap-2.5">
              <div
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: activeDs.color }}
              />
              <span className="text-sm font-semibold truncate">{activeDs.name}</span>
              {activeDs.sheetId && (
                <Badge variant="outline" className="text-[9px] gap-1 py-0 border-green-300 text-green-700">
                  <Sheet className="w-2.5 h-2.5" /> Google
                </Badge>
              )}
              <SyncStatusIndicator />
              <div className="flex-1" />
              <span className="text-[10px] text-muted-foreground mr-1">
                {rows.length} lignes · {columns.filter(c => c.visible).length}/{columns.length} colonnes
              </span>
              {/* Table management dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-secondary">
                    <MoreVertical className="w-3.5 h-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem onClick={() => { setRenameValue(activeDs.name); setShowRenameDialog(true); }}>
                    <Pencil className="w-3.5 h-3.5 mr-2" /> Renommer la table
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setShowImportModal(true)}>
                    <Upload className="w-3.5 h-3.5 mr-2" /> Importer CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowGoogleSheetsBrowser(true)}>
                    <Sheet className="w-3.5 h-3.5 mr-2" /> Google Sheets
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowUrlDialog(true)}>
                    <Link2 className="w-3.5 h-3.5 mr-2" /> Importer par URL
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleExport}>
                    <Download className="w-3.5 h-3.5 mr-2" /> Exporter CSV
                  </DropdownMenuItem>
                  {hasGoogleSheet && (
                    <DropdownMenuItem onClick={handleSyncGoogleSheet}>
                      <RefreshCw className="w-3.5 h-3.5 mr-2" /> Synchroniser
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setShowDeleteTableDialog(true)}>
                    <Trash2 className="w-3.5 h-3.5 mr-2" /> Supprimer la table
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* ── Toolbar row ── Search + Filter + Sort + Hide + Add column ── */}
            <div className="border-b border-border/60 bg-card/80 shrink-0 px-3 py-1.5 flex items-center gap-2 flex-wrap">
              {/* Search */}
              <div className="relative max-w-[220px] flex-1 min-w-[140px]">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Rechercher dans les données..."
                  className="h-7 text-xs pl-7 pr-7 bg-muted/30 border-border/40 focus:border-[#C9A84C]/50 focus:ring-[#C9A84C]/20"
                />
                {searchQuery && (
                  <button
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-muted-foreground/20 hover:bg-muted-foreground/40 flex items-center justify-center transition-colors"
                    onClick={() => setSearchQuery('')}
                  >
                    <X className="w-2.5 h-2.5 text-muted-foreground" />
                  </button>
                )}
              </div>

              {/* ── Filter Popover ── */}
              <Popover open={filterPopoverOpen} onOpenChange={(open) => {
                setFilterPopoverOpen(open);
                if (!open) {
                  setFilterSearch('');
                  setActiveFilterColSlug(null);
                }
              }}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      "h-7 text-xs gap-1.5 transition-colors",
                      filters.length > 0
                        ? "border-[#C9A84C]/40 bg-[#C9A84C]/5 text-[#C9A84C] hover:bg-[#C9A84C]/10"
                        : "hover:bg-muted"
                    )}
                  >
                    <Filter className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Filtrer</span>
                    {filters.length > 0 && (
                      <span className="ml-0.5 w-4 h-4 rounded-full bg-[#C9A84C]/20 text-[#C9A84C] text-[9px] font-bold flex items-center justify-center">
                        {filters.length}
                      </span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-80 p-0 shadow-lg border-border/60" sideOffset={4}>
                  {/* Filter header */}
                  <div className="px-3 pt-3 pb-2">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-foreground tracking-wide">
                        Filtrer
                      </span>
                      {filters.length > 0 && (
                        <button
                          className="text-[10px] text-[#C9A84C] hover:text-[#C9A84C]/80 font-medium transition-colors"
                          onClick={clearAllFilters}
                        >
                          Effacer tout
                        </button>
                      )}
                    </div>
                    {/* Search columns */}
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                      <Input
                        value={filterSearch}
                        onChange={e => setFilterSearch(e.target.value)}
                        placeholder="Rechercher une colonne..."
                        className="h-7 text-xs pl-7 bg-muted/30 border-border/40 focus:border-[#C9A84C]/50 focus:ring-[#C9A84C]/20"
                      />
                    </div>
                  </div>
                  <Separator className="bg-border/40" />
                  {/* Column list — vertical compact */}
                  <div className="max-h-64 overflow-y-auto py-1 custom-scrollbar">
                    {filteredColumnsForFilter.map(col => {
                      const existingFilter = getFilterForColumn(col.slug);
                      const isActive = activeFilterColSlug === col.slug;

                      return (
                        <div key={col.id}>
                          <button
                            className={cn(
                              "w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors",
                              "hover:bg-secondary/60",
                              (isActive || existingFilter) && "bg-[#C9A84C]/5"
                            )}
                            onClick={() => {
                              if (activeFilterColSlug === col.slug) {
                                setActiveFilterColSlug(null);
                              } else {
                                setActiveFilterColSlug(col.slug);
                              }
                            }}
                          >
                            <div className="w-5 h-5 rounded bg-primary/10 text-primary flex items-center justify-center shrink-0">
                              {COL_TYPE_ICON[col.type] || <Type className="w-3 h-3" />}
                            </div>
                            <span className={cn(
                              "text-xs truncate flex-1",
                              existingFilter ? "text-foreground font-medium" : "text-foreground"
                            )}>
                              {col.name}
                            </span>
                            {existingFilter && (
                              <Badge className="text-[9px] bg-[#C9A84C]/15 text-[#C9A84C] border-[#C9A84C]/30 hover:bg-[#C9A84C]/25">
                                {getOperatorLabel(col.type, existingFilter.operator)}
                                {existingFilter.value ? ` ${existingFilter.value}` : (getOperatorsForType(col.type).find(o => o.value === existingFilter.operator)?.needsValue ? ' …' : '')}
                              </Badge>
                            )}
                            <ChevronRight className={cn(
                              "w-3 h-3 text-muted-foreground shrink-0 transition-transform",
                              isActive && "rotate-90"
                            )} />
                          </button>

                          {/* Expanded filter section for this column */}
                          {isActive && (
                            <div className="px-3 pb-2 ml-5 border-l-2 border-[#C9A84C]/20">
                              {/* Operator chips — clickable buttons */}
                              <div className="mt-1 mb-1.5 flex flex-wrap gap-1">
                                {getOperatorsForType(col.type).map(op => {
                                  const isActiveOp = existingFilter?.operator === op.value;
                                  return (
                                    <button
                                      key={op.value}
                                      className={cn(
                                        "px-2 py-0.5 rounded text-[10px] font-medium transition-all cursor-pointer border",
                                        isActiveOp
                                          ? "bg-[#C9A84C]/15 text-[#C9A84C] border-[#C9A84C]/40 shadow-sm"
                                          : "bg-muted/30 text-muted-foreground border-border/40 hover:bg-muted/60 hover:text-foreground hover:border-border"
                                      )}
                                      onClick={() => {
                                        if (!op.needsValue) {
                                          // No-value operators: apply immediately
                                          addOrUpdateFilter(col, op.value, '');
                                        } else {
                                          // Value-needing operators: set operator, keep existing value or clear
                                          const currentVal = existingFilter?.value || '';
                                          if (currentVal) {
                                            addOrUpdateFilter(col, op.value, currentVal);
                                          } else {
                                            // Just set the operator in the filter with empty value (will be completed when user types)
                                            addOrUpdateFilter(col, op.value, '');
                                          }
                                        }
                                      }}
                                    >
                                      {op.label}
                                    </button>
                                  );
                                })}
                              </div>

                              {/* Value input — only if operator needs a value */}
                              {(() => {
                                const currentOp = existingFilter?.operator;
                                if (!currentOp) return null;
                                const opDef = getOperatorsForType(col.type).find(o => o.value === currentOp);
                                if (!opDef?.needsValue) return null;
                                return (
                                  <div className="relative">
                                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                                    <Input
                                      value={existingFilter?.value || ''}
                                      onChange={e => addOrUpdateFilter(col, currentOp, e.target.value)}
                                      placeholder={`Valeur pour ${col.name}...`}
                                      className="h-7 text-xs pl-7 bg-muted/30 border-[#C9A84C]/30 focus:border-[#C9A84C]/50 focus:ring-[#C9A84C]/20"
                                      autoFocus
                                    />
                                  </div>
                                );
                              })()}

                              {/* Active filter remove button */}
                              {existingFilter && (
                                <button
                                  className="mt-1.5 text-[10px] text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1"
                                  onClick={() => removeFilter(col.slug)}
                                >
                                  <X className="w-2.5 h-2.5" /> Retirer ce filtre
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {filteredColumnsForFilter.length === 0 && (
                      <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                        Aucune colonne trouvée
                      </div>
                    )}
                  </div>
                </PopoverContent>
              </Popover>

              {/* ── Sort Popover ── */}
              <Popover open={sortPopoverOpen} onOpenChange={(open) => {
                setSortPopoverOpen(open);
                if (!open) setSortSearch('');
              }}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      "h-7 text-xs gap-1.5 transition-colors",
                      sortConfig
                        ? "border-[#C9A84C]/40 bg-[#C9A84C]/5 text-[#C9A84C] hover:bg-[#C9A84C]/10"
                        : "hover:bg-muted"
                    )}
                  >
                    <ArrowUpDown className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Trier</span>
                    {sortConfig && (
                      <span className="ml-0.5 text-[9px] font-bold">
                        {sortConfig.direction === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-72 p-0 shadow-lg border-border/60" sideOffset={4}>
                  {/* Sort header */}
                  <div className="px-3 pt-3 pb-2">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-foreground tracking-wide">
                        Trier
                      </span>
                      {sortConfig && (
                        <button
                          className="text-[10px] text-[#C9A84C] hover:text-[#C9A84C]/80 font-medium transition-colors"
                          onClick={clearSort}
                        >
                          Effacer
                        </button>
                      )}
                    </div>
                    {/* Search columns */}
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                      <Input
                        value={sortSearch}
                        onChange={e => setSortSearch(e.target.value)}
                        placeholder="Rechercher une colonne..."
                        className="h-7 text-xs pl-7 bg-muted/30 border-border/40 focus:border-[#C9A84C]/50 focus:ring-[#C9A84C]/20"
                      />
                    </div>
                  </div>
                  <Separator className="bg-border/40" />

                  {/* Quick sort options — Statut / Date / Alphabetical */}
                  {!sortSearch.trim() && (
                    <div className="py-1">
                      {/* ── Statut section ── */}
                      <div className="px-3 py-1">
                        <span className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider">
                          Statut
                        </span>
                      </div>
                      <button
                        className={cn(
                          "w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors hover:bg-secondary/60",
                          sortConfig?.columnSlug === '__statut__' && sortConfig?.direction === 'asc' && "bg-[#C9A84C]/5"
                        )}
                        onClick={() => setSortConfig({ columnSlug: '__statut__', columnName: 'Statut (Nouveau)', direction: 'asc' })}
                      >
                        <span className="w-3.5 h-3.5 shrink-0 flex items-center justify-center text-emerald-500 text-[10px]">🟢</span>
                        <span className={cn(
                          "text-xs flex-1",
                          sortConfig?.columnSlug === '__statut__' && sortConfig?.direction === 'asc' ? "text-[#C9A84C] font-medium" : "text-foreground"
                        )}>
                          Nouveau
                        </span>
                        {sortConfig?.columnSlug === '__statut__' && sortConfig?.direction === 'asc' && (
                          <ArrowUp className="w-3 h-3 text-[#C9A84C]" />
                        )}
                      </button>
                      <button
                        className={cn(
                          "w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors hover:bg-secondary/60",
                          sortConfig?.columnSlug === '__statut__' && sortConfig?.direction === 'desc' && "bg-[#C9A84C]/5"
                        )}
                        onClick={() => setSortConfig({ columnSlug: '__statut__', columnName: 'Statut (Courant)', direction: 'desc' })}
                      >
                        <span className="w-3.5 h-3.5 shrink-0 flex items-center justify-center text-gray-400 text-[10px]">🔵</span>
                        <span className={cn(
                          "text-xs flex-1",
                          sortConfig?.columnSlug === '__statut__' && sortConfig?.direction === 'desc' ? "text-[#C9A84C] font-medium" : "text-foreground"
                        )}>
                          Courant
                        </span>
                        {sortConfig?.columnSlug === '__statut__' && sortConfig?.direction === 'desc' && (
                          <ArrowDown className="w-3 h-3 text-[#C9A84C]" />
                        )}
                      </button>

                      {/* ── Date section ── */}
                      <div className="px-3 py-1 mt-1">
                        <span className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider">
                          Date
                        </span>
                      </div>
                      <button
                        className={cn(
                          "w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors hover:bg-secondary/60",
                          sortConfig?.columnSlug === '__created_desc__' && "bg-[#C9A84C]/5"
                        )}
                        onClick={() => setSortConfig({ columnSlug: '__created_desc__', columnName: 'Plus récent', direction: 'desc' })}
                      >
                        <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span className={cn(
                          "text-xs flex-1",
                          sortConfig?.columnSlug === '__created_desc__' ? "text-[#C9A84C] font-medium" : "text-foreground"
                        )}>
                          Plus récent
                        </span>
                        {sortConfig?.columnSlug === '__created_desc__' && (
                          <ArrowDown className="w-3 h-3 text-[#C9A84C]" />
                        )}
                      </button>
                      <button
                        className={cn(
                          "w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors hover:bg-secondary/60",
                          sortConfig?.columnSlug === '__created_asc__' && "bg-[#C9A84C]/5"
                        )}
                        onClick={() => setSortConfig({ columnSlug: '__created_asc__', columnName: 'Plus ancien', direction: 'asc' })}
                      >
                        <Calendar className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span className={cn(
                          "text-xs flex-1",
                          sortConfig?.columnSlug === '__created_asc__' ? "text-[#C9A84C] font-medium" : "text-foreground"
                        )}>
                          Plus ancien
                        </span>
                        {sortConfig?.columnSlug === '__created_asc__' && (
                          <ArrowUp className="w-3 h-3 text-[#C9A84C]" />
                        )}
                      </button>

                      {/* ── Alphabetical section ── */}
                      {(() => {
                        const firstTextCol = visibleColumns.find(c => c.type === 'TEXT');
                        if (!firstTextCol) return null;
                        return (
                          <>
                            <div className="px-3 py-1 mt-1">
                              <span className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider">
                                Alphabétique
                              </span>
                            </div>
                            <button
                              className={cn(
                                "w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors hover:bg-secondary/60",
                                sortConfig?.columnSlug === firstTextCol.slug && sortConfig?.direction === 'asc' && sortConfig?.columnName === 'A→Z' && "bg-[#C9A84C]/5"
                              )}
                              onClick={() => setSortConfig({ columnSlug: firstTextCol.slug, columnName: 'A→Z', direction: 'asc' })}
                            >
                              <ArrowRightLeft className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                              <span className={cn(
                                "text-xs flex-1",
                                sortConfig?.columnSlug === firstTextCol.slug && sortConfig?.direction === 'asc' && sortConfig?.columnName === 'A→Z' ? "text-[#C9A84C] font-medium" : "text-foreground"
                              )}>
                                A → Z
                              </span>
                              {sortConfig?.columnSlug === firstTextCol.slug && sortConfig?.direction === 'asc' && sortConfig?.columnName === 'A→Z' && (
                                <ArrowUp className="w-3 h-3 text-[#C9A84C]" />
                              )}
                            </button>
                            <button
                              className={cn(
                                "w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors hover:bg-secondary/60",
                                sortConfig?.columnSlug === firstTextCol.slug && sortConfig?.direction === 'desc' && sortConfig?.columnName === 'Z→A' && "bg-[#C9A84C]/5"
                              )}
                              onClick={() => setSortConfig({ columnSlug: firstTextCol.slug, columnName: 'Z→A', direction: 'desc' })}
                            >
                              <ArrowRightLeft className="w-3.5 h-3.5 text-muted-foreground shrink-0 rotate-180" />
                              <span className={cn(
                                "text-xs flex-1",
                                sortConfig?.columnSlug === firstTextCol.slug && sortConfig?.direction === 'desc' && sortConfig?.columnName === 'Z→A' ? "text-[#C9A84C] font-medium" : "text-foreground"
                              )}>
                                Z → A
                              </span>
                              {sortConfig?.columnSlug === firstTextCol.slug && sortConfig?.direction === 'desc' && sortConfig?.columnName === 'Z→A' && (
                                <ArrowDown className="w-3 h-3 text-[#C9A84C]" />
                              )}
                            </button>
                          </>
                        );
                      })()}
                    </div>
                  )}

                  {!sortSearch.trim() && <Separator className="bg-border/40" />}

                  {/* Column list with sort */}
                  <div className="max-h-52 overflow-y-auto py-1 custom-scrollbar">
                    {!sortSearch.trim() && (
                      <div className="px-3 py-1">
                        <span className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider">
                          Par colonne
                        </span>
                      </div>
                    )}
                    {filteredColumnsForSort.map(col => {
                      const isSorted = sortConfig?.columnSlug === col.slug;
                      return (
                        <button
                          key={col.id}
                          className={cn(
                            "w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors",
                            "hover:bg-secondary/60",
                            isSorted && "bg-[#C9A84C]/5"
                          )}
                          onClick={() => cycleSort(col)}
                        >
                          <div className="w-5 h-5 rounded bg-primary/10 text-primary flex items-center justify-center shrink-0">
                            {COL_TYPE_ICON[col.type] || <Type className="w-3 h-3" />}
                          </div>
                          <span className={cn(
                            "text-xs truncate flex-1",
                            isSorted ? "text-[#C9A84C] font-medium" : "text-foreground"
                          )}>
                            {col.name}
                          </span>
                          {/* Direction toggle */}
                          <button
                            className={cn(
                              "p-0.5 rounded transition-colors shrink-0",
                              isSorted
                                ? "text-[#C9A84C] hover:bg-[#C9A84C]/10"
                                : "text-muted-foreground/30 hover:text-muted-foreground"
                            )}
                            onClick={(e) => {
                              e.stopPropagation();
                              cycleSort(col);
                            }}
                          >
                            {isSorted ? (
                              sortConfig!.direction === 'asc'
                                ? <ArrowUp className="w-3.5 h-3.5" />
                                : <ArrowDown className="w-3.5 h-3.5" />
                            ) : (
                              <Minus className="w-3 h-3" />
                            )}
                          </button>
                        </button>
                      );
                    })}
                    {filteredColumnsForSort.length === 0 && sortSearch.trim() && (
                      <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                        Aucune colonne trouvée
                      </div>
                    )}
                  </div>
                </PopoverContent>
              </Popover>

              {/* Separator */}
              <div className="w-px h-5 bg-border/40 mx-0.5" />

              {/* Column visibility (eye) */}
              <ColumnVisibilityDropdown
                columns={columns}
                onToggleVisibility={handleToggleColumnVisibility}
                onShowAll={handleShowAllColumns}
                onHideAll={handleHideAllColumns}
              />

              {/* Add column button */}
              <Button
                size="sm"
                className="h-7 text-xs gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground"
                onClick={() => setShowColumnModal(true)}
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Colonne</span>
              </Button>

              {/* Sync Status button */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={Object.keys(pendingStatusChanges).length > 0 ? "default" : "ghost"}
                    size={Object.keys(pendingStatusChanges).length > 0 ? "sm" : "icon"}
                    className={cn(
                      "transition-all relative",
                      Object.keys(pendingStatusChanges).length > 0
                        ? "h-8 bg-[#C9A84C] hover:bg-[#C9A84C]/90 text-white animate-pulse gap-1.5 px-2.5"
                        : "h-7 w-7 hover:bg-secondary"
                    )}
                    onClick={async () => {
                      if (!activeDataSourceId) return;
                      try {
                        const pendingEntries = Object.entries(pendingStatusChanges);
                        if (pendingEntries.length > 0) {
                          await Promise.all(
                            pendingEntries.map(([rowId, change]) =>
                              fetch(`/api/datasources/${activeDataSourceId}/status`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ rowId, statut: change.statut, locked: change.locked }),
                              })
                            )
                          );
                          toast.success(`${pendingEntries.length} changement(s) synchronisé(s)`);
                          setPendingStatusChanges({});
                          loadDataSourceData();
                        } else {
                          // No pending changes: just refresh/recompute statuses
                          const res = await fetch(`/api/datasources/${activeDataSourceId}/status`, { method: 'POST' });
                          if (res.ok) {
                            const json = await res.json();
                            toast.success(`Statuts recalculés (${json.data?.updatesCount ?? 0} mis à jour)`);
                            loadDataSourceData();
                          }
                        }
                      } catch {
                        toast.error('Erreur de synchronisation');
                      }
                    }}
                  >
                    <Activity className="w-3.5 h-3.5" />
                    {Object.keys(pendingStatusChanges).length > 0 ? (
                      <>
                        <span className="text-[11px] font-semibold">Sync ({Object.keys(pendingStatusChanges).length})</span>
                        <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-white text-[#C9A84C] text-[10px] font-bold flex items-center justify-center border border-[#C9A84C]/30 shadow-sm">
                          {Object.keys(pendingStatusChanges).length}
                        </span>
                      </>
                    ) : null}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-[10px]">
                  {Object.keys(pendingStatusChanges).length > 0
                    ? `Synchroniser ${Object.keys(pendingStatusChanges).length} changement(s)`
                    : 'Synchroniser les statuts'}
                </TooltipContent>
              </Tooltip>

              <div className="flex-1" />

              {/* Active filter badges */}
              {filters.length > 0 && (
                <div className="flex items-center gap-1 flex-wrap">
                  {filters.map(f => (
                    <Badge
                      key={f.columnSlug}
                      className="text-[9px] gap-1 bg-[#C9A84C]/10 text-[#C9A84C] border-[#C9A84C]/30 hover:bg-[#C9A84C]/20 pr-0.5"
                    >
                      {f.columnName} {getOperatorLabel(f.columnType, f.operator)}{f.value ? ` ${f.value}` : (getOperatorsForType(f.columnType).find(o => o.value === f.operator)?.needsValue ? ' …' : '')}
                      <button
                        className="w-3.5 h-3.5 rounded-full hover:bg-[#C9A84C]/30 flex items-center justify-center"
                        onClick={() => removeFilter(f.columnSlug)}
                      >
                        <X className="w-2 h-2" />
                      </button>
                    </Badge>
                  ))}
                  <button
                    className="text-[9px] text-muted-foreground hover:text-foreground transition-colors ml-1"
                    onClick={clearAllFilters}
                  >
                    Tout effacer
                  </button>
                </div>
              )}

              {/* Sort badge */}
              {sortConfig && filters.length === 0 && (
                <Badge className="text-[9px] gap-1 bg-[#C9A84C]/10 text-[#C9A84C] border-[#C9A84C]/30">
                  {sortConfig.direction === 'asc' ? <ArrowUp className="w-2.5 h-2.5" /> : <ArrowDown className="w-2.5 h-2.5" />}
                  {sortConfig.columnName}
                </Badge>
              )}

              {/* Search results count */}
              {searchQuery && (
                <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                  {filteredRows.length} résultat{filteredRows.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </>
        )}

        {/* Table */}
        <div className="flex-1 overflow-auto flex flex-col">
          {activeDataSourceId ? (
            <>
              {Object.keys(pendingStatusChanges).length > 0 && (
                <div className="h-8 border-b border-[#C9A84C]/30 bg-[#C9A84C]/5 flex items-center px-3 gap-2 shrink-0">
                  <span className="text-[10px] font-medium text-[#C9A84C]">
                    ⏳ {Object.keys(pendingStatusChanges).length} modification(s) en attente — Cliquez sur Synchroniser pour appliquer
                  </span>
                </div>
              )}
              <DataTable
              columns={columns}
              rows={filteredRows}
              dataSourceId={activeDataSourceId}
              loading={loading}
              onRefresh={loadDataSourceData}
              sortConfig={sortConfig}
              onSortChange={cycleSort}
              onSetSortDirect={setSortDirect}
              onLocalStatusChange={handleLocalStatusChange}
              onLocalLockToggle={handleLocalLockToggle}
              pendingStatusChanges={pendingStatusChanges}
              onAddColumn={() => setShowColumnModal(true)}
            />
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <HardDrive className="w-12 h-12 mb-4 opacity-30" />
              <p className="text-sm">Sélectionnez ou créez une table de données</p>
              <p className="text-xs mt-1">Importez un CSV ou connectez Google Sheets</p>
            </div>
          )}
        </div>
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nouvelle table de données</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-sm font-medium mb-1 block">Nom</label>
              <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Ex: Catalogue Produits" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Description</label>
              <Input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Description optionnelle" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Couleur</label>
              <div className="flex gap-2">
                {colors.map(c => (
                  <button
                    key={c}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${newColor === c ? 'border-foreground scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: c }}
                    onClick={() => setNewColor(c)}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Annuler</Button>
            <Button onClick={handleCreate} disabled={!newName.trim()}>Créer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Table Dialog */}
      <Dialog open={showRenameDialog} onOpenChange={setShowRenameDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Renommer la table</DialogTitle>
          </DialogHeader>
          <div className="mt-2">
            <Input
              value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              placeholder="Nom de la table"
              onKeyDown={e => { if (e.key === 'Enter') handleRenameTable(); }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRenameDialog(false)}>Annuler</Button>
            <Button onClick={handleRenameTable} disabled={!renameValue.trim()}>Renommer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Table Confirmation */}
      <AlertDialog open={showDeleteTableDialog} onOpenChange={setShowDeleteTableDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer « {activeDs?.name} » ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action supprimera la table et toutes ses données (colonnes et lignes). Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90" onClick={handleDeleteTable}>
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Import CSV Dialog */}
      <ImportCSVDialog
        open={showImportModal}
        onOpenChange={setShowImportModal}
        dataSourceId={activeDataSourceId}
        onImported={() => { loadDataSourceData(); loadDataSources(); }}
      />

      {/* Column Editor Dialog */}
      <ColumnEditorDialog
        open={showColumnModal}
        onOpenChange={setShowColumnModal}
        dataSourceId={activeDataSourceId || ''}
        columns={columns}
        rows={rows}
        editingColumn={null}
        onSaved={() => { loadDataSourceData(); setShowColumnModal(false); }}
      />

      {/* Google Sheets Browser */}
      <GoogleSheetsBrowser
        open={showGoogleSheetsBrowser}
        onOpenChange={setShowGoogleSheetsBrowser}
        onSelect={async (sheetId, name) => {
          setSyncStatus('syncing');
          setSyncMessage('Importation en cours...');
          try {
            const res = await fetch('/api/google/sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ sheetId, dataSourceName: name }),
            });
            if (res.ok) {
              setSyncStatus('success');
              setSyncMessage('Données importées');
              toast.success('Google Sheet importé avec succès');
              setShowGoogleSheetsBrowser(false);
              loadDataSources();
              setTimeout(() => setSyncStatus('idle'), 3000);
            } else {
              const json = await res.json();
              setSyncStatus('error');
              setSyncMessage(json.error || 'Erreur d\'importation');
              toast.error(json.error || 'Erreur d\'importation');
              setTimeout(() => setSyncStatus('idle'), 5000);
            }
          } catch {
            setSyncStatus('error');
            setSyncMessage('Erreur de connexion');
            toast.error('Erreur de connexion');
            setTimeout(() => setSyncStatus('idle'), 5000);
          }
        }}
      />

      {/* Manual URL Import Dialog */}
      <Dialog open={showUrlDialog} onOpenChange={setShowUrlDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Importer par URL Google Sheets</DialogTitle>
          </DialogHeader>
          <div className="mt-2">
            <Input
              value={manualUrl}
              onChange={e => setManualUrl(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/..."
              onKeyDown={e => { if (e.key === 'Enter') handleManualUrlImport(); }}
            />
            <p className="text-[11px] text-muted-foreground mt-2">
              Collez l&apos;URL d&apos;un Google Sheet public pour importer ses données.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUrlDialog(false)}>Annuler</Button>
            <Button onClick={handleManualUrlImport} disabled={!manualUrl.trim()}>Importer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
