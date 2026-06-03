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
  Plus, Upload, Download, Link2, Sheet, RefreshCw, HardDrive,
  Trash2, Pencil, MoreVertical, Search, Filter, ArrowUpDown,
  ArrowUp, ArrowDown, X, Type, Hash, Banknote, Image as ImageIcon, Images,
  ChevronDown, ListChecks, Layers, ToggleRight, ExternalLink, Link2 as LinkIcon,
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
};

// ── Filter / Sort types ────────────────────────────────────────────────────
export interface FilterConfig {
  columnSlug: string;
  columnName: string;
  value: string;
}

export interface SortConfig {
  columnSlug: string;
  columnName: string;
  direction: 'asc' | 'desc';
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

  // Active filter column being edited
  const [activeFilterCol, setActiveFilterCol] = useState<string | null>(null);

  const colors = ['#C9A84C', '#1A1A1A', '#D32F2F', '#2E7D32', '#1565C0', '#8B4513', '#F48FB1', '#483C32'];

  // Active data source
  const activeDs = dataSources.find(d => d.id === activeDataSourceId);
  const hasGoogleSheet = !!activeDs?.sheetId;

  // Filtered + sorted rows
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

    // Column filters
    if (filters.length > 0) {
      result = result.filter(row => {
        const data = row.data as Record<string, unknown>;
        return filters.every(f => {
          const val = data[f.columnSlug];
          if (val === null || val === undefined) return false;
          return String(val).toLowerCase().includes(f.value.toLowerCase());
        });
      });
    }

    // Sort
    if (sortConfig) {
      result = [...result].sort((a, b) => {
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
  }, [rows, searchQuery, filters, sortConfig]);

  // ── Filter helpers ──────────────────────────────────────────────────────────

  const addOrUpdateFilter = (col: Column, value: string) => {
    if (!value.trim()) {
      // Remove filter if value is empty
      setFilters(prev => prev.filter(f => f.columnSlug !== col.slug));
      return;
    }
    setFilters(prev => {
      const existing = prev.findIndex(f => f.columnSlug === col.slug);
      if (existing >= 0) {
        const next = [...prev];
        next[existing] = { columnSlug: col.slug, columnName: col.name, value };
        return next;
      }
      return [...prev, { columnSlug: col.slug, columnName: col.name, value }];
    });
  };

  const removeFilter = (columnSlug: string) => {
    setFilters(prev => prev.filter(f => f.columnSlug !== columnSlug));
  };

  const clearAllFilters = () => {
    setFilters([]);
    setActiveFilterCol(null);
  };

  // ── Sort helpers ────────────────────────────────────────────────────────────

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

  const clearSort = () => {
    setSortConfig(null);
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

  const handleSyncGoogleSheet = async () => {
    if (!activeDataSourceId) return;
    const ds = dataSources.find(d => d.id === activeDataSourceId);
    if (!ds?.sheetId) return;

    setSyncStatus('syncing');
    setSyncMessage('Synchronisation en cours...');
    try {
      const res = await fetch('/api/google/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sheetId: ds.sheetId, dataSourceId: ds.id }),
      });
      if (res.ok) {
        setSyncStatus('success');
        setSyncMessage('Données synchronisées');
        loadDataSourceData();
        loadDataSources();
        setTimeout(() => setSyncStatus('idle'), 3000);
      } else {
        const json = await res.json();
        setSyncStatus('error');
        setSyncMessage(json.error || 'Erreur de synchronisation');
        setTimeout(() => setSyncStatus('idle'), 5000);
      }
    } catch {
      setSyncStatus('error');
      setSyncMessage('Erreur de connexion');
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
              <Popover open={filterPopoverOpen} onOpenChange={setFilterPopoverOpen}>
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
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-foreground tracking-wide">
                        Filtrer par colonne
                      </span>
                      {filters.length > 0 && (
                        <button
                          className="text-[10px] text-[#C9A84C] hover:text-[#C9A84C]/80 font-medium transition-colors"
                          onClick={() => { clearAllFilters(); }}
                        >
                          Effacer tout
                        </button>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Sélectionnez une colonne puis saisissez une valeur à filtrer.
                    </p>
                  </div>
                  <Separator className="bg-border/40" />
                  {/* Column list */}
                  <div className="max-h-52 overflow-y-auto py-1 custom-scrollbar">
                    {columns.filter(c => c.visible).map(col => {
                      const existingFilter = filters.find(f => f.columnSlug === col.slug);
                      const isActive = activeFilterCol === col.slug || existingFilter;

                      return (
                        <div key={col.id}>
                          <button
                            className={cn(
                              "w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors",
                              "hover:bg-secondary/60",
                              isActive && "bg-[#C9A84C]/5"
                            )}
                            onClick={() => {
                              if (activeFilterCol === col.slug) {
                                setActiveFilterCol(null);
                              } else {
                                setActiveFilterCol(col.slug);
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
                                {existingFilter.value}
                              </Badge>
                            )}
                            {existingFilter && (
                              <button
                                className="w-4 h-4 rounded-full hover:bg-destructive/10 flex items-center justify-center shrink-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeFilter(col.slug);
                                }}
                              >
                                <X className="w-2.5 h-2.5 text-muted-foreground hover:text-destructive" />
                              </button>
                            )}
                          </button>
                          {/* Filter input for active column */}
                          {activeFilterCol === col.slug && (
                            <div className="px-3 pb-2">
                              <div className="relative">
                                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                                <Input
                                  value={existingFilter?.value || ''}
                                  onChange={e => addOrUpdateFilter(col, e.target.value)}
                                  placeholder={`Filtrer ${col.name}...`}
                                  className="h-7 text-xs pl-7 bg-muted/30 border-[#C9A84C]/30 focus:border-[#C9A84C]/50 focus:ring-[#C9A84C]/20"
                                  autoFocus
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {columns.filter(c => c.visible).length === 0 && (
                      <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                        Aucune colonne visible
                      </div>
                    )}
                  </div>
                </PopoverContent>
              </Popover>

              {/* ── Sort Popover ── */}
              <Popover open={sortPopoverOpen} onOpenChange={setSortPopoverOpen}>
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
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-foreground tracking-wide">
                        Trier par colonne
                      </span>
                      {sortConfig && (
                        <button
                          className="text-[10px] text-[#C9A84C] hover:text-[#C9A84C]/80 font-medium transition-colors"
                          onClick={() => { clearSort(); }}
                        >
                          Effacer le tri
                        </button>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Cliquez pour trier : ↑ croissant → ↓ décroissant → annuler
                    </p>
                  </div>
                  <Separator className="bg-border/40" />
                  {/* Column list */}
                  <div className="max-h-52 overflow-y-auto py-1 custom-scrollbar">
                    {columns.filter(c => c.visible).map(col => {
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
                            isSorted ? "text-foreground font-medium" : "text-foreground"
                          )}>
                            {col.name}
                          </span>
                          {isSorted && (
                            <span className="text-[#C9A84C] text-xs font-bold shrink-0">
                              {sortConfig!.direction === 'asc' ? '↑' : '↓'}
                            </span>
                          )}
                        </button>
                      );
                    })}
                    {columns.filter(c => c.visible).length === 0 && (
                      <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                        Aucune colonne visible
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

              <div className="flex-1" />

              {/* Active filter badges */}
              {filters.length > 0 && (
                <div className="flex items-center gap-1 flex-wrap">
                  {filters.map(f => (
                    <Badge
                      key={f.columnSlug}
                      className="text-[9px] gap-1 bg-[#C9A84C]/10 text-[#C9A84C] border-[#C9A84C]/30 hover:bg-[#C9A84C]/20 pr-0.5"
                    >
                      {f.columnName}: {f.value}
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
        <div className="flex-1 overflow-auto">
          {activeDataSourceId ? (
            <DataTable
              columns={columns}
              rows={filteredRows}
              dataSourceId={activeDataSourceId}
              loading={loading}
              onRefresh={loadDataSourceData}
              sortConfig={sortConfig}
              onSortChange={cycleSort}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <Database2Icon className="w-12 h-12 mb-4 opacity-30" />
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
              Cette action supprimera définitivement la table et toutes ses données ({rows.length} lignes, {columns.length} colonnes). Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90" onClick={handleDeleteTable}>
              Supprimer la table
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Manual Google Sheet URL Dialog */}
      <Dialog open={showUrlDialog} onOpenChange={setShowUrlDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Saisir l&apos;URL Google Sheet</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <p className="text-sm text-muted-foreground">
              Collez l&apos;URL d&apos;une Google Sheet publique pour l&apos;importer directement.
            </p>
            <Input
              value={manualUrl}
              onChange={e => setManualUrl(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/..."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowUrlDialog(false); setManualUrl(''); }}>Annuler</Button>
            <Button onClick={handleManualUrlImport} disabled={!manualUrl.trim()}>Importer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      {activeDataSourceId && (
        <ImportCSVDialog
          open={showImportModal}
          onOpenChange={setShowImportModal}
          dataSourceId={activeDataSourceId}
          onImported={() => {
            loadDataSourceData();
            loadDataSources();
          }}
        />
      )}

      {/* Column Editor Dialog */}
      {activeDataSourceId && (
        <ColumnEditorDialog
          open={showColumnModal}
          onOpenChange={setShowColumnModal}
          dataSourceId={activeDataSourceId}
          columns={columns}
          rows={rows}
          onSaved={() => loadDataSourceData()}
        />
      )}

      {/* Google Sheets Browser */}
      <GoogleSheetsBrowser
        open={showGoogleSheetsBrowser}
        onOpenChange={setShowGoogleSheetsBrowser}
        onImported={() => {
          loadDataSourceData();
          loadDataSources();
        }}
      />
    </div>
  );
}

function Database2Icon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M3 5V19A9 3 0 0 0 21 19V5" />
      <path d="M3 12A9 3 0 0 0 21 12" />
    </svg>
  );
}
