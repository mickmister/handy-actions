import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { runActionPayload, syncPresetNotifications } from '@/src/core/handyNotifications';
import type { HandyAction } from '@/src/core/handyModel';
import { useHandyStateContext } from '@/src/hooks/HandyStateProvider';

export default function PresetActionsScreen() {
  const router = useRouter();
  const handy = useHandyStateContext();
  const params = useLocalSearchParams<{ presetId?: string }>();
  const presetId = String(params.presetId ?? '');
  const preset = handy.state.presets.find((candidate) => candidate.id === presetId);
  const title = !handy.loaded ? 'Loading actions…' : preset?.name ?? 'Preset not found';

  async function useAction(action: HandyAction) {
    const message = await syncPresetNotifications(handy.state);
    handy.setMessage(message);

    if (action.payload.type === 'qr') {
      router.push({ pathname: '/qr', params: { title: action.name, value: action.payload.value } });
      return;
    }

    await runActionPayload(action.payload);
  }

  return (
    <>
      <Stack.Screen options={{ title }} />
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Notification panel</Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.copy}>
            {!handy.loaded
              ? 'Loading local presets from this device.'
              : preset
                ? 'Tap an action. The lock-screen notification is rebuilt before the action opens.'
                : 'This preset is no longer in local storage.'}
          </Text>
        </View>

        {preset && preset.actions.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.cardTitle}>No actions</Text>
            <Text style={styles.copy}>Add actions on the Actions tab, then refresh notifications.</Text>
          </View>
        ) : null}

        {preset?.actions.map((action) => (
          <View key={action.id} style={styles.card}>
            <View style={styles.row}>
              <View style={styles.flex}>
                <Text style={styles.cardTitle}>{action.name}</Text>
                <Text style={styles.meta}>{actionSummary(action)}</Text>
              </View>
              <Text style={styles.typePill}>{action.payload.type}</Text>
            </View>
            <Pressable style={styles.primaryButton} onPress={() => void useAction(action)}>
              <Text style={styles.primaryButtonText}>{action.payload.type === 'qr' ? 'Show QR' : 'Open'}</Text>
            </Pressable>
          </View>
        ))}
      </ScrollView>
    </>
  );
}

function actionSummary(action: HandyAction): string {
  if (action.payload.type === 'qr') return action.payload.value;
  if (action.payload.type === 'deeplink' && action.payload.fallbackUrl) {
    return `${action.payload.url} · fallback ${action.payload.fallbackUrl}`;
  }
  return action.payload.url;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f5f7fb' },
  content: { gap: 14, padding: 18, paddingBottom: 40 },
  header: { gap: 8, paddingTop: 10 },
  eyebrow: { color: '#53657d', fontSize: 13, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
  title: { color: '#0f172a', fontSize: 30, fontWeight: '800', letterSpacing: -0.6 },
  copy: { color: '#516070', fontSize: 16, lineHeight: 23 },
  card: { backgroundColor: '#fff', borderColor: '#e5e9f0', borderRadius: 22, borderWidth: 1, gap: 14, padding: 16 },
  emptyCard: { backgroundColor: '#eef6ff', borderColor: '#cfe7ff', borderRadius: 22, borderWidth: 1, gap: 8, padding: 16 },
  cardTitle: { color: '#111827', fontSize: 18, fontWeight: '800' },
  meta: { color: '#6b7280', fontSize: 14, lineHeight: 20, marginTop: 6 },
  row: { alignItems: 'flex-start', flexDirection: 'row', gap: 12, justifyContent: 'space-between' },
  flex: { flex: 1 },
  typePill: {
    backgroundColor: '#e0f2fe',
    borderRadius: 999,
    color: '#075985',
    fontSize: 13,
    fontWeight: '800',
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 6,
    textTransform: 'uppercase',
  },
  primaryButton: { alignItems: 'center', backgroundColor: '#0f172a', borderRadius: 16, minHeight: 48, justifyContent: 'center' },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
