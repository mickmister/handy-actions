import { Link, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { noteStyles as styles } from '@/components/NoteComposer';
import { completeNote, loadNotes, saveNote, type HandyNote } from '@/src/core/handyNotes';

export default function NotesScreen() {
  const params = useLocalSearchParams<{ text?: string; submissionId?: string }>();
  const [notes, setNotes] = useState<HandyNote[]>([]);
  const [message, setMessage] = useState('');
  const saved = useRef('');
  useFocusEffect(useCallback(() => {
    let cancelled = false;
    void (async () => {
      const key = `${params.submissionId ?? ''}:${params.text ?? ''}`;
      if (typeof params.text === 'string' && params.text.trim() && saved.current !== key) {
        await saveNote(params.text, params.submissionId);
        if (params.submissionId) await completeNote(params.submissionId);
        saved.current = key;
        if (!cancelled) setMessage('Note saved on this device.');
      }
      const next = await loadNotes();
      if (!cancelled) setNotes(next);
    })().catch((error) => { if (!cancelled) setMessage(`Could not save note: ${String(error)}`); });
    return () => { cancelled = true; };
  }, [params.text, params.submissionId]));

  return <>
    <Stack.Screen options={{ title: 'Notes' }} />
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Notes</Text>
      <Text style={styles.copy}>Notes sent to Handy Actions stay on this device.</Text>
      <Link href="/pending-notes">Recover unsent notes</Link>
      {message ? <Text style={styles.copy}>{message}</Text> : null}
      {!notes.length ? <Text style={styles.copy}>No notes yet. Add a text-input action with “Use this app” as its destination.</Text> : null}
      {notes.map((note) => <View key={note.id} style={styles.card}>
        <Text selectable style={{ fontSize: 17, color: '#0f172a' }}>{note.text}</Text>
        <Text style={styles.copy}>{new Date(note.createdAt).toLocaleString()}</Text>
      </View>)}
    </ScrollView>
  </>;
}
