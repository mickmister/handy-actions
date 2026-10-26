import * as ExpoLinking from 'expo-linking';
import { fetch } from 'expo/fetch';
import { requireOptionalNativeModule } from 'expo';
import { sharedActivityConfiguration } from './sharedActivityModel';
import type { HandyState } from './handyModel';
import SharedHandyActivity from '../liveActivities/SharedHandyActivity';
import { activityTheme } from './handyThemes';
import { nativeCaptureTarget } from './nativeCaptureTarget';
import { nativeAgentIcon, nativeSiteIcon } from './nativeSiteIcon';
import { loadRecentWorkspaces, recentWorkspacesEnabled, type RecentWorkspacesSnapshot } from './recentWorkspaces';
import { origins } from './origins';
import { createRequestClient } from './requestClient';
import { createVdClient } from './vdClient';

void SharedHandyActivity;
const widgets = requireOptionalNativeModule<{
  syncHandyActivity?: (configuration: string, renew: boolean) => Promise<string>;
}>('ExpoWidgets');

export async function syncPresetLiveActivities(state: HandyState, renew = false): Promise<string> {
  if (!widgets?.syncHandyActivity) return 'Install the updated native build to use the single Handy Actions Live Activity.';
  const configure = (recent?: RecentWorkspacesSnapshot) => sharedActivityConfiguration(state, {
    openUrl: ExpoLinking.createURL('/settings'), recent,
    theme: activityTheme(state.theme, new Date().toISOString()),
    link: (action, presetId, input) => ({
      title: action.name, siteGlyph: nativeSiteIcon(action.payload), solidGlyph: nativeAgentIcon(action.payload),
      systemImage: action.payload.type === 'notes' ? 'note.text' : action.payload.type === 'vd-workspace-search' ? 'magnifyingglass' : undefined,
      url: ExpoLinking.createURL(action.payload.type === 'notes' ? '/notes' : '/capture', {
        queryParams: { presetId, actionId: action.id, notification: input ? '1' : '0' },
      }),
      captureTarget: nativeCaptureTarget(presetId, action),
    }),
  });
  if (!recentWorkspacesEnabled(state)) {
    return `${await widgets.syncHandyActivity(JSON.stringify(configure()), renew)} Recent VD workspaces off.`;
  }
  // Publish actions/navigation before a slow VD fetch. The second transaction
  // updates data only; it cannot reset native search or the selected view.
  await widgets.syncHandyActivity(JSON.stringify(configure({ originId: state.recentWorkspaces?.originId ?? '', links: [], message: 'Refreshing recent VD workspaces…', openUrl: '', loading: true })), renew);
  const recent = await loadRecentWorkspaces(state, {
    connection: origins.connection,
    workspaces: profile => createVdClient(createRequestClient(async () => profile, fetch), profile.id).workspaces(),
  });
  const message = await widgets.syncHandyActivity(JSON.stringify(configure(recent)), false);
  return [message, recent?.message || (recent ? 'Recent VD workspaces refreshed in the Workspaces view.' : 'Recent VD workspaces off.')].join(' ');
}
