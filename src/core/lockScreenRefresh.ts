export const REFRESH_NOTIFICATION_ID = 'handy-lock-screen-refresh';
export const REFRESH_PRESS_ID = 'handy-refresh-lock-screen';
export function isRefreshPress(pressId: unknown, data: unknown, notificationId?: string): boolean {
  return pressId === REFRESH_PRESS_ID || (notificationId === REFRESH_NOTIFICATION_ID &&
    !!data && typeof data === 'object' && (data as Record<string,unknown>).refreshLockScreen === '1');
}
