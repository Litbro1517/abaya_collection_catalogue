'use client';

import { useAppStore } from '@/lib/store';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Sheet, Unplug, RefreshCw, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export function GoogleConnectPanel() {
  const {
    googleSession,
    setGoogleSession,
    syncStatus,
    setSyncStatus,
    setSyncMessage,
    setShowGoogleSheetsBrowser,
    activeDataSourceId,
    dataSources,
  } = useAppStore();

  const handleConnect = async () => {
    try {
      const res = await fetch('/api/google/auth');
      if (res.ok) {
        const json = await res.json();
        // API returns { data: { authUrl, state }, error: null }
        const authUrl = json.data?.authUrl || json.url;
        if (authUrl) {
          window.location.href = authUrl;
        } else {
          toast.error(json.error || 'URL d\'authentification non trouvée');
        }
      } else {
        const json = await res.json();
        if (json.setupRequired) {
          toast.error('Google OAuth non configuré. Ajoutez vos identifiants dans les paramètres.');
        } else {
          toast.error('Google non configuré');
        }
      }
    } catch {
      toast.error('Erreur de connexion Google');
    }
  };

  const handleDisconnect = async () => {
    try {
      const res = await fetch('/api/google/session', { method: 'DELETE' });
      if (res.ok) {
        setGoogleSession(null);
        toast.success('Google déconnecté');
      }
    } catch {
      toast.error('Erreur de déconnexion');
    }
  };

  /**
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   * DELTA SYNC — "Importer une feuille" button handler
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   * If there's an active DataSource linked to a Google Sheet:
   *   → Execute DELTA sync directly (compare "#" column, insert missing only)
   * Otherwise:
   *   → Open the GoogleSheetsBrowser for first-time import
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   */
  const handleSync = async () => {
    // Check if there's an active DataSource with a Google Sheet linked
    const activeDs = dataSources.find(d => d.id === activeDataSourceId);

    if (activeDs?.sheetId) {
      // ━━━ DELTA SYNC PATH ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      setSyncStatus('syncing');
      setSyncMessage('Synchronisation Delta en cours...');
      try {
        const res = await fetch('/api/google/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sheetId: activeDs.sheetId,
            dataSourceId: activeDs.id,
            mode: 'delta',
          }),
        });
        if (res.ok) {
          const json = await res.json();
          const data = json.data;
          setSyncStatus('success');

          if (data.rowsCreated > 0) {
            setSyncMessage(`Delta: ${data.rowsCreated} nouveau(x) produit(s) ajouté(s), ${data.rowsSkipped} existant(s) préservé(s)`);
            toast.success(`Synchronisation Delta: ${data.rowsCreated} nouveau(x) produit(s) ajouté(s)`, {
              description: `Statut=Courant, Disponibilité=Épuisé, Visibilité=Visible 👁️`,
            });
          } else {
            setSyncMessage('Catalogue à jour — aucun nouveau produit');
            toast.info('Catalogue à jour', {
              description: 'Aucun nouveau produit à ajouter depuis Google Sheets',
            });
          }

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
        toast.error('Erreur de connexion lors de la synchronisation Delta');
        setTimeout(() => setSyncStatus('idle'), 5000);
      }
    } else {
      // ━━━ FIRST IMPORT PATH — Open GoogleSheetsBrowser ━━━━━━━━
      setShowGoogleSheetsBrowser(true);
    }
  };

  const isSyncing = syncStatus === 'syncing';

  if (!googleSession) {
    return (
      <Card className="p-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
            <Sheet className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium">Google Sheets</p>
            <p className="text-[10px] text-muted-foreground">Non connecté</p>
          </div>
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5 shrink-0" onClick={handleConnect}>
            <Sheet className="w-3 h-3" />
            Connecter
          </Button>
        </div>
      </Card>
    );
  }

  const initials = (googleSession.name || googleSession.email || 'G').charAt(0).toUpperCase();
  const lastSync = googleSession.updatedAt
    ? new Date(googleSession.updatedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    : '';

  // Check if active DS has a sheetId for tooltip
  const activeDs = dataSources.find(d => d.id === activeDataSourceId);
  const hasLinkedSheet = !!activeDs?.sheetId;
  const tooltipText = hasLinkedSheet
    ? 'Synchronisation Delta — Ajouter uniquement les nouveaux produits'
    : 'Importer une feuille Google Sheets';

  return (
    <Card className="p-3">
      <div className="flex items-center gap-2">
        <Avatar className="w-8 h-8">
          {googleSession.picture && <AvatarImage src={googleSession.picture} alt={googleSession.name || ''} />}
          <AvatarFallback className="text-xs bg-green-100 text-green-700">{initials}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate">{googleSession.name || 'Google'}</p>
          <p className="text-[10px] text-muted-foreground truncate">{googleSession.email}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {/* ━━━ "Importer une feuille" BUTTON — DELTA SYNC ENTRY POINT ━━━ */}
          <Button
            size="sm"
            variant="ghost"
            className={cn(
              "h-7 w-7 p-0",
              hasLinkedSheet && "text-[#C9A84C] hover:text-[#C9A84C]/80 hover:bg-[#C9A84C]/10"
            )}
            onClick={handleSync}
            disabled={isSyncing}
            title={tooltipText}
          >
            {isSyncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
            onClick={handleDisconnect}
            title="Déconnecter"
          >
            <Unplug className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
      {lastSync && (
        <p className="text-[10px] text-muted-foreground mt-1.5 pl-10">
          Dernière sync : {lastSync}
        </p>
      )}
      {hasLinkedSheet && (
        <p className="text-[10px] text-[#C9A84C] mt-1 pl-10">
          🔄 Delta sync disponible
        </p>
      )}
    </Card>
  );
}
