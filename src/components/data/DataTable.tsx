'use client';

import { useState, useCallback, useRef } from 'react';
import type { Column, Row, ColumnType } from '@/types';
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
  Loader2, Image as ImageIcon, Copy, ChevronDown,
  Check, X, Pencil,
  Type, Hash, Banknote, Images,
  ListChecks, Layers, ToggleRight, ExternalLink, Link2, SquareStack,
  MoveRight,
} from 'lucide-react';
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
};

interface Props {
  columns: Column[];
  rows: Row[];
  dataSourceId: string;
  loading: boolean;
  onRefresh: () => void;
}

export function DataTable({ columns, rows, dataSourceId, loading, onRefresh }: Props) {
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

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'row' | 'column'; id: string; name?: string } | null>(null);

  const visibleColumns = columns.filter(c => c.visible);
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
        onRefresh();
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

  const renderCellValue = (row: Row, col: Column) => {
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
            <span className="truncate text-xs text-blue-600 max-w-[100px]">Image</span>
          </div>
        );
      }
    }

    if (col.type === 'CURRENCY') {
      return <span className="font-medium text-emerald-700">{strVal}</span>;
    }

    if (col.type === 'BOOLEAN') {
      return (
        <Badge variant={strVal === 'true' ? 'default' : 'secondary'} className="text-[10px]">
          {strVal === 'true' ? '✓ Oui' : '✗ Non'}
        </Badge>
      );
    }

    if (col.type === 'URL' && strVal.startsWith('http')) {
      return <a href={strVal} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 truncate max-w-[150px] block hover:underline">Lien ↗</a>;
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
          <div className="h-10 border-b border-border bg-amber-50 dark:bg-amber-950/20 flex items-center px-3 gap-3 shrink-0">
            <Check className="w-3.5 h-3.5 text-amber-600" />
            <span className="text-xs font-medium">{selectedRows.size} ligne(s) sélectionnée(s)</span>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setSelectedRows(new Set())}>
              <X className="w-3 h-3 mr-1" /> Désélectionner
            </Button>
            <div className="flex-1" />
            <Button variant="destructive" size="sm" className="h-7 text-xs gap-1" onClick={() => setShowBulkDeleteDialog(true)}>
              <Trash2 className="w-3 h-3" /> Supprimer la sélection
            </Button>
          </div>
        )}

        {/* Cell selection action bar */}
        {selectedCells.size > 0 && (
          <div className="h-9 border-b border-border bg-blue-50 dark:bg-blue-950/20 flex items-center px-3 gap-3 shrink-0">
            <SquareStack className="w-3.5 h-3.5 text-blue-600" />
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
        <div className="flex-1 overflow-auto">
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
                <th className="px-2 py-2 text-left text-xs font-medium text-muted-foreground w-10 border-b border-r border-border sticky left-9 bg-muted/90 z-20">
                  #
                </th>
                {/* Data columns */}
                {visibleColumns.map(col => (
                  <th key={col.id} className="px-0 py-0 text-left text-xs font-medium text-muted-foreground border-b border-border min-w-[140px]">
                    <div className="flex items-center gap-0.5 px-2 py-1.5 group/col">
                      {/* Column type icon */}
                      <div className="flex items-center justify-center w-5 h-5 rounded bg-primary/10 text-primary shrink-0">
                        {COLUMN_TYPE_ICON[col.type]}
                      </div>

                      {/* Column name — inline rename or display */}
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
                            className="truncate cursor-pointer hover:text-foreground transition-colors text-[11px] font-medium block"
                            onDoubleClick={() => {
                              setRenamingColId(col.id);
                              setRenameValue(col.name);
                            }}
                            title="Double-cliquer pour renommer"
                          >
                            {col.name}
                          </span>
                        )}
                      </div>

                      {/* ── Single context arrow (▾) ── replaces pencil + 3-dots ── */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors shrink-0 opacity-0 group-hover/col:opacity-100 data-[state=open]:opacity-100">
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-52">
                          <DropdownMenuItem onClick={() => openColumnEditor(col)}>
                            <Pencil className="w-3.5 h-3.5 mr-2" /> Éditer
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => duplicateColumn(col)}>
                            <Copy className="w-3.5 h-3.5 mr-2" /> Dupliquer
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => addColumnToRight(col)}>
                            <MoveRight className="w-3.5 h-3.5 mr-2" /> Ajouter à droite
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => toggleColumnVisibility(col)}>
                            {col.visible
                              ? <><EyeOff className="w-3.5 h-3.5 mr-2" /> Masquer</>
                              : <><Eye className="w-3.5 h-3.5 mr-2" /> Afficher</>
                            }
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteTarget({ type: 'column', id: col.id, name: col.name })}>
                            <Trash2 className="w-3.5 h-3.5 mr-2" /> Supprimer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    {/* Column type label */}
                    <div className="px-2 pb-1">
                      <span className="text-[9px] text-muted-foreground/60 uppercase tracking-wider">
                        {COLUMN_TYPE_LABEL[col.type]}
                      </span>
                    </div>
                  </th>
                ))}
                {/* ── Add column button — persistent at right ── */}
                <th className="px-2 py-2 w-10 border-b border-border sticky right-0 bg-muted/90 z-20">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        className="w-7 h-7 rounded-md border border-dashed border-border hover:border-gold hover:bg-gold/5 text-muted-foreground hover:text-gold transition-colors flex items-center justify-center"
                        onClick={() => { setEditingColumn(null); setShowColumnEditor(true); }}
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
                    {/* Row number — sticky */}
                    <td className="px-2 py-1.5 text-xs text-muted-foreground sticky left-9 bg-card z-10 border-r border-border/30 font-medium">
                      {rowNum}
                    </td>
                    {/* Data cells */}
                    {visibleColumns.map(col => {
                      const cellKey = `${row.id}-${col.slug}`;
                      const isEditing = editingCell === cellKey;
                      const isCellSelected = selectedCells.has(cellKey);

                      return (
                        <td key={col.slug} className={cn(
                          "px-3 py-1.5 border-l border-border/30 relative",
                          isCellSelected && "bg-blue-50 dark:bg-blue-950/20 ring-1 ring-blue-300 dark:ring-blue-700 ring-inset"
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
                              className="cursor-pointer min-h-[24px] flex items-center gap-1"
                              onDoubleClick={() => startEditing(row.id, col.slug, (row.data as Record<string, unknown>)[col.slug])}
                              onClick={(e) => {
                                if (e.shiftKey || e.ctrlKey || e.metaKey) {
                                  e.preventDefault();
                                  toggleCellSelect(row.id, col.slug, e.shiftKey || e.ctrlKey || e.metaKey);
                                }
                              }}
                              title="Double-cliquer pour modifier · Shift+Clic pour sélectionner"
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
        </div>

        {/* ── Footer: pagination + add row ── */}
        <div className="h-10 border-t border-border bg-card flex items-center px-3 gap-3 shrink-0">
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-gold hover:text-gold hover:bg-gold/5" onClick={addRow}>
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
