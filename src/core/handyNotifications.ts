import notifee, {
  AndroidImportance,
  AndroidLaunchActivityFlag,
  AndroidVisibility,
  AuthorizationStatus,
  EventType,
  type Event,
} from '@notifee/react-native';
import { Linking, Platform } from 'react-native';

import {
  actionNotificationRows,
  enabledPresets,
  findAction,
  notificationIdForPreset,
  type HandyAction,
  type HandyActionPayload,
  type HandyState,
} from './handyModel';

const CHANNEL_ID = 'handy-actions';

let currentState: HandyState = { presets: [] };
let actionHandler: ((action: HandyAction) => void) | undefined;

export type NotificationStatus = {
  permission: 'authorized' | 'denied' | 'provisional' | 'not-determined' | 'unavailable';
  message: string;
};

export function setNotificationActionHandler(handler: (action: HandyAction) => void): void {
  actionHandler = handler;
}

export async function getNotificationStatus(): Promise<NotificationStatus> {
  if (Platform.OS === 'web') {
    return { permission: 'unavailable', message: 'Native lock-screen notifications require iOS or Android.' };
  }

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
  if (Platform.OS === 'web') return getNotificationStatus();
  await notifee.requestPermission();
  await configureNotificationSurface();
  return getNotificationStatus();
}

export async function configureNotificationSurface(): Promise<void> {
  if (Platform.OS === 'web') return;

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

export async function syncPresetNotifications(state: HandyState): Promise<string> {
  currentState = state;
  if (Platform.OS === 'web') return 'Native notifications are unavailable on web.';

  await requestNotificationAccess();
  await notifee.cancelAllNotifications();
  const presets = enabledPresets(state);

  if (Platform.OS === 'ios') {
    await notifee.setNotificationCategories(
      presets.map((preset) => ({
        id: categoryIdForPreset(preset.id),
        actions: actionNotificationRows(preset)
          .slice(0, 2)
          .map((row) => ({ id: row.id, title: row.title, foreground: true, authenticationRequired: true })),
      })),
    );
  }

  for (const preset of presets) {
    const rows = actionNotificationRows(preset);
    await notifee.displayNotification({
      id: notificationIdForPreset(preset),
      title: preset.name,
      body: rows.length === 0 ? 'No actions configured.' : rows.map((row, index) => `${index + 1}. ${row.title}`).join('   '),
      data: { presetId: preset.id, actions: JSON.stringify(rows) },
      android: {
        channelId: CHANNEL_ID,
        ongoing: true,
        autoCancel: false,
        onlyAlertOnce: true,
        localOnly: true,
        visibility: AndroidVisibility.PUBLIC,
        pressAction: { id: 'open-app', launchActivity: 'default' },
        actions: rows.map((row) => ({
          title: row.title,
          pressAction: {
            id: row.id,
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

  return presets.length === 1 ? 'Showing 1 enabled preset notification.' : `Showing ${presets.length} enabled preset notifications.`;
}

export function registerNotificationEvents(): () => void {
  const unsubscribe = notifee.onForegroundEvent((event) => {
    void handleNotificationEvent(event);
  });

  notifee.onBackgroundEvent(async (event) => {
    await handleNotificationEvent(event);
  });

  return unsubscribe;
}

export async function consumeInitialNotification(): Promise<void> {
  if (Platform.OS === 'web') return;
  const initial = await notifee.getInitialNotification();
  if (initial) await openActionId(initial.pressAction.id, initial.notification.data);
}

export async function runActionPayload(payload: HandyActionPayload): Promise<void> {
  if (payload.type === 'qr') {
    return;
  }

  const url = payload.url;
  const fallbackUrl = payload.type === 'deeplink' ? payload.fallbackUrl : undefined;

  try {
    await Linking.openURL(url);
  } catch (error) {
    if (fallbackUrl) {
      await Linking.openURL(fallbackUrl);
      return;
    }
    throw error;
  }
}

async function handleNotificationEvent(event: Event): Promise<void> {
  if (event.type !== EventType.PRESS && event.type !== EventType.ACTION_PRESS) return;
  await openActionId(event.detail.pressAction?.id, event.detail.notification?.data);
}

async function openActionId(actionId: unknown, data: unknown): Promise<void> {
  if (typeof actionId !== 'string' || actionId === 'open-app') return;

  const found = findAction(currentState, actionId);
  const action = found?.action ?? actionFromNotificationData(actionId, data);
  if (!action) return;

  if (action.payload.type === 'qr') {
    actionHandler?.(action);
    return;
  }

  await runActionPayload(action.payload);
}

function categoryIdForPreset(presetId: string): string {
  return `handy-category-${presetId}`;
}

function actionFromNotificationData(actionId: string, data: unknown): HandyAction | undefined {
  if (!data || typeof data !== 'object' || !('actions' in data)) return undefined;
  const rawActions = data.actions;
  if (typeof rawActions !== 'string') return undefined;
  try {
    const rows = JSON.parse(rawActions) as Array<{ id: string; title: string; payload: HandyActionPayload }>;
    const row = rows.find((candidate) => candidate.id === actionId);
    return row ? { id: row.id, name: row.title, payload: row.payload } : undefined;
  } catch {
    return undefined;
  }
}
