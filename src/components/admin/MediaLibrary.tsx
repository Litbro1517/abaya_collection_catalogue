'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Loader2, Trash2, Search, ImageIcon, Cloud, HardDrive, AlertTriangle,
  Unlink, Link2, CheckSquare, Square,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { resolveHybridImageUrl } from '@/lib/media-utils';

/**
 * MediaLibrary (VG33.2)
 *
 * 3-column strict grid: N° Ordre | Nom Produit | Grille d'Images
 *
 * VG33.2 features:
 * - Per-image checkbox selection + select-all
 * - Bulk toolbar: Casser le lien (Unlink) / Restaurer le lien (Relink) / Supprimer (Delete)
 * - Per-image action buttons: Unlink (linked) / Relink (orphan) / Delete (all)
 * - Orphan filter toggle
 */

interface MediaImage {
  url: string;
  source: 'drive' | 'cdn' | 'unknown';
  fileId: string | null;
  assetStatus: string | null;
  mediaAssetId: string | null;
  originalRowId: string | null;
  isLinked: boolean;
}

interface MediaEntry {
  order: number;
  rowId: string;
  productTitle: string;
  images: MediaImage[];
  hasMediaAsset: boolean;
}

interface Props {
  dataSourceId: string;
  onRefresh?: () => void;
}

// Unique key for an image (for checkbox selection)
function imgKey(entry: MediaEntry, img: MediaImage): string {
  return `${entry.rowId}:${img.mediaAssetId || img.url}`;
}

export function MediaLibrary({ dataSourceId, onRefresh }: Props) {
  const [entries, setEntries] = useState<MediaEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [orphansOnly, setOrphansOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [busyKeys, setBusyKeys] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState(false);

  // VG33.3: CDN bucket scanner state
  const [viewMode, setViewMode] = useState<'library' | 'bucket'>('library');
  const [ghostFiles, setGhostFiles] = useState<Array<{ name: string; size: number; fileId: string | null }>>([]);
  const [bucketStats, setBucketStats] = useState({ totalBucket: 0, totalGhosts: 0, totalTracked: 0 });
  const [scanning, setScanning] = useState(false);
  const [selectedGhosts, setSelectedGhosts] = useState<Set<string>>(new Set());
  const [purging, setPurging] = useState(false);

  const loadMedia = useCallback(async () => {
    setLoading(true);
    try {
      const url = `/api/catalog/media/list?dataSourceId=${dataSourceId}&orphansOnly=${orphansOnly}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to load media');
      const json = await res.json();
      setEntries(json.data || []);
      setSelected(new Set()); // reset selection on reload
    } catch {
      toast.error('Erreur de chargement de la médiathèque');
    } finally {
      setLoading(false);
    }
  }, [dataSourceId, orphansOnly]);

  useEffect(() => {
    loadMedia();
  }, [loadMedia]);

  // VG33.3: CDN bucket scanner
  const scanBucket = useCallback(async () => {
    setScanning(true);
    try {
      const res = await fetch(`/api/catalog/media/scan-bucket?dataSourceId=${dataSourceId}`);
      if (!res.ok) throw new Error('Scan failed');
      const json = await res.json();
      setGhostFiles(json.data?.ghostFiles || []);
      setBucketStats({
        totalBucket: json.data?.totalBucket || 0,
        totalGhosts: json.data?.totalGhosts || 0,
        totalTracked: json.data?.totalTracked || 0,
      });
      setSelectedGhosts(new Set());
    } catch {
      toast.error('Erreur du scan du bucket CDN');
    } finally {
      setScanning(false);
    }
  }, [dataSourceId]);

  useEffect(() => {
    if (viewMode === 'bucket' && ghostFiles.length === 0 && !scanning) {
      scanBucket();
    }
  }, [viewMode, ghostFiles.length, scanning, scanBucket]);

  const handlePurgeGhosts = async () => {
    const files = Array.from(selectedGhosts);
    if (files.length === 0) return;
    if (!confirm(`Supprimer définitivement ${files.length} fichier(s) fantôme(s) du bucket CDN ?`)) return;
    setPurging(true);
    try {
      const res = await fetch('/api/catalog/media/purge-ghosts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files }),
      });
      if (!res.ok) throw new Error('Purge failed');
      const json = await res.json();
      toast.success(`${json.data.deleted} fichier(s) fantôme(s) supprimé(s)`);
      await scanBucket(); // refresh
      onRefresh?.();
    } catch {
      toast.error('Erreur lors de la purge');
    } finally {
      setPurging(false);
      setSelectedGhosts(new Set());
    }
  };

  // Collect all images from all entries (for select-all)
  const allImages: Array<{ entry: MediaEntry; img: MediaImage; key: string }> = [];
  entries.forEach((entry) => {
    entry.images.forEach((img) => {
      allImages.push({ entry, img, key: imgKey(entry, img) });
    });
  });

  const allSelected = allImages.length > 0 && allImages.every((ai) => selected.has(ai.key));
  const someSelected = selected.size > 0;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(allImages.map((ai) => ai.key)));
    }
  };

  const toggleSelect = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Build items array for bulk actions from selected keys
  const getSelectedItems = (): Array<{ mediaAssetId?: string; cdnUrl?: string }> => {
    return allImages
      .filter((ai) => selected.has(ai.key))
      .map((ai) => ({
        mediaAssetId: ai.img.mediaAssetId || undefined,
        cdnUrl: ai.img.url,
      }));
  };

  // ── Action handlers ──

  const doAction = async (
    keys: string[],
    action: 'unlink' | 'relink' | 'delete',
    items: Array<{ mediaAssetId?: string; cdnUrl?: string }>,
    successMsg: string,
  ) => {
    setBusyKeys((prev) => new Set([...prev, ...keys]));
    setBulkAction(true);
    try {
      const res = await fetch(`/api/catalog/media/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          items.length > 1 ? { items } : items[0],
        ),
      });
      if (!res.ok) throw new Error(`${action} failed`);
      const json = await res.json();
      const count = json.data?.unlinked || json.data?.relinked || json.data?.deleted || 0;
      toast.success(successMsg.replace('{count}', String(count)));
      await loadMedia();
      onRefresh?.();
    } catch {
      toast.error(`Erreur lors de l'action ${action}`);
    } finally {
      setBusyKeys((prev) => {
        const next = new Set(prev);
        keys.forEach((k) => next.delete(k));
        return next;
      });
      setBulkAction(false);
    }
  };

  const handleUnlink = async (entry: MediaEntry, img: MediaImage) => {
    const key = imgKey(entry, img);
    if (!img.mediaAssetId) {
      toast.error('Aucun asset média associé');
      return;
    }
    await doAction([key], 'unlink', [{ mediaAssetId: img.mediaAssetId }], 'Lien cassé — image orphanisée');
  };

  const handleRelink = async (entry: MediaEntry, img: MediaImage) => {
    const key = imgKey(entry, img);
    if (!img.mediaAssetId) {
      toast.error('Aucun asset média associé');
      return;
    }
    await doAction([key], 'relink', [{ mediaAssetId: img.mediaAssetId }], 'Lien restauré');
  };

  const handleDelete = async (entry: MediaEntry, img: MediaImage) => {
    const key = imgKey(entry, img);
    if (!confirm('Supprimer définitivement ce fichier média du CDN ?')) return;
    // MANDAT 4P — tsc : la prop attend string|undefined (mediaAssetId est
    // string|null) → normalisation null→undefined, runtime identique
    await doAction([key], 'delete', [{ mediaAssetId: img.mediaAssetId ?? undefined, cdnUrl: img.url }], 'Fichier supprimé');
  };

  const handleBulkUnlink = async () => {
    const items = getSelectedItems();
    if (items.length === 0) return;
    await doAction(Array.from(selected), 'unlink', items, '{count} lien(s) cassé(s)');
    setSelected(new Set());
  };

  const handleBulkRelink = async () => {
    const items = getSelectedItems();
    if (items.length === 0) return;
    await doAction(Array.from(selected), 'relink', items, '{count} lien(s) restauré(s)');
    setSelected(new Set());
  };

  const handleBulkDelete = async () => {
    const items = getSelectedItems();
    if (items.length === 0) return;
    if (!confirm(`Supprimer définitivement ${items.length} fichier(s) du CDN ?`)) return;
    await doAction(Array.from(selected), 'delete', items, '{count} fichier(s) supprimé(s)');
    setSelected(new Set());
  };

  const filtered = search.trim()
    ? entries.filter((e) =>
        e.productTitle.toLowerCase().includes(search.toLowerCase()) ||
        String(e.order).includes(search),
      )
    : entries;

  return (
    <div className="space-y-4">
      {/* View mode toggle: Médiathèque (database) vs Bucket CDN (physical scan) */}
      <div className="flex items-center gap-1 p-1 bg-muted/40 rounded-lg w-fit">
        <button
          onClick={() => setViewMode('library')}
          className={cn(
            'px-3 py-1 text-xs rounded transition-colors',
            viewMode === 'library' ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          Médiathèque
        </button>
        <button
          onClick={() => setViewMode('bucket')}
          className={cn(
            'px-3 py-1 text-xs rounded transition-colors flex items-center gap-1',
            viewMode === 'bucket' ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Cloud className="w-3 h-3" />
          Bucket CDN
          {bucketStats.totalGhosts > 0 && (
            <span className="ml-1 px-1.5 py-0.5 text-[9px] font-bold bg-red-100 text-red-700 rounded-full">
              {bucketStats.totalGhosts}
            </span>
          )}
        </button>
      </div>

      {/* ━━━ BUCKET CDN VIEW (VG33.3) — physical scan + ghost purge ━━━ */}
      {viewMode === 'bucket' && (
        <div className="space-y-3">
          {/* Bucket stats */}
          <div className="flex items-center gap-4 px-3 py-2 bg-muted/30 rounded text-xs">
            <span className="text-muted-foreground">Total bucket: <strong className="text-foreground">{bucketStats.totalBucket}</strong></span>
            <span className="text-emerald-600">Suivis: <strong>{bucketStats.totalTracked}</strong></span>
            <span className="text-red-600">Fantômes: <strong>{bucketStats.totalGhosts}</strong></span>
            <Button variant="ghost" size="sm" onClick={scanBucket} disabled={scanning} className="ml-auto h-6 text-[10px]">
              {scanning ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Rescanner'}
            </Button>
          </div>

          {/* Ghost files bulk action bar */}
          {selectedGhosts.size > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded text-xs">
              <span className="font-medium text-red-700">{selectedGhosts.size} fantôme(s) sélectionné(s)</span>
              <Button variant="destructive" size="sm" className="h-6 text-[10px] gap-1" onClick={handlePurgeGhosts} disabled={purging}>
                {purging ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                Purger les fantômes
              </Button>
              <Button variant="ghost" size="sm" className="h-6 text-[10px] ml-auto" onClick={() => setSelectedGhosts(new Set())}>
                Désélectionner
              </Button>
            </div>
          )}

          {/* Ghost files list */}
          <div className="max-h-[500px] overflow-y-auto space-y-1">
            {scanning && ghostFiles.length === 0 && (
              <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            )}
            {!scanning && ghostFiles.length === 0 && (
              <div className="text-center py-12 text-xs text-muted-foreground">
                Aucun fichier fantôme — le bucket est propre ✅
              </div>
            )}
            {ghostFiles.map((file) => (
              <div
                key={file.name}
                className="flex items-center gap-3 px-3 py-2 rounded border border-border/40 hover:bg-muted/20 transition-colors"
              >
                <Checkbox
                  checked={selectedGhosts.has(file.name)}
                  onCheckedChange={() => {
                    setSelectedGhosts((prev) => {
                      const next = new Set(prev);
                      if (next.has(file.name)) next.delete(file.name);
                      else next.add(file.name);
                      return next;
                    });
                  }}
                  className="w-3.5 h-3.5"
                />
                <div className="w-10 h-10 rounded bg-muted/40 flex items-center justify-center shrink-0">
                  <ImageIcon className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-mono truncate">{file.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {(file.size / 1024).toFixed(1)} KB · fileId: {file.fileId || '(inconnu)'}
                  </p>
                </div>
                <span className="text-[9px] font-bold px-1.5 py-0.5 bg-red-100 text-red-700 rounded">
                  FANTÔME
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ━━━ MÉDIATHÈQUE VIEW (database) — original view ━━━ */}
      {viewMode === 'library' && (
        <>
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative max-w-[220px] flex-1 min-w-[140px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher produit ou n°..."
            className="h-7 text-xs pl-7 bg-muted/30"
          />
        </div>
        <div className="flex items-center gap-2">
          <Switch
            id="orphans-toggle"
            checked={orphansOnly}
            onCheckedChange={setOrphansOnly}
          />
          <Label htmlFor="orphans-toggle" className="text-xs cursor-pointer flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-amber-500" />
            Orphelines uniquement
          </Label>
        </div>
        <Button variant="ghost" size="sm" onClick={loadMedia} disabled={loading} className="ml-auto">
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Rafraîchir'}
        </Button>
      </div>

      {/* Bulk action bar — shown when images are selected */}
      {someSelected && (
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded text-xs">
          <span className="font-medium text-amber-700">{selected.size} sélectionnée(s)</span>
          <Button variant="outline" size="sm" className="h-6 text-[10px] gap-1" onClick={handleBulkUnlink} disabled={bulkAction}>
            <Unlink className="w-3 h-3" /> Casser le lien
          </Button>
          <Button variant="outline" size="sm" className="h-6 text-[10px] gap-1" onClick={handleBulkRelink} disabled={bulkAction}>
            <Link2 className="w-3 h-3" /> Restaurer le lien
          </Button>
          <Button variant="destructive" size="sm" className="h-6 text-[10px] gap-1" onClick={handleBulkDelete} disabled={bulkAction}>
            <Trash2 className="w-3 h-3" /> Supprimer
          </Button>
          <Button variant="ghost" size="sm" className="h-6 text-[10px] ml-auto" onClick={() => setSelected(new Set())}>
            Désélectionner
          </Button>
        </div>
      )}

      {/* Grid header with select-all checkbox */}
      <div className="grid grid-cols-[28px_50px_1fr_2fr] gap-2 px-3 py-1.5 bg-muted/40 rounded text-[10px] font-semibold uppercase tracking-wider text-muted-foreground items-center">
        <Checkbox
          checked={allSelected ? true : someSelected ? 'indeterminate' : false}
          onCheckedChange={toggleSelectAll}
          className="w-3.5 h-3.5"
        />
        <div>N°</div>
        <div>Produit</div>
        <div>Images</div>
      </div>

      {/* Entries */}
      <div className="max-h-[550px] overflow-y-auto space-y-1">
        {loading && entries.length === 0 && (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <div className="text-center py-12 text-xs text-muted-foreground">
            Aucun média trouvé
          </div>
        )}
        {filtered.map((entry) => (
          <div
            key={entry.rowId + entry.order}
            className="grid grid-cols-[28px_50px_1fr_2fr] gap-2 px-3 py-2 rounded border border-border/40 hover:bg-muted/20 transition-colors items-start"
          >
            {/* Col 0: select-all-for-row checkbox (only if entry has images) */}
            <div className="pt-5">
              {entry.images.length > 0 && (
                <Checkbox
                  checked={entry.images.every((img) => selected.has(imgKey(entry, img)))}
                  onCheckedChange={() => {
                    const allSel = entry.images.every((img) => selected.has(imgKey(entry, img)));
                    setSelected((prev) => {
                      const next = new Set(prev);
                      entry.images.forEach((img) => {
                        const k = imgKey(entry, img);
                        if (allSel) next.delete(k);
                        else next.add(k);
                      });
                      return next;
                    });
                  }}
                  className="w-3.5 h-3.5"
                />
              )}
            </div>
            {/* Col 1: Order */}
            <div className="text-sm font-mono font-semibold text-muted-foreground pt-4">
              {entry.order < 0 ? '—' : entry.order}
            </div>
            {/* Col 2: Product name */}
            <div className="text-xs font-medium pt-4 break-words">
              {entry.productTitle || <span className="text-muted-foreground italic">(sans titre)</span>}
              {entry.order < 0 && (
                <span className="block text-[9px] text-amber-600 mt-0.5">orpheline</span>
              )}
            </div>
            {/* Col 3: Image grid */}
            <div className="flex flex-wrap gap-2">
              {entry.images.map((img, i) => {
                const isCdn = img.source === 'cdn';
                const key = imgKey(entry, img);
                const isBusy = busyKeys.has(key);
                const isSelected = selected.has(key);
                const isOrphan = !img.isLinked;
                return (
                  <div
                    key={i}
                    className={cn(
                      'relative group w-16 h-16 rounded border overflow-hidden bg-muted/30 transition-all',
                      isSelected ? 'border-amber-400 ring-2 ring-amber-200' : 'border-border/50',
                      isOrphan && 'opacity-60',
                    )}
                  >
                    <img
                      src={resolveHybridImageUrl(img.url, 150, { mode: 'contain' })}
                      alt=""
                      className="w-full h-full object-cover"
                      loading="lazy"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.opacity = '0.2';
                      }}
                    />
                    {/* Checkbox (top-left) */}
                    <div className="absolute top-0.5 left-0.5 z-10">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelect(key)}
                        className="w-3 h-3 bg-white/80"
                      />
                    </div>
                    {/* Source badge (top-right) */}
                    <span
                      className={cn(
                        'absolute top-0.5 right-0.5 text-[7px] font-bold px-1 py-0.5 rounded text-white',
                        isCdn ? 'bg-emerald-600' : 'bg-blue-600',
                      )}
                    >
                      {isCdn ? <Cloud className="w-2 h-2 inline" /> : <HardDrive className="w-2 h-2 inline" />}
                      {' '}{isCdn ? 'CDN' : 'Drive'}
                    </span>
                    {/* Orphan badge */}
                    {isOrphan && (
                      <span className="absolute bottom-0.5 left-0.5 text-[7px] font-bold px-1 py-0.5 rounded bg-amber-600 text-white">
                        orpheline
                      </span>
                    )}
                    {/* Per-image action buttons (bottom, hover) */}
                    <div className="absolute bottom-0 right-0 left-0 flex justify-end gap-0.5 p-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-t from-black/60 to-transparent">
                      {/* Unlink (only if linked) */}
                      {img.isLinked && img.mediaAssetId && (
                        <button
                          onClick={() => handleUnlink(entry, img)}
                          disabled={isBusy}
                          className="w-5 h-5 rounded bg-amber-600 text-white flex items-center justify-center hover:bg-amber-700 disabled:opacity-50"
                          title="Casser le lien (orphaniser)"
                        >
                          {isBusy ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Unlink className="w-2.5 h-2.5" />}
                        </button>
                      )}
                      {/* Relink (only if orphan) */}
                      {!img.isLinked && img.mediaAssetId && img.originalRowId && (
                        <button
                          onClick={() => handleRelink(entry, img)}
                          disabled={isBusy}
                          className="w-5 h-5 rounded bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 disabled:opacity-50"
                          title="Restaurer le lien"
                        >
                          {isBusy ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Link2 className="w-2.5 h-2.5" />}
                        </button>
                      )}
                      {/* Delete (always) */}
                      <button
                        onClick={() => handleDelete(entry, img)}
                        disabled={isBusy}
                        className="w-5 h-5 rounded bg-red-600 text-white flex items-center justify-center hover:bg-red-700 disabled:opacity-50"
                        title="Supprimer définitivement"
                      >
                        {isBusy ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Trash2 className="w-2.5 h-2.5" />}
                      </button>
                    </div>
                  </div>
                );
              })}
              {entry.images.length === 0 && (
                <div className="flex items-center justify-center w-16 h-16 text-muted-foreground/30">
                  <ImageIcon className="w-5 h-5" />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
        </>
      )}
    </div>
  );
}
