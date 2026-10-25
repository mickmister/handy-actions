import assert from 'node:assert/strict';
import test from 'node:test';
import { workspacePage } from '../src/core/workspacePagination.ts';

test('workspace pages retain ordering and reach every result exactly once in groups of ten', () => {
  const workspaces = Array.from({ length: 23 }, (_, id) => ({ id, name: `Workspace ${id}` }));
  const pages = [0, 1, 2].map(page => workspacePage(workspaces, page));
  assert.deepEqual(pages.map(page => page.items.length), [10, 10, 3]);
  assert.deepEqual(pages.flatMap(page => page.items), workspaces);
  assert.deepEqual(pages.map(({ first, last }) => [first, last]), [[1, 10], [11, 20], [21, 23]]);
  assert.equal(pages[0].pageCount, 3);
  assert.equal(pages[0].total, 23);
});

test('empty, exact-page, filtered, and reduced lists produce valid page controls', () => {
  assert.deepEqual(workspacePage([], 5), { items: [], page: 0, pageCount: 1, total: 0, first: 0, last: 0 });
  const workspaces = Array.from({ length: 20 }, (_, id) => id);
  assert.equal(workspacePage(workspaces, 2).page, 1);
  assert.equal(workspacePage(workspaces, -1).page, 0);
  assert.equal(workspacePage(workspaces, NaN).page, 0);
  const matches = workspaces.filter(id => id >= 18);
  assert.deepEqual(workspacePage(matches, 1).items, [18, 19]);
  assert.equal(workspacePage(matches, 1).page, 0);
});
