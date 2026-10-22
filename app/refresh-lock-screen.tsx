import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { Choice } from '@/components/FormControls';
import { noteStyles as styles } from '@/components/NoteComposer';
import { syncPresetNotifications } from '@/src/core/handyNotifications';
import { loadHandyState } from '@/src/core/handyStore';

export default function RefreshLockScreenScreen() {
  const {token}=useLocalSearchParams<{token?:string}>();
  const started=useRef('');
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('Refreshing lock screen…');
  async function refresh() {
    setBusy(true);
    try {setMessage(await syncPresetNotifications(await loadHandyState(),{renewActivities:true}));}
    catch {setMessage('Could not refresh the lock screen. Tap below to retry.');}
    finally {setBusy(false);}
  }
  useEffect(()=>{const key=token??'initial';if(started.current===key)return;started.current=key;void refresh();},[token]);
  return <><Stack.Screen options={{title:'Refresh Lock Screen'}} /><ScrollView style={styles.screen} contentContainerStyle={styles.content}>
    <Text style={styles.title}>Refresh Lock Screen</Text><Text accessibilityLiveRegion="polite" style={styles.copy}>{message}</Text>
    <Choice label={busy?'Refreshing…':'Recreate Live Activities again'} disabled={busy} onPress={()=>void refresh()} />
    <Text style={styles.copy}>The refresh notification is reposted for next time. iOS can dismiss notifications; reopen the app and refresh to restore it.</Text>
  </ScrollView></>;
}
