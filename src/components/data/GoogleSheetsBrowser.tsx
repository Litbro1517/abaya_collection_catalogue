'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '@/lib/store';
import type { GoogleSheetInfo } from '@/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, FileSpreadsheet, RefreshCw, Link, Loader2, ImageIcon, AlertCircle, Check } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported?: () => void;
}

export function GoogleSheetsBrowser({ open, onOpenChange, onImported }: Props) {
  const { googleSession, setGoogleSession, setGoogleSheets, setSyncStatus, setSyncMessage, setShowGoogleSheetsBrowser } = useAppStore();
  const [sheets, setLocalSheets] = useState<GoogleSheetInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedSheet, setSelectedSheet] = useState<GoogleSheetInfo | null>(null);
  const [sheetTabs, setSheetTabs] = useState<string[]>([]);
  const [selectedTab, setSelectedTab] = useState<string>('');
  const [loadingTabs, setLoadingTabs] = useState(false);
  const [importing, setImporting] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [manualUrl, setManualUrl] = useState('');

  // Fetch sheets list
  const fetchSheets = useCallback(async () => {
    if (!googleSession) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/google/sheets');
      if (res.ok) {
        const json = await res.json();
        const sheetList = json.data || [];
        setLocalSheets(sheetList);
        setGoogleSheets(sheetList);
      } else if (res.status === 401) {
        setGoogleSession(null);
        setError('Session Google expirée. Veuillez vous reconnecter.');
      } else {
        const json = await res.json();
        setError(json.error || 'Erreur lors du chargement des feuilles');
      }
    } catch {
      setError('Erreur de connexion');
    } finally {
      setLoading(false);
    }
  }, [googleSession, setGoogleSheets, setGoogleSession]);

  // Load sheets when dialog opens
  useEffect(() => {
    if (open && googleSession) {
      fetchSheets();
    }
    if (!open) {
      setSelectedSheet(null);
      setSheetTabs([]);
      setSelectedTab('');
      setShowUrlInput(false);
      setManualUrl('');
      setError('');
    }
  }, [open, googleSession, fetchSheets]);

  // When a sheet is selected, fetch its tabs
  const handleSelectSheet = async (sheet: GoogleSheetInfo) => {
    setSelectedSheet(sheet);
    setLoadingTabs(true);
    setSheetTabs([]);
    setSelectedTab('');
    setError('');
    try {
      const res = await fetch(`/api/google/sheets/${sheet.id}/tabs`);
      if (res.ok) {
        const json = await res.json();
        const tabs: string[] = json.data || [];
        setSheetTabs(tabs);
        if (tabs.length > 0) {
          setSelectedTab(tabs[0]);
        }
      } else {
        const json = await res.json();
        setError(json.error || 'Erreur lors du chargement des onglets');
      }
    } catch {
      setError('Erreur de connexion');
    } finally {
      setLoadingTabs(false);
    }
  };

  // Import the selected sheet
  const handleImport = async () => {
    if (!selectedSheet) return;
    setImporting(true);
    setSyncStatus('syncing');
    setSyncMessage('Importation en cours...');
    try {
      const res = await fetch('/api/google/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sheetId: selectedSheet.id,
          sheetName: selectedTab || undefined,
        }),
      });
      if (res.ok) {
        const json = await res.json();
        setSyncStatus('success');
        setSyncMessage(`${json.data?.rowsCreated || 0} lignes importées`);
        toast.success(`Import réussi : ${json.data?.rowsCreated || 0} lignes, ${json.data?.columnsCreated || 0} colonnes`);
        setShowGoogleSheetsBrowser(false);
        onImported?.();
        setTimeout(() => setSyncStatus('idle'), 3000);
      } else {
        const json = await res.json();
        setSyncStatus('error');
        setSyncMessage(json.error || 'Erreur d\'importation');
        setError(json.error || 'Erreur d\'importation');
        setTimeout(() => setSyncStatus('idle'), 5000);
      }
    } catch {
      setSyncStatus('error');
      setSyncMessage('Erreur de connexion');
      setError('Erreur de connexion');
      setTimeout(() => setSyncStatus('idle'), 5000);
    } finally {
      setImporting(false);
    }
  };

  // Import via manual URL
  const handleManualImport = async () => {
    if (!manualUrl.trim()) return;
    const match = manualUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
    if (!match) {
      setError('URL de Google Sheets invalide');
      return;
    }
    const sheetId = match[1];
    setImporting(true);
    setSyncStatus('syncing');
    setSyncMessage('Importation en cours...');
    try {
      const res = await fetch('/api/google/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sheetId }),
      });
      if (res.ok) {
        const json = await res.json();
        setSyncStatus('success');
        setSyncMessage(`${json.data?.rowsCreated || 0} lignes importées`);
        toast.success(`Import réussi : ${json.data?.rowsCreated || 0} lignes`);
        setShowGoogleSheetsBrowser(false);
        onImported?.();
        setTimeout(() => setSyncStatus('idle'), 3000);
      } else {
        const json = await res.json();
        setSyncStatus('error');
        setSyncMessage(json.error || 'Erreur d\'importation');
        setError(json.error || 'Erreur d\'importation');
        setTimeout(() => setSyncStatus('idle'), 5000);
      }
    } catch {
      setSyncStatus('error');
      setSyncMessage('Erreur de connexion');
      setError('Erreur de connexion');
      setTimeout(() => setSyncStatus('idle'), 5000);
    } finally {
      setImporting(false);
    }
  };

  // Connect Google
  const handleConnectGoogle = async () => {
    try {
      const res = await fetch('/api/google/auth');
      if (res.ok) {
        const json = await res.json();
        if (json.data?.authUrl) {
          window.location.href = json.data.authUrl;
        }
      } else {
        toast.error('Google non configuré. Veuillez configurer les identifiants OAuth dans les paramètres.');
      }
    } catch {
      toast.error('Erreur de connexion Google');
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sheet className="w-5 h-5 text-gold" />
            Google Sheets
          </DialogTitle>
          <DialogDescription>
            Sélectionnez une feuille Google Sheets à importer comme source de données
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-3 mt-2">
          {/* Not connected state */}
          {!googleSession && (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-4">
              <FileSpreadsheet className="w-12 h-12 opacity-30" />
              <p className="text-sm">Connectez votre compte Google pour accéder à vos feuilles</p>
              <Button onClick={handleConnectGoogle} className="gap-2">
                <Sheet className="w-4 h-4" />
                Connecter Google
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                Ou saisissez l&apos;URL d&apos;une feuille publique ci-dessous
              </p>
              <div className="flex gap-2 w-full max-w-md">
                <Input
                  value={manualUrl}
                  onChange={(e) => setManualUrl(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  className="h-9 text-sm"
                />
                <Button
                  size="sm"
                  className="h-9 gap-1.5 shrink-0"
                  onClick={handleManualImport}
                  disabled={!manualUrl.trim() || importing}
                >
                  {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  Importer
                </Button>
              </div>
            </div>
          )}

          {/* Connected state */}
          {googleSession && (
            <>
              {/* Tab toggle */}
              <div className="flex items-center gap-2">
                <Button
                  variant={!showUrlInput ? 'default' : 'outline'}
                  size="sm"
                  className="h-7 text-xs gap-1.5"
                  onClick={() => setShowUrlInput(false)}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  Mes feuilles
                </Button>
                <Button
                  variant={showUrlInput ? 'default' : 'outline'}
                  size="sm"
                  className="h-7 text-xs gap-1.5"
                  onClick={() => setShowUrlInput(true)}
                >
                  <Link className="w-3.5 h-3.5" />
                  Saisir l&apos;URL
                </Button>
                <div className="flex-1" />
                {!showUrlInput && (
                  <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5" onClick={fetchSheets} disabled={loading}>
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                    Actualiser
                  </Button>
                )}
              </div>

              {/* Manual URL input */}
              {showUrlInput && (
                <div className="space-y-3 border rounded-lg p-4">
                  <p className="text-xs text-muted-foreground">
                    Collez l&apos;URL d&apos;une Google Sheet publique pour l&apos;importer directement.
                    La feuille doit être publiée sur le web (Fichier &gt; Partager &gt; Publier sur le web).
                  </p>
                  <div className="flex gap-2">
                    <Input
                      value={manualUrl}
                      onChange={(e) => setManualUrl(e.target.value)}
                      placeholder="https://docs.google.com/spreadsheets/d/..."
                      className="h-9 text-sm"
                    />
                    <Button
                      size="sm"
                      className="h-9 gap-1.5 shrink-0"
                      onClick={handleManualImport}
                      disabled={!manualUrl.trim() || importing}
                    >
                      {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      Importer
                    </Button>
                  </div>
                </div>
              )}

              {/* Sheet list */}
              {!showUrlInput && !selectedSheet && (
                <ScrollArea className="flex-1 max-h-96">
                  {loading && (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                  )}
                  {!loading && error && (
                    <div className="flex items-center gap-2 p-4 text-destructive text-sm">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      {error}
                    </div>
                  )}
                  {!loading && !error && sheets.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                      <FileSpreadsheet className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">Aucune feuille trouvée sur votre Drive</p>
                    </div>
                  )}
                  {!loading && sheets.map((sheet) => (
                    <button
                      key={sheet.id}
                      className="w-full flex items-start gap-3 p-3 rounded-lg hover:bg-muted transition-colors text-left"
                      onClick={() => handleSelectSheet(sheet)}
                    >
                      <FileSpreadsheet className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{sheet.name}</p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-[10px] text-muted-foreground">
                            Modifiée le {formatDate(sheet.modifiedTime)}
                          </span>
                          {sheet.owners?.[0] && (
                            <span className="text-[10px] text-muted-foreground">
                              {sheet.owners[0].displayName}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </ScrollArea>
              )}

              {/* Selected sheet with tabs */}
              {selectedSheet && (
                <div className="flex-1 overflow-auto">
                  <div className="flex items-center gap-2 mb-3">
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => {
                      setSelectedSheet(null);
                      setSheetTabs([]);
                      setSelectedTab('');
                    }}>
                      ← Retour
                    </Button>
                    <span className="text-sm font-medium truncate">{selectedSheet.name}</span>
                  </div>

                  {loadingTabs && (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                  )}

                  {error && (
                    <div className="flex items-center gap-2 p-4 text-destructive text-sm">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      {error}
                    </div>
                  )}

                  {!loadingTabs && sheetTabs.length > 0 && (
                    <div className="space-y-3">
                      {/* Tab selector */}
                      <div className="border rounded-lg p-3 space-y-2">
                        <p className="text-xs text-muted-foreground">Sélectionnez l&apos;onglet à importer</p>
                        <div className="flex gap-1 flex-wrap">
                          {sheetTabs.map((tab) => (
                            <Button
                              key={tab}
                              variant={selectedTab === tab ? 'default' : 'outline'}
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => setSelectedTab(tab)}
                            >
                              {tab}
                            </Button>
                          ))}
                        </div>
                      </div>

                      {/* Info about import */}
                      <div className="border rounded-lg p-3 space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <ImageIcon className="w-4 h-4 text-gold" />
                          <span>Les colonnes contenant des liens Google Drive seront automatiquement détectées comme colonnes d&apos;images</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Après l&apos;import, vous pourrez configurer quelles colonnes utiliser pour les titres, descriptions, images de couverture et carrousels dans la section Mise en page.
                        </p>
                      </div>
                    </div>
                  )}

                  {!loadingTabs && sheetTabs.length === 0 && !error && (
                    <div className="text-center py-8 text-muted-foreground">
                      <p className="text-sm">Aucun onglet trouvé</p>
                      <p className="text-xs mt-1">Vous pouvez quand même importer la feuille complète</p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer with Import button */}
        {googleSession && selectedSheet && (
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button onClick={handleImport} disabled={importing} className="gap-2">
              {importing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Importation...
                </>
              ) : (
                <>
                  <Sheet className="w-4 h-4" />
                  Importer{selectedTab ? ` : ${selectedTab}` : ''}
                </>
              )}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
