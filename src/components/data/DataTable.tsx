'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import type { Column, Row } from '@/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { MoreVertical, Plus, Eye, EyeOff, Trash2, Edit2, ArrowUp, ArrowDown, Loader2, Image as ImageIcon } from 'lucide-react';
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

  const visibleColumns = columns.filter(c => c.visible);
  const paginatedRows = rows.slice(page * pageSize, (page + 1) * pageSize);

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

  const deleteRow = async (rowId: string) => {
    try {
      const res = await fetch(`/api/datasources/${dataSourceId}/rows/${rowId}`, { method: 'DELETE' });
      if (res.ok) {
        onRefresh();
        toast.success('Ligne supprimée');
      }
    } catch {
      toast.error('Erreur');
    }
  };

  const toggleColumnVisibility = async (col: Column) => {
    try {
      await fetch(`/api/datasources/${dataSourceId}/columns/${col.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visible: !col.visible }),
      });
      onRefresh();
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

  const renderCellValue = (row: Row, col: Column) => {
    const value = (row.data as Record<string, unknown>)[col.slug];
    if (value === undefined || value === null || value === '') return <span className="text-muted-foreground/40">—</span>;

    const strVal = String(value);

    if (col.type === 'IMAGE' || (col.type === 'IMAGE_ARRAY' && strVal.startsWith('http'))) {
      if (strVal.startsWith('[')) {
        try {
          const arr = JSON.parse(strVal);
          if (Array.isArray(arr)) return <Badge variant="secondary" className="text-[10px]">{arr.length} images</Badge>;
        } catch {}
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 z-10">
            <tr className="bg-muted/80 backdrop-blur-sm">
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground w-10">#</th>
              {visibleColumns.map(col => (
                <th key={col.id} className="px-3 py-2 text-left text-xs font-medium text-muted-foreground border-l border-border min-w-[120px]">
                  <div className="flex items-center gap-1">
                    <span className="truncate">{col.name}</span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="opacity-0 group-hover:opacity-100 hover:opacity-100 p-0.5 rounded transition-opacity">
                          <MoreVertical className="w-3 h-3" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-48">
                        <DropdownMenuItem onClick={() => { setEditingColumn(col); setShowColumnEditor(true); }}>
                          <Edit2 className="w-3.5 h-3.5 mr-2" /> Modifier
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toggleColumnVisibility(col)}>
                          {col.visible ? <><EyeOff className="w-3.5 h-3.5 mr-2" /> Masquer</> : <><Eye className="w-3.5 h-3.5 mr-2" /> Afficher</>}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive" onClick={() => deleteColumn(col.id)}>
                          <Trash2 className="w-3.5 h-3.5 mr-2" /> Supprimer
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Badge variant="outline" className="text-[9px] px-1 py-0 shrink-0">{col.type}</Badge>
                  </div>
                </th>
              ))}
              <th className="px-3 py-2 w-10" />
            </tr>
          </thead>
          <tbody>
            {paginatedRows.map((row, idx) => (
              <tr key={row.id} className="border-b border-border/50 hover:bg-muted/30 group">
                <td className="px-3 py-1.5 text-xs text-muted-foreground">{page * pageSize + idx + 1}</td>
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
                        >
                          {renderCellValue(row, col)}
                        </div>
                      )}
                    </td>
                  );
                })}
                <td className="px-1">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100">
                        <Trash2 className="w-3 h-3 text-destructive" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Supprimer cette ligne ?</AlertDialogTitle>
                        <AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteRow(row.id)}>Supprimer</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </td>
              </tr>
            ))}
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
        <span className="text-xs text-muted-foreground">{rows.length} lignes</span>
      </div>

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
