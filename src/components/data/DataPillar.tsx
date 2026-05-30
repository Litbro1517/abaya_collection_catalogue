'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '@/lib/store';
import type { DataSource, Column, Row } from '@/types';
import { DataSourceList } from './DataSourceList';
import { DataTable } from './DataTable';
import { ImportCSVDialog } from './ImportCSVDialog';
import { ColumnEditorDialog } from './ColumnEditorDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Upload, Download, Columns3, Link2 } from 'lucide-react';
import { toast } from 'sonner';

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
  } = useAppStore();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newColor, setNewColor] = useState('#C9A84C');
  const [loading, setLoading] = useState(false);

  const colors = ['#C9A84C', '#1A1A1A', '#D32F2F', '#2E7D32', '#1565C0', '#8B4513', '#F48FB1', '#483C32'];

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
      const res = await fetch(`/api/datasources/${activeDataSourceId}`);
      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          setColumns(json.data.columns || []);
          setRows(json.data.rows || []);
        }
      }
    } catch {
      // silent
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

  const handleExport = async () => {
    if (!activeDataSourceId) return;
    try {
      const res = await fetch(`/api/datasources/${activeDataSourceId}/export`);
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'catalogue.csv';
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Export réussi');
      }
    } catch {
      toast.error('Erreur d\'export');
    }
  };

  return (
    <div className="flex h-full">
      {/* Left: Data source list */}
      <div className="w-64 border-r border-border bg-card overflow-y-auto shrink-0">
        <div className="p-3">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">Tables de données</h2>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setShowCreateDialog(true)}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          <DataSourceList
            dataSources={dataSources}
            activeId={activeDataSourceId}
            onSelect={setActiveDataSourceId}
            onRefresh={loadDataSources}
          />
        </div>
      </div>

      {/* Right: Data table + toolbar */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        {activeDataSourceId && (
          <div className="h-11 border-b border-border bg-card flex items-center px-3 gap-2 shrink-0">
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={() => setShowImportModal(true)}>
              <Upload className="w-3.5 h-3.5" />
              Importer CSV
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={handleExport}>
              <Download className="w-3.5 h-3.5" />
              Exporter
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={() => setShowColumnModal(true)}>
              <Columns3 className="w-3.5 h-3.5" />
              Ajouter colonne
            </Button>
            <div className="flex-1" />
            <span className="text-xs text-muted-foreground">{rows.length} lignes · {columns.filter(c => c.visible).length} colonnes</span>
          </div>
        )}

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {activeDataSourceId ? (
            <DataTable
              columns={columns}
              rows={rows}
              dataSourceId={activeDataSourceId}
              loading={loading}
              onRefresh={loadDataSourceData}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <Database2Icon className="w-12 h-12 mb-4 opacity-30" />
              <p className="text-sm">Sélectionnez ou créez une table de données</p>
              <p className="text-xs mt-1">Importez un CSV ou créez une table manuellement</p>
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
                    className={cn('w-8 h-8 rounded-full border-2 transition-all', newColor === c ? 'border-foreground scale-110' : 'border-transparent')}
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
          onSaved={() => loadDataSourceData()}
        />
      )}
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

function cn(...inputs: (string | undefined | false)[]) {
  return inputs.filter(Boolean).join(' ');
}
