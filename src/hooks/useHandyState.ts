import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  defaultHandyState,
  exportHandyState,
  importHandyState,
  makeId,
  validateHandyState,
  type HandyActionPayload,
  type HandyState,
} from '@/src/core/handyModel';
import { loadHandyState, saveHandyState } from '@/src/core/handyStore';

export type SaveResult = { ok: true; message: string } | { ok: false; message: string };

export function useHandyState() {
  const [state, setState] = useState<HandyState>(defaultHandyState);
  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState('Loading local presets…');

  useEffect(() => {
    let cancelled = false;
    loadHandyState()
      .then((loadedState) => {
        if (cancelled) return;
        setState(loadedState);
        setMessage('Loaded local presets.');
      })
      .catch((error) => {
        if (cancelled) return;
        setState(defaultHandyState());
        setMessage(`Storage reset: ${error instanceof Error ? error.message : String(error)}`);
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = useCallback(async (next: HandyState, okMessage: string): Promise<SaveResult> => {
    const validation = validateHandyState(next);
    if (!validation.ok) return { ok: false, message: validation.errors.join('\n') };

    setState(next);
    await saveHandyState(next);
    setMessage(okMessage);
    return { ok: true, message: okMessage };
  }, []);

  const addPreset = useCallback(
    (name: string) =>
      persist(
        {
          presets: [
            ...state.presets,
            { id: makeId('preset'), name: name.trim() || 'Untitled preset', enabled: false, actions: [] },
          ],
        },
        'Preset added.',
      ),
    [persist, state],
  );

  const togglePreset = useCallback(
    (presetId: string) =>
      persist(
        {
          presets: state.presets.map((preset) =>
            preset.id === presetId ? { ...preset, enabled: !preset.enabled } : preset,
          ),
        },
        'Preset updated.',
      ),
    [persist, state],
  );

  const deletePreset = useCallback(
    (presetId: string) =>
      persist({ presets: state.presets.filter((preset) => preset.id !== presetId) }, 'Preset deleted.'),
    [persist, state],
  );

  const addAction = useCallback(
    (presetId: string, name: string, payload: HandyActionPayload) =>
      persist(
        {
          presets: state.presets.map((preset) =>
            preset.id === presetId
              ? {
                  ...preset,
                  actions: [...preset.actions, { id: makeId('action'), name: name.trim() || 'Untitled action', payload }],
                }
              : preset,
          ),
        },
        'Action added.',
      ),
    [persist, state],
  );

  const deleteAction = useCallback(
    (presetId: string, actionId: string) =>
      persist(
        {
          presets: state.presets.map((preset) =>
            preset.id === presetId
              ? { ...preset, actions: preset.actions.filter((action) => action.id !== actionId) }
              : preset,
          ),
        },
        'Action deleted.',
      ),
    [persist, state],
  );

  const importText = useCallback(
    (text: string) => persist(importHandyState(text), 'Imported presets.'),
    [persist],
  );

  const exportText = useMemo(() => exportHandyState(state), [state]);

  return {
    state,
    loaded,
    message,
    setMessage,
    addPreset,
    togglePreset,
    deletePreset,
    addAction,
    deleteAction,
    importText,
    exportText,
  };
}
