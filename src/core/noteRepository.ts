import { makeId, type HandyAction } from './handyModel.ts';

export type HandyNote = { id: string; text: string; createdAt: string };
export type PendingNote = { id: string; action: HandyAction; text: string; createdAt: string; attempted?: boolean; presetId?:string };
type NoteStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  getAllKeys(): Promise<readonly string[]>;
};
const NOTES_KEY = 'handy-actions/notes/v1';
const PENDING_PREFIX = 'handy-actions/pending-note/';
const COMPLETED_PREFIX = 'handy-actions/completed-note/';

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

  return {
    loadNotes,
    noteCompleted,
    saveNote(text: string, id = makeId('note'), createdAt = new Date().toISOString()): Promise<void> {
      return serialized(async () => {
        if (!text.trim()) throw new Error('Enter a note first.');
        const notes = await loadNotes();
        if (notes.some((note) => note.id === id)) return;
        await storage.setItem(NOTES_KEY, JSON.stringify([{ id, text, createdAt }, ...notes]));
      });
    },
    queueNote(action: HandyAction, text: string, id = makeId('submission'), presetId?:string): Promise<PendingNote | undefined> {
      return serialized(async () => {
        if (!text.trim()) throw new Error('Enter a note first.');
        if (await noteCompleted(id)) return undefined;
        const previous = await storage.getItem(PENDING_PREFIX + id);
        const old:PendingNote|undefined=previous?JSON.parse(previous):undefined;
        const contextPresetId=presetId??old?.presetId;
        const pending: PendingNote = { id, action, text, createdAt: old?.createdAt??new Date().toISOString(), ...(old ? { attempted: old.attempted === true } : {}),...(contextPresetId?{presetId:contextPresetId}:{}) };
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
      const keys = (await storage.getAllKeys()).filter((key) => key.startsWith(PENDING_PREFIX));
      const values = await Promise.all(keys.map((key) => storage.getItem(key)));
      const entries = values.flatMap((value) => value ? [JSON.parse(value) as PendingNote] : []);
      const pending = await Promise.all(entries.map(async (entry) => await noteCompleted(entry.id) ? undefined : entry));
      return pending.filter((entry): entry is PendingNote => !!entry).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    },
    completeNote(id: string): Promise<void> {
      return serialized(async () => {
        await storage.setItem(COMPLETED_PREFIX + id, new Date().toISOString());
        await storage.removeItem(PENDING_PREFIX + id);
      });
    },
  };
}
