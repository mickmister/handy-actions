import { Link, Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { useNoteStyles } from '@/components/NoteComposer';
import { completeNote, editNote, loadNotes, saveNote, setNoteStatus, type HandyNote } from '@/src/core/handyNotes';
import { Choice, Field } from '@/components/FormControls';
import { RemoteActionEditor } from '@/components/RemoteActionEditor';
import { makeId, validateHandyState, type AgentActionPayload, type HandyAction } from '@/src/core/handyModel';
import { saveEditorDraft } from '@/src/core/editorDrafts';
import { useHandyStateContext } from '@/src/hooks/HandyStateProvider';
import { combineNotes } from '@/src/core/combinedNotes';

export default function NotesScreen() {
  const styles = useNoteStyles();
  const router=useRouter();
  const handy=useHandyStateContext();
  const params = useLocalSearchParams<{ text?: string; submissionId?: string }>();
  const [notes, setNotes] = useState<HandyNote[]>([]);
  const [message, setMessage] = useState('');
  const saved = useRef('');
  const [view,setView]=useState<'unaddressed'|'completed'>('unaddressed');
  const [editing,setEditing]=useState<string>();
  const [text,setText]=useState('');
  const [choosingAgent,setChoosingAgent]=useState(false);
  const [custom,setCustom]=useState(false);
  const [payload,setPayload]=useState<AgentActionPayload>({type:'vd-agent',originId:'',prefix:''});
  const [busy,setBusy]=useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [selecting, setSelecting] = useState(false);
  const visible=notes.filter(note=>(note.status??'unaddressed')===view);
  const agentActions=handy.state.presets.flatMap(preset=>preset.actions.filter(action=>action.payload.type==='vd-agent').map(action=>({preset,action})));

  async function saveEdit() {
    if(!editing)return;
    setBusy(true);
    try {await editNote(editing,text);setNotes(await loadNotes());setMessage('Note updated.');setEditing(undefined);setChoosingAgent(false);}
    catch(error){setMessage(error instanceof Error?error.message:'Could not update note.');}
    finally{setBusy(false);}
  }
  async function changeStatus(note:HandyNote) {
    setBusy(true);
    try {await setNoteStatus(note.id,note.status==='completed'?'unaddressed':'completed');setNotes(await loadNotes());}
    catch{setMessage('Could not update note status.');}
    finally{setBusy(false);}
  }
  async function sendToAgent(action:HandyAction,presetId?:string) {
    if(!editing||busy)return;
    const validation=validateHandyState({presets:[{id:'handoff',name:'Handoff',enabled:false,actions:[action]}]});
    if(!validation.ok){setMessage(validation.errors.join('\n'));return;}
    setBusy(true);
    try {
      await editNote(editing,text);
      const draft=await saveEditorDraft(action,text,presetId,undefined,{sourceNoteId:editing});
      router.push({pathname:'/capture',params:{draftId:draft.id}});
      setEditing(undefined);setChoosingAgent(false);setCustom(false);
    } catch {setMessage('Could not prepare the agent draft. Your source note is retained.');}
    finally{setBusy(false);}
  }
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
    <Stack.Screen options={{ title: 'Notes inbox' }} />
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Notes inbox</Text>
      <View style={{flexDirection:'row',gap:12}}>{(['unaddressed','completed'] as const).map(status=><Choice key={status} label={`${status==='unaddressed'?'Unaddressed':'Completed'} (${notes.filter(note=>(note.status??'unaddressed')===status).length})`} selected={view===status} disabled={busy} onPress={()=>{setView(status);setEditing(undefined);setChoosingAgent(false);setSelecting(false);setSelected([]);}} />)}</View>
      <Link style={styles.link} href="/pending-notes">Recover unsent notes</Link>
      {view === 'unaddressed' ? <>
        <Choice label={selecting ? 'Cancel selection' : 'Select notes to combine'} disabled={busy} onPress={() => {setSelecting(!selecting);setSelected([]);setEditing(undefined);}} />
        {selecting ? <Choice label={`Combine ${selected.length} notes →`} disabled={busy || selected.length < 2} onPress={() => {
          setBusy(true);
          void (async () => {
            const fresh = await loadNotes();
            const draft = await saveEditorDraft({id: makeId('combined'), name: 'Combined notes', payload: {type:'vd-agent',originId:'',prefix:''}}, combineNotes(fresh, selected), undefined, undefined, {sourceNoteIds:selected,combineStep:'order'});
            router.push({pathname:'/combine-notes',params:{draftId:draft.id}});
            setSelecting(false);setSelected([]);
          })().catch(error=>setMessage(error instanceof Error?error.message:'Could not prepare combined draft.')).finally(()=>setBusy(false));
        }} /> : null}
      </> : null}
      {message ? <Text style={styles.copy}>{message}</Text> : null}
      {!visible.length ? <Text style={styles.copy}>{view==='completed'?'No completed notes.':'No unaddressed notes. Capture a note with “Use this app” as its destination.'}</Text> : null}
      {visible.map((note) => <View key={note.id} style={styles.card}>
        {selecting && view === 'unaddressed' ? <Choice label={selected.includes(note.id) ? `Selected ${selected.indexOf(note.id)+1}` : 'Select note'} selected={selected.includes(note.id)} disabled={busy} onPress={()=>setSelected(ids=>ids.includes(note.id)?ids.filter(id=>id!==note.id):[...ids,note.id])} /> : null}
        {editing===note.id?<>
          <Field label="Edit note" multiline value={text} onChangeText={setText} editable={!busy} />
          <Choice label="Save edits" disabled={busy||!text.trim()} onPress={()=>void saveEdit()} />
          <Choice label="Cancel editing" disabled={busy} onPress={()=>{setEditing(undefined);setChoosingAgent(false);setCustom(false);}} />
          <Choice label="Turn into agent action…" disabled={busy||!text.trim()} onPress={()=>setChoosingAgent(true)} />
          {choosingAgent?<View style={styles.card}>
            <Text style={styles.copy}>Choose an agent action. You will review the prompt and destination before sending.</Text>
            {agentActions.map(({preset,action})=><Choice key={`${preset.id}:${action.id}`} label={`${preset.name} / ${action.name}`} disabled={busy} onPress={()=>void sendToAgent(action,preset.id)} />)}
            <Choice label="Choose connection / session…" disabled={busy} onPress={()=>setCustom(true)} />
            {custom?<><RemoteActionEditor value={payload} onChange={next=>{if(next.type==='vd-agent')setPayload(next);}} />
              <Choice label="Review agent prompt" disabled={busy||!payload.originId} onPress={()=>void sendToAgent({id:makeId('note-agent'),name:'Send note to agent',payload})} /></>:null}
          </View>:null}
        </>:<>
          <Text selectable style={styles.body}>{note.text}</Text>
          <Choice label="Edit / send to agent" disabled={busy} onPress={()=>{setEditing(note.id);setText(note.text);setChoosingAgent(false);setCustom(false);}} />
          <Choice label={note.status==='completed'?'Reopen note':'Mark completed'} disabled={busy} onPress={()=>void changeStatus(note)} />
        </>}
        <Text style={styles.copy}>{new Date(note.createdAt).toLocaleString()}</Text>
        {note.handoff?<Text style={styles.copy}>{note.handoff.kind==='queued'?'Queued':'Sent'} to {note.handoff.sessionLabel} · {new Date(note.handoff.acceptedAt).toLocaleString()}</Text>:null}
      </View>)}
    </ScrollView>
  </>;
}
