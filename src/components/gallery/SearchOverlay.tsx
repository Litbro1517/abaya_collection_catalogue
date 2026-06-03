'use client';

import { useRef, useState, useCallback } from 'react';
import { X, Search } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { motion, AnimatePresence } from 'framer-motion';

interface SearchOverlayProps {
  open: boolean;
  onClose: () => void;
}

export default function SearchOverlay({ open, onClose }: SearchOverlayProps) {
  const searchQuery = useAppStore((s) => s.searchQuery);
  const setSearchQuery = useAppStore((s) => s.setSearchQuery);
  const [localValue, setLocalValue] = useState(searchQuery);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus when mounted (AnimatePresence remounts on open)
  const inputRefCallback = useCallback((node: HTMLInputElement | null) => {
    if (node) {
      inputRef.current = node;
      setTimeout(() => node.focus(), 100);
    }
  }, []);

  const debouncedSearch = useCallback(
    (value: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        setSearchQuery(value);
      }, 300);
    },
    [setSearchQuery]
  );

  const handleChange = (value: string) => {
    setLocalValue(value);
    debouncedSearch(value);
  };

  const handleClear = () => {
    setLocalValue('');
    setSearchQuery('');
    inputRef.current?.focus();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="fixed inset-0 z-50 bg-cream"
        >
          <div className="flex flex-col">
            {/* Search bar */}
            <div className="border-b border-border bg-white px-4 py-3">
              <div className="flex items-center gap-3">
                <Search className="size-5 shrink-0 text-muted-foreground" />
                <input
                  ref={inputRefCallback}
                  type="text"
                  placeholder="Rechercher un produit..."
                  value={localValue}
                  onChange={(e) => handleChange(e.target.value)}
                  className="flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
                />
                {localValue && (
                  <button
                    onClick={handleClear}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-4" />
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="ml-1 text-sm font-medium text-gold hover:text-gold/80"
                >
                  Annuler
                </button>
              </div>
            </div>

            {/* Search suggestions / empty state */}
            <div className="flex flex-1 flex-col items-center justify-center px-4 py-16">
              <Search className="size-12 text-border" />
              <p className="mt-4 text-sm text-muted-foreground">
                Tapez pour rechercher des produits
              </p>
              {searchQuery && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Resultats pour &laquo; {searchQuery} &raquo;
                </p>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
