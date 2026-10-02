import assert from 'node:assert/strict';
import test from 'node:test';

import {
  actionNotificationRows,
  defaultHandyState,
  exportHandyState,
  importHandyState,
  notificationIdForPreset,
  validateHandyState,
  type HandyPreset,
  type HandyState,
} from '../src/core/handyModel.ts';

test('default state starts local and empty', () => {
  const state = defaultHandyState();
  assert.deepEqual(state, { presets: [] });
});

test('validates typed action payloads', () => {
  const state: HandyState = {
    presets: [
      {
        id: 'conference',
        name: 'Conference',
        enabled: true,
        actions: [
          { id: 'linktree', name: 'My LinkTree', payload: { type: 'qr', value: 'https://example.test/linktree' } },
          {
            id: 'docs',
            name: 'Agenda Doc',
            payload: {
              type: 'deeplink',
              url: 'googledocs://document/d/abc',
              fallbackUrl: 'https://docs.google.com/document/d/abc',
            },
          },
          { id: 'site', name: 'Website', payload: { type: 'web', url: 'https://example.test' } },
        ],
      },
    ],
  };

  assert.equal(validateHandyState(state).ok, true);
});

test('rejects ambiguous payload JSON', () => {
  const state = {
    presets: [
      {
        id: 'bad',
        name: 'Bad',
        enabled: true,
        actions: [{ id: 'x', name: 'No type', payload: { url: 'https://example.test' } }],
      },
    ],
  };

  const result = validateHandyState(state);
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /payload.type/);
});

test('import/export round trips normalized state', () => {
  const state: HandyState = {
    presets: [
      {
        id: 'p1',
        name: 'Social',
        enabled: false,
        actions: [{ id: 'a1', name: 'Website', payload: { type: 'qr', value: 'https://example.test' } }],
      },
    ],
  };

  assert.deepEqual(importHandyState(exportHandyState(state)), state);
});

test('notification rows are stable and capped to OS-size controls', () => {
  const preset: HandyPreset = {
    id: 'conference',
    name: 'Conference',
    enabled: true,
    actions: [
      { id: 'a1', name: 'One', payload: { type: 'qr', value: '1' } },
      { id: 'a2', name: 'Two', payload: { type: 'qr', value: '2' } },
      { id: 'a3', name: 'Three', payload: { type: 'qr', value: '3' } },
      { id: 'a4', name: 'Four', payload: { type: 'qr', value: '4' } },
    ],
  };

  assert.equal(notificationIdForPreset(preset), 'handy-preset-conference');
  assert.deepEqual(
    actionNotificationRows(preset).map((row) => row.id),
    ['a1', 'a2', 'a3'],
  );
});
