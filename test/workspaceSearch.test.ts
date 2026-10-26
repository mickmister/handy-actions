import assert from 'node:assert/strict';
import test from 'node:test';
import { actionFromNotificationRowsData, exportHandyState, importHandyState, isInputPayload, notificationRowsData, validateHandyState, type HandyAction, type HandyState } from '../src/core/handyModel.ts';
import { originAffectsSurfaces, surfaceRefreshKey } from '../src/core/automaticSurfaceRefresh.ts';
import { WORKSPACE_SEARCH_TARGET, workspaceSearchTarget } from '../src/core/workspaceSearchTarget.ts';

const action: HandyAction = { id: 'search', name: 'Find workspace', payload: { type: 'vd-workspace-search', originId: 'vd' } };
const state: HandyState = { presets: [{ id: 'panel', name: 'VD', enabled: true, actions: [action] }] };

test('workspace search round-trips through presets and notification snapshots as input, with no fixed session', () => {
  assert.deepEqual(importHandyState(exportHandyState(state)), state);
  assert.equal(isInputPayload(action.payload), true);
  assert.deepEqual(actionFromNotificationRowsData('search', notificationRowsData(state.presets[0])), action);
  for (const payload of [{ type: 'vd-workspace-search', originId: '' }, { type: 'vd-workspace-search' }]) {
    assert.equal(validateHandyState({ presets: [{ ...state.presets[0], actions: [{ ...action, payload }] }] }).ok, false);
  }
});

test('native search intent contains a scoped action snapshot, and normalized imports discard connection material', () => {
  const imported = importHandyState(JSON.stringify({ presets: [{ ...state.presets[0], actions: [{ ...action, payload: { ...action.payload, headers: { Authorization: 'private' }, session: { id: 'stale' } } }] }] }));
  const target = workspaceSearchTarget(imported.presets[0].actions[0], 'panel');
  assert.equal(target.startsWith(WORKSPACE_SEARCH_TARGET), true);
  assert.deepEqual(JSON.parse(target.slice(WORKSPACE_SEARCH_TARGET.length)), { operation: 'begin', action, presetId: 'panel' });
  assert.equal(target.includes('private'), false);
  assert.equal(target.includes('stale'), false);
  assert.equal(JSON.parse(workspaceSearchTarget(action).slice(WORKSPACE_SEARCH_TARGET.length)).presetId, 'workspace-search');
});

test('saved origin changes invalidate active search controls but not disabled or unrelated surfaces', () => {
  assert.equal(originAffectsSurfaces(state, 'vd'), true);
  assert.equal(originAffectsSurfaces(state, 'other'), false);
  const changed = { presets: [{ ...state.presets[0], actions: [{ ...action, payload: { type: 'vd-workspace-search' as const, originId: 'other' } }] }] };
  assert.notEqual(surfaceRefreshKey(state), surfaceRefreshKey(changed));
  assert.equal(originAffectsSurfaces({ presets: [{ ...state.presets[0], enabled: false }] }, 'vd'), false);
});
