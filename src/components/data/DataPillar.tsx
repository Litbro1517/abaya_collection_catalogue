'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '@/lib/store';
import type { DataSource } from '@/types';
import { DataTable } from './DataTable';
import { ImportCSVDialog } from './ImportCSVDialog';
import { ColumnEditorDialog } from './ColumnEditorDialog';
import { GoogleSheetsBrowser } from './GoogleSheetsBrowser';
import { GoogleConnectPanel } from './GoogleConnectPanel';
import { SyncStatusIndicator } from './SyncStatusIndicator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
  Plus, Upload, Download, Columns3, Link2, Sheet, RefreshCw, HardDrive,
  Trash2, Pencil, MoreVertical,
} from 'lucide-react';
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
    showGoogleSheetsBrowser,
    setShowGoogleSheetsBrowser,
    googleSession,
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

  const colors = ['#C9A84C', '#1A1A1A', '#D32F2F', '#2E7D32', '#1565C0', '#8B4513', '#F48FB1', '#483C32'];

  // Active data source
  const activeDs = dataSources.find(d => d.id === activeDataSourceId);
  const hasGoogleSheet = !!activeDs?.sheetId;

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
      // First load columns via meta mode (lightweight, no rows)
      const metaRes = await fetch(`/api/datasources/${activeDataSourceId}?mode=meta`);
      if (metaRes.ok) {
        const metaJson = await metaRes.json();
        if (metaJson.data) {
          setColumns(metaJson.data.columns || []);
        }
      }
      // Then load rows via the rows endpoint (paginated, max 50 to prevent OOM)
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
        {/* Table header with name + management */}
        {activeDataSourceId && activeDs && (
          <div className="border-b border-border bg-card shrink-0">
            {/* Table name row */}
            <div className="h-9 px-3 flex items-center gap-2">
              <div
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: activeDs.color }}
              />
              <span className="text-sm font-semibold truncate">{activeDs.name}</span>
              {activeDs.sheetId && (
                <Badge variant="outline" className="text-[9px] gap-1 py-0">
                  <Sheet className="w-2.5 h-2.5" /> Google
                </Badge>
              )}
              <div className="flex-1" />
              {/* Table management dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7">
                    <MoreVertical className="w-3.5 h-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuItem onClick={() => { setRenameValue(activeDs.name); setShowRenameDialog(true); }}>
                    <Pencil className="w-3.5 h-3.5 mr-2" /> Renommer la table
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setShowDeleteTableDialog(true)}>
                    <Trash2 className="w-3.5 h-3.5 mr-2" /> Supprimer la table
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Toolbar row */}
            <div className="h-10 border-t border-border/50 flex items-center px-3 gap-1.5">
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setShowImportModal(true)}>
                <Upload className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Importer</span>
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setShowGoogleSheetsBrowser(true)}>
                <Sheet className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Google</span>
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setShowUrlDialog(true)}>
                <Link2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">URL</span>
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={handleExport}>
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Exporter</span>
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setShowColumnModal(true)}>
                <Columns3 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Colonne</span>
              </Button>
              {hasGoogleSheet && (
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={handleSyncGoogleSheet}>
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Sync</span>
                </Button>
              )}
              <div className="flex-1" />
              <SyncStatusIndicator />
              <span className="text-[10px] text-muted-foreground">{rows.length} lignes · {columns.filter(c => c.visible).length}/{columns.length} colonnes</span>
            </div>
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


