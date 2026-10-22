import { useEffect, useState } from 'react';
import { Link } from 'expo-router';
import { Switch, Text, View } from 'react-native';
import { Choice, Field, formStyles as styles } from './FormControls';
import { SessionPicker } from './SessionPicker';
import { origins } from '@/src/core/origins';
import type { OriginSummary } from '@/src/core/originRepository';
import type { AgentActionPayload, HandyActionPayload, HttpActionPayload } from '@/src/core/handyModel';

export function RemoteActionEditor({ value, onChange }: { value: HttpActionPayload | AgentActionPayload; onChange(value: HandyActionPayload): void }) {
  const [profiles, setProfiles] = useState<OriginSummary[]>([]);
  const [message,setMessage] = useState('');
  useEffect(()=>{ void origins.list().then(setProfiles).catch(()=>setMessage('Could not load secure connections.')); },[]);
  return <View style={styles.card}><Text style={styles.label}>Origin</Text><Link href="/origins">Manage origins and headers</Link>
    <View style={styles.row}>{profiles.map(p=><Choice key={p.id} label={p.name} selected={value.originId===p.id} onPress={()=>onChange(value.type==='vd-agent' ? { ...value, originId:p.id, session:undefined } : { ...value, originId:p.id })} />)}</View>
    <Choice label="Refresh connections" onPress={()=>{void origins.list().then(setProfiles).catch(()=>setMessage('Could not load connections.'));}} />
    {value.originId && !profiles.some(p=>p.id===value.originId) ? <Text style={styles.copy}>This action needs to be reconnected to a local origin.</Text>:null}
    {value.type==='http' ? <>
      <Field label="Path (relative to origin)" value={value.path} onChangeText={path=>onChange({...value,path})} />
      <View style={styles.row}>{(['GET','POST','PUT','PATCH','DELETE'] as const).map(method=><Choice key={method} label={method} selected={value.method===method} onPress={()=>onChange({...value,method, ...(method==='GET'?{bodyFormat:'none' as const}: {})})} />)}</View>
      <View style={styles.row}>{(['none','json','text'] as const).map(bodyFormat=><Choice key={bodyFormat} label={bodyFormat} selected={value.bodyFormat===bodyFormat} disabled={value.method==='GET'&&bodyFormat!=='none'} onPress={()=>onChange({...value,bodyFormat,body:bodyFormat==='json'&&!value.body?'{}':value.body})} />)}</View>
      {value.bodyFormat!=='none'?<Field label="Request body" multiline value={value.body} onChangeText={body=>onChange({...value,body})} />:null}
      <View style={styles.row}><Switch value={value.captureText} onValueChange={captureText=>onChange({...value,captureText})} /><Text style={styles.copy}>Ask for text before sending</Text></View>
      <Text style={styles.copy}>Use {'{text}'} in the path or a JSON string/body. JSON is escaped safely. Requests have a 20-second timeout and never follow redirects or retry automatically.</Text>
    </>:<>
      <Field label="Optional prompt prefix" multiline value={value.prefix} onChangeText={prefix=>onChange({...value,prefix})} />
      <Text style={styles.copy}>Prefix + newline + fresh prompt. Empty input never sends a prefix-only message.</Text>
      <View style={styles.row}><Switch value={!!value.session} onValueChange={locked=>{if(!locked)onChange({...value,session:undefined});else setMessage('Select a session below to lock this action.');}} /><Text style={styles.copy}>{value.session?'Locked to '+value.session.label:'Ask for session on every send'}</Text></View>
      {value.originId?<SessionPicker originId={value.originId} value={value.session} onSelect={session=>{onChange({...value,session});setMessage('Action locked to selected session. Clear the switch to ask each time.');}} />:null}
    </>}<Text style={styles.copy}>{message}</Text>
  </View>;
}
