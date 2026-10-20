import assert from 'node:assert/strict';
import test from 'node:test';

import { createNoteRepository } from '../src/core/noteRepository.ts';
import type { HandyAction } from '../src/core/handyModel.ts';

const action: HandyAction = { id: 'note', name: 'Add Note', payload: { type: 'text-input', urlTemplate: 'app://note?text={text}' } };

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    async getItem(key: string) { return data.get(key) ?? null; },
    async setItem(key: string, value: string) { data.set(key, value); },
    async removeItem(key: string) { data.delete(key); },
    async getAllKeys() { return [...data.keys()]; },
  };
}

test('unsent notes survive a fresh repository and can be edited before retry', async () => {
  const storage = memoryStorage();
  await createNoteRepository(storage).queueNote(action, 'Original', 'submission');
  const restarted = createNoteRepository(storage);
  assert.equal((await restarted.pendingNotes())[0].text, 'Original');
  await restarted.queueNote(action, 'Updated & 日本語', 'submission');
  assert.equal((await restarted.pendingNotes()).length, 1);
  assert.equal((await restarted.pendingNotes())[0].text, 'Updated & 日本語');
  assert.deepEqual((await restarted.pendingNotes())[0].action, action);
});

test('concurrent local saves preserve notes and repeated self deep links are idempotent', async () => {
  const notes = createNoteRepository(memoryStorage());
  await Promise.all([notes.saveNote('One', '1'), notes.saveNote('Two', '2'), notes.saveNote('One', '1')]);
  assert.deepEqual((await notes.loadNotes()).map((note) => note.text), ['Two', 'One']);
  await assert.rejects(notes.saveNote(' \n ', '3'), /Enter a note/);
  await notes.saveNote('Three', '3');
  assert.equal((await notes.loadNotes()).length, 3);
});

test('completed submissions cannot be resurrected by duplicate notification events after restart', async () => {
  const storage = memoryStorage();
  const notes = createNoteRepository(storage);
  await notes.queueNote(action, 'A note', 'submission');
  await notes.completeNote('submission');
  const restarted = createNoteRepository(storage);
  assert.deepEqual(await restarted.pendingNotes(), []);
  assert.equal(await restarted.queueNote(action, 'A note', 'submission'), undefined);
});

test('failed delivery retains queued text and a failed save does not poison subsequent saves', async () => {
  const storage = memoryStorage();
  let fail = true;
  const notes = createNoteRepository({ ...storage, async setItem(key, value) {
    if (key.endsWith('notes/v1') && fail) throw new Error('storage failure');
    return storage.setItem(key, value);
  } });
  await notes.queueNote(action, 'Recover me', 'submission');
  await assert.rejects(notes.saveNote('Recover me', 'submission'), /storage failure/);
  assert.equal((await notes.pendingNotes())[0].text, 'Recover me');
  fail = false;
  await notes.saveNote('Recover me', 'submission');
  await notes.completeNote('submission');
  assert.equal((await notes.loadNotes())[0].text, 'Recover me');
  assert.deepEqual(await notes.pendingNotes(), []);
});
