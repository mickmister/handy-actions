import AsyncStorage from '@react-native-async-storage/async-storage';

import { createNoteRepository } from './noteRepository';

export type { HandyNote, PendingNote } from './noteRepository';
export const { loadNotes, saveNote, queueNote, pendingNotes, completeNote, noteCompleted } = createNoteRepository(AsyncStorage);
