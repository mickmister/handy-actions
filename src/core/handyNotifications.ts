import notifee, {
  AndroidImportance,
  AndroidLaunchActivityFlag,
  AndroidVisibility,
  AuthorizationStatus,
  EventType,
  type Event,
} from '@notifee/react-native';
import { Linking, Platform } from 'react-native';
import * as ExpoLinking from 'expo-linking';

import {
  actionFromNotificationRowsData,
  actionIdFromPressId,
  actionNotificationRows,
  actionPressId,
  enabledPresets,
  findAction,
  notificationBodyForPreset,
  notificationIdForPreset,
  notificationRowsData,
  presetIdFromPressId,
  presetPressId,
  makeId,
  isInputPayload,
  surfaceSettings,
  type HandyAction,
  type HandyActionPayload,
  type HandyState,
} from './handyModel';
import { loadHandyState } from './handyStore';
import { syncPresetLiveActivities } from './handyLiveActivities';
import { syncLockScreenWidget } from './handyWidgets';
import { markNoteAttempt, queueNote } from './handyNotes';
import { isLocalNoteAction, LOCAL_INPUT_CATEGORY, LOCAL_RECOVERY_CATEGORY, LOCAL_RETRY_PRESS } from './localNoteDelivery';
import { nativeNoteInbox } from './nativeNoteInbox';
import { saveEditorDraft } from './editorDrafts';
import { request } from './requests';
import { httpRequestSpec } from './httpActions';
import { nativeActionInbox } from './nativeActionInbox';
import { isRefreshPress, REFRESH_NOTIFICATION_ID, REFRESH_PRESS_ID } from './lockScreenRefresh';
import { notificationEditorContext } from './notificationEditorContext';

const CHANNEL_ID = 'handy-actions';
const INPUT_CATEGORY = 'handy-text-input';
const INPUT_PRESS = 'handy-input-submit';
const handledSubmissions = new Set<string>();
let syncQueue: Promise<unknown> = Promise.resolve();

function savesLocallyInNative(action: Pick<HandyAction, 'payload'>): boolean {
  return Platform.OS === 'ios' && !!nativeNoteInbox && isLocalNoteAction(action, ExpoLinking.createURL('/notes'));
}
function sendsInNative(action:Pick<HandyAction,'payload'>):boolean {
  return !!nativeActionInbox && (action.payload.type==='http'&&action.payload.captureText || action.payload.type==='vd-agent'&&!!action.payload.session);
}

let currentState: HandyState = { presets: [] };
let pressHandler: ((target: NotificationPressTarget) => void) | undefined;
let pendingTarget: NotificationPressTarget | undefined;

export type NotificationPressTarget =
  | { type: 'action'; action: HandyAction; presetId?: string }
  | { type: 'input'; submissionId: string; submit?: boolean }
  | { type: 'editor'; draftId: string }
  | { type: 'refresh'; token: string }
  | { type: 'preset'; presetId: string };

export type NotificationStatus = {
  permission: 'authorized' | 'denied' | 'provisional' | 'not-determined' | 'unavailable';
  message: string;
};

export function setNotificationPressHandler(handler: (target: NotificationPressTarget) => void): void {
  pressHandler = handler;
  if (!pendingTarget) return;

  const target = pendingTarget;
  pendingTarget = undefined;
  handler(target);
}

export async function getNotificationStatus(): Promise<NotificationStatus> {
  const settings = await notifee.getNotificationSettings();
  if (settings.authorizationStatus === AuthorizationStatus.AUTHORIZED) {
    return { permission: 'authorized', message: 'Notifications are allowed.' };
  }
  if (settings.authorizationStatus === AuthorizationStatus.PROVISIONAL) {
    return { permission: 'provisional', message: 'Notifications are provisionally allowed.' };
  }
  if (settings.authorizationStatus === AuthorizationStatus.DENIED) {
    return { permission: 'denied', message: 'Notifications are blocked in system settings.' };
  }
  return { permission: 'not-determined', message: 'Notification permission has not been requested.' };
}

export async function requestNotificationAccess(): Promise<NotificationStatus> {
  await notifee.requestPermission();
  await configureNotificationSurface();
  return getNotificationStatus();
}

export async function configureNotificationSurface(): Promise<void> {
  if (Platform.OS === 'android') {
    await notifee.createChannel({
      id: CHANNEL_ID,
      name: 'Handy Actions',
      importance: AndroidImportance.HIGH,
      visibility: AndroidVisibility.PUBLIC,
      vibration: false,
      sound: undefined,
    });
  }
}

export function syncPresetNotifications(state: HandyState, options: { renewActivities?: boolean } = {}): Promise<string> {
  const sync = syncQueue.then(() => syncSurfaces(state, options.renewActivities === true));
  syncQueue = sync.catch(() => {});
  return sync;
}

async function configureCategories(state: HandyState): Promise<void> {
  if (Platform.OS !== 'ios') return;
  await notifee.setNotificationCategories([
    {id:'handy-refresh-lock-screen-v1',actions:[{id:REFRESH_PRESS_ID,title:'Refresh Lock Screen',foreground:true}]},
    {id:'handy-action-editor-v1',actions:[]},
    ...(nativeActionInbox?[{id:'handy-text-input-background-v1',actions:[{id:INPUT_PRESS,title:'Add Note',foreground:false,input:{placeholderText:'Write text…',buttonText:'Send'}}]}]:[]),
    { id: INPUT_CATEGORY, actions: [{ id: INPUT_PRESS, title: 'Add Note', foreground: true,
      input: { placeholderText: 'Write a note…', buttonText: 'Send' } }] },
    ...(nativeNoteInbox ? [
      { id: LOCAL_INPUT_CATEGORY, actions: [{ id: INPUT_PRESS, title: 'Add Note', foreground: false,
        input: { placeholderText: 'Write a note…', buttonText: 'Save' } }] },
      { id: LOCAL_RECOVERY_CATEGORY, actions: [
        { id: LOCAL_RETRY_PRESS, title: 'Retry save', foreground: false },
        { id: INPUT_PRESS, title: 'Add Note', foreground: false,
          input: { placeholderText: 'Write a replacement note…', buttonText: 'Save' } },
      ] },
    ] : []),
    ...enabledPresets(state).map((preset) => ({
      id: categoryIdForPreset(preset.id),
      actions: actionNotificationRows(preset).slice(0, 2).map((row) => ({
        id: actionPressId(row.id), title: row.title, foreground: !(savesLocallyInNative(row)||sendsInNative(row)),
        ...(isInputPayload(row.payload) ? { input: { placeholderText: 'Write a note…', buttonText: 'Send' } } : {}),
      })),
    })),
  ]);
}

async function syncSurfaces(state: HandyState, renew: boolean): Promise<string> {
  currentState = state;
  const settings = surfaceSettings(state);
  const messages: string[] = [];
  try {
    await syncPresetLiveActivities(state, renew);
    if (Platform.OS === 'ios') messages.push(settings.liveActivities ? 'Live Activities refreshed.' : 'Live Activities off.');
  } catch (error) { messages.push(`Live Activity: ${errorMessage(error)}`); }
  try {
    await syncLockScreenWidget(state);
    if (Platform.OS === 'ios') messages.push(settings.lockScreenWidgets ? 'Widget content published.' : 'Widgets off.');
  } catch (error) { messages.push(`Widget: ${errorMessage(error)}`); }

  try {
  if (settings.notifications) await requestNotificationAccess();
  // Never cancel a note-capture notification while rebuilding preset panels.
  for (const displayed of await notifee.getDisplayedNotifications()) {
    const id = displayed.notification.id;
    if (id?.startsWith('handy-preset-')) await notifee.cancelNotification(id);
  }
  const presets = settings.notifications ? enabledPresets(state) : [];
  await configureCategories(state);
  for (const preset of presets) {
    const rows = actionNotificationRows(preset);
    await notifee.displayNotification({
      id: notificationIdForPreset(preset),
      title: preset.name,
      body: notificationBodyForPreset(preset),
      data: { presetId: preset.id, actions: notificationRowsData(preset), submissionId: makeId('submission'),
        backgroundActionIds: JSON.stringify(rows.filter(sendsInNative).map(row=>row.id)),
        localNoteActionIds: JSON.stringify(rows.filter(savesLocallyInNative).map((row) => row.id)) },
      android: {
        channelId: CHANNEL_ID,
        ongoing: true,
        autoCancel: false,
        onlyAlertOnce: true,
        localOnly: true,
        visibility: AndroidVisibility.PUBLIC,
        pressAction: { id: presetPressId(preset.id), launchActivity: 'default' },
        actions: rows.map((row) => ({
          title: row.title,
          ...(isInputPayload(row.payload) ? { input: { placeholder: 'Write a note…' } } : {}),
          pressAction: {
            id: actionPressId(row.id),
            launchActivity: 'default',
            launchActivityFlags: [AndroidLaunchActivityFlag.SINGLE_TOP],
          },
        })),
      },
      ios: {
        categoryId: categoryIdForPreset(preset.id),
        foregroundPresentationOptions: { banner: true, list: true, sound: false, badge: false },
      },
    });
  }

  const notificationMessage =
    presets.length === 1 ? 'Showing 1 enabled preset notification.' : `Showing ${presets.length} enabled preset notifications.`;
  messages.push(notificationMessage);
  } catch (error) { messages.push(`Notifications: ${errorMessage(error)}`); }
  // Independent of preset panels, with a stable ID outside panel/capture cleanup.
  try {
    await configureNotificationSurface();
    const permission = await getNotificationStatus();
    if (permission.permission === 'authorized' || permission.permission === 'provisional') {
      await notifee.displayNotification({
        id: REFRESH_NOTIFICATION_ID, title: 'Refresh Lock Screen',
        body: 'Tap to recreate Live Activities and refresh your enabled lock-screen actions.',
        data: {refreshLockScreen:'1',refreshToken:makeId('refresh')},
        android: {channelId:CHANNEL_ID,ongoing:true,autoCancel:false,onlyAlertOnce:true,localOnly:true,
          pressAction:{id:REFRESH_PRESS_ID,launchActivity:'default'}},
        ios: {categoryId:'handy-refresh-lock-screen-v1',foregroundPresentationOptions:{banner:false,list:true,sound:false,badge:false}},
      });
      messages.push('Refresh notification ready.');
    } else messages.push('Allow notifications to keep the Refresh Lock Screen control.');
  } catch { messages.push('Could not post the Refresh Lock Screen notification.'); }
  return messages.join(' ');
}

export function registerNotificationEvents(): () => void {
  const unsubscribe = notifee.onForegroundEvent((event) => {
    void handleNotificationEvent(event).catch(console.warn);
  });

  return unsubscribe;
}

export async function consumeInitialNotification(): Promise<void> {
  const initial = await notifee.getInitialNotification();
  if (initial) await openPressAction(initial.pressAction?.id, initial.notification.data, initial.input, initial.notification.id);
}

export async function runActionPayload(payload: HandyActionPayload): Promise<void> {
  if (payload.type === 'notes') {
    await Linking.openURL(ExpoLinking.createURL('/notes'));
    return;
  }
  if (payload.type === 'qr') {
    return;
  }
  if (isInputPayload(payload)) throw new Error('Open the editor to use this input action.');
  if(payload.type==='http') {
    const {path,...spec}=httpRequestSpec(payload);await request(payload.originId,path,spec,false);return;
  }
  if(payload.type==='web'||payload.type==='deeplink')await Linking.openURL(payload.url);
}

export async function handleNotificationEvent(event: Event): Promise<void> {
  if (event.type !== EventType.PRESS && event.type !== EventType.ACTION_PRESS) return;
  await openPressAction(event.detail.pressAction?.id, event.detail.notification?.data, event.detail.input, event.detail.notification?.id);
}

async function openPressAction(pressId: unknown, data: unknown, input?: string, notificationId?: string): Promise<void> {
  if (isRefreshPress(pressId, data, notificationId)) {
    deliverPressTarget({type:'refresh',token:dataString(data,'refreshToken')??makeId('refresh')});
    return;
  }
  const sourcePresetId = dataString(data, 'presetId');
  const captureActionId = dataString(data, 'captureActionId');
  const actionId = pressId === INPUT_PRESS ? captureActionId : typeof pressId === 'string' ? actionIdFromPressId(pressId) : undefined;
  if (actionId) {
    const stored = await loadHandyState();
    const storedAction = findAction(stored, actionId, sourcePresetId)?.action;
    const snapshot = actionFromNotificationData(actionId, data);
    // A reply belongs to the destination shown when that notification was posted,
    // even if its action was edited or deleted before the user submits.
    const action = snapshot ?? storedAction;
    if (action?.payload.type === 'notes') {
      deliverPressTarget({ type: 'action', action, presetId: sourcePresetId });
      await syncStoredPresetNotifications();
      return;
    }
    if (action && isInputPayload(action.payload)) {
      if (input?.trim()) {
        const submissionId = `${dataString(data, 'submissionId') ?? notificationId ?? makeId('submission')}-${actionId}`;
        if (handledSubmissions.has(submissionId)) return;
        handledSubmissions.add(submissionId);
        try {
          const pending = await queueNote(action, input, submissionId,sourcePresetId);
          if (!pending) return;
        } catch (error) { handledSubmissions.delete(submissionId); throw error; }
        if (notificationId) await notifee.cancelNotification(notificationId);
        deliverPressTarget({ type: 'input', submissionId, submit: true });
        if (!captureActionId) await syncStoredPresetNotifications();
      } else {
        const draft=await saveEditorDraft(action,input ?? dataString(data,'editorText') ?? dataString(data,'localNoteRecoveryText') ?? '',sourcePresetId);
        deliverPressTarget({ type:'editor',draftId:draft.id });
      }
      return;
    }
  }
  if (captureActionId) {
    const editor = notificationEditorContext(data);
    const action = editor?.action ?? findAction(await loadHandyState(), captureActionId, sourcePresetId)?.action;
    if (action) {
      const text=editor?.text ?? dataString(data,'editorText') ?? dataString(data,'localNoteRecoveryText') ?? '';
      const recoveryId=editor?.submissionId ?? dataString(data,'recoverySubmissionId');
      if(recoveryId && text.trim()) {
        const pending=await queueNote(action,text,recoveryId,sourcePresetId);
        if(pending){await markNoteAttempt(pending.id);deliverPressTarget({type:'input',submissionId:pending.id});}
        return;
      }
      const draft=await saveEditorDraft(action,text,sourcePresetId);
      deliverPressTarget({type:'editor',draftId:draft.id});
    }
    return;
  }
  const presetId = typeof pressId === 'string' ? presetIdFromPressId(pressId) : presetIdFromNotificationData(data);
  if (presetId) {
    deliverPressTarget({ type: 'preset', presetId });
    await syncStoredPresetNotifications();
    return;
  }

  if (typeof pressId !== 'string') return;

  const pressedActionId = actionIdFromPressId(pressId);
  if (!pressedActionId) {
    const dataPresetId = presetIdFromNotificationData(data);
    if (dataPresetId) {
      deliverPressTarget({ type: 'preset', presetId: dataPresetId });
      await syncStoredPresetNotifications();
    }
    return;
  }
  const found = findAction(currentState, pressedActionId, sourcePresetId);
  const action = found?.action ?? actionFromNotificationData(pressedActionId, data);
  if (!action) return;

  if (action.payload.type === 'qr' || action.payload.type==='http') {
    deliverPressTarget({ type: 'action', action });
    await syncStoredPresetNotifications();
    return;
  }

  await syncStoredPresetNotifications();
  deliverPressTarget({type:'action',action,presetId:sourcePresetId});
}

function deliverPressTarget(target: NotificationPressTarget): void {
  if (pressHandler) {
    pressHandler(target);
    return;
  }
  pendingTarget = target;
}

async function syncStoredPresetNotifications(): Promise<void> {
  try {
    await syncPresetNotifications(await loadHandyState());
  } catch {
    await syncPresetNotifications(currentState);
  }
}

export async function showTextInputNotification(action: HandyAction, presetId?: string): Promise<void> {
  const status = await requestNotificationAccess();
  if (status.permission === 'denied') throw new Error('Notifications are disabled. You can write the note here instead.');
  await configureCategories(await loadHandyState());
  const submissionId = makeId('submission');
  const nativeLocal = savesLocallyInNative(action);
  const nativeRequest = sendsInNative(action);
  await notifee.displayNotification({
    id: `handy-input-${submissionId}`, title: action.name,
    body: 'Expand and select Add Note to type, or tap this notification to open the editor.',
    data: { captureActionId: action.id, submissionId, ...(presetId ? { presetId } : {}),
      ...(nativeLocal ? { localNoteDestination: '1' } : {}),
      ...(nativeRequest ? {backgroundRequest:'1'} : {}),
      actions: JSON.stringify([{ id: action.id, title: action.name, payload: action.payload }]) },
    ios: { categoryId: nativeLocal ? LOCAL_INPUT_CATEGORY : nativeRequest ? 'handy-text-input-background-v1' : INPUT_CATEGORY, foregroundPresentationOptions: { banner: true, list: true, sound: false } },
    android: { channelId: CHANNEL_ID, pressAction: { id: 'capture', launchActivity: 'default' },
      actions: [{ title: 'Add Note', pressAction: { id: INPUT_PRESS, launchActivity: 'default' }, input: { placeholder: 'Write a note…' } }] },
  });
}

function dataString(data: unknown, key: string): string | undefined {
  if (!data || typeof data !== 'object') return undefined;
  const value = (data as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : undefined;
}

function errorMessage(error: unknown): string { return error instanceof Error ? error.message : String(error); }

function categoryIdForPreset(presetId: string): string {
  return `handy-category-${presetId}`;
}

function presetIdFromNotificationData(data: unknown): string | undefined {
  if (!data || typeof data !== 'object' || !('presetId' in data)) return undefined;
  return typeof data.presetId === 'string' ? data.presetId : undefined;
}

function actionFromNotificationData(actionId: string, data: unknown): HandyAction | undefined {
  if (!data || typeof data !== 'object' || !('actions' in data)) return undefined;
  return actionFromNotificationRowsData(actionId, data.actions);
}
