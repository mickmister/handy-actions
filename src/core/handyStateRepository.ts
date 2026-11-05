import { defaultHandyState, importHandyState, makeId, validateHandyState, type HandyState } from './handyModel.ts';
import { mergeRecoveredPresets, withoutTheme } from './presetRecovery.ts';

export const HANDY_STATE_KEY = 'handy-actions/state/v1';
export const HANDY_STATE_RECOVERY_KEY = 'handy-actions/state-recovery/v1';
export const HANDY_STATE_BEFORE_RESTORE = 'handy-actions/state-before-restore/';
export const LEGACY_THEME_SEED_KEY = 'handy-actions/legacy-theme-seed/v1';
type Storage = { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void> };
type Journal = { version: 1; state: HandyState; legacyBase: string | null };
export type StateMutation = (current: HandyState) => HandyState;
type RecordDiagnostic = {status: 'missing' | 'valid' | 'invalid'; presets?: number; actions?: number; legacyTheme?: string};
export type HandyStateDiagnostics = {
  checkedAt?: string;
  primary?: RecordDiagnostic;
  recovery?: RecordDiagnostic;
  source?: 'primary' | 'recovery' | 'new-empty' | 'read-error';
};
function diagnostic(raw: string | null, state: HandyState | undefined): RecordDiagnostic {
  return state ? {status: 'valid', presets: state.presets.length, actions: state.presets.reduce((total, preset) => total + preset.actions.length, 0), ...(state.theme ? {legacyTheme: state.theme} : {})} : {status: raw === null ? 'missing' : 'invalid'};
}

export class HandyStateStorageError extends Error {
  readonly operation: 'read' | 'write' | 'uninitialized';
  constructor(operation: 'read' | 'write' | 'uninitialized') {
    super(operation === 'write'
      ? 'Could not save presets and settings. Reload saved settings before trying again.'
      : 'Could not load saved presets and settings. They have not been reset. Retry loading before making changes.');
    this.name = 'HandyStateStorageError';
    this.operation = operation;
  }
}

function decode(value: unknown): HandyState {
  // Imports deliberately normalize legacy data. Persisted snapshots must first
  // pass validation so {}, null, or a damaged structure cannot become defaults.
  if (!validateHandyState(value).ok) throw new HandyStateStorageError('read');
  return importHandyState(JSON.stringify(value));
}
const same = (a: HandyState, b: HandyState) => JSON.stringify(a) === JSON.stringify(b);

export function createHandyStateRepository(storage: Storage) {
  let queue: Promise<unknown> = Promise.resolve();
  let initialized = false;
  let diagnostics: HandyStateDiagnostics = {};
  function serial<T>(operation: () => Promise<T>): Promise<T> {
    const result = queue.then(operation);
    queue = result.catch(() => {});
    return result;
  }
  async function journal(value: Journal) {
    try { await storage.setItem(HANDY_STATE_RECOVERY_KEY, JSON.stringify(value)); }
    catch { throw new HandyStateStorageError('write'); }
  }
  async function read(): Promise<{state: HandyState; primary: string | null}> {
    let primary: string | null;
    let recovery: string | null;
    try { [primary, recovery] = await Promise.all([storage.getItem(HANDY_STATE_KEY), storage.getItem(HANDY_STATE_RECOVERY_KEY)]); }
    catch { diagnostics = {checkedAt: new Date().toISOString(), source: 'read-error'}; throw new HandyStateStorageError('read'); }
    let legacy: HandyState | undefined;
    let saved: Journal | undefined;
    if (primary !== null) {
      try { legacy = decode(JSON.parse(primary)); } catch { /* Retain invalid bytes; try the recovery snapshot. */ }
    }
    if (recovery !== null) {
      try {
        const value = JSON.parse(recovery);
        if (value?.version === 1 && (value.legacyBase === null || typeof value.legacyBase === 'string')) {
          saved = {version: 1, state: decode(value.state), legacyBase: value.legacyBase};
        }
      } catch { /* A valid legacy copy can still recover a damaged journal. */ }
    }
    diagnostics = {checkedAt: new Date().toISOString(), primary: diagnostic(primary, legacy), recovery: diagnostic(recovery, saved?.state)};
    if (saved) {
      // Recognize edits made by an older app using the legacy key. The exact
      // pre-commit legacy value distinguishes those from an interrupted mirror
      // write, even when multiple consecutive mirror writes have failed.
      if (legacy && !same(legacy, saved.state) && primary !== saved.legacyBase) {
        diagnostics.source = 'primary';
        await journal({version: 1, state: legacy, legacyBase: primary});
        return {state: legacy, primary};
      }
      diagnostics.source = 'recovery';
      return {state: saved.state, primary};
    }
    if (legacy) {
      diagnostics.source = 'primary';
      if (recovery === null) await journal({version: 1, state: legacy, legacyBase: primary});
      return {state: legacy, primary};
    }
    // Only two absent records mean a new installation. Present-but-unreadable
    // data is an error, never permission to overwrite it with an empty state.
    if (primary !== null || recovery !== null) throw new HandyStateStorageError('read');
    const state = defaultHandyState();
    diagnostics.source = 'new-empty';
    await journal({version: 1, state, legacyBase: null});
    return {state, primary};
  }
  return {
    // Cached metadata from the actual load, not another storage read or a write.
    // No note text, action names, URLs, prompts or credentials are exposed.
    getDiagnostics: (): HandyStateDiagnostics => JSON.parse(JSON.stringify(diagnostics)),
    load(): Promise<HandyState> {
      return serial(async () => {
        try { const {state} = await read(); initialized = true; return state; }
        catch (error) { initialized = false; throw error; }
      });
    },
    update(mutate: StateMutation): Promise<HandyState> {
      return serial(async () => {
        if (!initialized) throw new HandyStateStorageError('uninitialized');
        let current: Awaited<ReturnType<typeof read>>;
        try { current = await read(); }
        catch (error) { initialized = false; throw error; }
        const next = mutate(JSON.parse(JSON.stringify(current.state)) as HandyState);
        const validation = validateHandyState(next);
        if (!validation.ok) throw new Error(validation.errors.join('\n'));
        const state = decode(next);
        // Commit a complete recoverable snapshot BEFORE touching the legacy
        // mirror. A rejected commit cannot erase the previous primary copy.
        try { await journal({version: 1, state, legacyBase: current.primary}); }
        catch (error) { initialized = false; throw error; }
        try { await storage.setItem(HANDY_STATE_KEY, JSON.stringify(state)); }
        catch { /* The committed journal remains authoritative and recoverable. */ }
        return state;
      });
    },
    // Only an explicit user-selected recovery invokes this operation. Preserve
    // raw current records before replacing even an unreadable current snapshot.
    restorePresets(recovered: HandyState): Promise<HandyState> {
      return serial(async () => {
        const candidate = decode(withoutTheme(recovered));
        let primary: string | null;
        let recovery: string | null;
        try { [primary, recovery] = await Promise.all([storage.getItem(HANDY_STATE_KEY), storage.getItem(HANDY_STATE_RECOVERY_KEY)]); }
        catch { throw new HandyStateStorageError('read'); }
        let current: HandyState;
        try { current = (await read()).state; }
        catch (error) {
          if (!(error instanceof HandyStateStorageError) || error.operation !== 'read') throw error;
          // An IO error is not permission to discard a valid current record.
          // Only explicitly unreadable/corrupt structures may be replaced after
          // their exact raw bytes have been captured for the archive below.
          let validCurrent = false;
          try { if (primary !== null) { decode(JSON.parse(primary)); validCurrent = true; } } catch { }
          try { if (recovery !== null) { decode(JSON.parse(recovery).state); validCurrent = true; } } catch { }
          if (validCurrent) throw error;
          current = {presets: []};
        }
        const state = decode(withoutTheme(mergeRecoveredPresets(current, candidate)));
        try { await storage.setItem(HANDY_STATE_BEFORE_RESTORE + makeId('snapshot'), JSON.stringify({primary, recovery, selected: candidate})); }
        catch { throw new HandyStateStorageError('write'); }
        await journal({version: 1, state, legacyBase: primary});
        try { await storage.setItem(HANDY_STATE_KEY, JSON.stringify(state)); } catch { /* Committed recovery remains authoritative. */ }
        initialized = true;
        return state;
      });
    },
  };
}

// Runtime preset writes never serialize theme preferences. The legacy engine
// retains compatibility with old snapshots for migration and recovery only.
export function createPresetRepository(storage: Storage) {
  const repository = createHandyStateRepository(storage);
  return {...repository,
    async load() {
      const state = await repository.load();
      let raw: string | null;
      try { raw = await storage.getItem(LEGACY_THEME_SEED_KEY); } catch { throw new HandyStateStorageError('read'); }
      // Keep the old preference as a separate migration-only checkpoint until
      // the preference vault can accept it. Preset edits may proceed while the
      // vault is unavailable without destroying the only legacy theme value.
      if (raw === null && state.theme) {
        try { await storage.setItem(LEGACY_THEME_SEED_KEY, state.theme); } catch { throw new HandyStateStorageError('write'); }
      }
      const seed = state.theme ?? raw;
      return seed && ['psychedelic', 'midnight', 'paper'].includes(seed) ? {...state, theme: seed as NonNullable<HandyState['theme']>} : state;
    },
    update: (mutate: StateMutation) => repository.update(state => withoutTheme(mutate(state))),
  };
}
