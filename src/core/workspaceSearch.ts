import type { HandyAction } from './handyModel';

export async function beginWorkspaceSearch(_action: HandyAction, _presetId?: string, _query?: string): Promise<string> {
  throw new Error('Lock Screen workspace search requires the updated iOS 17+ native build.');
}
export const workspaceSearchAvailable = false;
