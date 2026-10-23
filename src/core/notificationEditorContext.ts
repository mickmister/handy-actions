import { actionFromNotificationRowsData, type HandyAction } from './handyModel.ts';

export type NotificationEditorContext = { action: HandyAction; presetId?: string; text: string; submissionId?: string };
export function notificationEditorContext(data: unknown): NotificationEditorContext | undefined {
  if (!data || typeof data !== 'object') return undefined;
  const values = data as Record<string,unknown>;
  if (typeof values.captureActionId !== 'string') return undefined;
  const action = actionFromNotificationRowsData(values.captureActionId, values.actions);
  if (!action) return undefined;
  return {
    action,
    ...(typeof values.presetId === 'string' ? {presetId:values.presetId} : {}),
    text: typeof values.editorText === 'string' ? values.editorText : typeof values.localNoteRecoveryText === 'string' ? values.localNoteRecoveryText : '',
    ...(typeof values.recoverySubmissionId === 'string' ? {submissionId:values.recoverySubmissionId} : {}),
  };
}
