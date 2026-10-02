import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { syncPresetNotifications } from '@/src/core/handyNotifications';
import { useHandyStateContext } from '@/src/hooks/HandyStateProvider';

export default function PresetsScreen() {
  const handy = useHandyStateContext();
  const [newPresetName, setNewPresetName] = useState('');
  const enabledCount = handy.state.presets.filter((preset) => preset.enabled).length;

  async function addPreset() {
    const result = await handy.addPreset(newPresetName);
    if (result.ok) setNewPresetName('');
    else Alert.alert('Cannot add preset', result.message);
  }

  async function refreshNotifications() {
    const message = await syncPresetNotifications(handy.state);
    handy.setMessage(message);
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Handy Actions</Text>
        <Text style={styles.title}>Lock-screen command panels</Text>
        <Text style={styles.copy}>
          Enable presets to keep their actions visible as local notifications. No server, no account, no push token.
        </Text>
      </View>

      <View style={styles.statusCard}>
        <Text style={styles.statusTitle}>{enabledCount} enabled</Text>
        <Text style={styles.statusCopy}>{handy.message}</Text>
        <Pressable style={styles.primaryButton} onPress={refreshNotifications}>
          <Text style={styles.primaryButtonText}>Refresh notifications</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>New preset</Text>
        <TextInput
          value={newPresetName}
          onChangeText={setNewPresetName}
          placeholder="Social / Conference"
          placeholderTextColor="#8792a2"
          style={styles.input}
        />
        <Pressable style={styles.secondaryButton} onPress={addPreset}>
          <Text style={styles.secondaryButtonText}>Add preset</Text>
        </Pressable>
      </View>

      {handy.state.presets.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.cardTitle}>No presets yet</Text>
          <Text style={styles.copy}>Create a preset, add actions on the Actions tab, then enable it here.</Text>
        </View>
      ) : (
        handy.state.presets.map((preset) => (
          <View key={preset.id} style={styles.card}>
            <View style={styles.row}>
              <View style={styles.flex}>
                <Text style={styles.cardTitle}>{preset.name}</Text>
                <Text style={styles.meta}>
                  {preset.actions.length} action{preset.actions.length === 1 ? '' : 's'}
                </Text>
              </View>
            </View>
            <View style={styles.row}>
              <Text style={preset.enabled ? styles.enabledPill : styles.disabledPill}>
                {preset.enabled ? 'Enabled for lock screen' : 'Disabled'}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: preset.enabled }}
                onPress={() => void handy.togglePreset(preset.id)}
                style={preset.enabled ? styles.disableButton : styles.enableButton}>
                <Text style={preset.enabled ? styles.disableButtonText : styles.enableButtonText}>
                  {preset.enabled ? 'Disable preset' : 'Enable preset'}
                </Text>
              </Pressable>
              <Pressable
                onPress={() =>
                  Alert.alert('Delete preset?', `Delete ${preset.name} and its actions?`, [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Delete', style: 'destructive', onPress: () => void handy.deletePreset(preset.id) },
                  ])
                }>
                <Text style={styles.deleteText}>Delete</Text>
              </Pressable>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f5f7fb' },
  content: { gap: 14, padding: 18, paddingBottom: 40 },
  header: { gap: 8, paddingTop: 10 },
  eyebrow: { color: '#53657d', fontSize: 13, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
  title: { color: '#0f172a', fontSize: 30, fontWeight: '800', letterSpacing: -0.6 },
  copy: { color: '#516070', fontSize: 16, lineHeight: 23 },
  statusCard: { backgroundColor: '#111827', borderRadius: 24, gap: 12, padding: 18 },
  statusTitle: { color: '#fff', fontSize: 22, fontWeight: '800' },
  statusCopy: { color: '#cbd5e1', fontSize: 15, lineHeight: 21 },
  card: { backgroundColor: '#fff', borderColor: '#e5e9f0', borderRadius: 22, borderWidth: 1, gap: 12, padding: 16 },
  emptyCard: { backgroundColor: '#eef6ff', borderColor: '#cfe7ff', borderRadius: 22, borderWidth: 1, gap: 8, padding: 16 },
  cardTitle: { color: '#111827', fontSize: 18, fontWeight: '800' },
  meta: { color: '#6b7280', fontSize: 14, marginTop: 4 },
  row: { alignItems: 'center', flexDirection: 'row', gap: 12, justifyContent: 'space-between' },
  flex: { flex: 1 },
  input: {
    backgroundColor: '#f8fafc',
    borderColor: '#d7dde7',
    borderRadius: 14,
    borderWidth: 1,
    color: '#0f172a',
    fontSize: 16,
    minHeight: 48,
    paddingHorizontal: 14,
  },
  primaryButton: { alignItems: 'center', backgroundColor: '#38bdf8', borderRadius: 16, minHeight: 48, justifyContent: 'center' },
  primaryButtonText: { color: '#082f49', fontSize: 16, fontWeight: '800' },
  secondaryButton: { alignItems: 'center', backgroundColor: '#0f172a', borderRadius: 16, minHeight: 48, justifyContent: 'center' },
  secondaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  enableButton: { alignItems: 'center', backgroundColor: '#dcfce7', borderRadius: 14, minHeight: 44, justifyContent: 'center', paddingHorizontal: 14 },
  enableButtonText: { color: '#166534', fontSize: 15, fontWeight: '800' },
  disableButton: { alignItems: 'center', backgroundColor: '#fee2e2', borderRadius: 14, minHeight: 44, justifyContent: 'center', paddingHorizontal: 14 },
  disableButtonText: { color: '#991b1b', fontSize: 15, fontWeight: '800' },
  enabledPill: { backgroundColor: '#dcfce7', borderRadius: 999, color: '#166534', fontSize: 13, fontWeight: '800', paddingHorizontal: 10, paddingVertical: 6 },
  disabledPill: { backgroundColor: '#f1f5f9', borderRadius: 999, color: '#64748b', fontSize: 13, fontWeight: '800', paddingHorizontal: 10, paddingVertical: 6 },
  deleteText: { color: '#dc2626', fontSize: 15, fontWeight: '800', minHeight: 44, paddingTop: 12 },
});
