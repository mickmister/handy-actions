import * as ExpoLinking from 'expo-linking';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  enabledPresets,
  liveActivityPropsForPreset,
  surfaceSettings,
  type HandyActionsLiveActivityProps,
  type HandyState,
} from './handyModel';
import HandyActionsLiveActivity from '../liveActivities/HandyActionsLiveActivity';
import { activityTheme } from './handyThemes';
import { isInputPayload } from './handyModel';
import { nativeCaptureTarget } from './nativeCaptureTarget';
import { reconcileActivities } from './activityLifecycle';

const LIVE_ACTIVITY_STALE_MS = 7.5 * 60 * 60 * 1000;

export async function syncPresetLiveActivities(state: HandyState, renew = false): Promise<void> {
  const endedProps = endedLiveActivityProps();
  const instances = HandyActionsLiveActivity.getInstances();
  const mapping: Record<string,string> = JSON.parse(await AsyncStorage.getItem('handy-actions/activity-ids/v1')??'{}');
  const activePresets = surfaceSettings(state).liveActivities ? enabledPresets(state) : [];
  const staleDate = new Date(Date.now() + LIVE_ACTIVITY_STALE_MS);
  const desired = activePresets.map(preset => {
    const openUrl = ExpoLinking.createURL('/preset-actions', { queryParams: { presetId: preset.id } });
    const props = liveActivityPropsForPreset(preset, new Date().toISOString(), openUrl);
    props.theme = activityTheme(state.theme,props.updatedAt);
    props.actionLinks = preset.actions.slice(0, 3).map((action) => ({
      title: action.name,
      url: ExpoLinking.createURL('/capture', { queryParams: { presetId: preset.id, actionId: action.id, notification: isInputPayload(action.payload) ? '1' : '0' } }),
      captureTarget: nativeCaptureTarget(preset.id, action),
    }));
    return {presetId:preset.id,props,openUrl};
  });
  const nextMapping=await reconcileActivities<HandyActionsLiveActivityProps>(instances,mapping,desired,{
    renew,endedProps,staleDate,start:(props,url,date)=>HandyActionsLiveActivity.start(props,url,date),
  });
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
