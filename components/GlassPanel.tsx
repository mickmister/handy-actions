import { GlassView, isGlassEffectAPIAvailable } from 'expo-glass-effect';
import { type PropsWithChildren } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

type GlassPanelProps = PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
  fallbackStyle?: StyleProp<ViewStyle>;
}>;

export function GlassPanel({ children, style, fallbackStyle }: GlassPanelProps) {
  if (Platform.OS === 'ios' && isGlassEffectAPIAvailable()) {
    return (
      <GlassView
        glassEffectStyle="regular"
        tintColor="#0f172a"
        colorScheme="dark"
        isInteractive
        style={[styles.panel, style]}>
        {children}
      </GlassView>
    );
  }

  return <View style={[styles.panel, fallbackStyle, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  panel: {
    overflow: 'hidden',
  },
});
