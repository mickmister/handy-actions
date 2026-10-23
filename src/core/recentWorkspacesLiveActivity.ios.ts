import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ExpoLinking from 'expo-linking';
import { fetch } from 'expo/fetch';
import type { HandyState } from './handyModel';
import { activityTheme } from './handyThemes';
import { origins } from './origins';
import { createRequestClient } from './requestClient';
import { createVdClient } from './vdClient';
import { loadRecentWorkspaces } from './recentWorkspaces';
import { reconcileActivities } from './activityLifecycle';
import RecentWorkspacesLiveActivity, { type RecentWorkspacesActivityProps } from '../liveActivities/RecentWorkspacesLiveActivity';

const STORAGE_KEY = 'handy-actions/recent-workspace-activity-ids/v1';

export async function syncRecentWorkspacesLiveActivity(state: HandyState, renew = false): Promise<string> {
  const snapshot = await loadRecentWorkspaces(state, {
    connection: origins.connection,
    workspaces: profile => createVdClient(createRequestClient(async () => profile, fetch), profile.id).workspaces(),
  });
  const mapping: Record<string, string> = JSON.parse(await AsyncStorage.getItem(STORAGE_KEY) ?? '{}');
  const theme = activityTheme(state.theme, new Date().toISOString());
  const endedProps: RecentWorkspacesActivityProps = { links: [], message: '', theme };
  const desired = snapshot ? [{
    presetId: snapshot.originId,
    props: { links: snapshot.links, message: snapshot.message, theme },
    openUrl: snapshot.openUrl || ExpoLinking.createURL('/settings'),
  }] : [];
  const next = await reconcileActivities<RecentWorkspacesActivityProps>(RecentWorkspacesLiveActivity.getInstances(), mapping, desired, {
    renew, endedProps, staleDate: new Date(Date.now() + 7.5 * 60 * 60 * 1000),
    start: (props, url, date) => RecentWorkspacesLiveActivity.start(props, url, date),
  });
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return snapshot ? snapshot.message || 'Recent VD workspaces refreshed.' : '';
}
