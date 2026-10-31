import { requireOptionalNativeModule } from 'expo';
import type { Reminder } from './reminderModel';

const native = requireOptionalNativeModule<{
  handyReminders?: (operation: string, payload: string) => Promise<string>;
}>('ExpoWidgets');
export const remindersAvailable = !!native?.handyReminders;

async function perform(operation: string, value: unknown = {}): Promise<Reminder[]> {
  if (!native?.handyReminders) throw new Error('Reminders require the latest iOS build of Handy Actions.');
  return JSON.parse(await native.handyReminders(operation, JSON.stringify(value))) as Reminder[];
}
export const loadReminders = () => perform('list');
export const createReminder = (value: { id: string; text: string; intervalMinutes: number; repeats: boolean }) => perform('create', value);
export const completeReminder = (id: string, revision: string) => perform('complete', { id, revision });
export const retryReminder = (id: string, revision: string) => perform('retry', { id, revision });
