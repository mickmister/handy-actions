import * as ExpoLinking from 'expo-linking';

import {
  enabledPresets,
  liveActivityPropsForPreset,
  surfaceSettings,
  type HandyActionsLiveActivityProps,
  type HandyState,
} from './handyModel';
import HandyActionsLiveActivity from '../liveActivities/HandyActionsLiveActivity';

const LIVE_ACTIVITY_STALE_MS = 7.5 * 60 * 60 * 1000;

export async function syncPresetLiveActivities(state: HandyState): Promise<void> {
  const endedProps = endedLiveActivityProps();
  for (const instance of HandyActionsLiveActivity.getInstances()) {
    try {
      await instance.end('immediate', endedProps, new Date());
    } catch {
      // Existing activity may already be gone; starting the fresh set below is the useful work.
    }
  }

  if (!surfaceSettings(state).liveActivities) return;
  const staleDate = new Date(Date.now() + LIVE_ACTIVITY_STALE_MS);
  for (const preset of enabledPresets(state)) {
    const openUrl = ExpoLinking.createURL('/preset-actions', { queryParams: { presetId: preset.id } });
    const props = liveActivityPropsForPreset(preset, new Date().toISOString(), openUrl);
    props.actionLinks = preset.actions.slice(0, 3).map((action) => ({
      title: action.name,
      url: ExpoLinking.createURL('/capture', { queryParams: { presetId: preset.id, actionId: action.id, notification: action.payload.type === 'text-input' ? '1' : '0' } }),
    }));
    HandyActionsLiveActivity.start(props, openUrl, staleDate);
  }
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
