import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { runActionPayload } from '@/src/core/handyNotifications';
import type { HandyActionPayload } from '@/src/core/handyModel';
import { useHandyStateContext } from '@/src/hooks/HandyStateProvider';
import { Link } from 'expo-router';
import * as ExpoLinking from 'expo-linking';

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
  const [editingId, setEditingId] = useState<string>();

  async function addAction() {
    if (!selectedPreset) return;
    const payload = makePayload(type, value, fallbackUrl);
    const result = editingId
      ? await handy.updateAction(selectedPreset.id, editingId, name, payload)
      : await handy.addAction(selectedPreset.id, name, payload);
    if (result.ok) {
      setName('');
      setValue('');
      setFallbackUrl('');
      setEditingId(undefined);
    } else {
      Alert.alert('Cannot add action', result.message);
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Actions</Text>
        <Text style={styles.title}>Name plus typed JSON</Text>
        <Text style={styles.copy}>QR actions show a code. Text-input actions capture a note and send it to a destination you choose.</Text>
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
                  onPress={() => { setSelectedPresetId(preset.id); setEditingId(undefined); setName(''); setValue(''); setFallbackUrl(''); }}>
                  <Text style={preset.id === selectedPreset?.id ? styles.selectedChipText : styles.chipText}>{preset.name}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>{editingId ? 'Edit action' : 'Add action'}</Text>
            <TextInput value={name} onChangeText={setName} placeholder="My LinkedIn" placeholderTextColor="#8792a2" style={styles.input} />
            <View style={styles.chips}>
              {(['qr', 'web', 'deeplink', 'text-input'] as const).map((payloadType) => (
                <Pressable
                  key={payloadType}
                  style={type === payloadType ? styles.selectedChip : styles.chip}
                  onPress={() => {
                    setType(payloadType);
                    if (payloadType === 'text-input' && !value) {
                      setValue(`${ExpoLinking.createURL('/notes')}?text={text}`);
                      if (!name) setName('Add Note');
                    }
                  }}>
                  <Text style={type === payloadType ? styles.selectedChipText : styles.chipText}>{payloadType}</Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              value={value}
              onChangeText={setValue}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder={type === 'qr' ? 'QR value or URL' : type === 'text-input' ? 'app://add-note?text={text}' : 'https://example.test or app://target'}
              placeholderTextColor="#8792a2"
              style={styles.input}
            />
            {type === 'text-input' ? <>
              <Text style={styles.copy}>Use {'{text}'} where the URL should receive your note. Text is URL-encoded automatically.</Text>
              <Pressable style={styles.secondaryButton} onPress={() => setValue(`${ExpoLinking.createURL('/notes')}?text={text}`)}>
                <Text style={styles.secondaryButtonText}>Use this app as destination</Text>
              </Pressable>
            </> : null}
            {type === 'deeplink' || type === 'text-input' ? (
              <TextInput
                value={fallbackUrl}
                onChangeText={setFallbackUrl}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder={type === 'text-input' ? 'Fallback https://…?text={text} (optional)' : 'Fallback web URL (optional)'}
                placeholderTextColor="#8792a2"
                style={styles.input}
              />
            ) : null}
            <Pressable style={styles.primaryButton} onPress={addAction}>
              <Text style={styles.primaryButtonText}>{editingId ? 'Save action' : 'Add action'}</Text>
            </Pressable>
            {editingId ? <Pressable onPress={() => { setEditingId(undefined); setName(''); setValue(''); setFallbackUrl(''); }}>
              <Text style={styles.deleteText}>Cancel editing</Text>
            </Pressable> : null}
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
                ) : action.payload.type === 'text-input' ? (
                  <Link href={{ pathname: '/capture', params: { actionId: action.id, presetId: selectedPreset.id } }} asChild>
                    <Pressable style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>Add Note</Text></Pressable>
                  </Link>
                ) : (
                  <Pressable style={styles.secondaryButton} onPress={() => void runActionPayload(action.payload)}>
                    <Text style={styles.secondaryButtonText}>Open</Text>
                  </Pressable>
                )}
                <Pressable onPress={() => {
                  setEditingId(action.id); setName(action.name); setType(action.payload.type);
                  setValue(action.payload.type === 'qr' ? action.payload.value : action.payload.type === 'text-input' ? action.payload.urlTemplate : action.payload.url);
                  setFallbackUrl(action.payload.type === 'deeplink' ? action.payload.fallbackUrl ?? '' : action.payload.type === 'text-input' ? action.payload.fallbackUrlTemplate ?? '' : '');
                }}><Text style={styles.chipText}>Edit</Text></Pressable>
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
  if (type === 'text-input') return { type, urlTemplate: value.trim(), ...(fallbackUrl.trim() ? { fallbackUrlTemplate: fallbackUrl.trim() } : {}) };
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
