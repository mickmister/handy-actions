import { requireOptionalNativeModule } from 'expo';
import { presetRecoveryCandidates } from './presetRecovery';

const native = requireOptionalNativeModule<{readHandySettingsRecovery?: () => Promise<string>}>('ExpoWidgets');
export const settingsRecoveryAvailable = !!native?.readHandySettingsRecovery;
export async function scanPreviousPresets() {
  if (!native?.readHandySettingsRecovery) throw new Error('Previous-file recovery requires the latest iOS preview build.');
  const value = JSON.parse(await native.readHandySettingsRecovery()) as {files: {id: string; source: string; raw: string; modifiedAt?: number}[]; unreadableFiles: number};
  return {candidates: presetRecoveryCandidates(value.files), unreadableFiles: value.unreadableFiles};
}
