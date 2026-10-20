import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

export const noteStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f5f7fb' },
  content: { padding: 18, gap: 14, paddingBottom: 40 },
  title: { fontSize: 26, fontWeight: '800', color: '#0f172a' },
  copy: { fontSize: 15, lineHeight: 22, color: '#516070' },
  card: { padding: 16, borderRadius: 18, backgroundColor: '#fff', gap: 12 },
  input: { minHeight: 150, padding: 14, borderRadius: 12, backgroundColor: '#f1f5f9', color: '#0f172a', fontSize: 17, textAlignVertical: 'top' },
  button: { padding: 15, borderRadius: 14, backgroundColor: '#0f172a', alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});

export function NoteComposer({ text, onChangeText, onSubmit, busy }: {
  text: string; onChangeText: (text: string) => void; onSubmit: () => void; busy: boolean;
}) {
  return <View style={noteStyles.card}>
    <TextInput accessibilityLabel="Note text" value={text} onChangeText={onChangeText} multiline
      placeholder="Write a note…" placeholderTextColor="#8792a2" style={noteStyles.input} editable={!busy} />
    <Pressable accessibilityRole="button" disabled={busy || !text.trim()} style={[noteStyles.button, (busy || !text.trim()) && { opacity: 0.5 }]} onPress={onSubmit}>
      <Text style={noteStyles.buttonText}>{busy ? 'Sending…' : 'Send note'}</Text>
    </Pressable>
  </View>;
}
