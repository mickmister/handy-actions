import type { AgentSession } from './handyModel.ts';
import type { RequestSpec } from './requestClient.ts';

export type Workspace = { id: string; name?: string | null; created_at: string; updated_at: string; archived?: boolean; worktree_deleted?: boolean };
export type Session = { id: string; workspace_id: string; name?: string | null; executor?: string | null; created_at: string; updated_at: string };
export type Tag = { id: string; tag_name: string; content: string };
export type QueueStatus = { status: 'empty' } | { status: 'queued'; message: { queued_at: string; data: { message: string; executor_config: { executor: string } } } };
type ApiRequest = (originId: string, path: string, spec?: RequestSpec, parseJson?: boolean) => Promise<unknown>;
export const displayName = (name: string | null | undefined, date: string) => name?.trim() || new Date(date).toLocaleString();
export const sessionLabel = (session: Session) => `${displayName(session.name, session.created_at)} · ${session.executor ?? 'No executor'}`;
export const sessionRef = (s: Session): AgentSession => ({ id: s.id, workspaceId: s.workspace_id, label: sessionLabel(s), executor: s.executor ?? '' });
export function prefixedPrompt(prefix: string, text: string) { if (!text.trim()) throw new Error('Enter a prompt first.'); return prefix.trim() ? `${prefix}\n${text}` : text; }
export function insertTag(text: string, selection: { start: number; end: number }, tag: Tag) {
  // VK FileTagTypeaheadPlugin inserts tag.content, NOT a literal @tag token.
  const start = Math.max(0, Math.min(selection.start, text.length));
  const end = Math.max(start, Math.min(selection.end, text.length));
  return { text: text.slice(0,start) + tag.content + text.slice(end), selection: { start: start + tag.content.length, end: start + tag.content.length } };
}
export class QueueChanged extends Error { constructor() { super('The queue changed. Review it again before updating.'); } }
export function createVdClient(request: ApiRequest, originId: string) {
  const api = async <T>(path: string, spec?: RequestSpec): Promise<T> => {
    const envelope = await request(originId, path, spec) as { success?: boolean; data?: T };
    if (envelope.success !== true || !('data' in envelope)) throw new Error('VD rejected the request. Your draft is unchanged.');
    return envelope.data as T;
  };
  const queue = (sessionId: string) => api<QueueStatus>(`/api/sessions/${encodeURIComponent(sessionId)}/queue`);
  return {
    async workspaces() { return (await api<Workspace[]>('/api/workspaces')).filter(w => !w.archived && !w.worktree_deleted).sort((a,b) => Date.parse(b.updated_at)-Date.parse(a.updated_at)); },
    sessions: (id: string) => api<Session[]>(`/api/sessions?workspace_id=${encodeURIComponent(id)}`),
    tags: () => api<Tag[]>('/api/tags'),
    queue,
    async send(target: AgentSession, prompt: string, edit?: { operation: 'append' | 'overwrite'; expected: QueueStatus }) {
      if (!prompt.trim()) throw new Error('Enter a prompt first.');
      const path = `/api/sessions/${encodeURIComponent(target.id)}`;
      const session = await api<Session>(path);
      if (session.id !== target.id || session.workspace_id !== target.workspaceId || !session.executor || session.executor !== target.executor) throw new Error('The selected session changed or has no matching executor. Choose it again; draft retained.');
      const current = await queue(target.id);
      const queued = current.status === 'queued';
      if (edit && JSON.stringify(edit.expected) !== JSON.stringify(current)) throw new QueueChanged();
      if (queued && !edit) return { kind: 'needs-choice' as const, queue: current };
      if (edit && !queued) throw new QueueChanged();
      const state = await api<{ has_running_turn: boolean; session_id: string | null }>(`${path}/conversation-preview?limit=1`);
      if (state.session_id !== target.id || typeof state.has_running_turn !== 'boolean') throw new Error('Cannot verify session activity. Draft retained.');
      if (state.has_running_turn || queued) {
        if(queued && edit?.operation==='append' && current.message.data.message.includes('[secret]'))throw new Error('Queued content includes hidden connection data. Append is unavailable; explicitly overwrite or review on VD.');
        const latest=await queue(target.id);
        if(JSON.stringify(latest)!==JSON.stringify(current))throw new QueueChanged();
        const message = queued && edit?.operation === 'append' ? `${current.message.data.message}\n${prompt}` : prompt;
        await api(`${path}/queue`, { method: 'POST', contentType: 'application/json', body: JSON.stringify({ message, executor_config: { executor: session.executor } }) });
        return { kind: 'queued' as const };
      }
      await api(`${path}/follow-up`, { method: 'POST', contentType: 'application/json', body: JSON.stringify({ prompt, executor_config: { executor: session.executor }, retry_process_id: null, force_when_dirty: null, perform_git_reset: null }) });
      return { kind: 'started' as const };
    },
  };
}
