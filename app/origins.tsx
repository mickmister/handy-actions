import { Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { Choice, Field, formStyles as styles } from '@/components/FormControls';
import { origins } from '@/src/core/origins';
import { makeId } from '@/src/core/handyModel';
import type { OriginDraft, OriginSummary } from '@/src/core/originRepository';

export default function OriginsScreen() {
  const [list, setList] = useState<OriginSummary[]>([]);
  const [draft, setDraft] = useState<OriginDraft>();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => { try { setList(await origins.list()); } catch { setMessage('Could not read secure origin profiles.'); } }, []);
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  async function save() {
    if (!draft) return;
    const submitted = draft;
    // Immediately discard submitted secrets from editable UI, including failures.
    setDraft({ ...draft, headers: draft.headers.map(h => h.mode === 'secret' ? { name: h.name, mode: h.mode } : h) });
    setBusy(true); setMessage('');
    try { await origins.save(submitted); setDraft(undefined); await refresh(); setMessage('Origin saved securely.'); }
    catch (e) { setMessage(e instanceof Error ? e.message : 'Could not save origin. Re-enter secret values to retry.'); }
    finally { setBusy(false); }
  }
  return <><Stack.Screen options={{ title: 'Origins & headers' }} /><ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Text style={styles.title}>Connections</Text><Text style={styles.copy}>Reusable origins for HTTP and VD actions. All profiles and headers are in secure storage, separate from exported presets. Secret values cannot be revealed after saving.</Text>
    {list.map(profile => <View key={profile.id} style={styles.card}><Text style={styles.label}>{profile.name}</Text><Text style={styles.copy}>{profile.origin}</Text>
      {profile.headers.map(h => <Text key={h.name} style={styles.copy}>{h.name}: {h.mode === 'secret' ? (h.configured ? 'Secret configured' : 'Not configured') : h.value}</Text>)}
      <View style={styles.row}><Choice label="Edit / replace headers" onPress={() => { setDraft({ id: profile.id, name: profile.name, origin: profile.origin, headers: profile.headers.map(h => ({ name: h.name, mode: h.mode, ...(h.mode === 'plaintext' ? { value: h.value } : {}) })) }); setMessage('Leave an existing secret blank to keep it. Mode changes require a replacement.'); }} />
      <Choice label="Delete" onPress={() => Alert.alert('Delete origin?', 'Actions referencing it will need another origin.', [{ text: 'Cancel' }, { text: 'Delete', style: 'destructive', onPress: () => { void origins.remove(profile.id).then(refresh).catch(() => setMessage('Could not delete origin.')); } }])} /></View>
    </View>)}
    <Choice label="Add origin" onPress={() => { setDraft({ id: makeId('origin'), name: '', origin: '', headers: [] }); setMessage(''); }} />
    {draft ? <View style={styles.card}><Field label="Connection name" value={draft.name} onChangeText={name => setDraft({ ...draft, name })} />
      <Field label="Origin (for example https://vd.example.com)" value={draft.origin} onChangeText={origin => setDraft({ ...draft, origin })} />
      {draft.headers.map((h, index) => <View key={index} style={styles.card}><Field label="Header name" value={h.name} onChangeText={name => setDraft({ ...draft, headers: draft.headers.map((v,i) => i === index ? { ...v, name } : v) })} />
        <View style={styles.row}>{(['plaintext','secret'] as const).map(mode => <Choice key={mode} label={mode} selected={h.mode === mode} onPress={() => { if (mode !== h.mode) setDraft({ ...draft, headers: draft.headers.map((v,i) => i === index ? { name: v.name, mode, value: '' } : v) }); }} />)}</View>
        <Field label={h.mode === 'secret' ? 'Replacement secret (never shown after submission)' : 'Header value'} secureTextEntry={h.mode === 'secret'} value={h.value ?? ''} onChangeText={value => setDraft({ ...draft, headers: draft.headers.map((v,i) => i === index ? { ...v, value } : v) })} />
        <Choice label="Remove header" onPress={() => setDraft({ ...draft, headers: draft.headers.filter((_,i) => i !== index) })} />
      </View>)}
      <Choice label="Add header" onPress={() => setDraft({ ...draft, headers: [...draft.headers, { name: '', mode: 'secret', value: '' }] })} />
      <View style={styles.row}><Choice label={busy ? 'Saving…' : 'Save securely'} disabled={busy} selected onPress={() => void save()} /><Choice label="Cancel" disabled={busy} onPress={() => setDraft(undefined)} /></View>
    </View> : null}<Text accessibilityLiveRegion="polite" style={styles.copy}>{message}</Text>
  </ScrollView></>;
}
