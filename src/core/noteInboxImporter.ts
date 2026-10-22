import type { HandyNote } from './noteRepository.ts';

export type NativeNoteInbox = {
  read(): Promise<unknown[]>;
  acknowledge(id: string): Promise<void>;
};

type NoteSink = {
  saveNote(text: string, id: string, createdAt?: string): Promise<void>;
  completeNote(id: string): Promise<void>;
};

function capturedNote(value: unknown): HandyNote {
  const note = value as Partial<HandyNote> | null;
  if (!note || typeof note.id !== 'string' || !note.id ||
    typeof note.text !== 'string' || !note.text.trim() ||
    typeof note.createdAt !== 'string' || !Number.isFinite(Date.parse(note.createdAt))) {
    throw new Error('A captured note could not be read. Its native copy has been retained.');
  }
  return note as HandyNote;
}

export function createNoteInboxImporter(inbox: NativeNoteInbox | undefined, sink: NoteSink) {
  let inFlight: Promise<void> | undefined;
  return function importNotes(): Promise<void> {
    if (!inbox) return Promise.resolve();
    if (inFlight) return inFlight;
    inFlight = (async () => {
      for (const value of await inbox.read()) {
        const note = capturedNote(value);
        // Persist first; acknowledge last. A crash at any boundary is safe to
        // replay because saveNote and completion use the stable submission ID.
        await sink.saveNote(note.text, note.id, note.createdAt);
        await sink.completeNote(note.id);
        await inbox.acknowledge(note.id);
      }
    })().finally(() => { inFlight = undefined; });
    return inFlight;
  };
}
