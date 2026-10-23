import assert from 'node:assert/strict';
import test from 'node:test';
import { exportHandyState, importHandyState, type HandyState } from '../src/core/handyModel.ts';
import { loadRecentWorkspaces, recentWorkspaceLinks } from '../src/core/recentWorkspaces.ts';
import type { OriginProfile } from '../src/core/originRepository.ts';
import { createRequestClient } from '../src/core/requestClient.ts';
import { createVdClient, type Workspace } from '../src/core/vdClient.ts';

const enabled: HandyState = { presets: [], recentWorkspaces: { enabled: true, originId: 'vd' } };
const profile: OriginProfile = { id: 'vd', name: 'My VD', origin: 'https://vd.example:8443', headers: [{ name: 'Authorization', mode: 'secret', value: 'Bearer private-token' }] };
const workspace = (id: string, updated_at: string, extra: Partial<Workspace> = {}): Workspace => ({
  id, name: `Workspace ${id}`, created_at: '2026-10-01T00:00:00Z', updated_at, ...extra,
});

test('orders recent active workspace names, removes duplicates, and bounds the list to three', () => {
  const workspaces = [
    workspace('old', '2026-10-01T00:00:00Z'),
    workspace('third', '2026-10-20T00:00:00Z'),
    workspace('second', '2026-10-21T00:00:00Z', { name: '  Fix mobile icons  ' }),
    workspace('latest', '2026-10-22T00:00:00Z', { name: 'Recent workspaces' }),
    workspace('latest', '2026-10-22T00:00:00Z'),
    workspace('archived', '2026-10-23T00:00:00Z', { archived: true }),
    workspace('deleted', '2026-10-23T00:00:00Z', { worktree_deleted: true }),
    workspace('invalid', 'not-a-date'),
  ];
  const links = recentWorkspaceLinks(profile.origin, workspaces);
  assert.deepEqual(links.map(link => link.id), ['latest', 'second', 'third']);
  assert.equal(links[0].title, 'Recent workspaces');
  assert.equal(links[1].title, 'Fix mobile icons');
  assert.equal(workspaces[0].id, 'old', 'sorting must not mutate the caller’s response');
});

test('workspace browser links retain the selected origin and encode the workspace ID as one path segment', () => {
  const links = recentWorkspaceLinks(profile.origin, [workspace('abc/日本語 ?#', '2026-10-22T00:00:00Z')]);
  assert.equal(links[0].url, 'https://vd.example:8443/workspaces/abc%2F%E6%97%A5%E6%9C%AC%E8%AA%9E%20%3F%23');
  assert.deepEqual(recentWorkspaceLinks(profile.origin, [workspace('..', '2026-10-22T00:00:00Z')]), []);
  const [unnamed] = recentWorkspaceLinks(profile.origin, [workspace('12345678-rest', '2026-10-22T00:00:00Z', { name: null })]);
  assert.equal(unnamed.title, 'Workspace 12345678');
});

test('disabled lists and disabled Live Activities make no connection or API calls', async () => {
  const dependencies = {
    connection: async () => { throw new Error('must not resolve'); },
    workspaces: async () => { throw new Error('must not fetch'); },
  };
  for (const state of [
    { presets: [] },
    { ...enabled, recentWorkspaces: { enabled: false, originId: 'vd' } },
    { ...enabled, surfaces: { liveActivities: false, lockScreenWidgets: false, notifications: false } },
  ]) assert.equal(await loadRecentWorkspaces(state, dependencies), undefined);
});

test('opt-in works without presets, uses one connection snapshot, and exposes no headers in activity data', async () => {
  let resolves = 0;
  const snapshot = await loadRecentWorkspaces(enabled, {
    connection: async id => { assert.equal(id, 'vd'); resolves++; return profile; },
    workspaces: async received => {
      assert.equal(received, profile);
      return [workspace('id', '2026-10-22T00:00:00Z')];
    },
  });
  assert.equal(resolves, 1);
  assert.equal(snapshot?.links[0].url, `${profile.origin}/workspaces/id`);
  assert.equal(snapshot?.message, '');
  assert.equal(JSON.stringify(snapshot).includes('private-token'), false);
  assert.equal(JSON.stringify(snapshot).includes('Authorization'), false);
});

test('missing, empty, and failed connections produce safe empty states rather than stale links', async () => {
  const empty = await loadRecentWorkspaces(enabled, { connection: async () => profile, workspaces: async () => [] });
  assert.match(empty!.message, /No recent active workspaces/);
  const failed = await loadRecentWorkspaces(enabled, {
    connection: async () => profile,
    workspaces: async () => { throw new Error('server echoed private-token'); },
  });
  assert.deepEqual(failed?.links, []);
  assert.equal(failed?.openUrl, '');
  assert.equal(JSON.stringify(failed).includes('private-token'), false);
  const missing = await loadRecentWorkspaces({ presets: [], recentWorkspaces: { enabled: true, originId: '' } }, {
    connection: async () => { throw new Error('must not resolve'); }, workspaces: async () => [],
  });
  assert.match(missing!.message, /Choose a VD origin/);
});

test('workspace fetching is a read-only uncached GET with credentials confined to request headers', async () => {
  const request = createRequestClient(async () => profile, async (url, init) => {
    assert.equal(url, `${profile.origin}/api/workspaces`);
    assert.equal(init.method, 'GET');
    assert.equal(init.cache, 'no-store');
    assert.equal(init.redirect, 'error');
    assert.equal(init.credentials, 'omit');
    assert.equal((init.headers as Record<string, string>).authorization, 'Bearer private-token');
    return new Response(JSON.stringify({ success: true, data: [workspace('id', '2026-10-22T00:00:00Z')] }), { status: 200 });
  });
  assert.equal((await createVdClient(request, profile.id).workspaces())[0].id, 'id');
});

test('workspace settings round trip independently of presets and secure origin credentials', () => {
  const restored = importHandyState(exportHandyState(enabled));
  assert.deepEqual(restored, enabled);
  assert.equal(importHandyState('{"presets":[]}').recentWorkspaces, undefined);
  assert.equal(exportHandyState(enabled).includes(profile.origin), false);
});
