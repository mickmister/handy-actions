import * as ExpoLinking from 'expo-linking';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Linking, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { NoteComposer, noteStyles as styles } from '@/components/NoteComposer';
import { findAction, isInputPayload, makeId, textInputUrl, type AgentSession, type HandyAction } from '@/src/core/handyModel';
import { completeNote, confirmAgentHandoff, editNote, markNoteAttempt, pendingNotes, queueNote, saveNote } from '@/src/core/handyNotes';
import { readEditorDraft, removeEditorDraft, saveEditorDraft } from '@/src/core/editorDrafts';
import { request } from '@/src/core/requests';
import { httpRequestSpec } from '@/src/core/httpActions';
import { createVdClient, insertTag, prefixedPrompt, type QueueStatus, type Tag } from '@/src/core/vdClient';
import { SessionPicker } from '@/components/SessionPicker';
import { Choice } from '@/components/FormControls';
import { isLocalNoteAction } from '@/src/core/localNoteDelivery';
import { runActionPayload, showTextInputNotification } from '@/src/core/handyNotifications';
import { useHandyStateContext } from '@/src/hooks/HandyStateProvider';

const deliveriesInFlight = new Set<string>();

export default function CaptureScreen() {
  const params = useLocalSearchParams<{ presetId?: string; actionId?: string; submissionId?: string; notification?: string; draftId?: string; submit?: string }>();
  const handy = useHandyStateContext();
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<HandyAction>();
  const [text, setText] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [session, setSession] = useState<AgentSession>();
  const [queueChoice, setQueueChoice] = useState<QueueStatus>();
  const [tags, setTags] = useState<Tag[]>();
  const [selection, setSelection] = useState({start:0,end:0});
  const inputRef = useRef<TextInput>(null);
  const draftId = useRef<string | undefined>(undefined);
  const presetId = useRef(params.presetId);
  const activeId = useRef<string | undefined>(undefined);
  const sourceNoteId = useRef<string | undefined>(undefined);
  const started = useRef('');
  const action = snapshot ?? findAction(handy.state, String(params.actionId ?? ''), params.presetId)?.action;

  function changeText(value: string, selectedSession = session) {
    setText(value); setQueueChoice(undefined);
    if (!action) return;
    draftId.current ??= makeId('editor');
    void saveEditorDraft(action, value, presetId.current, draftId.current,{session:selectedSession,submissionId:activeId.current,sourceNoteId:sourceNoteId.current}).catch(()=>setMessage('Could not save the draft on this device.'));
  }

  async function deliver(target: HandyAction, value: string, submissionId?: string, operation?: 'append'|'overwrite') {
    if (!isInputPayload(target.payload) && target.payload.type !== 'http') return;
    if (isInputPayload(target.payload) && !value.trim()) { setMessage('Enter text first.'); return; }
    const editorAction=target;
    if(target.payload.type==='vd-agent') {
      const destination = target.payload.session ?? session;
      if(!destination) {setMessage('Choose a session for this prompt.');return;}
      target = {...target,payload:{...target.payload,session:destination}};
    }
    if (submissionId && deliveriesInFlight.has(submissionId)) return;
    const deliveryKey = submissionId ?? target.id;
    if (deliveriesInFlight.has(deliveryKey)) return;
    deliveriesInFlight.add(deliveryKey);
    setBusy(true);
    try {
      if(sourceNoteId.current)await editNote(sourceNoteId.current,value);
      const pending = await queueNote(target, value || '[HTTP action]', submissionId,presetId.current,sourceNoteId.current);
      if (!pending) { setMessage('This note was already sent.'); return; }
      activeId.current = pending.id;
      if(draftId.current)await saveEditorDraft(editorAction,value,presetId.current,draftId.current,{session,submissionId:pending.id,sourceNoteId:sourceNoteId.current});
      if(target.payload.type==='http' || target.payload.type==='vd-agent') {
        await markNoteAttempt(pending.id);
        let resultMessage = 'Request sent.';
        if(target.payload.type==='http') {
          const {path,...spec} = httpRequestSpec(target.payload,target.payload.captureText?value:'');
          await request(target.payload.originId,path,spec,false);
        } else {
          const result = await createVdClient(request,target.payload.originId).send(target.payload.session!,prefixedPrompt(target.payload.prefix,value),operation && queueChoice ? {operation,expected:queueChoice} : undefined);
          if(result.kind==='needs-choice') {setQueueChoice(result.queue);setMessage('A message is already queued. Review it, then choose append or overwrite.');return;}
          if(pending.sourceNoteId)await confirmAgentHandoff(pending.id,pending.sourceNoteId,target,result.kind);
          resultMessage = result.kind==='queued'?'Prompt queued for the busy agent.':'Prompt sent to the selected session.';
        }
        await completeNote(pending.id);
        if(draftId.current)await removeEditorDraft(draftId.current);
        draftId.current=undefined;activeId.current=undefined;
        setText('');setSession(undefined);setQueueChoice(undefined);setMessage(resultMessage+(sourceNoteId.current?' Source note marked completed.':''));
        if(sourceNoteId.current)router.replace('/notes');
        return;
      }
      if(target.payload.type!=='text-input')return;
      const url = textInputUrl(target.payload.urlTemplate, value);
      const localNotesUrl = ExpoLinking.createURL('/notes');
      if (isLocalNoteAction(target, localNotesUrl)) {
        await saveNote(value, pending.id);
        await completeNote(pending.id);
        activeId.current = undefined;
        setText('');
        setMessage('Note saved on this device.');
      } else if (url.startsWith(`${localNotesUrl}?`)) {
        // Preserve existing foreground semantics for custom text transforms.
        const destination = new URL(url);
        destination.searchParams.set('submissionId', pending.id);
        await Linking.openURL(destination.toString());
        activeId.current = undefined;
        setText('');
        setMessage('Opened the notes destination in this app.');
      } else {
        await Linking.openURL(url);
        await completeNote(pending.id);
        activeId.current = undefined;
        setText('');
        setMessage('Note sent to the destination app.');
      }
      if(draftId.current)await removeEditorDraft(draftId.current);
      draftId.current=undefined;
    } catch (error) {
      setQueueChoice(undefined);
      setMessage(`Could not confirm delivery. Your draft is kept. Review the destination before explicitly retrying. ${error instanceof Error ? error.message : 'Request failed.'}`);
    } finally { deliveriesInFlight.delete(deliveryKey); setBusy(false); }
  }

  useEffect(() => {
    const key = params.draftId ?? params.submissionId ?? (params.actionId ? `${params.presetId ?? ''}:${params.actionId}` : '');
    if (!handy.loaded || !key || started.current === key) return;
    started.current = key;
    setSnapshot(undefined);
    setText('');
    setMessage('');
    activeId.current = undefined;
    sourceNoteId.current = undefined;
    draftId.current = params.draftId;
    presetId.current = params.presetId;
    setSession(undefined);setQueueChoice(undefined);setTags(undefined);
    if(params.draftId) {
      void readEditorDraft(params.draftId).then(async draft=>{
        if(started.current!==key)return;
         if(!draft){setMessage('This draft is no longer available.');return;}
         if (draft.action.payload.type === 'notes') {
           await removeEditorDraft(draft.id);
           router.replace('/notes');
           return;
         }
        setSnapshot(draft.action);setText(draft.text);setSelection({start:draft.text.length,end:draft.text.length});
        presetId.current=draft.presetId;
        sourceNoteId.current=draft.sourceNoteId;
        setSession(draft.session);activeId.current=draft.submissionId;
        const attempted=draft.submissionId && (await pendingNotes()).find(p=>p.id===draft.submissionId)?.attempted;
        if(attempted)setMessage('Previous delivery may have succeeded. Review the destination before retrying.');
        if(draft.action.payload.type==='http'&&!draft.action.payload.captureText&&params.submit==='1'&&!attempted)await deliver(draft.action,'',draft.submissionId);
        else if(draft.action.payload.type==='web'||draft.action.payload.type==='deeplink') {
          await runActionPayload(draft.action.payload);
          await removeEditorDraft(draft.id);setMessage('Opened destination app.');
        }
      }).catch(()=>setMessage('Could not open this action. The saved draft is retained.'));
      return;
    }
    if (params.submissionId) {
      void pendingNotes().then(async (entries) => {
        const pending = entries.find((entry) => entry.id === params.submissionId);
        if(started.current!==key)return;
        if (!pending) { setMessage('This note was already sent.'); return; }
        setSnapshot(pending.action);
        presetId.current=pending.presetId;
        sourceNoteId.current=pending.sourceNoteId;
        setText(pending.text);
        activeId.current = pending.id;
        if(params.submit==='1' && !pending.attempted) await deliver(pending.action, pending.text, pending.id);
        else if(pending.attempted)setMessage('A previous delivery may have succeeded. Check the destination before sending again.');
      }).catch((error) => setMessage(String(error)));
      return;
    }
    const action=findAction(handy.state,String(params.actionId??''),params.presetId)?.action;
    if (!action) { setMessage('This action is no longer available.'); return; }
    setSnapshot(action);
    if (action.payload.type === 'notes') {
      router.replace('/notes');
    } else if (action.payload.type === 'qr') {
      router.replace({ pathname: '/qr', params: { title: action.name, value: action.payload.value } });
    } else if (isInputPayload(action.payload)) {
      if (params.notification === '1') void postInputNotification(action);
    } else if(action.payload.type==='http') {
      void deliver(action,'');
    } else {
      void runActionPayload(action.payload).then(() => setMessage('Opened destination app.')).catch((error) => setMessage(String(error)));
    }
  }, [handy.loaded, params.presetId, params.actionId, params.submissionId, params.draftId, params.submit, action, params.notification, router]);

  async function showTags() {
    if(action?.payload.type!=='vd-agent')return;
    const key=started.current;
    try {const list=await createVdClient(request,action.payload.originId).tags();if(started.current===key)setTags(list);}
    catch(error){if(started.current===key)setMessage(error instanceof Error?error.message:'Could not load tags.');}
  }

  async function postInputNotification(target: HandyAction) {
    try {
      await showTextInputNotification(target, presetId.current);
      setMessage('Input notification posted. Expand it and select Add Note, or write here.');
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
  }

  return <>
    <Stack.Screen options={{ title: action?.name ?? 'Action' }} />
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>{action?.name ?? 'Action'}</Text>
      {action?.payload.type==='vd-agent'?<>
        <Text style={styles.copy}>{action.payload.session?`Locked session: ${action.payload.session.label}`:'Choose a session for this send.'}</Text>
        {!action.payload.session?<SessionPicker originId={action.payload.originId} value={session} disabled={busy} onSelect={next=>{setSession(next);changeText(text,next);}} />:null}
        {action.payload.prefix?<Text style={styles.copy}>Prefix: {action.payload.prefix}</Text>:null}
        <Choice label="Insert tag…" disabled={busy} onPress={()=>void showTags()} />
        {tags?<View style={styles.card}>{tags.length?tags.map(tag=><Choice key={tag.id} label={tag.tag_name} onPress={()=>{
          const inserted=insertTag(text,selection,tag);changeText(inserted.text);setSelection(inserted.selection);setTags(undefined);inputRef.current?.focus();
        }} />):<Text style={styles.copy}>No tags on this origin.</Text>}<Choice label="Close tags" onPress={()=>setTags(undefined)} /></View>:null}
      </>:null}
      {action && isInputPayload(action.payload) ? <>
        <Text style={styles.copy}>Write a note here or use native notification input. The destination is configured on this action.</Text>
        <NoteComposer text={text} onChangeText={changeText} busy={busy} inputRef={inputRef} selection={selection} onSelectionChange={setSelection}
          submitLabel={action.payload.type==='vd-agent'?'Send prompt':action.payload.type==='http'?'Send request':'Send note'} onSubmit={() => void deliver(action, text, activeId.current)} />
        {queueChoice?.status==='queued'?<View style={styles.card}>
          <Text style={styles.copy}>Already queued: {queueChoice.message.data.message}</Text>
          <Choice label="Append this prompt" disabled={busy} onPress={()=>void deliver(action,text,activeId.current,'append')} />
          <Choice label="Overwrite queued message" disabled={busy} onPress={()=>void deliver(action,text,activeId.current,'overwrite')} />
          <Text style={styles.copy}>The queue is rechecked before writing. Concurrent changes on another client can still race.</Text>
        </View>:null}
        {!sourceNoteId.current?<Pressable style={styles.button} disabled={busy} onPress={() => void postInputNotification(action)}>
          <Text style={styles.buttonText}>Use notification input</Text>
        </Pressable>:<Text style={styles.copy}>Confirmed send or queue acceptance completes the source note. Failed or uncertain delivery keeps it in the inbox.</Text>}
      </> : null}
      {action?.payload.type==='http'&&!action.payload.captureText?<Choice label="Run request" disabled={busy} onPress={()=>void deliver(action,'',activeId.current)} />:null}
      <Text accessibilityLiveRegion="polite" style={styles.copy}>{message || (!handy.loaded ? 'Loading action…' : '')}</Text>
    </ScrollView>
  </>;
}
