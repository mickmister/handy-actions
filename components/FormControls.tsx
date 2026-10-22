import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

export const formStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f5f7fb' }, content: { padding: 18, gap: 14, paddingBottom: 48 },
  card: { padding: 16, borderRadius: 18, backgroundColor: '#fff', gap: 12 },
  title: { fontSize: 25, fontWeight: '800', color: '#172D36' }, label: { fontSize: 16, fontWeight: '700', color: '#172D36' },
  copy: { fontSize: 15, color: '#516070', lineHeight: 22 },
  input: { padding: 12, minHeight: 48, borderWidth: 1, borderColor: '#cad5dc', borderRadius: 12, backgroundColor: '#f8fafc', color: '#172D36', fontSize: 16 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
});
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return <View style={{ gap: 6 }}><Text style={formStyles.label}>{label}</Text><TextInput accessibilityLabel={label} placeholderTextColor="#708591" autoCapitalize="none" autoCorrect={false} {...props} style={[formStyles.input, props.multiline && { minHeight: 110, textAlignVertical: 'top' }, props.style]} /></View>;
}
export function Choice({ label, onPress, selected, disabled }: { label: string; onPress(): void; selected?: boolean; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected, disabled }} disabled={disabled} onPress={onPress} style={{ padding: 12, minHeight: 44, borderRadius: 12, backgroundColor: selected ? '#172D36' : '#e6eff2', opacity: disabled ? 0.5 : 1 }}><Text style={{ color: selected ? '#fff' : '#172D36', fontSize: 15, fontWeight: '600' }}>{label}</Text></Pressable>;
}
