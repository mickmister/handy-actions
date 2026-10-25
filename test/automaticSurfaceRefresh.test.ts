import assert from 'node:assert/strict';
import test from 'node:test';
import { createAutomaticSurfaceRefresh, originAffectsSurfaces, surfaceRefreshKey } from '../src/core/automaticSurfaceRefresh.ts';
import { createOriginRepository, type OriginDraft } from '../src/core/originRepository.ts';
import { notifyOriginChanged, subscribeOriginChanges } from '../src/core/originChanges.ts';
import type { HandyState } from '../src/core/handyModel.ts';

const state: HandyState = { presets: [{ id: 'p', name: 'Panel', enabled: true, actions: [
  { id: 'a', name: 'Agent', payload: { type: 'vd-agent', originId: 'vd', prefix: '' } },
  { id: 'b', name: 'Notes', payload: { type: 'notes' } },
] }] };
const renamed: HandyState = { ...state, presets: [{ ...state.presets[0], name: 'Renamed panel' }] };
const reversed: HandyState = { ...state, presets: [{ ...state.presets[0], actions: [...state.presets[0].actions].reverse() }] };
const tick = () => new Promise<void>(resolve => setImmediate(resolve));

function harness(sync: (snapshot: HandyState) => Promise<string>) {
  const scheduled = new Set<() => void>();
  const messages: string[] = [];
  const refresher = createAutomaticSurfaceRefresh({
    sync,
    onMessage: message => messages.push(message),
    schedule: callback => { scheduled.add(callback); return () => { scheduled.delete(callback); }; },
  });
  return { refresher, messages, async flush() {
    const callbacks = [...scheduled];
    scheduled.clear();
    callbacks.forEach(callback => callback());
    await tick();
  } };
}

test('saved visible preset/action/order/theme/settings changes invalidate surfaces, disabled preset edits do not', () => {
  for (const changed of [
    renamed, reversed, { ...state, theme: 'paper' as const },
    { ...state, presets: [] },
    { ...state, presets: [{ ...state.presets[0], enabled: false }] },
    { ...state, presets: [{ ...state.presets[0], actions: [state.presets[0].actions[0]] }] },
    { ...state, surfaces: { liveActivities: false, lockScreenWidgets: false, notifications: true } },
    { ...state, recentWorkspaces: { enabled: true, originId: 'vd' } },
  ]) assert.notEqual(surfaceRefreshKey(changed), surfaceRefreshKey(state));
  assert.equal(surfaceRefreshKey({ ...state, theme: 'psychedelic' }), surfaceRefreshKey(state));
  assert.equal(surfaceRefreshKey({ ...state, presets: [...state.presets, { id: 'off', name: 'Draft', enabled: false, actions: [] }] }), surfaceRefreshKey(state));
  assert.equal(surfaceRefreshKey({ ...state, recentWorkspaces: { enabled: false, originId: 'unselected' } }), surfaceRefreshKey(state));
});

test('rapid edits publish only the latest snapshot and equal effective state is not refreshed twice', async () => {
  const calls: HandyState[] = [];
  const { refresher, flush } = harness(async snapshot => { calls.push(snapshot); return 'done'; });
  refresher.request(state);
  refresher.request(renamed);
  refresher.request(reversed);
  await flush();
  assert.deepEqual(calls, [reversed]);
  refresher.request({ ...reversed });
  await flush();
  assert.equal(calls.length, 1);
  refresher.request(reversed, true); // foreground/origin invalidation bypasses equality
  await flush();
  assert.equal(calls.length, 2);
});

test('an in-flight refresh is followed only by the latest pending state, with no stale status message', async () => {
  let finish!: (message: string) => void;
  const calls: HandyState[] = [];
  const { refresher, messages, flush } = harness(async snapshot => {
    calls.push(snapshot);
    return calls.length === 1 ? new Promise<string>(resolve => { finish = resolve; }) : 'latest';
  });
  refresher.request(state);
  await flush();
  refresher.request(renamed);
  refresher.request(reversed);
  await flush();
  assert.equal(calls.length, 1);
  finish('obsolete');
  await tick();
  assert.deepEqual(calls, [state, reversed]);
  assert.deepEqual(messages, ['latest']);
});

test('failures allow explicit/foreground retry, and disposal cancels pending work and late feedback', async () => {
  let attempts = 0;
  const failed = harness(async () => { if (++attempts === 1) throw new Error('private native detail'); return 'recovered'; });
  failed.refresher.request(state);
  await failed.flush();
  assert.equal(failed.messages[0].includes('private native detail'), false);
  assert.match(failed.messages[0], /Changes saved/);
  failed.refresher.request(state, true);
  await failed.flush();
  assert.equal(failed.messages[1], 'recovered');

  let finish!: (message: string) => void;
  let calls = 0;
  const disposed = harness(async () => { calls++; return new Promise<string>(resolve => { finish = resolve; }); });
  disposed.refresher.request(state);
  await disposed.flush();
  disposed.refresher.request(renamed);
  disposed.refresher.dispose();
  finish('late');
  await disposed.flush();
  assert.equal(calls, 1);
  assert.deepEqual(disposed.messages, []);
});

test('origin changes refresh only referenced active surfaces, including the standalone workspace activity', () => {
  assert.equal(originAffectsSurfaces(state, 'vd'), true);
  assert.equal(originAffectsSurfaces(state, 'unrelated'), false);
  assert.equal(originAffectsSurfaces({ presets: [], recentWorkspaces: { enabled: true, originId: 'recent' } }, 'recent'), true);
  const off: HandyState = { ...state, surfaces: { liveActivities: false, lockScreenWidgets: false, notifications: false } };
  assert.equal(originAffectsSurfaces(off, 'vd'), false);
  assert.equal(surfaceRefreshKey({ ...off, theme: 'paper', presets: [] }), surfaceRefreshKey(off));
});

test('origin invalidations occur only after successful persistence and contain profile IDs, not credentials', async () => {
  const values = new Map<string, string>();
  const events: string[] = [];
  const unsubscribe = subscribeOriginChanges(id => events.push(id));
  const badListener = subscribeOriginChanges(() => { throw new Error('listener failed'); });
  const vault = {
    getItem: async (key: string) => values.get(key) ?? null,
    setItem: async (key: string, value: string) => { values.set(key, value); },
    removeItem: async (key: string) => { values.delete(key); },
  };
  const repository = createOriginRepository(vault, notifyOriginChanged);
  const draft: OriginDraft = { id: 'vd', name: 'VD', origin: 'http://vd.tailnet:3007', headers: [{ name: 'Authorization', mode: 'secret', value: 'Bearer private-token' }] };
  try {
    await repository.previewConnection(draft);
    assert.deepEqual(events, []);
    await repository.save(draft);
    assert.deepEqual(events, ['vd']);
    await assert.rejects(repository.save({ ...draft, origin: 'bad origin' }));
    assert.deepEqual(events, ['vd']);
    await repository.remove('vd');
    assert.deepEqual(events, ['vd', 'vd']);
    const failing = createOriginRepository({ ...vault, setItem: async () => { throw new Error('storage full'); } }, notifyOriginChanged);
    await assert.rejects(failing.save(draft));
    assert.deepEqual(events, ['vd', 'vd']);
  } finally { unsubscribe(); badListener(); }
  notifyOriginChanged('after-unsubscribe');
  assert.deepEqual(events, ['vd', 'vd']);
});
