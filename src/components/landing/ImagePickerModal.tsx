'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, ImageIcon, Search } from 'lucide-react';
import { resolveHybridImageUrl } from '@/lib/media-utils';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';

interface ImagePickerModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (url: string) => void;
}

interface MediaImage {
  id: string;
  cdnUrl: string | null;
  originalUrl: string;
  fileName: string | null;
}

export function ImagePickerModal({ open, onClose, onSelect }: ImagePickerModalProps) {
  const [images, setImages] = useState<MediaImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  const fetchImages = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch all MediaAssets that have a CDN URL
      const res = await fetch('/api/landing-pages/media');
      const data = await res.json();
      if (data.data) {
        setImages(data.data);
      }
    } catch {
      // Silent fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) fetchImages();
  }, [open, fetchImages]);

  if (!open) return null;

  const filtered = search
    ? images.filter(img =>
        img.fileName?.toLowerCase().includes(search.toLowerCase()) ||
        img.originalUrl.toLowerCase().includes(search.toLowerCase())
      )
    : images;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-base font-semibold flex items-center gap-2">
            <ImageIcon className="w-5 h-5" />
            Médiathèque — Sélectionner une image
          </h3>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-muted">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="p-3 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher une image..."
              className="pl-9"
            />
          </div>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">
              Aucune image trouvée. Importez d'abord des images via la Médiathèque.
            </p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
              {filtered.map(img => {
                const url = img.cdnUrl || resolveHybridImageUrl(img.originalUrl, 300);
                return (
                  <button
                    key={img.id}
                    onClick={() => {
                      onSelect(img.cdnUrl || img.originalUrl);
                      onClose();
                    }}
                    className="group relative aspect-square rounded-lg overflow-hidden border-2 border-transparent hover:border-blue-500 transition-all"
                  >
                    <img
                      src={url}
                      alt={img.fileName || ''}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
