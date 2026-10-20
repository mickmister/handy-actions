import * as ExpoLinking from 'expo-linking';

import { surfaceSettings, widgetPreset, type HandyState } from './handyModel';
import HandyActionsWidget from '../widgets/HandyActionsWidget';

export async function syncLockScreenWidget(state: HandyState): Promise<void> {
  const preset = widgetPreset(state);
  const enabled = surfaceSettings(state).lockScreenWidgets && !!preset;
  HandyActionsWidget.updateSnapshot({
    enabled,
    presetName: preset?.name ?? 'Handy Actions',
    openUrl: ExpoLinking.createURL(preset && enabled ? '/preset-actions' : '/settings', {
      queryParams: preset && enabled ? { presetId: preset.id } : {},
    }),
    actions: enabled ? preset.actions.slice(0, 3).map((action) => ({
      title: action.name,
      url: ExpoLinking.createURL('/capture', { queryParams: { presetId: preset.id, actionId: action.id, notification: action.payload.type === 'text-input' ? '1' : '0' } }),
    })) : [],
  });
}
