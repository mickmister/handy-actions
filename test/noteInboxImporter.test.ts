import assert from 'node:assert/strict';
import test from 'node:test';

import { createNoteInboxImporter } from '../src/core/noteInboxImporter.ts';
import { createNoteRepository } from '../src/core/noteRepository.ts';

function fixture() {
  const data = new Map<string, string>();
  const files = new Map<string, unknown>();
  const storage = {
    async getItem(key: string) { return data.get(key) ?? null; },
    async setItem(key: string, value: string) { data.set(key, value); },
    async removeItem(key: string) { data.delete(key); },
    async getAllKeys() { return [...data.keys()]; },
  };
  const inbox = {
    async read() { return [...files.values()]; },
    async acknowledge(id: string) { files.delete(id); },
  };
  return { storage, inbox, files };
}

const captured = {
  id: 'submission-📝/not-a-filename-action',
  text: 'Meet café & ask? #100% + 日本語\nSecond line',
  createdAt: '2026-10-22T10:15:16.123Z',
};

test('native notes import exact text/time once across duplicate responses and app restarts', async () => {
  const { storage, inbox, files } = fixture();
  files.set(captured.id, captured);
  const repository = createNoteRepository(storage);
  await createNoteInboxImporter(inbox, repository)();
  assert.deepEqual(await repository.loadNotes(), [captured]);
  assert.equal(files.size, 0);
  assert.equal(await repository.noteCompleted(captured.id), true);
  // A late native duplicate after file acknowledgement must not duplicate save.
  files.set(captured.id, { ...captured, createdAt: '2026-10-23T10:00:00Z' });
  const restarted = createNoteRepository(storage);
  await createNoteInboxImporter(inbox, restarted)();
  assert.deepEqual(await restarted.loadNotes(), [captured]);
  assert.equal(files.size, 0);
});

test('storage failure leaves native copy available and a fresh importer recovers it', async () => {
  const { storage, inbox, files } = fixture();
  files.set(captured.id, captured);
  const broken = createNoteRepository({ ...storage, async setItem() { throw new Error('disk full'); } });
  await assert.rejects(createNoteInboxImporter(inbox, broken)(), /disk full/);
  assert.equal(files.size, 1);
  const recovered = createNoteRepository(storage);
  await createNoteInboxImporter(inbox, recovered)();
  assert.deepEqual(await recovered.loadNotes(), [captured]);
  assert.equal(files.size, 0);
});

test('crashes after saving or completion but before native acknowledgement are safe to replay', async () => {
  for (const stage of ['completion', 'acknowledgement']) {
    const { storage, inbox, files } = fixture();
    files.set(captured.id, captured);
    const repository = createNoteRepository(storage);
    const sink = stage === 'completion' ? {
      ...repository, async completeNote() { throw new Error('interrupted completion'); },
    } : repository;
    const interruptedInbox = stage === 'acknowledgement' ? {
      ...inbox, async acknowledge() { throw new Error('interrupted acknowledgement'); },
    } : inbox;
    await assert.rejects(createNoteInboxImporter(interruptedInbox, sink)(), /interrupted/);
    assert.equal(files.size, 1);
    assert.deepEqual(await repository.loadNotes(), [captured]);
    const restarted = createNoteRepository(storage);
    await createNoteInboxImporter(inbox, restarted)();
    assert.deepEqual(await restarted.loadNotes(), [captured]);
    assert.equal(files.size, 0);
  }
});

test('concurrent reads share an import, malformed records are retained, and failures can retry', async () => {
  const { storage, inbox, files } = fixture();
  files.set(captured.id, captured);
  let reads = 0;
  const importer = createNoteInboxImporter({ ...inbox, async read() { reads++; return inbox.read(); } }, createNoteRepository(storage));
  await Promise.all([importer(), importer(), importer()]);
  assert.equal(reads, 1);
  files.set('invalid', { id: 'invalid', text: 'Keep me', createdAt: 'bad date' });
  await assert.rejects(importer(), /retained/);
  assert.equal(files.size, 1);
  files.set('invalid', { ...captured, id: 'invalid' });
  await importer();
  assert.equal(files.size, 0);
  await createNoteInboxImporter(undefined, createNoteRepository(storage))();
});
