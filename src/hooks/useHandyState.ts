import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import { exportHandyState, importHandyState, makeId, type HandyActionPayload, type HandyState, type SurfaceSettings } from '@/src/core/handyModel';
import { handyStateRepository } from '@/src/core/handyStore';
import { createHandyStateSession } from '@/src/core/handyStateSession';
import { type StateMutation } from '@/src/core/handyStateRepository';
import { movePresetAction } from '@/src/core/actionOrdering';

export type { SaveResult } from '@/src/core/handyStateSession';

export function useHandyState() {
  const [session] = useState(() => createHandyStateSession(handyStateRepository));
  const snapshot = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
  useEffect(() => {
    void session.load();
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active' && !session.getSnapshot().loaded) void session.load();
    });
    return () => subscription.remove();
  }, [session]);

  const persist = useCallback((mutate: StateMutation, message: string) => session.update(mutate, message), [session]);
  const addPreset = useCallback((name: string) => persist(state => ({...state, presets: [...state.presets,
    {id: makeId('preset'), name: name.trim() || 'Untitled preset', enabled: false, actions: []}]}), 'Preset added.'), [persist]);
  const togglePreset = useCallback((presetId: string) => persist(state => ({...state,
    presets: state.presets.map(preset => preset.id === presetId ? {...preset, enabled: !preset.enabled} : preset)}), 'Preset updated.'), [persist]);
  const deletePreset = useCallback((presetId: string) => persist(state => ({...state,
    presets: state.presets.filter(preset => preset.id !== presetId)}), 'Preset deleted.'), [persist]);
  const addAction = useCallback((presetId: string, name: string, payload: HandyActionPayload) => persist(state => ({...state,
    presets: state.presets.map(preset => preset.id === presetId ? {...preset, actions: [...preset.actions,
      {id: makeId('action'), name: name.trim() || 'Untitled action', payload}]} : preset)}), 'Action added.'), [persist]);
  const deleteAction = useCallback((presetId: string, actionId: string) => persist(state => ({...state,
    presets: state.presets.map(preset => preset.id === presetId ? {...preset, actions: preset.actions.filter(action => action.id !== actionId)} : preset)}), 'Action deleted.'), [persist]);
  const importText = useCallback((text: string) => persist(() => importHandyState(text), 'Imported presets.'), [persist]);

  return {
    ...snapshot,
    setMessage: session.setMessage,
    retryLoad: session.load,
    addPreset, togglePreset, deletePreset, addAction, deleteAction, importText,
    exportText: exportHandyState(snapshot.state),
    updateSurfaces: (surfaces: SurfaceSettings) => persist(state => ({...state, surfaces}), 'Lock-screen settings saved.'),
    updateTheme: (theme: NonNullable<HandyState['theme']>) => persist(state => ({...state, theme}), 'Theme saved.'),
    updateRecentWorkspaces: (recentWorkspaces: NonNullable<HandyState['recentWorkspaces']>) =>
      persist(state => ({...state, recentWorkspaces}), 'Recent VD workspaces settings saved.'),
    updateAction: (presetId: string, actionId: string, name: string, payload: HandyActionPayload) => persist(state => ({...state,
      presets: state.presets.map(preset => preset.id === presetId ? {...preset, actions: preset.actions.map(action => action.id === actionId
        ? {...action, name: name.trim() || 'Untitled action', payload} : action)} : preset)}), 'Action updated.'),
    moveAction: (presetId: string, actionId: string, direction: -1 | 1) => persist(state => movePresetAction(state, presetId, actionId, direction), 'Action order saved.'),
  };
}
