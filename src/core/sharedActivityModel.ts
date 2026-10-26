import { enabledPresets, isInputPayload, surfaceSettings, type HandyAction, type HandyState, type LiveActivityActionLink } from './handyModel.ts';
import type { RecentWorkspacesSnapshot } from './recentWorkspaces.ts';

export type SharedActivityConfiguration = {
  enabled: boolean;
  openUrl: string;
  presets: { id: string; name: string; actions: (LiveActivityActionLink & { id: string })[] }[];
  recent?: RecentWorkspacesSnapshot;
  theme?: { id: string; colors: string[]; accent: string; ink: string; muted: string; tile: string };
};

// The full configuration goes to protected HOST storage, not ActivityKit. Native
// navigation publishes only the current page and replaces capture payloads with
// short, revision-checked references into this snapshot.
export function sharedActivityConfiguration(state: HandyState, options: {
  openUrl: string;
  recent?: RecentWorkspacesSnapshot;
  link(action: HandyAction, presetId: string, input: boolean): LiveActivityActionLink;
  theme?: SharedActivityConfiguration['theme'];
}): SharedActivityConfiguration {
  const enabled = surfaceSettings(state).liveActivities;
  return {
    enabled,
    openUrl: options.openUrl,
    presets: enabled ? enabledPresets(state).map(preset => ({
      id: preset.id, name: preset.name,
      actions: preset.actions.map(action => ({ ...options.link(action, preset.id, isInputPayload(action.payload)), id: action.id })),
    })) : [],
    recent: enabled ? options.recent : undefined,
    theme: options.theme,
  };
}
