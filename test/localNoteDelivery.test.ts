import assert from 'node:assert/strict';
import test from 'node:test';

import { isLocalNoteAction } from '../src/core/localNoteDelivery.ts';
import { liveActivityCaptureTarget, type HandyAction } from '../src/core/handyModel.ts';

const notesUrl = 'handyactionspreview://notes';
const note = (urlTemplate: string): HandyAction => ({ id: 'a', name: 'Note', payload: { type: 'text-input', urlTemplate } });

test('only exact self note destinations with unchanged text qualify for native saving', () => {
  assert.equal(isLocalNoteAction(note(`${notesUrl}?text={text}`), notesUrl), true);
  assert.equal(isLocalNoteAction(note(`${notesUrl}?source=lock&text=%7Btext%7D`), notesUrl), true);
  for (const url of [
    'otherapp://notes?text={text}',
    'handyactionsproduction://notes?text={text}',
    'handyactionspreview://notes/other?text={text}',
    'handyactionspreview://notes.evil.test?text={text}',
    'handyactionspreview://user@notes?text={text}',
    `${notesUrl}?text=prefix{text}`,
    `${notesUrl}?text={text}&text=other`,
    `${notesUrl}?body={text}`,
    `${notesUrl}?text={text}#other`,
    'not a URL',
  ]) assert.equal(isLocalNoteAction(note(url), notesUrl), false, url);
  assert.equal(isLocalNoteAction({ payload: { type: 'web', url: notesUrl } }, notesUrl), false);
});

test('native local-save intent keeps its explicit mode and the original scoped snapshot', () => {
  const action = note(`${notesUrl}?text={text}`);
  const prefix = 'handy-note-capture-v1:';
  const local = JSON.parse(liveActivityCaptureTarget('preset', action, true)!.slice(prefix.length));
  assert.equal(local.localSave, true);
  assert.equal(local.actionId, action.id);
  assert.equal(local.presetId, 'preset');
  assert.deepEqual(JSON.parse(local.actions)[0].payload, action.payload);
  const legacy = JSON.parse(liveActivityCaptureTarget('preset', action)!.slice(prefix.length));
  assert.equal(legacy.localSave, undefined);
});
