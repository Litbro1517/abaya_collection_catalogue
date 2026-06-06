'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { Column, Row, ColumnType } from '@/types';
import type { SortConfig } from './DataPillar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  MoreVertical, Plus, Eye, EyeOff, Trash2, Edit2, ArrowUp, ArrowDown,
  Loader2, Image as ImageIcon, Copy, ChevronDown, ChevronRight,
  Check, X, Pencil,
  Type, Hash, Banknote, Images,
  ListChecks, Layers, ToggleRight, ExternalLink, Link2, SquareStack,
  MoveRight, Activity, Lock, Unlock, ArrowUpDown, Zap,
  ChevronUp, Minus,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ColumnEditorDialog } from './ColumnEditorDialog';

// Column type icon mapping
const COLUMN_TYPE_ICON: Record<ColumnType, React.ReactNode> = {
  TEXT: <Type className="w-3 h-3" />,
  NUMBER: <Hash className="w-3 h-3" />,
  CURRENCY: <Banknote className="w-3 h-3" />,
  IMAGE: <ImageIcon className="w-3 h-3" />,
  IMAGE_ARRAY: <Images className="w-3 h-3" />,
  SELECT: <ChevronDown className="w-3 h-3" />,
  MULTI_SELECT: <ListChecks className="w-3 h-3" />,
  RELATION: <Link2 className="w-3 h-3" />,
  ARRAY: <Layers className="w-3 h-3" />,
  BOOLEAN: <ToggleRight className="w-3 h-3" />,
  URL: <ExternalLink className="w-3 h-3" />,
  STATUS: <Activity className="w-3 h-3" />,
};

const COLUMN_TYPE_LABEL: Record<ColumnType, string> = {
  TEXT: 'Texte',
  NUMBER: 'Nombre',
  CURRENCY: 'Prix',
  IMAGE: 'Image',
  IMAGE_ARRAY: 'Galerie',
  SELECT: 'Sélection',
  MULTI_SELECT: 'Multi-sélection',
  RELATION: 'Relation',
  ARRAY: 'Groupe',
  BOOLEAN: 'Oui/Non',
  URL: 'Lien',
  STATUS: 'Statut',
};

interface Props {
  columns: Column[];
  rows: Row[];
  dataSourceId: string;
  loading: boolean;
  onRefresh: () => void;
  onUpdateRow: (rowId: string, newData: Record<string, unknown>) => void;
  sortConfig?: SortConfig | null;
  onSortChange?: (col: Column) => void;
  onSetSortDirect?: (colSlug: string, colName: string, direction: 'asc' | 'desc') => void;
  onLocalStatusChange?: (rowId: string, newStatut: string) => void;
  onLocalLockToggle?: (rowId: string, currentLocked: boolean) => void;
  pendingStatusChanges?: Record<string, { statut: string; locked: boolean }>;
  onAddColumn?: () => void;
}

export function DataTable({ columns, rows, dataSourceId, loading, onRefresh, onUpdateRow, sortConfig, onSortChange, onSetSortDirect, onLocalStatusChange, onLocalLockToggle, pendingStatusChanges, onAddColumn }: Props) {
  const [editingCell, setEditingCell] = useState<string | null>(null); // `${rowId}-${colSlug}`
  const [editValue, setEditValue] = useState('');
  const [showColumnEditor, setShowColumnEditor] = useState(false);
  const [editingColumn, setEditingColumn] = useState<Column | null>(null);
  const [page, setPage] = useState(0);
  const pageSize = 50;

  // Renaming column inline
  const [renamingColId, setRenamingColId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Row selection for bulk operations
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);

  // Cell selection mode
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());

  // STATUS cell editing state
  const [editingStatusCell, setEditingStatusCell] = useState<string | null>(null); // `${rowId}-${colSlug}`

  // Column options popover — track which col's popover is open and expanded sections
  const [colOptionsOpen, setColOptionsOpen] = useState<string | null>(null); // col.id
  const [colOptionsExpanded, setColOptionsExpanded] = useState<Set<string>>(new Set());

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'row' | 'column'; id: string; name?: string } | null>(null);

  // ━━━ Optimistic State Layer (Stock, Switch, Visibility) ━━━━━━━━━━━━━
  // All three use the same pattern: instant local state → async background save
  // No onRefresh() calls → no loading spinner → no freeze

  // Stock: optimistic value map
  const [optimisticStock, setOptimisticStock] = useState<Record<string, number>>({});
  const [stockStepperOpen, setStockStepperOpen] = useState<string | null>(null);
  const stockDebounceRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const stockPendingRef = useRef<Record<string, { data: Record<string, unknown>; colSlug: string }>>({});

  // Switch (Disponibilité): optimistic value map
  const [optimisticSwitch, setOptimisticSwitch] = useState<Record<string, boolean>>({});

  // Eye (Visibility): optimistic value map
  const [optimisticVisibility, setOptimisticVisibility] = useState<Record<string, boolean>>({});

  // ── Background API save with rollback on failure ─────────────────────
  const backgroundSave = useCallback(async (
    rowId: string,
    data: Record<string, unknown>,
    rollbackFn: () => void,
    successMsg?: string
  ) => {
    try {
      const res = await fetch(`/api/datasources/${dataSourceId}/rows/${rowId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data }),
      });
      if (res.ok) {
        // Silently update the row in the parent store (no loading spinner)
        onUpdateRow(rowId, data);
        // Clear optimistic overlays for this row (DB now matches)
        setOptimisticSwitch(prev => {
          const next = { ...prev };
          delete next[rowId];
          return next;
        });
        setOptimisticVisibility(prev => {
          const next = { ...prev };
          delete next[rowId];
          return next;
        });
        if (successMsg) toast.success(successMsg);
      } else {
        // API returned error → rollback
        rollbackFn();
        toast.error('Erreur de sauvegarde — modification annulée');
      }
    } catch {
      // Network error → rollback
      rollbackFn();
      toast.error('Erreur réseau — modification annulée');
    }
  }, [dataSourceId, onUpdateRow]);

  // Flush all pending stock changes immediately (e.g., on unmount)
  const flushStockChange = useCallback(async (rowId: string) => {
    const pending = stockPendingRef.current[rowId];
    if (!pending) return;
    delete stockPendingRef.current[rowId];
    try {
      const res = await fetch(`/api/datasources/${dataSourceId}/rows/${rowId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: pending.data }),
      });
      if (res.ok) {
        onUpdateRow(rowId, pending.data);
      }
    } catch { /* silent on unmount */ }
  }, [dataSourceId, onUpdateRow]);

  // Schedule a debounced stock save (1.5s after last click)
  const scheduleStockSave = useCallback((rowId: string, data: Record<string, unknown>, colSlug: string) => {
    // Store the pending payload
    stockPendingRef.current[rowId] = { data, colSlug };
    // Clear existing timer
    if (stockDebounceRef.current[rowId]) {
      clearTimeout(stockDebounceRef.current[rowId]);
    }
    // Set new timer — 1.5s debounce
    stockDebounceRef.current[rowId] = setTimeout(async () => {
      const pending = stockPendingRef.current[rowId];
      if (!pending) return;
      delete stockPendingRef.current[rowId];
      try {
        const res = await fetch(`/api/datasources/${dataSourceId}/rows/${rowId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: pending.data }),
        });
        if (res.ok) {
          // Silently update row in parent store — NO onRefresh()
          onUpdateRow(rowId, pending.data);
        } else {
          // Rollback on failure
          setOptimisticStock(prev => {
            const next = { ...prev };
            delete next[rowId];
            return next;
          });
          toast.error('Erreur de sauvegarde stock — modification annulée');
        }
      } catch {
        setOptimisticStock(prev => {
          const next = { ...prev };
          delete next[rowId];
          return next;
        });
        toast.error('Erreur réseau — modification stock annulée');
      }
      // Clear optimistic overlay (parent store now has the value)
      setOptimisticStock(prev => {
        const next = { ...prev };
        delete next[rowId];
        return next;
      });
    }, 1500);
  }, [dataSourceId, onUpdateRow]);

  // Cleanup debounce timers on unmount
  useEffect(() => {
    return () => {
      Object.values(stockDebounceRef.current).forEach(timer => clearTimeout(timer));
      Object.keys(stockPendingRef.current).forEach(rowId => flushStockChange(rowId));
    };
  }, [flushStockChange]);

  // Native system column slugs — non-deletable, ordered first
  const NATIVE_COLUMN_SLUGS = ['__disponibilite__', '__stock__', '__statut__'];
  const isNativeColumn = (slug: string) => NATIVE_COLUMN_SLUGS.includes(slug);

  // Filter out __is_visible__ (handled by Eye icon in # column)
  const visibleColumns = columns.filter(c => c.visible && c.slug !== '__is_visible__');
  // Sort visible columns: native columns first in specified order, then regular columns
  const NATIVE_ORDER: Record<string, number> = { '__disponibilite__': 0, '__stock__': 1, '__statut__': 2 };
  const sortedVisibleColumns = [...visibleColumns].sort((a, b) => {
    const aNative = NATIVE_ORDER[a.slug] ?? 999;
    const bNative = NATIVE_ORDER[b.slug] ?? 999;
    if (aNative !== bNative) return aNative - bNative;
    return 0;
  });
  const paginatedRows = rows.slice(page * pageSize, (page + 1) * pageSize);
  const allVisibleSelected = paginatedRows.length > 0 && paginatedRows.every(r => selectedRows.has(r.id));

  // ── Cell editing ──────────────────────────────────────────────────────────

  const startEditing = (rowId: string, colSlug: string, value: unknown) => {
    setEditingCell(`${rowId}-${colSlug}`);
    let strVal = '';
    if (typeof value === 'string') strVal = value;
    else if (Array.isArray(value)) strVal = JSON.stringify(value);
    else if (value !== null && value !== undefined) strVal = String(value);
    setEditValue(strVal);
  };

  const saveCell = async (rowId: string, colSlug: string) => {
    setEditingCell(null);
    const row = rows.find(r => r.id === rowId);
    if (!row) return;

    const data = { ...(row.data as Record<string, unknown>) };
    try {
      data[colSlug] = JSON.parse(editValue);
    } catch {
      data[colSlug] = editValue;
    }

    try {
      const res = await fetch(`/api/datasources/${dataSourceId}/rows/${rowId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data }),
      });
      if (res.ok) {
        // Silently update row in parent store — NO onRefresh()
        onUpdateRow(rowId, data);
      }
    } catch {
      toast.error('Erreur de sauvegarde');
    }
  };

  // ── Row operations ────────────────────────────────────────────────────────

  const addRow = async () => {
    try {
      const res = await fetch(`/api/datasources/${dataSourceId}/rows`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: {} }),
      });
      if (res.ok) {
        onRefresh();
        toast.success('Ligne ajoutée');
      }
    } catch {
      toast.error('Erreur');
    }
  };

  const duplicateRow = async (row: Row) => {
    try {
      const res = await fetch(`/api/datasources/${dataSourceId}/rows`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: { ...row.data } }),
      });
      if (res.ok) {
        onRefresh();
        toast.success('Ligne dupliquée');
      }
    } catch {
      toast.error('Erreur de duplication');
    }
  };

  const deleteRow = async (rowId: string) => {
    try {
      const res = await fetch(`/api/datasources/${dataSourceId}/rows/${rowId}`, { method: 'DELETE' });
      if (res.ok) {
        onRefresh();
        setSelectedRows(prev => { const n = new Set(prev); n.delete(rowId); return n; });
        toast.success('Ligne supprimée');
      }
    } catch {
      toast.error('Erreur');
    }
  };

  const deleteSelectedRows = async () => {
    try {
      await Promise.all(
        Array.from(selectedRows).map(id =>
          fetch(`/api/datasources/${dataSourceId}/rows/${id}`, { method: 'DELETE' })
        )
      );
      onRefresh();
      setSelectedRows(new Set());
      setShowBulkDeleteDialog(false);
      toast.success(`${selectedRows.size} ligne(s) supprimée(s)`);
    } catch {
      toast.error('Erreur de suppression');
    }
  };

  const moveRow = async (rowId: string, direction: 'up' | 'down') => {
    const idx = rows.findIndex(r => r.id === rowId);
    if (idx < 0) return;
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === rows.length - 1) return;

    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    const currentRow = rows[idx];
    const swapRow = rows[swapIdx];

    try {
      await Promise.all([
        fetch(`/api/datasources/${dataSourceId}/rows/${currentRow.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order: swapRow.order }),
        }),
        fetch(`/api/datasources/${dataSourceId}/rows/${swapRow.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order: currentRow.order }),
        }),
      ]);
      onRefresh();
    } catch {
      toast.error('Erreur de déplacement');
    }
  };

  // ── Column operations ─────────────────────────────────────────────────────

  const toggleColumnVisibility = async (col: Column) => {
    try {
      await fetch(`/api/datasources/${dataSourceId}/columns/${col.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visible: !col.visible }),
      });
      onRefresh();
      toast.success(col.visible ? 'Colonne masquée' : 'Colonne affichée');
    } catch {
      toast.error('Erreur');
    }
  };

  const deleteColumn = async (colId: string) => {
    try {
      await fetch(`/api/datasources/${dataSourceId}/columns/${colId}`, { method: 'DELETE' });
      onRefresh();
      toast.success('Colonne supprimée');
    } catch {
      toast.error('Erreur');
    }
  };

  const addColumnToRight = async (afterCol: Column) => {
    const sortedCols = [...columns].sort((a, b) => a.order - b.order);
    const idx = sortedCols.findIndex(c => c.id === afterCol.id);
    const newOrder = idx >= 0 && idx < sortedCols.length - 1
      ? (sortedCols[idx].order + sortedCols[idx + 1].order) / 2
      : sortedCols[sortedCols.length - 1].order + 1;

    try {
      const res = await fetch(`/api/datasources/${dataSourceId}/columns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Nouvelle colonne', type: 'TEXT', order: newOrder }),
      });
      if (res.ok) {
        onRefresh();
        toast.success('Colonne ajoutée à droite');
      }
    } catch {
      toast.error('Erreur');
    }
  };

  const duplicateColumn = async (col: Column) => {
    const sortedCols = [...columns].sort((a, b) => a.order - b.order);
    const idx = sortedCols.findIndex(c => c.id === col.id);
    const newOrder = idx >= 0 && idx < sortedCols.length - 1
      ? (sortedCols[idx].order + sortedCols[idx + 1].order) / 2
      : sortedCols[sortedCols.length - 1].order + 1;

    try {
      const res = await fetch(`/api/datasources/${dataSourceId}/columns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${col.name} (copie)`,
          type: col.type,
          order: newOrder,
          config: col.config,
          visible: col.visible,
        }),
      });
      if (res.ok) {
        onRefresh();
        toast.success('Colonne dupliquée');
      }
    } catch {
      toast.error('Erreur de duplication');
    }
  };

  // Column rename — ONLY updates name, does NOT touch slug (data integrity)
  const renameColumn = async (colId: string) => {
    if (!renameValue.trim()) {
      setRenamingColId(null);
      return;
    }
    try {
      await fetch(`/api/datasources/${dataSourceId}/columns/${colId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: renameValue.trim() }),
      });
      onRefresh();
      toast.success('Colonne renommée');
    } catch {
      toast.error('Erreur de renommage');
    }
    setRenamingColId(null);
  };

  const openColumnEditor = (col: Column) => {
    setEditingColumn(col);
    setShowColumnEditor(true);
  };

  // Both the "+" button in the header AND the green "Colonne" button in toolbar
  // should open the same ColumnEditorDialog. When "+" is clicked, it opens
  // the dialog in "new column" mode (editingColumn = null).
  // This prop is passed from DataPillar via setShowColumnModal.

  // ── Cell selection ────────────────────────────────────────────────────────

  const toggleCellSelect = (rowId: string, colSlug: string, shiftKey: boolean) => {
    const cellKey = `${rowId}-${colSlug}`;
    setSelectedCells(prev => {
      const n = new Set(prev);
      if (shiftKey) {
        if (n.has(cellKey)) n.delete(cellKey);
        else n.add(cellKey);
      } else {
        n.clear();
        n.add(cellKey);
      }
      return n;
    });
  };

  const deleteSelectedCellsContent = async () => {
    const updates = Array.from(selectedCells).map(cellKey => {
      const row = rows.find(r => cellKey.startsWith(r.id));
      return { row, colSlug: row ? cellKey.substring(row.id.length + 1) : '' };
    }).filter(u => u.row);

    try {
      await Promise.all(
        updates.map(({ row, colSlug }) => {
          if (!row) return Promise.resolve();
          const data = { ...row.data } as Record<string, unknown>;
          data[colSlug] = '';
          return fetch(`/api/datasources/${dataSourceId}/rows/${row.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data }),
          });
        })
      );
      setSelectedCells(new Set());
      onRefresh();
      toast.success('Contenu des cellules effacé');
    } catch {
      toast.error('Erreur');
    }
  };

  // ── Row selection ─────────────────────────────────────────────────────────

  const toggleRowSelect = (rowId: string) => {
    setSelectedRows(prev => {
      const n = new Set(prev);
      if (n.has(rowId)) n.delete(rowId);
      else n.add(rowId);
      return n;
    });
  };

  const toggleAllVisible = () => {
    if (allVisibleSelected) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(paginatedRows.map(r => r.id)));
    }
  };

  // ── Cell rendering ────────────────────────────────────────────────────────

  // STATUS cell: local status change (no API call)
  const handleLocalStatusChangeLocal = (rowId: string, newStatut: string) => {
    setEditingStatusCell(null);
    if (onLocalStatusChange) {
      onLocalStatusChange(rowId, newStatut);
      toast.success('Statut modifié (en attente de synchronisation)');
    }
  };

  // STATUS cell: local lock toggle (no API call)
  const handleLocalLockToggleLocal = (rowId: string, currentLocked: boolean) => {
    if (onLocalLockToggle) {
      onLocalLockToggle(rowId, currentLocked);
      toast.success(currentLocked ? 'Statut déverrouillé' : 'Statut verrouillé');
    }
  };

  // ── Bulk lock/unlock for selected rows ──
  const hasStatusColumn = visibleColumns.some(c => c.type === 'STATUS' || c.slug === '__statut__');

  const handleBulkLock = () => {
    if (!onLocalLockToggle) return;
    let count = 0;
    selectedRows.forEach(rowId => {
      const row = rows.find(r => r.id === rowId);
      if (!row) return;
      const rawData = row.data as Record<string, unknown>;
      const currentLocked = pendingStatusChanges?.[rowId]?.locked ?? !!rawData.__statut_locked__;
      if (!currentLocked) {
        onLocalLockToggle(rowId, false); // false = current is unlocked → will lock
        count++;
      }
    });
    if (count > 0) toast.success(`${count} statut(s) verrouillé(s) 🔒`);
    else toast.info('Tous les statuts sélectionnés sont déjà verrouillés');
  };

  const handleBulkUnlock = () => {
    if (!onLocalLockToggle) return;
    let count = 0;
    selectedRows.forEach(rowId => {
      const row = rows.find(r => r.id === rowId);
      if (!row) return;
      const rawData = row.data as Record<string, unknown>;
      const currentLocked = pendingStatusChanges?.[rowId]?.locked ?? !!rawData.__statut_locked__;
      if (currentLocked) {
        onLocalLockToggle(rowId, true); // true = current is locked → will unlock
        count++;
      }
    });
    if (count > 0) toast.success(`${count} statut(s) déverrouillé(s) 🔓`);
    else toast.info('Tous les statuts sélectionnés sont déjà déverrouillés');
  };

  const renderCellValue = (row: Row, col: Column) => {
    // STATUS column: special rendering with colored badge + lock toggle
    if (col.type === 'STATUS' || col.slug === '__statut__') {
      const rawData = row.data as Record<string, unknown>;
      const storedStatut = String(rawData.__statut__ || '');
      const storedLocked = !!rawData.__statut_locked__;

      // Overlay pending changes — display the PENDING value if it exists
      const pending = pendingStatusChanges?.[row.id];
      const displayStatut = pending?.statut ?? storedStatut;
      const isLocked = pending?.locked ?? storedLocked;

      const cellKey = `${row.id}-${col.slug}`;
      const isEditingStatus = editingStatusCell === cellKey;
      const hasPendingChange = !!pending;

      // When unlocked and editing, show dropdown
      if (isEditingStatus && !isLocked) {
        return (
          <select
            className="h-6 text-xs bg-background border border-[#C9A84C]/40 rounded px-1 focus:border-[#C9A84C] focus:ring-1 focus:ring-[#C9A84C]/20 outline-none"
            value={displayStatut || 'Courant'}
            onChange={(e) => handleLocalStatusChangeLocal(row.id, e.target.value)}
            onBlur={() => setEditingStatusCell(null)}
            autoFocus
          >
            <option value="Nouveau">🟢 Nouveau</option>
            <option value="Courant">🔵 Courant</option>
          </select>
        );
      }

      return (
        <div className="flex items-center gap-1.5">
          {/* Status badge — NOT clickable; use double-click on cell instead */}
          {displayStatut === 'Nouveau' ? (
            <span
              className={cn(
                "inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium border transition-colors",
                "bg-emerald-100 text-emerald-700 border-emerald-200",
                isLocked && "opacity-70",
                hasPendingChange && "ring-2 ring-[#C9A84C]/50 ring-offset-1"
              )}
              title={isLocked ? "🔒 Verrouillé — Double-clic bloqué" : "🔓 Déverrouillé — Double-cliquer pour modifier"}
            >
              {hasPendingChange && <span className="mr-0.5 text-[8px]">⏳</span>}
              Nouveau
            </span>
          ) : displayStatut === 'Courant' ? (
            <span
              className={cn(
                "inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium border transition-colors",
                "bg-gray-100 text-gray-600 border-gray-200",
                isLocked && "opacity-70",
                hasPendingChange && "ring-2 ring-[#C9A84C]/50 ring-offset-1"
              )}
              title={isLocked ? "🔒 Verrouillé — Double-clic bloqué" : "🔓 Déverrouillé — Double-cliquer pour modifier"}
            >
              {hasPendingChange && <span className="mr-0.5 text-[8px]">⏳</span>}
              Courant
            </span>
          ) : (
            <span className="text-muted-foreground/40 text-[10px]">—</span>
          )}

          {/* Lock toggle icon — always clickable */}
          <button
            className={cn(
              "p-0.5 rounded transition-colors shrink-0",
              isLocked
                ? "text-red-400 hover:text-red-500 hover:bg-red-50"
                : "text-[#C9A84C]/70 hover:text-[#C9A84C] hover:bg-[#C9A84C]/10"
            )
            }
            onClick={(e) => {
              e.stopPropagation();
              handleLocalLockToggleLocal(row.id, isLocked);
            }}
            title={isLocked ? "Déverrouiller 🔓 (permet le double-clic)" : "Verrouiller 🔒 (lecture seule)"}
          >
            {isLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
          </button>
        </div>
      );
    }

    const value = (row.data as Record<string, unknown>)[col.slug];
    if (value === undefined || value === null || value === '') return <span className="text-muted-foreground/40">—</span>;

    if (Array.isArray(value)) {
      if (col.type === 'IMAGE' || col.type === 'IMAGE_ARRAY') {
        return (
          <Badge variant="secondary" className="text-[10px] gap-1">
            <Images className="w-2.5 h-2.5" />
            {value.length} image{value.length > 1 ? 's' : ''}
          </Badge>
        );
      }
      return <span className="truncate block max-w-[250px]" title={value.join(', ')}>{value.join(', ')}</span>;
    }

    const strVal = String(value);

    if (col.type === 'IMAGE' || col.type === 'IMAGE_ARRAY') {
      if (strVal.startsWith('[')) {
        try {
          const arr = JSON.parse(strVal);
          if (Array.isArray(arr)) return (
            <Badge variant="secondary" className="text-[10px] gap-1">
              <Images className="w-2.5 h-2.5" />
              {arr.length} image{arr.length > 1 ? 's' : ''}
            </Badge>
          );
        } catch { /* not valid JSON */ }
      }
      if (strVal.startsWith('http')) {
        return (
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded bg-muted flex items-center justify-center shrink-0">
              <ImageIcon className="w-3 h-3 text-muted-foreground" />
            </div>
            <span className="truncate text-xs text-emerald-700 max-w-[100px]">Image</span>
          </div>
        );
      }
    }

    if (col.type === 'CURRENCY') {
      return <span className="font-medium text-emerald-700">{strVal}</span>;
    }

    // ━━━ Stock counter: Minimalist design with optimistic update + debounce ━━━
    if (col.type === 'NUMBER' && col.slug === '__stock__') {
      // Use optimistic value if available, otherwise fall back to DB value
      const dbVal = parseInt(strVal) || 0;
      const numVal = optimisticStock[row.id] ?? dbVal;
      const stockColor = numVal > 0 ? 'text-emerald-600' : numVal === 0 ? 'text-red-500' : 'text-muted-foreground';
      const isOpen = stockStepperOpen === row.id;
      const hasPending = optimisticStock[row.id] !== undefined;

      // Optimistic stock change handler — updates local state instantly, debounces API save
      const handleStockChange = (delta: number, isQuickSell = false) => {
        const freshRow = rows.find(r => r.id === row.id);
        if (!freshRow) return;
        const currentOptimistic = optimisticStock[row.id] ?? dbVal;
        const newStock = Math.max(0, currentOptimistic + delta);
        if (newStock === currentOptimistic && delta <= 0) return; // can't go below 0

        // ━━━ Instant optimistic UI update (0ms) ━━━
        setOptimisticStock(prev => ({ ...prev, [row.id]: newStock }));

        // Build full row data payload with reactive business rules
        const data = { ...(freshRow.data as Record<string, unknown>) };
        data[col.slug] = String(newStock);
        // Also include any pending optimistic switch value
        if (row.id in optimisticSwitch) {
          data.__disponibilite__ = String(optimisticSwitch[row.id]);
        }

        // ━━━ Reactive Engine: Stock > 0 → auto ON, Stock == 0 → auto OFF ━━━
        if (newStock > 0) {
          data.__disponibilite__ = 'true'; // Scenario A: re-integrate into normal flow
          setOptimisticSwitch(prev => ({ ...prev, [row.id]: true })); // instant switch ON
        } else if (newStock === 0) {
          data.__disponibilite__ = 'false'; // Scenario B: auto-épuisé
          setOptimisticSwitch(prev => ({ ...prev, [row.id]: false })); // instant switch OFF
        }

        // ━━━ Debounced API save (1.5s) ━━━
        scheduleStockSave(row.id, data, col.slug);

        // Toast feedback
        if (isQuickSell) {
          toast.success('⚡ Vente rapide');
          if (newStock === 0) toast.info('Stock épuisé → Disponible désactivé');
        } else if (delta > 0 && currentOptimistic === 0) {
          toast.success('Stock ajouté → Disponible activé');
        } else if (newStock === 0) {
          toast.info('Stock épuisé → Disponible désactivé');
        }
      };

      return (
        <div className="flex items-center gap-0.5 select-none">
          {/* ── Minimalist stock display: click to reveal stepper ── */}
          <button
            className={cn(
              "flex items-center gap-0.5 rounded px-1.5 py-0.5 transition-all duration-200 cursor-pointer",
              "hover:bg-muted/60",
              isOpen && "bg-muted/60 ring-1 ring-border/40",
              hasPending && "ring-1 ring-amber-300/50"
            )}
            onClick={() => setStockStepperOpen(isOpen ? null : row.id)}
            title={hasPending ? '⏳ Sauvegarde en cours…' : 'Cliquer pour modifier le stock'}
          >
            {/* Stock number — clean, bold, colored */}
            <span className={cn("text-xs font-bold min-w-[18px] text-center tabular-nums", stockColor)}>
              {numVal}
            </span>
          </button>

          {/* ── Hidden stepper arrows — appear when stock cell is active ── */}
          {isOpen && (
            <div className="flex flex-col items-center gap-px ml-0.5 animate-in fade-in duration-150">
              <button
                className="p-0 rounded-sm text-muted-foreground hover:text-emerald-600 hover:bg-emerald-50 transition-colors leading-none"
                onClick={(e) => { e.stopPropagation(); handleStockChange(1); }}
                title="Ajouter 1 au stock"
              >
                <ChevronUp className="w-3 h-3" />
              </button>
              <button
                className={cn(
                  "p-0 rounded-sm transition-colors leading-none",
                  numVal > 0
                    ? "text-muted-foreground hover:text-red-500 hover:bg-red-50"
                    : "text-muted-foreground/20 cursor-not-allowed"
                )}
                onClick={(e) => { e.stopPropagation(); if (numVal > 0) handleStockChange(-1); }}
                title="Retirer 1 du stock"
              >
                <ChevronDown className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* ── ⚡ Quick Sell button — always visible, minimalist ── */}
          <button
            className={cn(
              "ml-0.5 p-0.5 rounded-sm transition-colors leading-none",
              numVal > 0
                ? "text-amber-500 hover:text-amber-600 hover:bg-amber-50"
                : "text-muted-foreground/20 cursor-not-allowed"
            )}
            onClick={(e) => { e.stopPropagation(); if (numVal > 0) handleStockChange(-1, true); }}
            title="⚡ Vente rapide — décrémenter le stock"
          >
            <Zap className="w-3.5 h-3.5" />
          </button>
        </div>
      );
    }

    if (col.type === 'BOOLEAN') {
      // ━━━ Optimistic Switch: read from optimistic overlay if available ━━━
      const dbBoolVal = strVal === 'true';
      const boolVal = row.id in optimisticSwitch ? optimisticSwitch[row.id] : dbBoolVal;
      const colNameLower = col.name.toLowerCase();
      const isDisponible = colNameLower.includes('disponible') || colNameLower.includes('disponibilite') || colNameLower.includes('disponibilité') || col.slug === '__disponibilite__';
      // ━━━ Reactive Engine: Compute Sur commande state ━━━
      // Sur commande = Switch ON + Stock = 0 (Scenario C — derogatory mode)
      // Use optimistic stock if available for instant feedback
      const rowData = row.data as Record<string, unknown>;
      const dbStock = typeof rowData.__stock__ === 'number' ? rowData.__stock__ : parseInt(String(rowData.__stock__)) || 0;
      const currentStock = optimisticStock[row.id] ?? dbStock;
      const isSurCommande = isDisponible && boolVal && currentStock === 0;
      const trueLabel = isSurCommande ? 'Sur commande' : (isDisponible ? 'Disponible' : 'Oui');
      const falseLabel = isDisponible ? 'Épuisé' : 'Non';
      return (
        <div className="flex items-center gap-2">
          <Switch
            checked={boolVal}
            onCheckedChange={(checked) => {
              // ━━━ INSTANT optimistic update (0ms) ━━━
              setOptimisticSwitch(prev => ({ ...prev, [row.id]: checked }));

              // Build full row data payload with reactive rules
              const currentRow = rows.find(r => r.id === row.id);
              if (!currentRow) return;
              const data = { ...(currentRow.data as Record<string, unknown>) };
              data[col.slug] = String(checked);
              // Also update optimistic stock/switch consistency
              if (optimisticStock[row.id] !== undefined) {
                data.__stock__ = String(optimisticStock[row.id]);
              }

              // ━━━ Async background save (no await, no blocking) ━━━
              const rollbackFn = () => {
                setOptimisticSwitch(prev => {
                  const next = { ...prev };
                  delete next[row.id];
                  return next;
                });
              };

              const successMsg = checked && currentStock === 0
                ? '🔍 Mode Sur commande activé'
                : checked ? trueLabel : falseLabel;

              backgroundSave(row.id, data, rollbackFn, successMsg);
            }}
            className="scale-75"
          />
          <span className={cn(
            "text-[10px] font-medium",
            isSurCommande ? "text-amber-600" : boolVal ? "text-emerald-600" : "text-red-500"
          )}>
            {boolVal ? trueLabel : falseLabel}
          </span>
          {isSurCommande && (
            <span className="text-[8px] px-1 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200 font-medium">SO</span>
          )}
        </div>
      );
    }

    if (col.type === 'URL' && strVal.startsWith('http')) {
      return <a href={strVal} target="_blank" rel="noopener noreferrer" className="text-xs text-emerald-700 truncate max-w-[150px] block hover:underline">Lien ↗</a>;
    }

    if (col.type === 'SELECT' || col.type === 'MULTI_SELECT') {
      return <Badge variant="outline" className="text-[10px]">{strVal}</Badge>;
    }

    if (strVal.length > 80) {
      return <span className="truncate block max-w-[250px]" title={strVal}>{strVal.substring(0, 80)}...</span>;
    }

    return <span>{strVal}</span>;
  };

  // ── Loading state ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="h-full flex flex-col">
        {/* Bulk action bar */}
        {selectedRows.size > 0 && (
          <div className="h-10 border-b border-border bg-amber-50 dark:bg-amber-950/20 flex items-center px-3 gap-2 shrink-0">
            <Check className="w-3.5 h-3.5 text-amber-600" />
            <span className="text-xs font-medium">{selectedRows.size} ligne(s) sélectionnée(s)</span>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setSelectedRows(new Set())}>
              <X className="w-3 h-3 mr-1" /> Désélectionner
            </Button>

            {/* Bulk lock/unlock for Statut column — only shown when STATUS column exists */}
            {hasStatusColumn && onLocalLockToggle && (
              <div className="flex items-center gap-1 ml-1 pl-2 border-l border-amber-300/40">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                  onClick={handleBulkLock}
                >
                  <Lock className="w-3 h-3" /> Verrouiller
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1 border-emerald-200 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
                  onClick={handleBulkUnlock}
                >
                  <Unlock className="w-3 h-3" /> Déverrouiller
                </Button>
              </div>
            )}

            <div className="flex-1" />
            <Button variant="destructive" size="sm" className="h-7 text-xs gap-1" onClick={() => setShowBulkDeleteDialog(true)}>
              <Trash2 className="w-3 h-3" /> Supprimer la sélection
            </Button>
          </div>
        )}

        {/* Cell selection action bar */}
        {selectedCells.size > 0 && (
          <div className="h-9 border-b border-border bg-amber-50/50 dark:bg-amber-950/10 flex items-center px-3 gap-3 shrink-0">
            <SquareStack className="w-3.5 h-3.5 text-amber-600" />
            <span className="text-xs font-medium">{selectedCells.size} cellule(s) sélectionnée(s)</span>
            <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setSelectedCells(new Set())}>
              <X className="w-3 h-3 mr-1" /> Désélectionner
            </Button>
            <div className="flex-1" />
            <Button variant="outline" size="sm" className="h-6 text-xs gap-1" onClick={deleteSelectedCellsContent}>
              <Trash2 className="w-3 h-3" /> Effacer le contenu
            </Button>
          </div>
        )}

        {/* ── Table with sticky row indices ── */}
        <div className="flex-1 overflow-auto relative">
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="bg-muted/80 backdrop-blur-sm">
                {/* Checkbox column — sticky */}
                <th className="px-2 py-2 w-9 border-b border-border sticky left-0 bg-muted/90 z-20">
                  <Checkbox
                    checked={allVisibleSelected}
                    onCheckedChange={toggleAllVisible}
                    className="h-3.5 w-3.5"
                  />
                </th>
                {/* Row # column — sticky */}
                <th className="px-2 py-2 text-left text-xs font-medium text-muted-foreground w-14 border-b border-r border-border sticky left-9 bg-muted/90 z-20">
                  <div className="flex items-center gap-1">
                    <span>#</span>
                    <Eye className="w-3 h-3 text-muted-foreground/50" />
                  </div>
                </th>
                {/* Data columns */}
                {sortedVisibleColumns.map(col => {
                  const isSorted = sortConfig?.columnSlug === col.slug;
                  return (
                    <th key={col.id} className="px-0 py-0 text-left text-xs font-medium text-muted-foreground border-b border-border min-w-[140px]">
                      <div className="flex items-center gap-0.5 px-2 py-1.5 group/col">
                        {/* Column type icon */}
                        <div className="flex items-center justify-center w-5 h-5 rounded bg-primary/10 text-primary shrink-0">
                          {COLUMN_TYPE_ICON[col.type]}
                        </div>

                        {/* Column name — inline rename or display. Clicking triggers sort. */}
                        <div className="flex-1 min-w-0">
                          {renamingColId === col.id ? (
                            <Input
                              ref={renameInputRef}
                              value={renameValue}
                              onChange={e => setRenameValue(e.target.value)}
                              onBlur={() => renameColumn(col.id)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') renameColumn(col.id);
                                if (e.key === 'Escape') setRenamingColId(null);
                              }}
                              className="h-5 text-xs w-[90px] px-1"
                              autoFocus
                              onClick={e => e.stopPropagation()}
                            />
                          ) : (
                            <span
                              className={cn(
                                "truncate cursor-pointer hover:text-foreground transition-colors text-[11px] font-medium block select-none",
                                isSorted && "text-[#C9A84C]"
                              )}
                              onClick={() => {
                                if (onSortChange) onSortChange(col);
                              }}
                              onDoubleClick={(e) => {
                                e.stopPropagation();
                                setRenamingColId(col.id);
                                setRenameValue(col.name);
                              }}
                              title="Cliquer pour trier · Double-cliquer pour renommer"
                            >
                              {col.name}
                              {isNativeColumn(col.slug) && (
                                <Badge variant="secondary" className="h-3 text-[7px] px-1 py-0 bg-amber-100 text-amber-700 border-amber-200 ml-1 shrink-0">Native</Badge>
                              )}
                            </span>
                          )}
                        </div>

                        {/* Sort indicator arrow on column — only when sorted */}
                        {isSorted && onSortChange && (
                          <button
                            className="p-0.5 rounded transition-colors shrink-0 text-[#C9A84C] hover:bg-[#C9A84C]/10"
                            onClick={() => onSortChange(col)}
                            title={sortConfig!.direction === 'asc' ? 'Tri croissant — cliquer pour décroissant' : 'Tri décroissant — cliquer pour annuler'}
                          >
                            {sortConfig!.direction === 'asc'
                              ? <ArrowUp className="w-3.5 h-3.5" />
                              : <ArrowDown className="w-3.5 h-3.5" />
                            }
                          </button>
                        )}

                        {/* ── Column options — clean popover with expandable list ── */}
                        <Popover open={colOptionsOpen === col.id} onOpenChange={(open) => { setColOptionsOpen(open ? col.id : null); setColOptionsExpanded(new Set()); }}>
                          <PopoverTrigger asChild>
                            <button className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors shrink-0 opacity-0 group-hover/col:opacity-100 data-[state=open]:opacity-100">
                              <ChevronDown className="w-3.5 h-3.5" />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent align="start" className="w-56 p-0 shadow-lg border-border/60">
                            {/* Column info header */}
                            <div className="px-3 py-2 border-b border-border/40 bg-muted/30">
                              <div className="flex items-center gap-2">
                                <div className="w-5 h-5 rounded bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                  {COLUMN_TYPE_ICON[col.type]}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs font-medium truncate flex items-center gap-1.5">
                                    {col.name}
                                    {isNativeColumn(col.slug) && (
                                      <Badge variant="secondary" className="h-3.5 text-[8px] px-1 py-0 bg-amber-100 text-amber-700 border-amber-200 shrink-0">Native</Badge>
                                    )}
                                  </p>
                                  <p className="text-[9px] text-muted-foreground">{COLUMN_TYPE_LABEL[col.type]} · slug: {col.slug}</p>
                                </div>
                              </div>
                            </div>

                            {/* Options list with expandable arrows */}
                            <div className="py-1">
                              {/* Edit option — disabled for native columns (type change not allowed) */}
                              <button
                                className={cn(
                                  "w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors",
                                  isNativeColumn(col.slug) ? "opacity-40 cursor-not-allowed" : "hover:bg-secondary/60"
                                )}
                                disabled={isNativeColumn(col.slug)}
                                onClick={() => { if (!isNativeColumn(col.slug)) { openColumnEditor(col); setColOptionsOpen(null); } }}
                              >
                                <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                                <span className="flex-1">Éditer</span>
                                {isNativeColumn(col.slug)
                                  ? <span className="text-[8px] text-amber-500">Type verrouillé</span>
                                  : <span className="text-[8px] text-muted-foreground/50">PUT /columns/{col.id.slice(0,6)}</span>
                                }
                              </button>

                              {/* Rename option */}
                              <button
                                className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-secondary/60 transition-colors"
                                onClick={() => { setRenamingColId(col.id); setRenameValue(col.name); setColOptionsOpen(null); }}
                              >
                                <Type className="w-3.5 h-3.5 text-muted-foreground" />
                                <span className="flex-1">Renommer</span>
                                <span className="text-[8px] text-muted-foreground/50">field: name</span>
                              </button>

                              {/* Sort option — expandable */}
                              <button
                                className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-secondary/60 transition-colors"
                                onClick={() => {
                                  const next = new Set(colOptionsExpanded);
                                  if (next.has('sort')) next.delete('sort'); else next.add('sort');
                                  setColOptionsExpanded(next);
                                }}
                              >
                                <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground" />
                                <span className="flex-1">Trier</span>
                                <ChevronRight className={cn("w-3 h-3 text-muted-foreground transition-transform", colOptionsExpanded.has('sort') && "rotate-90")} />
                              </button>
                              {colOptionsExpanded.has('sort') && (
                                <div className="ml-7 border-l-2 border-[#C9A84C]/20 pl-2 py-0.5">
                                  <p className="text-[8px] text-muted-foreground/50 px-2 py-0.5">field: {col.slug}</p>
                                  <button
                                    className="w-full flex items-center gap-2 px-2 py-1 text-[10px] text-left hover:bg-secondary/60 rounded transition-colors"
                                    onClick={() => {
                                      if (onSetSortDirect) onSetSortDirect(col.slug, col.name, 'asc');
                                      else if (onSortChange) onSortChange(col);
                                      setColOptionsOpen(null);
                                    }}
                                  >
                                    <ArrowUp className="w-3 h-3" /> Croissant (A→Z)
                                  </button>
                                  <button
                                    className="w-full flex items-center gap-2 px-2 py-1 text-[10px] text-left hover:bg-secondary/60 rounded transition-colors"
                                    onClick={() => {
                                      if (onSetSortDirect) {
                                        onSetSortDirect(col.slug, col.name, 'desc');
                                      } else if (onSortChange) {
                                        onSortChange(col);
                                      }
                                      setColOptionsOpen(null);
                                    }}
                                  >
                                    <ArrowDown className="w-3 h-3" /> Décroissant (Z→A)
                                  </button>
                                </div>
                              )}

                              {/* Duplicate option */}
                              <button
                                className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-secondary/60 transition-colors"
                                onClick={() => { duplicateColumn(col); setColOptionsOpen(null); }}
                              >
                                <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                                <span className="flex-1">Dupliquer</span>
                                <span className="text-[8px] text-muted-foreground/50">POST /columns</span>
                              </button>

                              {/* Add column to right */}
                              <button
                                className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-secondary/60 transition-colors"
                                onClick={() => { addColumnToRight(col); setColOptionsOpen(null); }}
                              >
                                <MoveRight className="w-3.5 h-3.5 text-muted-foreground" />
                                <span className="flex-1">Ajouter à droite</span>
                                <span className="text-[8px] text-muted-foreground/50">POST /columns</span>
                              </button>

                              <div className="my-1 h-px bg-border/40" />

                              {/* Visibility option — expandable */}
                              <button
                                className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-secondary/60 transition-colors"
                                onClick={() => {
                                  const next = new Set(colOptionsExpanded);
                                  if (next.has('visibility')) next.delete('visibility'); else next.add('visibility');
                                  setColOptionsExpanded(next);
                                }}
                              >
                                {col.visible ? <EyeOff className="w-3.5 h-3.5 text-muted-foreground" /> : <Eye className="w-3.5 h-3.5 text-muted-foreground" />}
                                <span className="flex-1">Visibilité</span>
                                <ChevronRight className={cn("w-3 h-3 text-muted-foreground transition-transform", colOptionsExpanded.has('visibility') && "rotate-90")} />
                              </button>
                              {colOptionsExpanded.has('visibility') && (
                                <div className="ml-7 border-l-2 border-[#C9A84C]/20 pl-2 py-0.5">
                                  <p className="text-[8px] text-muted-foreground/50 px-2 py-0.5">field: visible = {String(!col.visible)}</p>
                                  <button
                                    className="w-full flex items-center gap-2 px-2 py-1 text-[10px] text-left hover:bg-secondary/60 rounded transition-colors"
                                    onClick={() => { toggleColumnVisibility(col); setColOptionsOpen(null); }}
                                  >
                                    {col.visible ? <><EyeOff className="w-3 h-3" /> Masquer</> : <><Eye className="w-3 h-3" /> Afficher</>}
                                  </button>
                                </div>
                              )}

                              <div className="my-1 h-px bg-border/40" />

                              {/* Delete option — hidden for native columns */}
                              {!isNativeColumn(col.slug) && (
                                <button
                                  className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-destructive/10 text-destructive transition-colors"
                                  onClick={() => { setDeleteTarget({ type: 'column', id: col.id, name: col.name }); setColOptionsOpen(null); }}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span className="flex-1">Supprimer</span>
                                  <span className="text-[8px] text-destructive/50">DELETE + all cell data</span>
                                </button>
                              )}
                              {isNativeColumn(col.slug) && (
                                <div className="px-3 py-1.5 text-[10px] text-amber-600/70 italic">
                                  Colonne système — suppression désactivée
                                </div>
                              )}
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                      {/* Column type label + sort indicator */}
                      <div className="px-2 pb-1 flex items-center gap-1.5">
                        <span className="text-[9px] text-muted-foreground/60 uppercase tracking-wider">
                          {COLUMN_TYPE_LABEL[col.type]}
                        </span>
                        {isSorted && (
                          <span className="text-[9px] text-[#C9A84C] font-medium">
                            {sortConfig!.direction === 'asc' ? '↑ A-Z' : '↓ Z-A'}
                          </span>
                        )}
                      </div>
                    </th>
                  );
                })}
                {/* ── Add column button — sticky at top-right ── */}
                <th className="px-2 py-2 w-10 border-b border-l border-border sticky right-0 top-0 bg-muted z-40">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        className="w-7 h-7 rounded-full border border-dashed border-border hover:border-[#C9A84C] hover:bg-[#C9A84C]/5 text-muted-foreground hover:text-[#C9A84C] transition-colors flex items-center justify-center"
                        onClick={() => {
                          // Same action as the green "Colonne" button — both coexist
                          if (onAddColumn) onAddColumn();
                          else { setEditingColumn(null); setShowColumnEditor(true); }
                        }}
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="text-[10px]">
                      Ajouter une colonne
                    </TooltipContent>
                  </Tooltip>
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedRows.map((row, idx) => {
                const isSelected = selectedRows.has(row.id);
                const rowNum = page * pageSize + idx + 1;
                // ━━━ Optimistic visibility: overlay on DB value ━━━
                const dbVisible = (row.data as Record<string, unknown>).__is_visible__ !== false;
                const isVisible = row.id in optimisticVisibility ? optimisticVisibility[row.id] : dbVisible;

                return (
                  <tr key={row.id} className={cn(
                    'border-b border-border/50 group hover:bg-muted/30 transition-colors',
                    isSelected && 'bg-amber-50/50 dark:bg-amber-950/10 hover:bg-amber-50/70'
                  )}>
                    {/* Row checkbox — sticky */}
                    <td className="px-2 py-1.5 sticky left-0 bg-card z-10 border-r-2" style={{ borderRightColor: isSelected ? '#C9A84C' : 'transparent' }}>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleRowSelect(row.id)}
                        className="h-3.5 w-3.5"
                      />
                    </td>
                    {/* Row number + visibility toggle — sticky */}
                    <td className="px-2 py-1.5 text-xs text-muted-foreground sticky left-9 bg-card z-10 border-r border-border/30 font-medium">
                      <div className="flex items-center gap-1">
                        <span>{rowNum}</span>
                        <button
                          className={cn(
                            "p-0.5 rounded transition-colors shrink-0",
                            isVisible
                              ? "text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50"
                              : "text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted"
                          )}
                          onClick={(e) => {
                            e.stopPropagation();
                            // ━━━ INSTANT optimistic update (0ms) ━━━
                            const newVisible = !isVisible;
                            setOptimisticVisibility(prev => ({ ...prev, [row.id]: newVisible }));

                            // Build full row data payload
                            const data = { ...(row.data as Record<string, unknown>) };
                            data.__is_visible__ = newVisible;
                            // Also include optimistic stock/switch if pending
                            if (optimisticStock[row.id] !== undefined) {
                              data.__stock__ = String(optimisticStock[row.id]);
                            }
                            if (row.id in optimisticSwitch) {
                              data.__disponibilite__ = String(optimisticSwitch[row.id]);
                            }

                            // ━━━ Async background save (no await, no blocking) ━━━
                            const rollbackFn = () => {
                              setOptimisticVisibility(prev => {
                                const next = { ...prev };
                                delete next[row.id];
                                return next;
                              });
                            };

                            backgroundSave(row.id, data, rollbackFn, newVisible ? 'Visible 👁️' : 'Masqué 👁️‍🗨️');
                          }}
                          title={isVisible ? "Visible — cliquer pour masquer" : "Masqué — cliquer pour afficher"}
                        >
                          {isVisible
                            ? <Eye className="w-3 h-3" />
                            : <EyeOff className="w-3 h-3" />
                          }
                        </button>
                      </div>
                    </td>
                    {/* Data cells */}
                    {sortedVisibleColumns.map(col => {
                      const cellKey = `${row.id}-${col.slug}`;
                      const isEditing = editingCell === cellKey;
                      const isCellSelected = selectedCells.has(cellKey);

                      return (
                        <td key={col.slug} className={cn(
                          "px-3 py-1.5 border-l border-border/30 relative",
                          isCellSelected && "bg-amber-50 dark:bg-amber-950/20 ring-1 ring-[#C9A84C]/40 dark:ring-[#C9A84C]/30 ring-inset"
                        )}>
                          {isEditing ? (
                            <Input
                              value={editValue}
                              onChange={e => setEditValue(e.target.value)}
                              onBlur={() => saveCell(row.id, col.slug)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') saveCell(row.id, col.slug);
                                if (e.key === 'Escape') setEditingCell(null);
                              }}
                              className="h-7 text-xs"
                              autoFocus
                            />
                          ) : (
                            <div
                              data-cell-key={cellKey}
                              className={cn(
                                "min-h-[24px] flex items-center gap-1",
                                (col.type === 'STATUS' || col.slug === '__statut__')
                                  ? (((pendingStatusChanges?.[row.id]?.locked ?? (row.data as Record<string, unknown>).__statut_locked__) ? "cursor-not-allowed bg-red-50/30" : "cursor-pointer"))
                                  : "cursor-pointer"
                              )}
                              onDoubleClick={() => {
                                // STATUS column: open inline select only if unlocked (double-click only!)
                                if (col.type === 'STATUS' || col.slug === '__statut__') {
                                  const effectiveLocked = pendingStatusChanges?.[row.id]?.locked ?? !!(row.data as Record<string, unknown>).__statut_locked__;
                                  if (!effectiveLocked) {
                                    setEditingStatusCell(cellKey);
                                  } else {
                                    // Visual feedback: shake + toast
                                    const el = document.querySelector(`[data-cell-key="${cellKey}"]`);
                                    if (el) { el.classList.add('animate-shake'); setTimeout(() => el.classList.remove('animate-shake'), 500); }
                                    toast.error('Statut verrouillé 🔒 — Déverrouillez d\'abord le cadenas');
                                  }
                                } else {
                                  startEditing(row.id, col.slug, (row.data as Record<string, unknown>)[col.slug]);
                                }
                              }}
                              onClick={(e) => {
                                if (e.shiftKey || e.ctrlKey || e.metaKey) {
                                  e.preventDefault();
                                  toggleCellSelect(row.id, col.slug, e.shiftKey || e.ctrlKey || e.metaKey);
                                }
                              }}
                              title={(col.type === 'STATUS' || col.slug === '__statut__') ? ((pendingStatusChanges?.[row.id]?.locked ?? (row.data as Record<string, unknown>).__statut_locked__) ? "Statut verrouillé 🔒 — déverrouillez d'abord" : "Double-cliquer pour changer le statut") : "Double-cliquer pour modifier · Shift+Clic pour sélectionner"}
                            >
                              {renderCellValue(row, col)}
                            </div>
                          )}
                        </td>
                      );
                    })}
                    {/* Row actions — sticky right */}
                    <td className="px-1 sticky right-0 bg-card z-10">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity">
                            <MoreVertical className="w-3 h-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onClick={() => startEditing(row.id, visibleColumns[0]?.slug || '', (row.data as Record<string, unknown>)[visibleColumns[0]?.slug || ''])}>
                            <Edit2 className="w-3.5 h-3.5 mr-2" /> Modifier
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => duplicateRow(row)}>
                            <Copy className="w-3.5 h-3.5 mr-2" /> Dupliquer
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => moveRow(row.id, 'up')} disabled={idx === 0}>
                            <ArrowUp className="w-3.5 h-3.5 mr-2" /> Monter
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => moveRow(row.id, 'down')} disabled={idx === paginatedRows.length - 1}>
                            <ArrowDown className="w-3.5 h-3.5 mr-2" /> Descendre
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteTarget({ type: 'row', id: row.id })}>
                            <Trash2 className="w-3.5 h-3.5 mr-2" /> Supprimer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Floating "+" add column button — always visible during scroll */}
          <button
            className="absolute bottom-4 right-4 z-30 w-10 h-10 rounded-full shadow-lg bg-[#C9A84C] hover:bg-[#C9A84C]/90 text-white flex items-center justify-center transition-transform hover:scale-110"
            onClick={() => {
              if (onAddColumn) onAddColumn();
              else { setEditingColumn(null); setShowColumnEditor(true); }
            }}
            title="Ajouter une colonne"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {/* ── Footer: pagination + add row ── */}
        <div className="h-10 border-t border-border bg-card flex items-center px-3 gap-3 shrink-0">
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-[#C9A84C] hover:text-[#C9A84C] hover:bg-[#C9A84C]/5" onClick={addRow}>
            <Plus className="w-3 h-3" /> Nouvelle ligne
          </Button>
          <div className="flex-1" />
          {rows.length > pageSize && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page === 0} onClick={() => setPage(page - 1)}>
                Préc.
              </Button>
              <span className="text-xs text-muted-foreground">
                {page + 1} / {Math.ceil(rows.length / pageSize)}
              </span>
              <Button variant="outline" size="sm" className="h-7 text-xs" disabled={(page + 1) * pageSize >= rows.length} onClick={() => setPage(page + 1)}>
                Suiv.
              </Button>
            </div>
          )}
          <span className="text-xs text-muted-foreground">{rows.length} lignes · {visibleColumns.length}/{columns.length} colonnes</span>
        </div>

        {/* Delete confirmation dialog */}
        <AlertDialog open={!!deleteTarget} onOpenChange={v => { if (!v) setDeleteTarget(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {deleteTarget?.type === 'column'
                  ? `Supprimer la colonne « ${deleteTarget.name} » ?`
                  : 'Supprimer cette ligne ?'
                }
              </AlertDialogTitle>
              <AlertDialogDescription>
                {deleteTarget?.type === 'column'
                  ? 'Toutes les données de cette colonne seront perdues. Cette action est irréversible.'
                  : 'Cette action est irréversible.'
                }
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-white hover:bg-destructive/90"
                onClick={() => {
                  if (deleteTarget) {
                    if (deleteTarget.type === 'row') deleteRow(deleteTarget.id);
                    else deleteColumn(deleteTarget.id);
                  }
                  setDeleteTarget(null);
                }}
              >
                Supprimer
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Bulk delete confirmation */}
        <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Supprimer {selectedRows.size} ligne(s) ?</AlertDialogTitle>
              <AlertDialogDescription>
                Cette action supprimera définitivement les lignes sélectionnées. Cette action est irréversible.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90" onClick={deleteSelectedRows}>
                Supprimer tout
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Column editor dialog */}
        <ColumnEditorDialog
          open={showColumnEditor}
          onOpenChange={setShowColumnEditor}
          dataSourceId={dataSourceId}
          columns={columns}
          rows={rows}
          editingColumn={editingColumn}
          onSaved={() => { onRefresh(); setEditingColumn(null); }}
        />
      </div>
    </TooltipProvider>
  );
}
