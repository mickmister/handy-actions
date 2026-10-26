import { useMemo } from 'react';
import { appTheme, type ThemeColors } from '../core/appTheme';
import { useHandyStateContext } from './HandyStateProvider';

export function useAppTheme() {
  const { state } = useHandyStateContext();
  return useMemo(() => appTheme(state.theme), [state.theme]);
}

export function useThemeStyles<T>(createStyles: (colors: ThemeColors) => T): T {
  const { colors } = useAppTheme();
  return useMemo(() => createStyles(colors), [colors, createStyles]);
}
