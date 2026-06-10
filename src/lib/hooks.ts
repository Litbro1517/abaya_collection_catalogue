'use client';

import { useSyncExternalStore } from 'react';

const emptySubscribe = () => () => {};

/**
 * Hook to check if the component is mounted (hydrated) on the client.
 * Uses useSyncExternalStore to avoid the "setState in effect" lint warning.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}
