import assert from 'node:assert/strict';
import test from 'node:test';
import { movePresetAction } from '../src/core/actionOrdering.ts';
import { actionNotificationRows, exportHandyState, importHandyState, liveActivityActionRowsForPreset, widgetPreset, type HandyState } from '../src/core/handyModel.ts';

const state: HandyState = {
  presets: [
    { id: 'selected', name: 'Selected', enabled: true, actions: Array.from({ length: 4 }, (_, index) => ({
      id: `action-${index}`, name: 'Same name', payload: { type: 'web', url: `https://example.com/${index}` },
    })) },
    { id: 'other', name: 'Other', enabled: true, actions: [{ id: 'action-3', name: 'Other action', payload: { type: 'notes' } }] },
  ],
};

test('reordering preserves IDs, payloads, and other presets without mutating the original', () => {
  const next = movePresetAction(state, 'selected', 'action-3', -1);
  assert.deepEqual(next.presets[0].actions.map(action => action.id), ['action-0', 'action-1', 'action-3', 'action-2']);
  assert.equal(next.presets[0].actions[2], state.presets[0].actions[3]);
  assert.equal(next.presets[1], state.presets[1]);
  assert.equal(state.presets[0].actions[3].id, 'action-3');
  assert.deepEqual(movePresetAction(next, 'selected', 'action-3', 1), state);
});

test('boundary moves and stale or missing action/preset IDs are harmless', () => {
  for (const [presetId, actionId, direction] of [
    ['selected', 'action-0', -1], ['selected', 'action-3', 1],
    ['missing', 'action-0', 1], ['selected', 'missing', -1],
  ] as const) assert.equal(movePresetAction(state, presetId, actionId, direction), state);
});

test('saved order survives import/export and changes notification, Live Activity, and widget order together', () => {
  const restored = importHandyState(exportHandyState(movePresetAction(state, 'selected', 'action-3', -1)));
  const expected = ['action-0', 'action-1', 'action-3', 'action-2'];
  assert.deepEqual(restored.presets[0].actions.map(action => action.id), expected);
  assert.deepEqual(actionNotificationRows(restored.presets[0]).map(action => action.id), expected.slice(0, 3));
  assert.deepEqual(liveActivityActionRowsForPreset(restored.presets[0], action => ({ title: action.name, url: action.id })).flat().map(action => action.url), expected);
  assert.deepEqual(widgetPreset(restored)!.actions.map(action => action.id), expected);
});
