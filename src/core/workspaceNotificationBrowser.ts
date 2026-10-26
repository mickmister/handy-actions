// Only a notification BODY press may open the browser. In particular, text
// submissions must reach the native journal/sender or the snapshot editor.
export function workspaceNotificationBrowserUrl(pressId: unknown, data: unknown, input?: string): string | undefined {
  if (input !== undefined) return undefined;
  if (pressId !== undefined && pressId !== 'default') return undefined;
  if (!data || typeof data !== 'object') return undefined;
  const text = (data as Record<string, unknown>).workspaceBrowserUrl;
  if (typeof text !== 'string') return undefined;
  try {
    const url = new URL(text);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash
      || !/^\/workspaces\/[^/]+$/.test(url.pathname)) return undefined;
    return url.toString();
  } catch { return undefined; }
}
