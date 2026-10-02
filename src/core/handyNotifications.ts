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
  actionFromNotificationRowsData,
  actionIdFromPressId,
  actionNotificationRows,
  actionPressId,
  enabledPresets,
  findAction,
  notificationBodyForPreset,
  notificationIdForPreset,
  notificationRowsData,
  type HandyAction,
  type HandyActionPayload,
  type HandyState,
} from './handyModel';

const CHANNEL_ID = 'handy-actions';

let currentState: HandyState = { presets: [] };
let actionHandler: ((action: HandyAction) => void) | undefined;
let pendingAction: HandyAction | undefined;

export type NotificationStatus = {
  permission: 'authorized' | 'denied' | 'provisional' | 'not-determined' | 'unavailable';
  message: string;
};

export function setNotificationActionHandler(handler: (action: HandyAction) => void): void {
  actionHandler = handler;
  if (!pendingAction) return;

  const action = pendingAction;
  pendingAction = undefined;
  handler(action);
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
          .map((row) => ({ id: actionPressId(row.id), title: row.title, foreground: true })),
      })),
    );
  }

  for (const preset of presets) {
    const rows = actionNotificationRows(preset);
    await notifee.displayNotification({
      id: notificationIdForPreset(preset),
      title: preset.name,
      body: notificationBodyForPreset(preset),
      data: { presetId: preset.id, actions: notificationRowsData(preset) },
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
  if (initial) await openPressAction(initial.pressAction.id, initial.notification.data);
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
  await openPressAction(event.detail.pressAction?.id, event.detail.notification?.data);
}

async function openPressAction(pressId: unknown, data: unknown): Promise<void> {
  if (typeof pressId !== 'string') return;

  const actionId = actionIdFromPressId(pressId);
  if (!actionId) return;
  const found = findAction(currentState, actionId);
  const action = found?.action ?? actionFromNotificationData(actionId, data);
  if (!action) return;

  if (action.payload.type === 'qr') {
    if (actionHandler) {
      actionHandler(action);
      return;
    }
    pendingAction = action;
    return;
  }

  await runActionPayload(action.payload);
}

function categoryIdForPreset(presetId: string): string {
  return `handy-category-${presetId}`;
}

function actionFromNotificationData(actionId: string, data: unknown): HandyAction | undefined {
  if (!data || typeof data !== 'object' || !('actions' in data)) return undefined;
  return actionFromNotificationRowsData(actionId, data.actions);
}
