import type { RefObject } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAppTheme, useThemeStyles } from '@/src/hooks/useAppTheme';
import type { ThemeColors } from '@/src/core/appTheme';

const createNoteStyles = (c: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.background },
  content: { padding: 18, gap: 14, paddingBottom: 40 },
  title: { fontSize: 26, fontWeight: '800', color: c.text },
  copy: { fontSize: 15, lineHeight: 22, color: c.muted },
  body: { fontSize: 17, color: c.text },
  link: { color: c.primary, fontSize: 15, lineHeight: 22 },
  card: { padding: 16, borderRadius: 18, backgroundColor: c.surface, gap: 12 },
  input: { minHeight: 150, padding: 14, borderRadius: 12, backgroundColor: c.input, color: c.text, fontSize: 17, textAlignVertical: 'top' },
  button: { padding: 15, borderRadius: 14, backgroundColor: c.primary, alignItems: 'center' },
  buttonText: { color: c.onPrimary, fontSize: 16, fontWeight: '700' },
});
export function useNoteStyles() { return useThemeStyles(createNoteStyles); }

export function NoteComposer({ text, onChangeText, onSubmit, busy, selection, onSelectionChange, inputRef, submitLabel = 'Send note' }: {
  text: string; onChangeText: (text: string) => void; onSubmit: () => void; busy: boolean;
  selection?: { start: number; end: number }; onSelectionChange?: (selection: { start: number; end: number }) => void;
  inputRef?: RefObject<TextInput | null>; submitLabel?: string;
}) {
  const noteStyles = useNoteStyles();
  const { colors, dark } = useAppTheme();
  return <View style={noteStyles.card}>
    <TextInput ref={inputRef} accessibilityLabel="Note text" value={text} onChangeText={onChangeText} multiline
      selection={selection} onSelectionChange={event=>onSelectionChange?.(event.nativeEvent.selection)}
      placeholder="Write a note…" placeholderTextColor={colors.placeholder} selectionColor={colors.primary} keyboardAppearance={dark ? 'dark' : 'light'} style={noteStyles.input} editable={!busy} />
    <Pressable accessibilityRole="button" disabled={busy || !text.trim()} style={[noteStyles.button, (busy || !text.trim()) && { opacity: 0.5 }]} onPress={onSubmit}>
      <Text style={noteStyles.buttonText}>{busy ? 'Sending…' : submitLabel}</Text>
    </Pressable>
  </View>;
}
