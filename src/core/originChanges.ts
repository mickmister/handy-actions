const listeners = new Set<(id: string) => void>();

export function subscribeOriginChanges(listener: (id: string) => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

// Events carry only the profile ID, never the URL or header values.
export function notifyOriginChanged(id: string): void {
  for (const listener of listeners) {
    try { listener(id); } catch { /* A listener cannot invalidate a saved origin. */ }
  }
}
