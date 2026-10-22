import * as ExpoLinking from 'expo-linking';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  enabledPresets,
  liveActivityPropsForPreset,
  liveActivityCaptureTarget,
  surfaceSettings,
  type HandyActionsLiveActivityProps,
  type HandyState,
} from './handyModel';
import HandyActionsLiveActivity from '../liveActivities/HandyActionsLiveActivity';
import { isLocalNoteAction } from './localNoteDelivery';
import { nativeNoteInbox } from './nativeNoteInbox';
import { activityTheme } from './handyThemes';
import { nativeActionInbox } from './nativeActionInbox';
import { isInputPayload } from './handyModel';

const LIVE_ACTIVITY_STALE_MS = 7.5 * 60 * 60 * 1000;

export async function syncPresetLiveActivities(state: HandyState): Promise<void> {
  const endedProps = endedLiveActivityProps();
  const instances = HandyActionsLiveActivity.getInstances();
  const mapping: Record<string,string> = JSON.parse(await AsyncStorage.getItem('handy-actions/activity-ids/v1')??'{}');
  const activePresets = surfaceSettings(state).liveActivities ? enabledPresets(state) : [];
  const keep = new Set(activePresets.map(p=>mapping[p.id]).filter(Boolean));
  for (const instance of instances.filter(i=>!keep.has(i.getId()))) {
    try {
      await instance.end('immediate', endedProps, new Date());
    } catch {
      // Existing activity may already be gone; starting the fresh set below is the useful work.
    }
  }

  const nextMapping: Record<string,string> = {};
  const staleDate = new Date(Date.now() + LIVE_ACTIVITY_STALE_MS);
  for (const preset of activePresets) {
    const openUrl = ExpoLinking.createURL('/preset-actions', { queryParams: { presetId: preset.id } });
    const props = liveActivityPropsForPreset(preset, new Date().toISOString(), openUrl);
    props.theme = activityTheme(state.theme,props.updatedAt);
    props.actionLinks = preset.actions.slice(0, 3).map((action) => ({
      title: action.name,
      url: ExpoLinking.createURL('/capture', { queryParams: { presetId: preset.id, actionId: action.id, notification: isInputPayload(action.payload) ? '1' : '0' } }),
      ...(Number.parseInt(String(Platform.Version), 10) >= 17
        ? { captureTarget: liveActivityCaptureTarget(preset.id, action,
          !!nativeNoteInbox && isLocalNoteAction(action, ExpoLinking.createURL('/notes')),
          !!nativeActionInbox && (action.payload.type==='http' || (action.payload.type==='vd-agent' && !!action.payload.session))) } : {}),
    }));
    const existing = instances.find(instance=>instance.getId()===mapping[preset.id]);
    if(existing) {await existing.update(props,staleDate);nextMapping[preset.id]=existing.getId();}
    else nextMapping[preset.id]=HandyActionsLiveActivity.start(props, openUrl, staleDate).getId();
  }
  await AsyncStorage.setItem('handy-actions/activity-ids/v1',JSON.stringify(nextMapping));
}

function endedLiveActivityProps(): HandyActionsLiveActivityProps {
  return {
    presetId: '',
    presetName: 'Handy Actions',
    actionCount: 0,
    firstAction: '',
    secondAction: '',
    thirdAction: '',
    updatedAt: new Date().toISOString(),
    openUrl: ExpoLinking.createURL('/'),
  };
}
