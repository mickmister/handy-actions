import { GlassView, isGlassEffectAPIAvailable } from 'expo-glass-effect';
import { type PropsWithChildren } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useAppTheme } from '@/src/hooks/useAppTheme';

type GlassPanelProps = PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
  fallbackStyle?: StyleProp<ViewStyle>;
}>;

export function GlassPanel({ children, style, fallbackStyle }: GlassPanelProps) {
  const { dark, colors } = useAppTheme();
  if (Platform.OS === 'ios' && isGlassEffectAPIAvailable()) {
    return (
      <GlassView
        glassEffectStyle="regular"
        tintColor={colors.surfaceRaised}
        colorScheme={dark ? 'dark' : 'light'}
        isInteractive
        style={[styles.panel, style]}>
        {children}
      </GlassView>
    );
  }

  return <View style={[styles.panel, { backgroundColor: colors.surfaceRaised }, fallbackStyle, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  panel: {
    overflow: 'hidden',
  },
});
