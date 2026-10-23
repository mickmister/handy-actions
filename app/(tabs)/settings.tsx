import { useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { Link } from 'expo-router';

import { getNotificationStatus, requestNotificationAccess, syncPresetNotifications } from '@/src/core/handyNotifications';
import { useHandyStateContext } from '@/src/hooks/HandyStateProvider';
import { enabledPresets, surfaceSettings, type SurfaceSettings } from '@/src/core/handyModel';
import { themeOptions } from '@/src/core/handyThemes';

export default function SettingsScreen() {
  const handy = useHandyStateContext();
  const [importText, setImportText] = useState('');
  const [status, setStatus] = useState('Tap Check permission.');
  const [syncing, setSyncing] = useState(false);
  const surfaces = surfaceSettings(handy.state);

  async function updateSurface(patch: Partial<SurfaceSettings>) {
    setSyncing(true);
    try {
      const next = { ...surfaces, ...patch };
      await handy.updateSurfaces(next);
      handy.setMessage(await syncPresetNotifications({ ...handy.state, surfaces: next }));
    } catch (error) { Alert.alert('Could not update lock screen', String(error)); }
    finally { setSyncing(false); }
  }

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
        <Text style={styles.cardTitle}>Lock-screen experiments</Text>
        <Text style={styles.copy}>Enable either surface, or both to compare them. Changes are saved and applied immediately.</Text>
        {([
          ['liveActivities', 'Live Activities', Platform.OS !== 'ios'],
          ['lockScreenWidgets', 'Lock Screen Widgets', Platform.OS !== 'ios'],
          ['notifications', 'Preset notification panels', false],
        ] as const).map(([key, label, unsupported]) => <View key={key} style={styles.settingRow}>
          <Text style={styles.copy}>{label}{unsupported ? ' (iOS only)' : ''}</Text>
          <Switch accessibilityLabel={label} value={surfaces[key]} disabled={!handy.loaded || syncing || unsupported}
            onValueChange={(value) => void updateSurface({ [key]: value })} />
        </View>)}
        <Text style={styles.copy}>Note-input notifications remain available even when preset notification panels are off.</Text>
        {Platform.OS === 'ios' ? <>
          <Text style={styles.copy}>To add a widget: long-press the Lock Screen → Customize → Lock Screen → Add Widgets → Handy Actions. Choose circular, rectangular, or inline. Turning widgets off shows an inactive tile; remove it in the Lock Screen editor.</Text>
          <Text style={styles.copy}>Widget preset (must be enabled and contain actions):</Text>
          <View style={styles.buttonRow}>
            {[{ id: '', name: 'First enabled preset' }, ...enabledPresets(handy.state)].map((preset) => <Pressable
              key={preset.id} disabled={syncing || !handy.loaded}
              style={surfaces.widgetPresetId === preset.id || (!surfaces.widgetPresetId && !preset.id) ? styles.primaryButton : styles.secondaryButton}
              onPress={() => void updateSurface({ widgetPresetId: preset.id })}>
              <Text style={styles.secondaryButtonText}>{preset.name}</Text>
            </Pressable>)}
          </View>
          <Text style={styles.copy}>On iOS 17+, circular and rectangular input buttons post native capture notifications; inline widgets and older iOS use app-opening links. Rectangular widgets show two actions; Live Activities arrange all actions in rows of up to two. iOS controls available space, refresh timing and placement.</Text>
        </> : null}
        <Text style={styles.copy}>{handy.message}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Live Activity theme</Text>
        {themeOptions.map(theme=><Pressable key={theme.id} disabled={!handy.loaded||syncing} style={[styles.card,{backgroundColor:theme.colors[0],borderColor:(handy.state.theme??'psychedelic')===theme.id?'#38BDF8':'transparent',borderWidth:3}]} onPress={()=>{
          setSyncing(true);
          void handy.updateTheme(theme.id).then(async result=>{if(!result.ok)throw new Error(result.message);handy.setMessage(await syncPresetNotifications({...handy.state,theme:theme.id}));}).catch(()=>Alert.alert('Theme','Could not apply the theme.')).finally(()=>setSyncing(false));
        }}><Text style={{color:theme.id==='paper'?'#172D36':'#F8FAFC',fontWeight:'800'}}>{theme.name}{(handy.state.theme??'psychedelic')===theme.id?' ✓':''}</Text>
          <View style={styles.buttonRow}>{theme.colors.map(color=><View key={color} style={{backgroundColor:color,width:36,height:20,borderRadius:6,borderWidth:1,borderColor:'#94A3B8'}} />)}</View>
          <Text style={{color:theme.id==='paper'?'#475569':'#D3DFEB'}}>{theme.description}</Text>
        </Pressable>)}
        <Text style={styles.copy}>Global theme for Live Activities. Color changes happen on app-requested updates; continuous background animation is not available here. Always-On uses a subdued palette. No repeating animation is used.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Connections</Text>
        <Link href="/origins">Manage secure origins and HTTP headers</Link>
        <Text style={styles.copy}>Connections stay in secure storage and are excluded from preset exports. Imported remote actions must be reconnected locally.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Notes</Text>
        <Link href="/notes">View notes saved in this app</Link>
        <Link href="/pending-notes">Recover unsent notes</Link>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Notifications</Text>
        <Text style={styles.copy}>{status}</Text>
        <Text style={styles.copy}>Each lock-screen update keeps a Refresh Lock Screen notification, even when preset panels are off. Tap it to recreate expired Live Activities. iOS notifications remain dismissible; refreshing in the app restores the control.</Text>
        <View style={styles.buttonRow}>
          <Pressable style={styles.secondaryButton} onPress={checkPermission}>
            <Text style={styles.secondaryButtonText}>Check permission</Text>
          </Pressable>
          <Pressable style={styles.primaryButton} onPress={requestPermission}>
            <Text style={styles.primaryButtonText}>Request access</Text>
          </Pressable>
        </View>
        <Pressable style={styles.darkButton} onPress={refreshNotifications}>
          <Text style={styles.darkButtonText}>Rebuild lock-screen surfaces</Text>
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
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  primaryButton: { alignItems: 'center', backgroundColor: '#38bdf8', borderRadius: 16, minHeight: 48, justifyContent: 'center', paddingHorizontal: 16 },
  primaryButtonText: { color: '#082f49', fontSize: 15, fontWeight: '800' },
  secondaryButton: { alignItems: 'center', backgroundColor: '#e0f2fe', borderRadius: 16, minHeight: 48, justifyContent: 'center', paddingHorizontal: 16 },
  secondaryButtonText: { color: '#075985', fontSize: 15, fontWeight: '800' },
  darkButton: { alignItems: 'center', backgroundColor: '#0f172a', borderRadius: 16, minHeight: 48, justifyContent: 'center' },
  darkButtonText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  codeBlock: { backgroundColor: '#0f172a', borderRadius: 16, color: '#dbeafe', fontFamily: 'SpaceMono', fontSize: 12, lineHeight: 18, padding: 14 },
  textArea: { backgroundColor: '#f8fafc', borderColor: '#d7dde7', borderRadius: 14, borderWidth: 1, color: '#0f172a', fontFamily: 'SpaceMono', fontSize: 13, minHeight: 160, padding: 14, textAlignVertical: 'top' },
});
