import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { getNotificationStatus, requestNotificationAccess, syncPresetNotifications } from '@/src/core/handyNotifications';
import { useHandyStateContext } from '@/src/hooks/HandyStateProvider';

export default function SettingsScreen() {
  const handy = useHandyStateContext();
  const [importText, setImportText] = useState('');
  const [status, setStatus] = useState('Tap Check permission.');

  async function checkPermission() {
    const next = await getNotificationStatus();
    setStatus(next.message);
  }

  async function requestPermission() {
    const next = await requestNotificationAccess();
    setStatus(next.message);
  }

  async function importPresets() {
    try {
      const result = await handy.importText(importText);
      if (!result.ok) Alert.alert('Import failed', result.message);
      else setImportText('');
    } catch (error) {
      Alert.alert('Import failed', error instanceof Error ? error.message : String(error));
    }
  }

  async function refreshNotifications() {
    const message = await syncPresetNotifications(handy.state);
    handy.setMessage(message);
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Settings</Text>
        <Text style={styles.title}>Local app controls</Text>
        <Text style={styles.copy}>Everything here stays on this device unless you copy the JSON yourself.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Notifications</Text>
        <Text style={styles.copy}>{status}</Text>
        <View style={styles.buttonRow}>
          <Pressable style={styles.secondaryButton} onPress={checkPermission}>
            <Text style={styles.secondaryButtonText}>Check permission</Text>
          </Pressable>
          <Pressable style={styles.primaryButton} onPress={requestPermission}>
            <Text style={styles.primaryButtonText}>Request access</Text>
          </Pressable>
        </View>
        <Pressable style={styles.darkButton} onPress={refreshNotifications}>
          <Text style={styles.darkButtonText}>Rebuild local notifications</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Export JSON</Text>
        <Text selectable style={styles.codeBlock}>
          {handy.exportText}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Import JSON</Text>
        <TextInput
          value={importText}
          onChangeText={setImportText}
          multiline
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="Paste Handy Actions JSON"
          placeholderTextColor="#8792a2"
          style={styles.textArea}
        />
        <Pressable style={styles.darkButton} onPress={importPresets}>
          <Text style={styles.darkButtonText}>Import presets</Text>
        </Pressable>
      </View>
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
  card: { backgroundColor: '#fff', borderColor: '#e5e9f0', borderRadius: 22, borderWidth: 1, gap: 12, padding: 16 },
  cardTitle: { color: '#111827', fontSize: 18, fontWeight: '800' },
  buttonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  primaryButton: { alignItems: 'center', backgroundColor: '#38bdf8', borderRadius: 16, minHeight: 48, justifyContent: 'center', paddingHorizontal: 16 },
  primaryButtonText: { color: '#082f49', fontSize: 15, fontWeight: '800' },
  secondaryButton: { alignItems: 'center', backgroundColor: '#e0f2fe', borderRadius: 16, minHeight: 48, justifyContent: 'center', paddingHorizontal: 16 },
  secondaryButtonText: { color: '#075985', fontSize: 15, fontWeight: '800' },
  darkButton: { alignItems: 'center', backgroundColor: '#0f172a', borderRadius: 16, minHeight: 48, justifyContent: 'center' },
  darkButtonText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  codeBlock: { backgroundColor: '#0f172a', borderRadius: 16, color: '#dbeafe', fontFamily: 'SpaceMono', fontSize: 12, lineHeight: 18, padding: 14 },
  textArea: { backgroundColor: '#f8fafc', borderColor: '#d7dde7', borderRadius: 14, borderWidth: 1, color: '#0f172a', fontFamily: 'SpaceMono', fontSize: 13, minHeight: 160, padding: 14, textAlignVertical: 'top' },
});
