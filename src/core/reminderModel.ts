export type ReminderUnit = 'minutes' | 'hours' | 'days';
export type Reminder = {
  id: string;
  revision: string;
  text: string;
  intervalMinutes: number;
  repeats: boolean;
  createdAt: number;
  firstFireAt?: number;
  completedAt?: number;
  status: 'scheduling' | 'active' | 'completed';
};
export const REMINDER_CATEGORY = 'handy-reminder-v1';
export const REMINDER_COMPLETE_PRESS = 'handy-reminder-complete-v1';

export function reminderMinutes(amount: string, unit: ReminderUnit): number {
  if (!/^\d+$/.test(amount.trim())) throw new Error('Enter a whole number for the reminder interval.');
  const minutes = Number(amount) * ({ minutes: 1, hours: 60, days: 1440 }[unit]);
  if (!Number.isSafeInteger(minutes) || minutes < 1 || minutes > 525600) {
    throw new Error('Choose an interval between 1 minute and 365 days.');
  }
  return minutes;
}
export function reminderIntervalLabel(minutes: number): string {
  const unit = minutes % 1440 === 0 ? 'day' : minutes % 60 === 0 ? 'hour' : 'minute';
  const amount = minutes / (unit === 'day' ? 1440 : unit === 'hour' ? 60 : 1);
  return `${amount} ${unit}${amount === 1 ? '' : 's'}`;
}
export function reminderPress(pressId: unknown, data: unknown, input?: string): { id: string; revision: string; complete: boolean } | undefined {
  if (input !== undefined || !data || typeof data !== 'object') return undefined;
  if (pressId !== undefined && pressId !== 'default' && pressId !== REMINDER_COMPLETE_PRESS) return undefined;
  const row = data as Record<string, unknown>;
  if (typeof row.reminderId !== 'string' || !/^[a-zA-Z0-9-]{1,100}$/.test(row.reminderId)
      || typeof row.reminderRevision !== 'string' || !/^[a-zA-Z0-9-]{1,100}$/.test(row.reminderRevision)) return undefined;
  return { id: row.reminderId, revision: row.reminderRevision, complete: pressId === REMINDER_COMPLETE_PRESS };
}
