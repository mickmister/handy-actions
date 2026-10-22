import type { HandyAction } from './handyModel.ts';

export const LOCAL_INPUT_CATEGORY = 'handy-text-input-local-v1';
export const LOCAL_RECOVERY_CATEGORY = 'handy-text-input-local-recovery-v1';
export const LOCAL_RETRY_PRESS = 'handy-local-retry';

// Native local saving receives the raw reply. Only opt in when it is exactly
// what our Notes route would save; transformed/ambiguous templates stay routed.
export function isLocalNoteAction(action: Pick<HandyAction, 'payload'>, notesUrl: string): boolean {
  if (action.payload.type !== 'text-input') return false;
  try {
    const target = new URL(action.payload.urlTemplate);
    const local = new URL(notesUrl);
    return target.protocol === local.protocol && target.host === local.host &&
      target.pathname === local.pathname && !target.username && !target.password && !target.hash &&
      target.searchParams.getAll('text').length === 1 && target.searchParams.get('text') === '{text}';
  } catch { return false; }
}
