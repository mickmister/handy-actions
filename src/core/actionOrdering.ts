import type { HandyState } from './handyModel.ts';

export function movePresetAction(state: HandyState, presetId: string, actionId: string, direction: -1 | 1): HandyState {
  const preset = state.presets.find(candidate => candidate.id === presetId);
  if (!preset) return state;
  const index = preset.actions.findIndex(action => action.id === actionId);
  const destination = index + direction;
  if (index < 0 || destination < 0 || destination >= preset.actions.length) return state;
  const actions = [...preset.actions];
  [actions[index], actions[destination]] = [actions[destination], actions[index]];
  return {
    ...state,
    presets: state.presets.map(candidate => candidate.id === presetId ? { ...candidate, actions } : candidate),
  };
}
