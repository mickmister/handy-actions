import type { HandyAction } from './handyModel.ts';

export const WORKSPACE_SEARCH_TARGET = 'handy-workspace-search-v1:';
export function workspaceSearchTarget(action: HandyAction, presetId?: string): string {
  return WORKSPACE_SEARCH_TARGET + JSON.stringify({ operation: 'begin', action, presetId: presetId || 'workspace-search' });
}
