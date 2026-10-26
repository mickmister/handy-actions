import { useCallback, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Switch } from '@/components/FormControls';
import { useAppTheme, useThemeStyles } from '@/src/hooks/useAppTheme';
import { appTheme, type ThemeColors } from '@/src/core/appTheme';
import { Link, useFocusEffect } from 'expo-router';

import { getNotificationStatus, requestNotificationAccess, syncPresetNotifications } from '@/src/core/handyNotifications';
import { useHandyStateContext } from '@/src/hooks/HandyStateProvider';
import { enabledPresets, surfaceSettings, type SurfaceSettings } from '@/src/core/handyModel';
import { themeOptions } from '@/src/core/handyThemes';
import { origins } from '@/src/core/origins';

export default function SettingsScreen() {
  const styles = useThemeStyles(createStyles);
  const { colors, dark } = useAppTheme();
  const handy = useHandyStateContext();
  const [importText, setImportText] = useState('');
  const [status, setStatus] = useState('Tap Check permission.');
  const [syncing, setSyncing] = useState(false);
  const surfaces = surfaceSettings(handy.state);
  const recentWorkspaces = handy.state.recentWorkspaces ?? { enabled: false, originId: '' };
  const [originChoices, setOriginChoices] = useState<{ id: string; name: string }[]>([]);
  const [originMessage, setOriginMessage] = useState('');
  useFocusEffect(useCallback(() => {
    let cancelled = false;
    void origins.list().then(profiles => {
      if (!cancelled) {
        setOriginChoices(profiles.map(({ id, name }) => ({ id, name })));
        setOriginMessage('');
      }
    }).catch(() => {
      if (!cancelled) { setOriginChoices([]); setOriginMessage('Could not load saved origins.'); }
    });
    return () => { cancelled = true; };
  }, []));

  async function updateRecentWorkspaces(patch: Partial<typeof recentWorkspaces>) {
    setSyncing(true);
    try {
      const next = { ...recentWorkspaces, ...patch };
      const result = await handy.updateRecentWorkspaces(next);
      if (!result.ok) throw new Error(result.message);
    } catch { Alert.alert('Recent VD workspaces', 'Could not apply the workspace list settings.'); }
    finally { setSyncing(false); }
  }

  async function updateSurface(patch: Partial<SurfaceSettings>) {
    setSyncing(true);
    try {
      const next = { ...surfaces, ...patch };
      const result = await handy.updateSurfaces(next);
      if (!result.ok) throw new Error(result.message);
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
        <Text style={styles.cardTitle}>About</Text>
        <Text selectable style={styles.copy}>Commit: {process.env.EXPO_PUBLIC_COMMIT_HASH || 'Unknown'}</Text>
        <Text selectable style={styles.copy}>{process.env.EXPO_PUBLIC_COMMIT_MESSAGE || 'Commit message unavailable'}</Text>
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
              <Text style={surfaces.widgetPresetId === preset.id || (!surfaces.widgetPresetId && !preset.id) ? styles.primaryButtonText : styles.secondaryButtonText}>{preset.name}</Text>
            </Pressable>)}
          </View>
          <Text style={styles.copy}>On iOS 17+, circular and rectangular input buttons post native capture notifications; inline widgets and older iOS use app-opening links. Rectangular widgets show two actions. One shared Live Activity has Actions and Workspaces views; action pages show up to four controls and browse all enabled presets in saved order. iOS controls available space, refresh timing and placement.</Text>
        </> : null}
        <Text style={styles.copy}>{handy.message}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Recent VD workspaces</Text>
        <Text style={styles.copy}>Show the three most recently updated workspaces in the Workspaces view of the shared Lock Screen Live Activity. Archived and deleted worktrees are excluded.</Text>
        <View style={styles.settingRow}>
          <Text style={styles.copy}>Show recent VD workspaces{Platform.OS !== 'ios' ? ' (iOS only)' : ''}</Text>
          <Switch accessibilityLabel="Show recent VD workspaces" value={recentWorkspaces.enabled}
            disabled={!handy.loaded || syncing || Platform.OS !== 'ios' || (!recentWorkspaces.enabled && !originChoices.some(origin => origin.id === recentWorkspaces.originId))}
            onValueChange={enabled => void updateRecentWorkspaces({ enabled })} />
        </View>
        <Text style={styles.copy}>VD origin:</Text>
        <View style={styles.buttonRow}>
          {originChoices.map(origin => <Pressable key={origin.id}
            accessibilityRole="button" accessibilityState={{ selected: recentWorkspaces.originId === origin.id }}
            disabled={!handy.loaded || syncing || Platform.OS !== 'ios'}
            style={recentWorkspaces.originId === origin.id ? styles.primaryButton : styles.secondaryButton}
            onPress={() => void updateRecentWorkspaces({ originId: origin.id })}>
            <Text style={recentWorkspaces.originId === origin.id ? styles.primaryButtonText : styles.secondaryButtonText}>{origin.name}</Text>
          </Pressable>)}
        </View>
        {originMessage ? <Text style={styles.copy}>{originMessage}</Text> : null}
        {!originChoices.some(origin => origin.id === recentWorkspaces.originId) ? <Text style={styles.copy}>Choose a saved VD origin to enable the list.</Text> : null}
        <Link style={styles.link} href="/origins">Manage origins / test VD connection</Link>
        <Text style={styles.copy}>Tap a workspace to get a message-input notification for its newest-created session. Expand it and select Add Note to write and send; short-tap its body to open the workspace in your browser. Browser authentication is separate from the app’s saved API headers.</Text>
        <Text style={styles.copy}>Refreshes when the app opens or returns to the foreground, and when you refresh Lock Screen surfaces. Live Activities must also be enabled above.</Text>
        <Pressable style={styles.darkButton} disabled={!handy.loaded || syncing || Platform.OS !== 'ios'} onPress={() => void refreshNotifications()}>
          <Text style={styles.darkButtonText}>{syncing ? 'Applying…' : 'Refresh recent workspaces'}</Text>
        </Pressable>
        <Text accessibilityLiveRegion="polite" style={styles.copy}>{handy.message}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>App & Live Activity theme</Text>
        {themeOptions.map(theme=><Pressable key={theme.id} accessibilityRole="button" accessibilityState={{ selected: (handy.state.theme??'psychedelic')===theme.id, disabled: !handy.loaded||syncing }} disabled={!handy.loaded||syncing} style={[styles.card,{backgroundColor:theme.colors[0],borderColor:(handy.state.theme??'psychedelic')===theme.id?colors.primary:'transparent',borderWidth:3}]} onPress={()=>{
          setSyncing(true);
          void handy.updateTheme(theme.id).then(result=>{if(!result.ok)throw new Error(result.message);}).catch(()=>Alert.alert('Theme','Could not apply the theme.')).finally(()=>setSyncing(false));
        }}><Text style={{color:appTheme(theme.id).colors.text,fontWeight:'800'}}>{theme.name}{(handy.state.theme??'psychedelic')===theme.id?' ✓':''}</Text>
          <View style={styles.buttonRow}>{theme.colors.map(color=><View key={color} style={{backgroundColor:color,width:36,height:20,borderRadius:6,borderWidth:1,borderColor:appTheme(theme.id).colors.border}} />)}</View>
          <Text style={{color:appTheme(theme.id).colors.muted}}>{theme.description}</Text>
        </Pressable>)}
        <Text style={styles.copy}>Applies throughout the app and to Live Activities, and is saved on this device. Live Activity colors change on app-requested updates; Always-On uses a subdued palette.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Connections</Text>
        <Link style={styles.link} href="/origins">Manage secure origins and HTTP headers</Link>
        <Text style={styles.copy}>Connections stay in secure storage and are excluded from preset exports. Imported remote actions must be reconnected locally.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Notes</Text>
        <Link style={styles.link} href="/notes">View notes saved in this app</Link>
        <Link style={styles.link} href="/pending-notes">Recover unsent notes</Link>
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
          placeholderTextColor={colors.placeholder}
          selectionColor={colors.primary}
          keyboardAppearance={dark ? 'dark' : 'light'}
          style={styles.textArea}
        />
        <Pressable style={styles.darkButton} onPress={importPresets}>
          <Text style={styles.darkButtonText}>Import presets</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const createStyles = (c: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.background },
  content: { gap: 14, padding: 18, paddingBottom: 40 },
  header: { gap: 8, paddingTop: 10 },
  eyebrow: { color: c.muted, fontSize: 13, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
  title: { color: c.text, fontSize: 30, fontWeight: '800', letterSpacing: -0.6 },
  copy: { color: c.muted, fontSize: 16, lineHeight: 23 },
  link: { color: c.primary, fontSize: 16, lineHeight: 23 },
  card: { backgroundColor: c.surface, borderColor: c.border, borderRadius: 22, borderWidth: 1, gap: 12, padding: 16 },
  cardTitle: { color: c.text, fontSize: 18, fontWeight: '800' },
  buttonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  primaryButton: { alignItems: 'center', backgroundColor: c.primary, borderRadius: 16, minHeight: 48, justifyContent: 'center', paddingHorizontal: 16 },
  primaryButtonText: { color: c.onPrimary, fontSize: 15, fontWeight: '800' },
  secondaryButton: { alignItems: 'center', backgroundColor: c.secondary, borderRadius: 16, minHeight: 48, justifyContent: 'center', paddingHorizontal: 16 },
  secondaryButtonText: { color: c.onSecondary, fontSize: 15, fontWeight: '800' },
  darkButton: { alignItems: 'center', backgroundColor: c.primary, borderRadius: 16, minHeight: 48, justifyContent: 'center' },
  darkButtonText: { color: c.onPrimary, fontSize: 16, fontWeight: '800' },
  codeBlock: { backgroundColor: c.code, borderRadius: 16, color: c.codeText, fontFamily: 'SpaceMono', fontSize: 12, lineHeight: 18, padding: 14 },
  textArea: { backgroundColor: c.input, borderColor: c.border, borderRadius: 14, borderWidth: 1, color: c.text, fontFamily: 'SpaceMono', fontSize: 13, minHeight: 160, padding: 14, textAlignVertical: 'top' },
});
