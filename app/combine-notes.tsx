import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { Choice } from '@/components/FormControls';
import { SessionPicker } from '@/components/SessionPicker';
import { useNoteStyles } from '@/components/NoteComposer';
import { readEditorDraft, saveEditorDraft, type EditorDraft } from '@/src/core/editorDrafts';
import { loadNotes, type HandyNote } from '@/src/core/handyNotes';
import { combineNotes } from '@/src/core/combinedNotes';
import { origins } from '@/src/core/origins';
import type { OriginSummary } from '@/src/core/originRepository';

export default function CombineNotesScreen() {
  const styles = useNoteStyles();
  const router = useRouter();
  const {draftId} = useLocalSearchParams<{draftId:string}>();
  const [draft, setDraft] = useState<EditorDraft>();
  const [notes, setNotes] = useState<HandyNote[]>([]);
  const [profiles, setProfiles] = useState<OriginSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useFocusEffect(useCallback(() => {
    let current = true;
    setDraft(undefined);
    void Promise.all([readEditorDraft(draftId),loadNotes(),origins.list()]).then(([saved,list,connections]) => {
      if (!current) return;
      if (!saved?.sourceNoteIds?.length) throw new Error('Open the saved message from Recover unsent notes.');
      if (saved.submissionId) {router.replace({pathname:'/capture',params:{draftId:saved.id}});return;}
      setDraft(saved);setNotes(list);setProfiles(connections);
    }).catch(error=>{if(current)setMessage(error instanceof Error?error.message:'Could not load combined draft.');});
    return ()=>{current=false;};
  },[draftId,router]));
  async function update(next: EditorDraft) {
    setBusy(true);
    try {
      await saveEditorDraft(next.action,next.text,next.presetId,next.id,{sourceNoteIds:next.sourceNoteIds,combineStep:next.combineStep,session:next.session,submissionId:next.submissionId});
      setDraft(next);setMessage('');
      return true;
    } catch {setMessage('Could not save the combined draft. Try again.');return false;}
    finally {setBusy(false);}
  }
  const step = draft?.combineStep ?? 'destination';
  const payload = draft?.action.payload;
  return <>
    <Stack.Screen options={{title:'Combine notes'}} />
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{step === 'order' ? '1 · Arrange notes' : '2 · Choose destination'}</Text>
      {draft && step === 'order' ? <>
        {(draft.sourceNoteIds ?? []).map((id,index,ids)=><View key={id} style={styles.card}>
          <Text numberOfLines={3} style={styles.body}>{notes.find(note=>note.id===id)?.text ?? 'Note unavailable'}</Text>
          <View style={{flexDirection:'row',gap:12}}>{[-1,1].map(direction=><Choice key={direction} label={direction<0?'Move up':'Move down'} disabled={busy || index+direction<0 || index+direction>=ids.length} onPress={()=>{
            const reordered=[...ids];[reordered[index],reordered[index+direction]]=[reordered[index+direction],reordered[index]];
            try {void update({...draft,sourceNoteIds:reordered,text:combineNotes(notes,reordered)});} catch(error){setMessage(String(error));}
          }} />)}</View>
        </View>)}
        <Choice label="Next: destination →" disabled={busy} onPress={()=>{
          setBusy(true);
          void loadNotes().then(fresh=>{setNotes(fresh);return update({...draft,text:combineNotes(fresh,draft.sourceNoteIds ?? []),combineStep:'destination'});}).catch(error=>setMessage(String(error))).finally(()=>setBusy(false));
        }} />
      </> : draft && payload?.type==='vd-agent' ? <>
        {profiles.map(profile=><Choice key={profile.id} label={profile.name} selected={payload.originId===profile.id} disabled={busy} onPress={()=>void update({...draft,action:{...draft.action,payload:{...payload,originId:profile.id,session:undefined}}})} />)}
        {!profiles.length?<Choice label="Add a connection →" onPress={()=>router.push('/origins')} />:null}
        {payload.originId?<SessionPicker key={payload.originId} originId={payload.originId} value={payload.session} disabled={busy} onSelect={session=>void update({...draft,action:{...draft.action,payload:{...payload,session}}})} />:null}
        <Choice label="Review and edit message →" disabled={busy || !payload.originId || !payload.session} onPress={()=>{
          void update({...draft,combineStep:'review'}).then(saved=>{if(saved)router.push({pathname:'/capture',params:{draftId:draft.id}});});
        }} />
        <Choice label="Back: arrange notes" disabled={busy} onPress={()=>{
          if(step==='review') Alert.alert('Rebuild the combined message?', 'Reordering replaces your edited combined draft with the original note contents.', [{text:'Keep draft',style:'cancel'},{text:'Rebuild',onPress:()=>void update({...draft,combineStep:'order'})}]);
          else void update({...draft,combineStep:'order'});
        }} />
      </>:null}
      {message?<Text accessibilityLiveRegion="polite" style={styles.copy}>{message}</Text>:null}
    </ScrollView>
  </>;
}
