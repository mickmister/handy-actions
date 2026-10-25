export const WORKSPACE_PAGE_SIZE = 10;

export function workspacePage<T>(workspaces: readonly T[], requestedPage: number) {
  const pageCount = Math.max(1, Math.ceil(workspaces.length / WORKSPACE_PAGE_SIZE));
  const page = Math.min(pageCount - 1, Math.max(0, Number.isFinite(requestedPage) ? Math.floor(requestedPage) : 0));
  const offset = page * WORKSPACE_PAGE_SIZE;
  return {
    items: workspaces.slice(offset, offset + WORKSPACE_PAGE_SIZE),
    page,
    pageCount,
    total: workspaces.length,
    first: workspaces.length ? offset + 1 : 0,
    last: Math.min(offset + WORKSPACE_PAGE_SIZE, workspaces.length),
  };
}
