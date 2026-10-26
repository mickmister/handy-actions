import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';
import type { HandyAction } from './handyModel';
import SharedHandyActivity from '../liveActivities/SharedHandyActivity';

// Registers the serialized layout before a native intent can start this activity.
void SharedHandyActivity;
const widgets = requireOptionalNativeModule<{
  beginHandyWorkspaceSearch?: (action: string, presetId: string, query: string | null) => Promise<string>;
  syncHandyActivity?: (configuration: string, renew: boolean) => Promise<string>;
}>('ExpoWidgets');
export const workspaceSearchAvailable = Number.parseInt(String(Platform.Version), 10) >= 17 && !!widgets?.beginHandyWorkspaceSearch && !!widgets?.syncHandyActivity;
export async function beginWorkspaceSearch(action: HandyAction, presetId?: string, query?: string): Promise<string> {
  if (!workspaceSearchAvailable) throw new Error('Install the updated iOS 17+ native build to use Lock Screen workspace search.');
  return widgets!.beginHandyWorkspaceSearch!(JSON.stringify(action), presetId || 'workspace-search', query ?? null);
}
