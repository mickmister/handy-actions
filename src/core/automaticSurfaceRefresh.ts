import { enabledPresets, surfaceSettings, widgetPreset, type HandyState } from './handyModel.ts';
import { recentWorkspacesEnabled } from './recentWorkspaces.ts';

export function surfaceRefreshKey(state: HandyState): string {
  const settings = surfaceSettings(state);
  return JSON.stringify({
    liveActivities: settings.liveActivities,
    notifications: settings.notifications,
    lockScreenWidgets: settings.lockScreenWidgets,
    presets: settings.liveActivities || settings.notifications ? enabledPresets(state) : [],
    widget: settings.lockScreenWidgets ? widgetPreset(state) : undefined,
    theme: settings.liveActivities ? state.theme ?? 'psychedelic' : undefined,
    recentWorkspaces: recentWorkspacesEnabled(state) ? state.recentWorkspaces : undefined,
  });
}

export function originAffectsSurfaces(state: HandyState, originId: string): boolean {
  if (recentWorkspacesEnabled(state) && state.recentWorkspaces?.originId === originId) return true;
  const settings = surfaceSettings(state);
  const presets = settings.liveActivities || settings.notifications ? enabledPresets(state)
    : settings.lockScreenWidgets ? [widgetPreset(state)].filter(preset => !!preset) : [];
  return presets.some(preset => preset.actions.some(({ payload }) =>
    (payload.type === 'http' || payload.type === 'vd-agent') && payload.originId === originId));
}

// Keep at most one in-flight refresh and one pending (latest) snapshot. The
// native surface service also serializes explicit refresh/renewal requests.
export function createAutomaticSurfaceRefresh(dependencies: {
  sync(state: HandyState): Promise<string>;
  onMessage(message: string): void;
  schedule?(callback: () => void): () => void;
}) {
  const schedule = dependencies.schedule ?? (callback => {
    const timer = setTimeout(callback, 200);
    return () => clearTimeout(timer);
  });
  let lastKey: string | undefined;
  let revision = 0;
  let pending: { state: HandyState; revision: number } | undefined;
  let cancelTimer: (() => void) | undefined;
  let running = false;
  let disposed = false;

  async function run() {
    if (disposed || running || !pending) return;
    const job = pending;
    pending = undefined;
    running = true;
    try {
      const message = await dependencies.sync(job.state);
      if (!disposed && job.revision === revision) dependencies.onMessage(message);
    } catch {
      if (!disposed && job.revision === revision) {
        dependencies.onMessage('Changes saved. Could not refresh Lock Screen surfaces; use Refresh Lock Screen to retry.');
      }
    } finally {
      running = false;
      if (pending && !cancelTimer) void run();
    }
  }

  return {
    request(state: HandyState, force = false) {
      if (disposed) return;
      const key = surfaceRefreshKey(state);
      if (!force && key === lastKey) return;
      lastKey = key;
      pending = { state, revision: ++revision };
      cancelTimer?.();
      cancelTimer = schedule(() => { cancelTimer = undefined; void run(); });
    },
    dispose() {
      disposed = true;
      cancelTimer?.();
      cancelTimer = undefined;
      pending = undefined;
    },
  };
}
