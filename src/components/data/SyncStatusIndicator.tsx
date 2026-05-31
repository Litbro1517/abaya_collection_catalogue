'use client';

import { useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import { Loader2, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export function SyncStatusIndicator() {
  const { syncStatus, setSyncStatus, syncMessage } = useAppStore();

  // Auto-hide after 3 seconds on success
  useEffect(() => {
    if (syncStatus === 'success') {
      const timer = setTimeout(() => setSyncStatus('idle'), 3000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [syncStatus, setSyncStatus]);

  if (syncStatus === 'idle') return null;

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition-all',
        syncStatus === 'syncing' && 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
        syncStatus === 'success' && 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300',
        syncStatus === 'error' && 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300',
      )}
    >
      {syncStatus === 'syncing' && <Loader2 className="w-3 h-3 animate-spin" />}
      {syncStatus === 'success' && <Check className="w-3 h-3" />}
      {syncStatus === 'error' && <X className="w-3 h-3" />}
      {syncMessage && <span className="max-w-[150px] truncate">{syncMessage}</span>}
    </div>
  );
}
