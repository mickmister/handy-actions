import assert from 'node:assert/strict';
import test from 'node:test';

import {
  actionFromNotificationRowsData,
  actionIdFromPressId,
  actionNotificationRows,
  actionPressId,
  defaultHandyState,
  exportHandyState,
  importHandyState,
  liveActivityPropsForPreset,
  notificationBodyForPreset,
  notificationIdForPreset,
  notificationRowsData,
  presetIdFromPressId,
  presetPressId,
  validateHandyState,
  type HandyPreset,
  type HandyState,
} from '../src/core/handyModel.ts';

test('default state starts local and empty', () => {
  const state = defaultHandyState();
  assert.deepEqual(state, { presets: [] });
});

test('live activity props summarize the preset without app runtime state', () => {
  const preset: HandyPreset = {
    id: 'conference',
    name: 'Social/Conference',
    enabled: true,
    actions: [
      { id: 'a1', name: 'My LinkTree', payload: { type: 'qr', value: 'https://example.test/linktree' } },
      { id: 'a2', name: 'My LinkedIn', payload: { type: 'qr', value: 'https://example.test/linkedin' } },
      { id: 'a3', name: 'My website', payload: { type: 'qr', value: 'https://example.test' } },
      { id: 'a4', name: 'Landing page', payload: { type: 'qr', value: 'https://example.test/app' } },
    ],
  };

  assert.deepEqual(liveActivityPropsForPreset(preset, '2026-10-02T20:00:00.000Z', 'handyactions://preset-actions?presetId=conference'), {
    presetId: 'conference',
    presetName: 'Social/Conference',
    actionCount: 4,
    firstAction: 'My LinkTree',
    secondAction: 'My LinkedIn',
    thirdAction: 'My website',
    updatedAt: '2026-10-02T20:00:00.000Z',
    openUrl: 'handyactions://preset-actions?presetId=conference',
  });
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

test('notification metadata builds real action press ids instead of body text commands', () => {
  const preset: HandyPreset = {
    id: 'conference',
    name: 'Social/Conference',
    enabled: true,
    actions: [
      { id: 'linkedin-one', name: 'LinkedIn', payload: { type: 'web', url: 'https://www.linkedin.com/in/example-one' } },
      { id: 'linkedin-two', name: 'LinkedIn', payload: { type: 'web', url: 'https://www.linkedin.com/in/example-two' } },
    ],
  };

  assert.equal(notificationBodyForPreset(preset), 'Long-press or expand for 2 actions.');
  assert.equal(actionPressId('linkedin-one'), 'handy-action:linkedin-one');
  assert.equal(actionIdFromPressId('handy-action:linkedin-two'), 'linkedin-two');
  assert.equal(presetPressId('conference'), 'handy-preset-press:conference');
  assert.equal(presetIdFromPressId('handy-preset-press:conference'), 'conference');
  assert.equal(actionIdFromPressId('open-app'), undefined);
  assert.equal(presetIdFromPressId('open-app'), undefined);

  const action = actionFromNotificationRowsData('linkedin-two', notificationRowsData(preset));
  assert.deepEqual(action, {
    id: 'linkedin-two',
    name: 'LinkedIn',
    payload: { type: 'web', url: 'https://www.linkedin.com/in/example-two' },
  });
});
