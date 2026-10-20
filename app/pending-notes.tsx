import { Link, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { noteStyles as styles } from '@/components/NoteComposer';
import { pendingNotes, type PendingNote } from '@/src/core/handyNotes';

export default function PendingNotesScreen() {
  const [pending, setPending] = useState<PendingNote[]>([]);
  const [error, setError] = useState('');
  useFocusEffect(useCallback(() => {
    void pendingNotes().then(setPending).catch((reason) => setError(String(reason)));
  }, []));
  return <>
    <Stack.Screen options={{ title: 'Unsent notes' }} />
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Unsent notes</Text>
      <Text style={styles.copy}>{error || (pending.length ? 'Tap a note to retry delivery.' : 'No unsent notes.')}</Text>
      {pending.map((entry) => <View style={styles.card} key={entry.id}>
        <Text style={styles.copy}>{entry.action.name}</Text>
        <Text selectable>{entry.text}</Text>
        <Link href={{ pathname: '/capture', params: { submissionId: entry.id } }}>Retry delivery</Link>
      </View>)}
    </ScrollView>
  </>;
}
