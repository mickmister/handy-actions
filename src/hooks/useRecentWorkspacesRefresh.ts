import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import type { HandyState } from '../core/handyModel';
import { syncPresetNotifications } from '../core/handyNotifications';
import { recentWorkspacesEnabled } from '../core/recentWorkspaces';

export function useRecentWorkspacesRefresh(state: HandyState, loaded: boolean, onMessage: (message: string) => void) {
  const current = useRef({ state, onMessage });
  current.current = { state, onMessage };
  useEffect(() => {
    if (!loaded || Platform.OS !== 'ios') return;
    const refresh = () => {
      const snapshot = current.current.state;
      if (!recentWorkspacesEnabled(snapshot)) return;
      // Use the existing surface queue; foreground and manual refreshes must
      // not race to create duplicate ActivityKit instances.
      void syncPresetNotifications(snapshot).then(message => {
        if (current.current.state === snapshot) current.current.onMessage(message);
      }).catch(() => {});
    };
    refresh();
    const subscription = AppState.addEventListener('change', next => {
      if (next === 'active') refresh();
    });
    return () => subscription.remove();
  }, [loaded]);
}
