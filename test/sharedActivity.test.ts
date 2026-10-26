import assert from 'node:assert/strict';
import test from 'node:test';
import { sharedActivityConfiguration } from '../src/core/sharedActivityModel.ts';
import { workspaceNotificationBrowserUrl } from '../src/core/workspaceNotificationBrowser.ts';
import type { HandyState } from '../src/core/handyModel.ts';

const state: HandyState = { presets: [
  { id: 'first', name: 'First', enabled: true, actions: Array.from({ length: 9 }, (_, index) => ({ id: `a-${index}`, name: `Action ${index}`, payload: { type: 'notes' as const } })) },
  { id: 'disabled', name: 'Not visible', enabled: false, actions: [{ id: 'hidden', name: 'Hidden', payload: { type: 'notes' } }] },
  { id: 'last', name: 'Last', enabled: true, actions: [{ id: 'search', name: 'Find workspace', payload: { type: 'vd-workspace-search', originId: 'vd' } }] },
] };
const recent = { originId: 'vd', links: [{ id: 'w', title: 'Workspace', url: 'http://vd.tailnet:3000/workspaces/w' }], message: '', openUrl: 'http://vd.tailnet:3000/workspaces' };
const options = { openUrl: 'handyactions://settings', recent, link: (action: { id: string; name: string }, presetId: string, input: boolean) => ({ title: action.name, url: `handyactions://capture?presetId=${presetId}&actionId=${action.id}`, ...(input ? { captureTarget: `capture:${action.id}` } : {}) }) };

test('one host configuration retains ALL ordered actions/presets and recent workspaces without truncating the saved model', () => {
  const before = JSON.stringify(state);
  const config = sharedActivityConfiguration(state, options);
  assert.equal(config.enabled, true);
  assert.deepEqual(config.presets.map(preset => preset.id), ['first', 'last']);
  assert.deepEqual(config.presets[0].actions.map(action => action.id), Array.from({ length: 9 }, (_, index) => `a-${index}`));
  assert.equal(config.presets[1].actions[0].captureTarget, 'capture:search');
  assert.deepEqual(config.recent, recent);
  assert.equal(JSON.stringify(state), before);
});

test('standalone Workspaces content works without a preset, while the global switch clears desired content', () => {
  const onlyRecent = sharedActivityConfiguration({ presets: [] }, options);
  assert.deepEqual(onlyRecent.presets, []);
  assert.deepEqual(onlyRecent.recent, recent);
  const disabled = sharedActivityConfiguration({ ...state, surfaces: { liveActivities: false, notifications: true, lockScreenWidgets: true } }, options);
  assert.equal(disabled.enabled, false);
  assert.deepEqual(disabled.presets, []);
  assert.equal(disabled.recent, undefined);
});

test('shared host configuration forwards every recent result and identifies the temporary loading phase', () => {
  const allRecent = { ...recent, links: Array.from({ length: 14 }, (_, index) => ({ id: `w-${index}`, title: `Workspace ${index}`, url: `http://vd.tailnet:3000/workspaces/w-${index}` })) };
  const complete = sharedActivityConfiguration(state, { ...options, recent: allRecent });
  assert.equal(complete.recent?.links.length, 14);
  assert.equal(complete.recent?.loading, undefined);
  const loading = sharedActivityConfiguration(state, { ...options, recent: { ...recent, links: [], loading: true, message: 'Refreshing…' } });
  assert.equal(loading.recent?.loading, true);
  assert.equal(loading.recent?.originId, complete.recent?.originId);
  assert.deepEqual(loading.presets, complete.presets);
});

test('action reordering and origin changes reach the shared host snapshot, not separate per-preset activities', () => {
  const changed: HandyState = { presets: [{ ...state.presets[0], actions: [...state.presets[0].actions].reverse() }, { ...state.presets[2], actions: [{ ...state.presets[2].actions[0], payload: { type: 'vd-workspace-search', originId: 'other' } }] }] };
  const calls: string[] = [];
  const config = sharedActivityConfiguration(changed, { ...options, link: (action, presetId, input) => {
    if (action.payload.type === 'vd-workspace-search') calls.push(action.payload.originId);
    return options.link(action, presetId, input);
  } });
  assert.equal(config.presets[0].actions[0].id, 'a-8');
  assert.deepEqual(calls, ['other']);
});

test('workspace message body taps open the workspace browser URL; input submissions never route to the browser', () => {
  const data = { workspaceBrowserUrl: 'http://vd.tailnet:3000/workspaces/w%2Fwith%20spaces', captureActionId: 'message', backgroundRequest: '1' };
  assert.equal(workspaceNotificationBrowserUrl('default', data), data.workspaceBrowserUrl);
  assert.equal(workspaceNotificationBrowserUrl(undefined, data), data.workspaceBrowserUrl);
  assert.equal(workspaceNotificationBrowserUrl(undefined, data, 'Typed prompt'), undefined);
  assert.equal(workspaceNotificationBrowserUrl('default', data, ''), undefined);
  for (const press of ['handy-input-submit', 'handy-action:message', 'handy-local-retry', 'handy-workspace-search-submit']) {
    assert.equal(workspaceNotificationBrowserUrl(press, data), undefined);
  }
  assert.equal(workspaceNotificationBrowserUrl('default', { captureActionId: 'message', recoverySubmissionId: 'uncertain' }), undefined);
});

test('browser routing rejects credentials, unsafe schemes, unrelated paths and query/fragment payloads', () => {
  for (const value of ['not a URL', 'javascript:alert(1)', 'handyactions://notes', 'https://user:password@vd.test/workspaces/w', 'https://vd.test/api/workspaces', 'https://vd.test/workspaces', 'https://vd.test/workspaces/../settings', 'https://vd.test/workspaces/w?token=private', 'https://vd.test/workspaces/w#other']) {
    assert.equal(workspaceNotificationBrowserUrl('default', { workspaceBrowserUrl: value }), undefined, value);
  }
});
