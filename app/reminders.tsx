import { Stack, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { AppState, ScrollView, Text, View } from 'react-native';
import notifee from '@notifee/react-native';

import { Choice, Field, useFormStyles } from '@/components/FormControls';
import { makeId } from '@/src/core/handyModel';
import { getNotificationStatus, requestNotificationAccess, type NotificationStatus } from '@/src/core/handyNotifications';
import { reminderIntervalLabel, reminderMinutes, type Reminder, type ReminderUnit } from '@/src/core/reminderModel';
import { completeReminder, createReminder, loadReminders, remindersAvailable, retryReminder } from '@/src/core/reminders';

export default function RemindersScreen() {
  const styles = useFormStyles();
  const [text, setText] = useState('');
  const [amount, setAmount] = useState('1');
  const [unit, setUnit] = useState<ReminderUnit>('hours');
  const [repeats, setRepeats] = useState(true);
  const [records, setRecords] = useState<Reminder[]>([]);
  const [view, setView] = useState<'active' | 'completed'>('active');
  const [permission, setPermission] = useState<NotificationStatus>();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const requestId = useRef(makeId('reminder'));
  const loadGeneration = useRef(0);
  const visible = records.filter(record => view === 'completed' ? record.status === 'completed' : record.status !== 'completed');
  let interval: number | undefined;
  try { interval = reminderMinutes(amount, unit); } catch { /* Show validation on save. */ }

  useFocusEffect(useCallback(() => {
    let active = true;
    async function refresh() {
      const generation = ++loadGeneration.current;
      try {
        const next = remindersAvailable ? await loadReminders() : [];
        const settings = await getNotificationStatus();
        if (active && generation === loadGeneration.current && !busyRef.current) { setRecords(next); setPermission(settings); }
      } catch { if (active) setMessage('Could not load reminders. Your saved reminders are retained.'); }
    }
    void refresh();
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') void refresh(); });
    const unsubscribe = notifee.onForegroundEvent(() => { if (!busyRef.current) void refresh(); });
    return () => { active = false; ++loadGeneration.current; subscription.remove(); unsubscribe(); };
  }, []));

  async function run(operation: () => Promise<void>) {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); ++loadGeneration.current; setMessage('');
    try { await operation(); }
    catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not update reminders.');
      try { setRecords(await loadReminders()); } catch { /* Keep last successful list. */ }
    } finally { busyRef.current = false; setBusy(false); }
  }
  async function save() {
    await run(async () => {
      const minutes = reminderMinutes(amount, unit);
      if (!text.trim()) throw new Error('Write something to remember.');
      if (Array.from(text.trim()).length > 2000) throw new Error('Use at most 2,000 characters for your reminder.');
      const settings = await requestNotificationAccess(); setPermission(settings);
      if (settings.permission !== 'authorized' && settings.permission !== 'provisional') throw new Error('Allow notifications in Settings, then save your reminder.');
      const next = await createReminder({ id: requestId.current, text, intervalMinutes: minutes, repeats });
      setRecords(next); setView('active'); setText(''); requestId.current = makeId('reminder');
      setMessage(`Reminder set: in ${reminderIntervalLabel(minutes)}${repeats ? `, then every ${reminderIntervalLabel(minutes)} until completed.` : '.'}`);
    });
  }

  return <>
    <Stack.Screen options={{ title: 'Reminders' }} />
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Reminders</Text>
      {remindersAvailable ? <View style={styles.card}>
        <Field label="What do you want to remember?" value={text} onChangeText={value => {setText(value); requestId.current = makeId('reminder');}} multiline editable={!busy} placeholder="Pick something up from the store" />
        <Field label="Remind me in" value={amount} onChangeText={value => {setAmount(value); requestId.current = makeId('reminder');}} keyboardType="number-pad" editable={!busy} />
        <View style={styles.row}>{(['minutes', 'hours', 'days'] as const).map(value => <Choice key={value} label={value} selected={unit === value} disabled={busy} onPress={() => {setUnit(value); requestId.current = makeId('reminder');}} />)}</View>
        <View style={styles.row}>
          <Choice label="Repeat until complete" selected={repeats} disabled={busy} onPress={() => {setRepeats(true); requestId.current = makeId('reminder');}} />
          <Choice label="Notify once" selected={!repeats} disabled={busy} onPress={() => {setRepeats(false); requestId.current = makeId('reminder');}} />
        </View>
        <Text style={styles.copy}>{interval ? `First notification in ${reminderIntervalLabel(interval)}.${repeats ? ` Repeats every ${reminderIntervalLabel(interval)} until you mark it complete.` : ''}` : 'Choose a custom interval.'}</Text>
        <Choice label={busy ? 'Saving…' : 'Set reminder'} disabled={busy || !text.trim()} onPress={() => void save()} />
        <Text style={styles.copy}>iOS schedules these notifications, including when the app is closed. Expand a notification and choose Mark complete to stop it.</Text>
      </View> : <Text style={styles.copy}>Reminders require the latest iOS build of Handy Actions.</Text>}
      {permission?.permission === 'denied' ? <Choice label="Open notification settings" onPress={() => void notifee.openNotificationSettings()} /> : null}
      {message ? <Text accessibilityLiveRegion="polite" style={styles.copy}>{message}</Text> : null}
      {remindersAvailable ? <Choice label="Refresh list" disabled={busy} onPress={() => void run(async () => {setRecords(await loadReminders()); setPermission(await getNotificationStatus());})} /> : null}
      <View style={styles.row}>{(['active', 'completed'] as const).map(value => <Choice key={value} label={`${value === 'active' ? 'Active' : 'Completed'} (${records.filter(record => value === 'completed' ? record.status === 'completed' : record.status !== 'completed').length})`} selected={view === value} disabled={busy} onPress={() => setView(value)} />)}</View>
      {!visible.length ? <Text style={styles.copy}>{view === 'active' ? 'No active reminders.' : 'No completed reminders.'}</Text> : null}
      {visible.map(record => <View key={record.id} style={styles.card}>
        <Text selectable style={styles.label}>{record.text}</Text>
        <Text style={styles.copy}>{record.repeats ? `Every ${reminderIntervalLabel(record.intervalMinutes)} until complete` : `Once after ${reminderIntervalLabel(record.intervalMinutes)}`}</Text>
        {record.status === 'completed' ? <Text style={styles.copy}>Completed {new Date(record.completedAt!).toLocaleString()}</Text> : <>
          <Text style={styles.copy}>{record.status === 'scheduling' ? 'Not yet confirmed scheduled — retry below.' : `First notification: ${new Date(record.firstFireAt!).toLocaleString()}`}</Text>
          {record.status === 'scheduling' ? <Choice label="Retry scheduling" disabled={busy} onPress={() => void run(async () => {setPermission(await requestNotificationAccess()); setRecords(await retryReminder(record.id, record.revision)); setMessage('Reminder scheduled.');})} /> : null}
          <Choice label="Mark complete" disabled={busy} onPress={() => void run(async () => {setRecords(await completeReminder(record.id, record.revision)); setMessage('Completed. Future notifications stopped.');})} />
        </>}
      </View>)}
    </ScrollView>
  </>;
}
