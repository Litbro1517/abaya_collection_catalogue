'use client';

import { useAppStore } from '@/lib/store';
import { clearCache, CACHE_KEYS } from '@/lib/cache';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Sheet, Unplug, Link2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Google Connect Panel — CONNECTION ONLY
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * This panel is for initial Google account connection/disconnection.
 * The Link2 icon opens the GoogleSheetsBrowser to import/connect a new source.
 *
 * ⚠️ SYNC is now per-table — see DataPillar.tsx for the RefreshCw button
 *    next to each imported table.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */
export function GoogleConnectPanel() {
  const {
    googleSession,
    setGoogleSession,
    setDataSources,
    setShowGoogleSheetsBrowser,
  } = useAppStore();

  const handleConnect = async () => {
    try {
      const res = await fetch('/api/google/auth');
      if (res.ok) {
        const json = await res.json();
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
        // 1. Clear Google session from Zustand (immediate UI update)
        setGoogleSession(null);

        // 2. Invalidate datasources cache so stale Google-linked badges are cleared
        clearCache(CACHE_KEYS.datasources);

        // 3. Show success immediately — user sees instant feedback
        toast.success('Google déconnecté');

        // 4. Reload datasources in background (non-blocking, no await)
        // The table list will update silently when the fetch completes
        fetch('/api/datasources')
          .then(r => r.ok ? r.json() : null)
          .then(json => {
            if (json?.data) setDataSources(json.data);
          })
          .catch(() => {
            // Network error — datasources list will refresh on next page load
          });
      }
    } catch {
      toast.error('Erreur de déconnexion');
    }
  };

  /**
   * Open the GoogleSheetsBrowser to connect/import a new sheet source
   */
  const handleOpenSheetsBrowser = () => {
    setShowGoogleSheetsBrowser(true);
  };

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
          {/* ━━━ Link/Connect icon — Opens GoogleSheetsBrowser for new source ━━━ */}
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-gold hover:bg-gold/10"
            onClick={handleOpenSheetsBrowser}
            title="Connecter une nouvelle source Google Sheets"
          >
            <Link2 className="w-3.5 h-3.5" />
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
    </Card>
  );
}
