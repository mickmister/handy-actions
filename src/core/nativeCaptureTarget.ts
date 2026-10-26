import * as ExpoLinking from 'expo-linking';
import { Platform } from 'react-native';
import { liveActivityCaptureTarget, type HandyAction } from './handyModel';
import { isLocalNoteAction } from './localNoteDelivery';
import { nativeNoteInbox } from './nativeNoteInbox';
import { nativeActionInbox } from './nativeActionInbox';
import { workspaceSearchTarget } from './workspaceSearchTarget';
import { workspaceSearchAvailable } from './workspaceSearch';

export function nativeCaptureTarget(presetId: string, action: HandyAction): string | undefined {
  if (Platform.OS !== 'ios' || Number.parseInt(String(Platform.Version), 10) < 17) return undefined;
  if (action.payload.type === 'vd-workspace-search') return workspaceSearchAvailable ? workspaceSearchTarget(action, presetId) : undefined;
  return liveActivityCaptureTarget(presetId, action,
    !!nativeNoteInbox && isLocalNoteAction(action, ExpoLinking.createURL('/notes')),
    !!nativeActionInbox && (action.payload.type === 'http' || (action.payload.type === 'vd-agent' && !!action.payload.session)));
}
