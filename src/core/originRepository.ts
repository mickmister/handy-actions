export type HeaderMode = 'plaintext' | 'secret';
export type OriginHeader = { name: string; mode: HeaderMode; value: string };
export type OriginProfile = { id: string; name: string; origin: string; headers: OriginHeader[] };
export type OriginSummary = Omit<OriginProfile, 'headers'> & { headers: { name: string; mode: HeaderMode; configured: boolean; value?: string }[] };
export type OriginDraft = Omit<OriginProfile, 'headers'> & { headers: { name: string; mode: HeaderMode; value?: string }[] };
export type Vault = { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void>; removeItem(key: string): Promise<void> };
export const ORIGIN_SERVICE = 'handy-actions-origins-v1';
export const originKey = (id: string) => `handy-origin-${id}`;
const INDEX = 'handy-origin-index';

export function normalizedOrigin(value: string): string {
  const url = new URL(value);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('Enter an HTTP(S) origin without a path, query, or credentials.');
  }
  return url.origin;
}

export function originUrl(origin: string, path: string): string {
  const base = normalizedOrigin(origin);
  if (!path.startsWith('/') || path.startsWith('//') || /[\\\r\n]/.test(path)) throw new Error('Request path must start with a single /.');
  const url = new URL(path, base);
  if (url.origin !== base || url.username || url.password || url.hash) throw new Error('The request path must stay on its configured origin.');
  return url.toString();
}

export function publicOrigin(profile: OriginProfile): OriginSummary {
  return { ...profile, headers: profile.headers.map(({ name, mode, value }) => ({ name, mode, configured: !!value, ...(mode === 'plaintext' ? { value } : {}) })) };
}

function resolveDraft(draft: OriginDraft, previous?: OriginProfile): OriginProfile {
  if (!/^[a-zA-Z0-9._-]+$/.test(draft.id) || !draft.name.trim()) throw new Error('Origin needs a name and a valid identifier.');
  const seen = new Set<string>();
  const headers = draft.headers.map(header => {
    const name = header.name.trim();
    const lower = name.toLowerCase();
    if (!/^[!#$%&'*+.^_`|~0-9a-z-]+$/i.test(name) || seen.has(lower) || ['host', 'content-length', 'connection'].includes(lower)) throw new Error('Header names must be valid, unique, and not transport headers.');
    seen.add(lower);
    if (!['plaintext', 'secret'].includes(header.mode)) throw new Error('Choose plaintext or secret for every header.');
    const old = previous?.headers.find(h => h.name.toLowerCase() === lower);
    if (old && old.mode !== header.mode && !header.value?.trim()) throw new Error('Enter a new non-empty value when changing header mode.');
    if (header.value === undefined && (!old || old.mode !== header.mode)) throw new Error('Enter a replacement value when changing header mode.');
    const value = header.value ?? old!.value;
    if (/[\r\n]/.test(value)) throw new Error('Header values cannot contain line breaks.');
    return { name, mode: header.mode, value };
  });
  return { id: draft.id, name: draft.name.trim(), origin: normalizedOrigin(draft.origin.trim()), headers };
}

export function createOriginRepository(vault: Vault) {
  let writes: Promise<unknown> = Promise.resolve();
  const serialize = <T>(work: () => Promise<T>) => { const next = writes.then(work); writes = next.catch(() => {}); return next; };
  const ids = async (): Promise<string[]> => JSON.parse(await vault.getItem(INDEX) ?? '[]');
  const read = async (id: string): Promise<OriginProfile> => {
    if (!/^[a-zA-Z0-9._-]+$/.test(id)) throw new Error('Choose a configured origin.');
    const raw = await vault.getItem(originKey(id));
    if (!raw) throw new Error('Origin is missing. Configure or reconnect it in Settings.');
    try { return JSON.parse(raw); }
    catch { throw new Error('Could not read this secure origin. Reconfigure it in Settings.'); }
  };
  return {
    async list(): Promise<OriginSummary[]> { return Promise.all((await ids()).map(async id => publicOrigin(await read(id)))); },
    connection: read,
    previewConnection(draft: OriginDraft): Promise<OriginProfile> { return serialize(async () => {
      const previous = (await ids()).includes(draft.id) ? await read(draft.id) : undefined;
      // Resolve unchanged write-only secrets without saving draft edits or
      // returning those values to any editable form fields.
      return resolveDraft(draft, previous);
    }); },
    save(draft: OriginDraft): Promise<void> { return serialize(async () => {
      const existingIds = await ids();
      const previous = existingIds.includes(draft.id) ? await read(draft.id) : undefined;
      const profile = resolveDraft(draft, previous);
      await vault.setItem(originKey(profile.id), JSON.stringify(profile));
      if (!existingIds.includes(profile.id)) await vault.setItem(INDEX, JSON.stringify([...existingIds, profile.id]));
    }); },
    remove(id: string) { return serialize(async () => { await vault.setItem(INDEX, JSON.stringify((await ids()).filter(x => x !== id))); await vault.removeItem(originKey(id)); }); },
  };
}
