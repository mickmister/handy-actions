import { surfaceSettings, type HandyState } from './handyModel.ts';
import { normalizedOrigin, originUrl, type OriginProfile } from './originRepository.ts';
import type { Workspace } from './vdClient.ts';

export type WorkspaceLink = { id: string; title: string; url: string };
export type RecentWorkspacesSnapshot = { originId: string; links: WorkspaceLink[]; message: string; openUrl: string };

export function recentWorkspacesEnabled(state: HandyState): boolean {
  return surfaceSettings(state).liveActivities && state.recentWorkspaces?.enabled === true;
}

export function recentWorkspaceLinks(origin: string, workspaces: Workspace[]): WorkspaceLink[] {
  const seen = new Set<string>();
  return workspaces
    .filter(workspace => workspace && !workspace.archived && !workspace.worktree_deleted
      && typeof workspace.id === 'string' && workspace.id.trim() && !['.', '..'].includes(workspace.id)
      && Number.isFinite(Date.parse(workspace.updated_at)))
    .sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at) || a.id.localeCompare(b.id))
    .filter(workspace => {
      if (seen.has(workspace.id)) return false;
      seen.add(workspace.id);
      return true;
    })
    .slice(0, 3)
    .map(workspace => ({
      id: workspace.id,
      title: workspace.name?.trim().slice(0, 100) || `Workspace ${workspace.id.slice(0, 8)}`,
      url: originUrl(origin, `/workspaces/${encodeURIComponent(workspace.id)}`),
    }));
}

// Resolve once so the API response and browser links always use the same
// connection snapshot, even if a connection is edited during a refresh.
export async function loadRecentWorkspaces(state: HandyState, dependencies: {
  connection(id: string): Promise<OriginProfile>;
  workspaces(profile: OriginProfile): Promise<Workspace[]>;
}): Promise<RecentWorkspacesSnapshot | undefined> {
  if (!recentWorkspacesEnabled(state)) return undefined;
  const originId = state.recentWorkspaces?.originId ?? '';
  const empty = { originId, links: [], openUrl: '' };
  if (!originId) return { ...empty, message: 'Choose a VD origin in Settings.' };
  try {
    const profile = await dependencies.connection(originId);
    const origin = normalizedOrigin(profile.origin);
    const links = recentWorkspaceLinks(origin, await dependencies.workspaces(profile));
    return { originId, links, openUrl: originUrl(origin, '/workspaces'), message: links.length ? '' : 'No recent active workspaces.' };
  } catch {
    // Clear old links on failure rather than showing an obsolete origin/list.
    return { ...empty, message: 'Could not refresh VD workspaces. Open the app to retry.' };
  }
}
