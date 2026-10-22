import { Link, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { noteStyles as styles } from '@/components/NoteComposer';
import { pendingNotes, type PendingNote } from '@/src/core/handyNotes';
import { listEditorDrafts, type EditorDraft } from '@/src/core/editorDrafts';

export default function PendingNotesScreen() {
  const [pending, setPending] = useState<PendingNote[]>([]);
  const [drafts,setDrafts] = useState<EditorDraft[]>([]);
  const [error, setError] = useState('');
  const refresh=useCallback(async()=>{
    try {
      setError('');
      const entries=await pendingNotes(); // Import native records before listing editor drafts.
      const saved=await listEditorDrafts();
      setPending(entries);setDrafts(saved);
    } catch {setError('Could not load recovery drafts. Native copies are retained.');}
  },[]);
  useFocusEffect(useCallback(() => {void refresh();}, [refresh]));
  return <>
    <Stack.Screen options={{ title: 'Unsent notes' }} />
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Unsent notes</Text>
      <Text style={styles.copy}>{error || (pending.length||drafts.length ? 'Review a draft before sending. Uncertain deliveries are never automatically retried.' : 'No unsent drafts.')}</Text>
      <Pressable style={styles.button} onPress={()=>void refresh()}><Text style={styles.buttonText}>Refresh recovery</Text></Pressable>
      {drafts.map(entry=><View style={styles.card} key={entry.id}><Text style={styles.copy}>{entry.action.name}</Text><Text selectable>{entry.text}</Text><Link href={{pathname:'/capture',params:{draftId:entry.id}}}>Open editor</Link></View>)}
      {pending.map((entry) => <View style={styles.card} key={entry.id}>
        <Text style={styles.copy}>{entry.action.name}</Text>
        <Text selectable>{entry.text}</Text>
        <Link href={{ pathname: '/capture', params: { submissionId: entry.id } }}>Review delivery</Link>
      </View>)}
    </ScrollView>
  </>;
}
