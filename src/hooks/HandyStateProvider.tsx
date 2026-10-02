import { createContext, useContext, type PropsWithChildren } from 'react';

import { useHandyState } from './useHandyState';

type HandyStateContextValue = ReturnType<typeof useHandyState>;

const HandyStateContext = createContext<HandyStateContextValue | undefined>(undefined);

export function HandyStateProvider({ children }: PropsWithChildren) {
  const value = useHandyState();
  return <HandyStateContext.Provider value={value}>{children}</HandyStateContext.Provider>;
}

export function useHandyStateContext(): HandyStateContextValue {
  const value = useContext(HandyStateContext);
  if (!value) throw new Error('useHandyStateContext must be used inside HandyStateProvider.');
  return value;
}
