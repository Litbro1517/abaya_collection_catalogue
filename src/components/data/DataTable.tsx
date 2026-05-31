'use client';

import { useState, useCallback, useRef } from 'react';
import type { Column, Row } from '@/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
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
  MoreVertical, Plus, Eye, EyeOff, Trash2, Edit2, ArrowUp, ArrowDown,
  Loader2, Image as ImageIcon, Copy, GripVertical, Columns3, Rows3,
  MoveLeft, MoveRight, ArrowUpDown, Check, X, Pencil, RotateCcw,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ColumnEditorDialog } from './ColumnEditorDialog';

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

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'row' | 'column'; id: string; name?: string } | null>(null);

  const visibleColumns = columns.filter(c => c.visible);
  const hiddenColumns = columns.filter(c => !c.visible);
  const paginatedRows = rows.slice(page * pageSize, (page + 1) * pageSize);
  const allVisibleSelected = paginatedRows.length > 0 && paginatedRows.every(r => selectedRows.has(r.id));

  // ── Cell editing ──────────────────────────────────────────────────────────

  const startEditing = (rowId: string, colSlug: string, value: unknown) => {
    setEditingCell(`${rowId}-${colSlug}`);
    const strVal = typeof value === 'string' ? value : value ? JSON.stringify(value) : '';
    setEditValue(strVal);
  };

  const saveCell = async (rowId: string, colSlug: string) => {
    setEditingCell(null);
    const row = rows.find(r => r.id === rowId);
    if (!row) return;

    const data = { ...row.data } as Record<string, unknown>;
    data[colSlug] = editValue;

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
      // Swap order values
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

  const moveColumn = async (colId: string, direction: 'left' | 'right') => {
    const sortedCols = [...columns].sort((a, b) => a.order - b.order);
    const idx = sortedCols.findIndex(c => c.id === colId);
    if (idx < 0) return;
    if (direction === 'left' && idx === 0) return;
    if (direction === 'right' && idx === sortedCols.length - 1) return;

    const swapIdx = direction === 'left' ? idx - 1 : idx + 1;
    const currentCol = sortedCols[idx];
    const swapCol = sortedCols[swapIdx];

    try {
      await Promise.all([
        fetch(`/api/datasources/${dataSourceId}/columns/${currentCol.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order: swapCol.order }),
        }),
        fetch(`/api/datasources/${dataSourceId}/columns/${swapCol.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order: currentCol.order }),
        }),
      ]);
      onRefresh();
    } catch {
      toast.error('Erreur de déplacement');
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

    const strVal = String(value);

    if (col.type === 'IMAGE' || (col.type === 'IMAGE_ARRAY' && strVal.startsWith('http'))) {
      if (strVal.startsWith('[')) {
        try {
          const arr = JSON.parse(strVal);
          if (Array.isArray(arr)) return <Badge variant="secondary" className="text-[10px]">{arr.length} images</Badge>;
        } catch { /* not valid JSON */ }
      }
      if (strVal.startsWith('http')) {
        return (
          <div className="flex items-center gap-1">
            <ImageIcon className="w-3 h-3 text-muted-foreground" />
            <span className="truncate text-xs text-blue-600 max-w-[120px]">Image</span>
          </div>
        );
      }
    }

    if (col.type === 'CURRENCY') {
      return <span className="font-medium">{strVal}</span>;
    }

    if (col.type === 'BOOLEAN') {
      return <Badge variant={strVal === 'true' ? 'default' : 'secondary'} className="text-[10px]">{strVal}</Badge>;
    }

    if (col.type === 'URL' && strVal.startsWith('http')) {
      return <a href={strVal} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 truncate max-w-[150px] block hover:underline">Lien</a>;
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
    <div className="h-full flex flex-col">
      {/* Bulk action bar */}
      {selectedRows.size > 0 && (
        <div className="h-10 border-b border-border bg-gold/5 flex items-center px-3 gap-3 shrink-0">
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

      {/* Hidden columns bar */}
      {hiddenColumns.length > 0 && (
        <div className="border-b border-border bg-muted/30 px-3 py-1.5 flex items-center gap-2 shrink-0 overflow-x-auto">
          <EyeOff className="w-3 h-3 text-muted-foreground shrink-0" />
          <span className="text-[10px] text-muted-foreground shrink-0">Masquées :</span>
          {hiddenColumns.map(col => (
            <Badge
              key={col.id}
              variant="outline"
              className="text-[10px] gap-1 cursor-pointer hover:bg-muted transition-colors"
              onClick={() => toggleColumnVisibility(col)}
            >
              {col.name}
              <Eye className="w-2.5 h-2.5" />
            </Badge>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 z-10">
            <tr className="bg-muted/80 backdrop-blur-sm">
              {/* Select all checkbox */}
              <th className="px-2 py-2 w-9">
                <Checkbox
                  checked={allVisibleSelected}
                  onCheckedChange={toggleAllVisible}
                  className="h-3.5 w-3.5"
                />
              </th>
              <th className="px-2 py-2 text-left text-xs font-medium text-muted-foreground w-10">#</th>
              {visibleColumns.map(col => (
                <th key={col.id} className="px-3 py-2 text-left text-xs font-medium text-muted-foreground border-l border-border min-w-[120px] group/col">
                  <div className="flex items-center gap-1">
                    {/* Column name — inline rename or display */}
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
                        className="h-6 text-xs w-[100px]"
                        autoFocus
                      />
                    ) : (
                      <span
                        className="truncate cursor-pointer hover:text-foreground transition-colors"
                        onDoubleClick={() => {
                          setRenamingColId(col.id);
                          setRenameValue(col.name);
                        }}
                        title="Double-cliquer pour renommer"
                      >
                        {col.name}
                      </span>
                    )}

                    {/* Column menu */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="opacity-0 group-hover/col:opacity-100 hover:opacity-100 p-0.5 rounded transition-opacity">
                          <MoreVertical className="w-3 h-3" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-52">
                        <DropdownMenuItem onClick={() => { setRenamingColId(col.id); setRenameValue(col.name); }}>
                          <Pencil className="w-3.5 h-3.5 mr-2" /> Renommer
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setEditingColumn(col); setShowColumnEditor(true); }}>
                          <Edit2 className="w-3.5 h-3.5 mr-2" /> Modifier le type
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => moveColumn(col.id, 'left')} disabled={col.order === Math.min(...visibleColumns.map(c => c.order))}>
                          <MoveLeft className="w-3.5 h-3.5 mr-2" /> Déplacer à gauche
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => moveColumn(col.id, 'right')} disabled={col.order === Math.max(...visibleColumns.map(c => c.order))}>
                          <MoveRight className="w-3.5 h-3.5 mr-2" /> Déplacer à droite
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => toggleColumnVisibility(col)}>
                          {col.visible ? <><EyeOff className="w-3.5 h-3.5 mr-2" /> Masquer la colonne</> : <><Eye className="w-3.5 h-3.5 mr-2" /> Afficher la colonne</>}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteTarget({ type: 'column', id: col.id, name: col.name })}>
                          <Trash2 className="w-3.5 h-3.5 mr-2" /> Supprimer la colonne
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <Badge variant="outline" className="text-[9px] px-1 py-0 shrink-0">{col.type}</Badge>
                  </div>
                </th>
              ))}
              <th className="px-2 py-2 w-10" />
            </tr>
          </thead>
          <tbody>
            {paginatedRows.map((row, idx) => {
              const isSelected = selectedRows.has(row.id);
              const rowNum = page * pageSize + idx + 1;

              return (
                <tr key={row.id} className={cn(
                  'border-b border-border/50 group hover:bg-muted/30 transition-colors',
                  isSelected && 'bg-gold/5 hover:bg-gold/10'
                )}>
                  {/* Row checkbox */}
                  <td className="px-2 py-1.5">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleRowSelect(row.id)}
                      className="h-3.5 w-3.5"
                    />
                  </td>
                  <td className="px-2 py-1.5 text-xs text-muted-foreground">{rowNum}</td>
                  {visibleColumns.map(col => {
                    const cellKey = `${row.id}-${col.slug}`;
                    const isEditing = editingCell === cellKey;

                    return (
                      <td key={col.slug} className="px-3 py-1.5 border-l border-border/30">
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
                            className="cursor-pointer min-h-[24px] flex items-center"
                            onDoubleClick={() => startEditing(row.id, col.slug, (row.data as Record<string, unknown>)[col.slug])}
                            title="Double-cliquer pour modifier"
                          >
                            {renderCellValue(row, col)}
                          </div>
                        )}
                      </td>
                    );
                  })}
                  {/* Row actions dropdown */}
                  <td className="px-1">
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

      {/* Footer: pagination + add row */}
      <div className="h-10 border-t border-border bg-card flex items-center px-3 gap-3 shrink-0">
        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={addRow}>
          <Plus className="w-3 h-3" /> Ligne
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
        editingColumn={editingColumn}
        onSaved={() => { onRefresh(); setEditingColumn(null); }}
      />
    </div>
  );
}
