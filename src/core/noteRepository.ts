import { makeId, type HandyAction } from './handyModel.ts';

export type AgentHandoff = {
  submissionId: string; actionName: string; originId: string; sessionId: string;
  sessionLabel: string; kind: 'started' | 'queued'; acceptedAt: string;
};
export type HandyNote = {
  id: string; text: string; createdAt: string; updatedAt?: string;
  status?: 'unaddressed' | 'completed'; completedAt?: string; handoff?: AgentHandoff;
};
export type PendingNote = { id: string; action: HandyAction; text: string; createdAt: string; attempted?: boolean; presetId?:string; sourceNoteId?:string };
type HandoffReceipt = { sourceNoteId: string; handoff: AgentHandoff; applied?: boolean };
type NoteStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  getAllKeys(): Promise<readonly string[]>;
};
const NOTES_KEY = 'handy-actions/notes/v1';
const PENDING_PREFIX = 'handy-actions/pending-note/';
const COMPLETED_PREFIX = 'handy-actions/completed-note/';
const HANDOFF_PREFIX = 'handy-actions/agent-handoff/';

export function createNoteRepository(storage: NoteStorage) {
  let writes: Promise<unknown> = Promise.resolve();
  function serialized<T>(write: () => Promise<T>): Promise<T> {
    const result = writes.then(write);
    writes = result.catch(() => {});
    return result;
  }
  async function loadNotes(): Promise<HandyNote[]> {
    const raw = await storage.getItem(NOTES_KEY);
    return raw ? JSON.parse(raw) : [];
  }
  const noteCompleted = async (id: string) => (await storage.getItem(COMPLETED_PREFIX + id)) !== null;
  async function finishSubmission(id: string) {
    await storage.setItem(COMPLETED_PREFIX + id, new Date().toISOString());
    await storage.removeItem(PENDING_PREFIX + id);
  }
  async function applyHandoff(receipt: HandoffReceipt) {
    if (receipt.applied) return;
    const notes = await loadNotes();
    const note = notes.find(entry => entry.id === receipt.sourceNoteId);
    if (!note) throw new Error('Source note is missing; handoff receipt retained.');
    // A replay must not re-complete a note explicitly reopened after this handoff.
    if (note.handoff?.submissionId !== receipt.handoff.submissionId &&
      (!note.handoff || Date.parse(note.handoff.acceptedAt) < Date.parse(receipt.handoff.acceptedAt))) {
      await storage.setItem(NOTES_KEY, JSON.stringify(notes.map(entry => entry.id === note.id ? {
        ...entry, status: 'completed', completedAt: receipt.handoff.acceptedAt, handoff: receipt.handoff,
      } : entry)));
    }
    await finishSubmission(receipt.handoff.submissionId);
    await storage.setItem(HANDOFF_PREFIX + receipt.handoff.submissionId, JSON.stringify({...receipt, applied:true}));
  }
  function reconcileHandoffs(): Promise<void> {
    return serialized(async () => {
      const keys = (await storage.getAllKeys()).filter(key => key.startsWith(HANDOFF_PREFIX));
      for (const key of keys) {
        const raw = await storage.getItem(key);
        if (raw) await applyHandoff(JSON.parse(raw));
      }
    });
  }

  return {
    loadNotes,
    noteCompleted,
    reconcileHandoffs,
    editNote(id: string, text: string): Promise<void> {
      return serialized(async () => {
        if (!text.trim()) throw new Error('Enter a note first.');
        const notes = await loadNotes();
        if (!notes.some(note => note.id === id)) throw new Error('This note is no longer available.');
        await storage.setItem(NOTES_KEY, JSON.stringify(notes.map(note => note.id === id ? {...note,text,updatedAt:new Date().toISOString()} : note)));
      });
    },
    setNoteStatus(id: string, status: 'unaddressed' | 'completed'): Promise<void> {
      return serialized(async () => {
        const notes = await loadNotes();
        if (!notes.some(note => note.id === id)) throw new Error('This note is no longer available.');
        await storage.setItem(NOTES_KEY, JSON.stringify(notes.map(note => {
          if (note.id !== id) return note;
          const {completedAt: _old, ...rest} = note;
          return {...rest,status,...(status==='completed'?{completedAt:new Date().toISOString()}:{})};
        })));
      });
    },
    confirmAgentHandoff(submissionId: string, sourceNoteId: string, action: HandyAction, kind: 'started' | 'queued'): Promise<void> {
      return serialized(async () => {
        if (action.payload.type !== 'vd-agent' || !action.payload.session) throw new Error('A verified agent session is required.');
        const existing = await storage.getItem(HANDOFF_PREFIX + submissionId);
        const previous = Date.parse((await loadNotes()).find(note=>note.id===sourceNoteId)?.handoff?.acceptedAt ?? '');
        const acceptedAt = new Date(Math.max(Date.now(),Number.isFinite(previous)?previous+1:0)).toISOString();
        const receipt: HandoffReceipt = existing ? JSON.parse(existing) : {sourceNoteId,handoff:{
          submissionId, actionName:action.name,originId:action.payload.originId,
          sessionId:action.payload.session.id,sessionLabel:action.payload.session.label,kind,acceptedAt,
        }};
        // Journal confirmed acceptance first. Recovery can finish local changes
        // without reissuing the non-idempotent agent request.
        if (!existing) await storage.setItem(HANDOFF_PREFIX + submissionId, JSON.stringify(receipt));
        await applyHandoff(receipt);
      });
    },
    saveNote(text: string, id = makeId('note'), createdAt = new Date().toISOString()): Promise<void> {
      return serialized(async () => {
        if (!text.trim()) throw new Error('Enter a note first.');
        const notes = await loadNotes();
        if (notes.some((note) => note.id === id)) return;
        await storage.setItem(NOTES_KEY, JSON.stringify([{ id, text, createdAt }, ...notes]));
      });
    },
    queueNote(action: HandyAction, text: string, id = makeId('submission'), presetId?:string, sourceNoteId?:string): Promise<PendingNote | undefined> {
      return serialized(async () => {
        if (!text.trim()) throw new Error('Enter a note first.');
        const receipt = await storage.getItem(HANDOFF_PREFIX + id);
        if (receipt) { await applyHandoff(JSON.parse(receipt)); return undefined; }
        if (await noteCompleted(id)) return undefined;
        const previous = await storage.getItem(PENDING_PREFIX + id);
        const old:PendingNote|undefined=previous?JSON.parse(previous):undefined;
        const contextPresetId=presetId??old?.presetId;
        const source = sourceNoteId ?? old?.sourceNoteId;
        const pending: PendingNote = { id, action, text, createdAt: old?.createdAt??new Date().toISOString(), ...(old ? { attempted: old.attempted === true } : {}),...(contextPresetId?{presetId:contextPresetId}:{}),...(source?{sourceNoteId:source}:{}) };
        await storage.setItem(PENDING_PREFIX + id, JSON.stringify(pending));
        return pending;
      });
    },
    markNoteAttempt(id: string): Promise<void> {
      return serialized(async () => {
        const raw = await storage.getItem(PENDING_PREFIX + id);
        if (!raw) throw new Error('The saved draft is missing.');
        await storage.setItem(PENDING_PREFIX + id, JSON.stringify({ ...JSON.parse(raw), attempted: true }));
      });
    },
    async pendingNotes(): Promise<PendingNote[]> {
      await reconcileHandoffs();
      const keys = (await storage.getAllKeys()).filter((key) => key.startsWith(PENDING_PREFIX));
      const values = await Promise.all(keys.map((key) => storage.getItem(key)));
      const entries = values.flatMap((value) => value ? [JSON.parse(value) as PendingNote] : []);
      const pending = await Promise.all(entries.map(async (entry) => await noteCompleted(entry.id) ? undefined : entry));
      return pending.filter((entry): entry is PendingNote => !!entry).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    },
    completeNote(id: string): Promise<void> {
      return serialized(async () => {
        await finishSubmission(id);
      });
    },
  };
}
