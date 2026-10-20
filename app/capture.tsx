import * as ExpoLinking from 'expo-linking';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Linking, Pressable, ScrollView, Text } from 'react-native';

import { NoteComposer, noteStyles as styles } from '@/components/NoteComposer';
import { findAction, textInputUrl, type HandyAction } from '@/src/core/handyModel';
import { completeNote, pendingNotes, queueNote } from '@/src/core/handyNotes';
import { runActionPayload, showTextInputNotification } from '@/src/core/handyNotifications';
import { useHandyStateContext } from '@/src/hooks/HandyStateProvider';

const deliveriesInFlight = new Set<string>();

export default function CaptureScreen() {
  const params = useLocalSearchParams<{ presetId?: string; actionId?: string; submissionId?: string; notification?: string }>();
  const handy = useHandyStateContext();
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<HandyAction>();
  const [text, setText] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const activeId = useRef<string | undefined>(undefined);
  const started = useRef('');
  const action = snapshot ?? findAction(handy.state, String(params.actionId ?? ''), params.presetId)?.action;

  async function deliver(target: HandyAction, value: string, submissionId?: string) {
    if (target.payload.type !== 'text-input') return;
    if (submissionId && deliveriesInFlight.has(submissionId)) return;
    const deliveryKey = submissionId ?? target.id;
    if (deliveriesInFlight.has(deliveryKey)) return;
    deliveriesInFlight.add(deliveryKey);
    setBusy(true);
    try {
      const pending = await queueNote(target, value, submissionId);
      if (!pending) { setMessage('This note was already sent.'); return; }
      activeId.current = pending.id;
      const url = textInputUrl(target.payload.urlTemplate, value);
      const localNotesUrl = ExpoLinking.createURL('/notes');
      if (url.startsWith(`${localNotesUrl}?`)) {
        const destination = new URL(url);
        destination.searchParams.set('submissionId', pending.id);
        await Linking.openURL(destination.toString());
        activeId.current = undefined;
        setText('');
        setMessage('Opened the notes destination in this app.');
      } else {
        try { await Linking.openURL(url); }
        catch (error) {
          if (!target.payload.fallbackUrlTemplate) throw error;
          await Linking.openURL(textInputUrl(target.payload.fallbackUrlTemplate, value));
        }
        await completeNote(pending.id);
        activeId.current = undefined;
        setText('');
        setMessage('Note sent to the destination app.');
      }
    } catch (error) {
      setMessage(`Could not send. Your note is kept for retry. ${error instanceof Error ? error.message : String(error)}`);
    } finally { deliveriesInFlight.delete(deliveryKey); setBusy(false); }
  }

  useEffect(() => {
    const key = params.submissionId ?? (params.actionId ? `${params.presetId ?? ''}:${params.actionId}` : '');
    if (!handy.loaded || !key || started.current === key) return;
    started.current = key;
    setSnapshot(undefined);
    setText('');
    setMessage('');
    activeId.current = undefined;
    if (params.submissionId) {
      void pendingNotes().then(async (entries) => {
        const pending = entries.find((entry) => entry.id === params.submissionId);
        if (!pending) { setMessage('This note was already sent.'); return; }
        setSnapshot(pending.action);
        setText(pending.text);
        activeId.current = pending.id;
        await deliver(pending.action, pending.text, pending.id);
      }).catch((error) => setMessage(String(error)));
      return;
    }
    if (!action) { setMessage('This action is no longer available.'); return; }
    if (action.payload.type === 'qr') {
      router.replace({ pathname: '/qr', params: { title: action.name, value: action.payload.value } });
    } else if (action.payload.type === 'text-input') {
      if (params.notification === '1') void postInputNotification(action);
    } else {
      void runActionPayload(action.payload).then(() => setMessage('Opened destination app.')).catch((error) => setMessage(String(error)));
    }
  }, [handy.loaded, params.presetId, params.actionId, params.submissionId, action, params.notification, router]);

  async function postInputNotification(target: HandyAction) {
    try {
      await showTextInputNotification(target, params.presetId);
      setMessage('Input notification posted. Expand it and select Add Note, or write here.');
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
  }

  return <>
    <Stack.Screen options={{ title: action?.name ?? 'Action' }} />
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>{action?.name ?? 'Action'}</Text>
      {action?.payload.type === 'text-input' ? <>
        <Text style={styles.copy}>Write a note here or use native notification input. The destination is configured on this action.</Text>
        <NoteComposer text={text} onChangeText={setText} busy={busy} onSubmit={() => void deliver(action, text, activeId.current)} />
        <Pressable style={styles.button} disabled={busy} onPress={() => void postInputNotification(action)}>
          <Text style={styles.buttonText}>Use notification input</Text>
        </Pressable>
      </> : null}
      <Text accessibilityLiveRegion="polite" style={styles.copy}>{message || (!handy.loaded ? 'Loading action…' : '')}</Text>
    </ScrollView>
  </>;
}
