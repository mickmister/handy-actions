import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { runActionPayload } from '@/src/core/handyNotifications';
import type { HandyActionPayload } from '@/src/core/handyModel';
import { useHandyStateContext } from '@/src/hooks/HandyStateProvider';
import { Link } from 'expo-router';

type PayloadType = HandyActionPayload['type'];

export default function ActionsScreen() {
  const handy = useHandyStateContext();
  const [selectedPresetId, setSelectedPresetId] = useState<string | undefined>(handy.state.presets[0]?.id);
  const selectedPreset = useMemo(
    () => handy.state.presets.find((preset) => preset.id === selectedPresetId) ?? handy.state.presets[0],
    [handy.state.presets, selectedPresetId],
  );
  const [name, setName] = useState('');
  const [type, setType] = useState<PayloadType>('qr');
  const [value, setValue] = useState('');
  const [fallbackUrl, setFallbackUrl] = useState('');

  async function addAction() {
    if (!selectedPreset) return;
    const payload = makePayload(type, value, fallbackUrl);
    const result = await handy.addAction(selectedPreset.id, name, payload);
    if (result.ok) {
      setName('');
      setValue('');
      setFallbackUrl('');
    } else {
      Alert.alert('Cannot add action', result.message);
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Actions</Text>
        <Text style={styles.title}>Name plus typed JSON</Text>
        <Text style={styles.copy}>QR actions open an in-app code. Web and deeplink actions open directly after unlock.</Text>
      </View>

      {handy.state.presets.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.cardTitle}>Create a preset first</Text>
          <Text style={styles.copy}>Use the Presets tab to create the notification panel that will hold these actions.</Text>
        </View>
      ) : (
        <>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Preset</Text>
            <View style={styles.chips}>
              {handy.state.presets.map((preset) => (
                <Pressable
                  key={preset.id}
                  style={preset.id === selectedPreset?.id ? styles.selectedChip : styles.chip}
                  onPress={() => setSelectedPresetId(preset.id)}>
                  <Text style={preset.id === selectedPreset?.id ? styles.selectedChipText : styles.chipText}>{preset.name}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Add action</Text>
            <TextInput value={name} onChangeText={setName} placeholder="My LinkedIn" placeholderTextColor="#8792a2" style={styles.input} />
            <View style={styles.chips}>
              {(['qr', 'web', 'deeplink'] as const).map((payloadType) => (
                <Pressable
                  key={payloadType}
                  style={type === payloadType ? styles.selectedChip : styles.chip}
                  onPress={() => setType(payloadType)}>
                  <Text style={type === payloadType ? styles.selectedChipText : styles.chipText}>{payloadType}</Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              value={value}
              onChangeText={setValue}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder={type === 'qr' ? 'QR value or URL' : 'https://example.test or app://target'}
              placeholderTextColor="#8792a2"
              style={styles.input}
            />
            {type === 'deeplink' ? (
              <TextInput
                value={fallbackUrl}
                onChangeText={setFallbackUrl}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="Fallback web URL (optional)"
                placeholderTextColor="#8792a2"
                style={styles.input}
              />
            ) : null}
            <Pressable style={styles.primaryButton} onPress={addAction}>
              <Text style={styles.primaryButtonText}>Add action</Text>
            </Pressable>
          </View>

          {selectedPreset?.actions.map((action) => (
            <View key={action.id} style={styles.card}>
              <View style={styles.row}>
                <View style={styles.flex}>
                  <Text style={styles.cardTitle}>{action.name}</Text>
                  <Text style={styles.meta}>{JSON.stringify(action.payload)}</Text>
                </View>
              </View>
              <View style={styles.row}>
                {action.payload.type === 'qr' ? (
                  <Link href={{ pathname: '/qr', params: { title: action.name, value: action.payload.value } }} asChild>
                    <Pressable style={styles.secondaryButton}>
                      <Text style={styles.secondaryButtonText}>Show QR</Text>
                    </Pressable>
                  </Link>
                ) : (
                  <Pressable style={styles.secondaryButton} onPress={() => void runActionPayload(action.payload)}>
                    <Text style={styles.secondaryButtonText}>Open</Text>
                  </Pressable>
                )}
                <Pressable onPress={() => selectedPreset && void handy.deleteAction(selectedPreset.id, action.id)}>
                  <Text style={styles.deleteText}>Delete</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}

function makePayload(type: PayloadType, value: string, fallbackUrl: string): HandyActionPayload {
  if (type === 'web') return { type, url: value.trim() };
  if (type === 'deeplink') {
    const fallback = fallbackUrl.trim();
    return fallback ? { type, url: value.trim(), fallbackUrl: fallback } : { type, url: value.trim() };
  }
  return { type, value: value.trim() };
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f5f7fb' },
  content: { gap: 14, padding: 18, paddingBottom: 40 },
  header: { gap: 8, paddingTop: 10 },
  eyebrow: { color: '#53657d', fontSize: 13, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
  title: { color: '#0f172a', fontSize: 30, fontWeight: '800', letterSpacing: -0.6 },
  copy: { color: '#516070', fontSize: 16, lineHeight: 23 },
  card: { backgroundColor: '#fff', borderColor: '#e5e9f0', borderRadius: 22, borderWidth: 1, gap: 12, padding: 16 },
  emptyCard: { backgroundColor: '#eef6ff', borderColor: '#cfe7ff', borderRadius: 22, borderWidth: 1, gap: 8, padding: 16 },
  cardTitle: { color: '#111827', fontSize: 18, fontWeight: '800' },
  meta: { color: '#6b7280', fontFamily: 'SpaceMono', fontSize: 12, lineHeight: 18, marginTop: 6 },
  row: { alignItems: 'center', flexDirection: 'row', gap: 12, justifyContent: 'space-between' },
  flex: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: '#f1f5f9', borderRadius: 999, minHeight: 44, justifyContent: 'center', paddingHorizontal: 14 },
  selectedChip: { backgroundColor: '#0f172a', borderRadius: 999, minHeight: 44, justifyContent: 'center', paddingHorizontal: 14 },
  chipText: { color: '#475569', fontSize: 15, fontWeight: '800' },
  selectedChipText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  input: { backgroundColor: '#f8fafc', borderColor: '#d7dde7', borderRadius: 14, borderWidth: 1, color: '#0f172a', fontSize: 16, minHeight: 48, paddingHorizontal: 14 },
  primaryButton: { alignItems: 'center', backgroundColor: '#0f172a', borderRadius: 16, minHeight: 48, justifyContent: 'center' },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  secondaryButton: { alignItems: 'center', backgroundColor: '#e0f2fe', borderRadius: 16, minHeight: 44, justifyContent: 'center', paddingHorizontal: 16 },
  secondaryButtonText: { color: '#075985', fontSize: 15, fontWeight: '800' },
  deleteText: { color: '#dc2626', fontSize: 15, fontWeight: '800', minHeight: 44, paddingTop: 12 },
});
