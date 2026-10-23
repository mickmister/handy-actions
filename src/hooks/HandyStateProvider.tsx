import { createContext, useContext, type PropsWithChildren } from 'react';

import { useHandyState } from './useHandyState';
import { useRecentWorkspacesRefresh } from './useRecentWorkspacesRefresh';

type HandyStateContextValue = ReturnType<typeof useHandyState>;

const HandyStateContext = createContext<HandyStateContextValue | undefined>(undefined);

export function HandyStateProvider({ children }: PropsWithChildren) {
  const value = useHandyState();
  useRecentWorkspacesRefresh(value.state, value.loaded, value.setMessage);
  return <HandyStateContext.Provider value={value}>{children}</HandyStateContext.Provider>;
}

export function useHandyStateContext(): HandyStateContextValue {
  const value = useContext(HandyStateContext);
  if (!value) throw new Error('useHandyStateContext must be used inside HandyStateProvider.');
  return value;
}
