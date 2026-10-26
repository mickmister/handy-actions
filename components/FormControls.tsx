import { Pressable, StyleSheet, Switch as NativeSwitch, Text, TextInput, View, type TextInputProps, type SwitchProps } from 'react-native';
import { useAppTheme, useThemeStyles } from '@/src/hooks/useAppTheme';
import type { ThemeColors } from '@/src/core/appTheme';

const createFormStyles = (c: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.background }, content: { padding: 18, gap: 14, paddingBottom: 48 },
  card: { padding: 16, borderRadius: 18, backgroundColor: c.surface, gap: 12 },
  title: { fontSize: 25, fontWeight: '800', color: c.text }, label: { fontSize: 16, fontWeight: '700', color: c.text },
  copy: { fontSize: 15, color: c.muted, lineHeight: 22 },
  link: { color: c.primary, fontSize: 15, lineHeight: 22 },
  input: { padding: 12, minHeight: 48, borderWidth: 1, borderColor: c.border, borderRadius: 12, backgroundColor: c.input, color: c.text, fontSize: 16 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
});
export function useFormStyles() { return useThemeStyles(createFormStyles); }
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  const formStyles = useFormStyles();
  const { colors, dark } = useAppTheme();
  return <View style={{ gap: 6 }}><Text style={formStyles.label}>{label}</Text><TextInput accessibilityLabel={label} placeholderTextColor={colors.placeholder} selectionColor={colors.primary} keyboardAppearance={dark ? 'dark' : 'light'} autoCapitalize="none" autoCorrect={false} {...props} style={[formStyles.input, props.multiline && { minHeight: 110, textAlignVertical: 'top' }, props.style]} /></View>;
}
export function Choice({ label, onPress, selected, disabled }: { label: string; onPress(): void; selected?: boolean; disabled?: boolean }) {
  const { colors } = useAppTheme();
  return <Pressable accessibilityRole="button" accessibilityState={{ selected, disabled }} disabled={disabled} onPress={onPress} style={{ padding: 12, minHeight: 44, borderRadius: 12, backgroundColor: selected ? colors.primary : colors.secondary, opacity: disabled ? 0.5 : 1 }}><Text style={{ color: selected ? colors.onPrimary : colors.onSecondary, fontSize: 15, fontWeight: '600' }}>{label}</Text></Pressable>;
}

export function Switch(props: SwitchProps) {
  const { colors } = useAppTheme();
  return <NativeSwitch trackColor={{ false: colors.border, true: colors.primary }} thumbColor={colors.surface} ios_backgroundColor={colors.border} {...props} />;
}
