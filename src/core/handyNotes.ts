import AsyncStorage from '@react-native-async-storage/async-storage';

import { createNoteRepository } from './noteRepository';
import { nativeNoteInbox } from './nativeNoteInbox';
import { createNoteInboxImporter } from './noteInboxImporter';
import { createActionInboxImporter } from './actionInboxImporter';
import { nativeActionInbox } from './nativeActionInbox';
import { saveEditorDraft } from './editorDrafts';

export type { HandyNote, PendingNote } from './noteRepository';
const repository = createNoteRepository(AsyncStorage);
export const { saveNote, queueNote, completeNote, noteCompleted, markNoteAttempt } = repository;
export const importCapturedActions=createActionInboxImporter(nativeActionInbox,repository,(action,id,presetId)=>saveEditorDraft(action,'',presetId,`${id}-editor`));
export async function pendingNotes() {await importCapturedActions();return repository.pendingNotes();}
export const importCapturedNotes = createNoteInboxImporter(nativeNoteInbox, repository);

export async function loadNotes() {
  await importCapturedNotes();
  // A capture may be imported long after a newer in-app note was created.
  return (await repository.loadNotes()).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}
