import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import type { HandyState } from '../core/handyModel';
import { syncPresetNotifications } from '../core/handyNotifications';
import { createAutomaticSurfaceRefresh, originAffectsSurfaces } from '../core/automaticSurfaceRefresh';
import { subscribeOriginChanges } from '../core/originChanges';

export function useAutomaticLockScreenRefresh(state: HandyState, loaded: boolean, onMessage: (message: string) => void) {
  const current = useRef({ state, loaded, onMessage });
  current.current = { state, loaded, onMessage };
  const scheduler = useRef<ReturnType<typeof createAutomaticSurfaceRefresh> | undefined>(undefined);

  useEffect(() => {
    const refresh = createAutomaticSurfaceRefresh({
      sync: snapshot => syncPresetNotifications(snapshot, { requestPermissions: false }),
      onMessage: message => current.current.onMessage(message),
    });
    scheduler.current = refresh;
    const request = (force = false) => {
      if (current.current.loaded) refresh.request(current.current.state, force);
    };
    request();
    const unsubscribe = subscribeOriginChanges(id => {
      if (originAffectsSurfaces(current.current.state, id)) request(true);
    });
    let previous = AppState.currentState;
    const subscription = AppState.addEventListener('change', next => {
      if (next === 'active' && previous !== 'active') request(true);
      previous = next;
    });
    return () => {
      unsubscribe();
      subscription.remove();
      refresh.dispose();
      scheduler.current = undefined;
    };
  }, []);

  // State is published only after storage succeeds; draft text and status
  // messages do not trigger this effect. The scheduler filters irrelevant edits.
  useEffect(() => {
    if (loaded) scheduler.current?.request(state);
  }, [state, loaded]);
}
