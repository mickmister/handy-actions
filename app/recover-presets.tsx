import { Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Choice, useFormStyles } from '@/components/FormControls';
import { useHandyStateContext } from '@/src/hooks/HandyStateProvider';
import { scanPreviousPresets, settingsRecoveryAvailable } from '@/src/core/settingsRecovery';
import type { RecoveryCandidate } from '@/src/core/presetRecovery';

export default function RecoverPresetsScreen() {
  const styles = useFormStyles();
  const handy = useHandyStateContext();
  const [candidates, setCandidates] = useState<RecoveryCandidate[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useFocusEffect(useCallback(() => {
    let active = true;
    setBusy(true);
    void scanPreviousPresets().then(result => {
      if (!active) return;
      setCandidates(result.candidates);
      setMessage(`${result.candidates.length ? 'Found previous presets to review.' : 'No valid previous preset file was found.'}${result.unreadableFiles ? ` ${result.unreadableFiles} file(s) could not be read; unlock the phone and retry.` : ''}`);
    }).catch(error => {if (active) setMessage(error instanceof Error ? error.message : 'Could not inspect previous presets.');})
      .finally(() => {if (active) setBusy(false);});
    return () => {active = false;};
  }, []));
  async function scan() {
    if (busy) return;
    setBusy(true);
    try {const result = await scanPreviousPresets(); setCandidates(result.candidates); setMessage(`${result.candidates.length ? 'Found previous presets to review.' : 'No valid previous preset file was found.'}${result.unreadableFiles ? ` ${result.unreadableFiles} file(s) could not be read; unlock the phone and retry.` : ''}`);}
    catch (error) {setMessage(error instanceof Error ? error.message : 'Could not inspect previous presets.');}
    finally {setBusy(false);}
  }
  return <><Stack.Screen options={{title:'Recover presets'}} /><ScrollView style={styles.screen} contentContainerStyle={styles.content}>
    <Text style={styles.title}>Recover previous presets</Text>
    <Text style={styles.copy}>This looks for original settings files that may remain after the current preset list became empty. Looking does not change your data.</Text>
    <Choice label={busy ? 'Working…' : 'Look again'} disabled={busy || !settingsRecoveryAvailable} onPress={() => void scan()} />
    {message ? <Text accessibilityLiveRegion="polite" style={styles.copy}>{message}</Text> : null}
    {candidates.map(candidate => <View key={candidate.id} style={styles.card}>
      <Text style={styles.label}>{candidate.source}</Text>
      <Text style={styles.copy}>{candidate.state.presets.length} presets · {candidate.state.presets.reduce((count, preset) => count + preset.actions.length, 0)} actions</Text>
      {candidate.modifiedAt ? <Text style={styles.copy}>{new Date(candidate.modifiedAt).toLocaleString()}</Text> : null}
      {candidate.state.presets.map(preset => <Text key={preset.id} style={styles.copy}>{preset.name} ({preset.actions.length} actions)</Text>)}
      <Text style={styles.copy}>Restore adds missing presets and actions. Current action edits and your separately saved theme are preserved.</Text>
      <Choice label="Restore these presets" disabled={busy} onPress={() => {
        setBusy(true);
        void handy.restorePresets(candidate.state).then(result => setMessage(result.message)).finally(() => setBusy(false));
      }} />
    </View>)}
  </ScrollView></>;
}
