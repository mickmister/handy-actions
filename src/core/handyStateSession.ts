import { defaultHandyState, type HandyState } from './handyModel.ts';
import { HandyStateStorageError, type StateMutation } from './handyStateRepository.ts';
import { withoutTheme } from './presetRecovery.ts';
import type { ThemeChoice, ThemeRepository } from './themeRepository.ts';

export type SaveResult = { ok: true; message: string } | { ok: false; message: string };
type Repository = { load(): Promise<HandyState>; update(mutate: StateMutation): Promise<HandyState>; restorePresets(state: HandyState): Promise<HandyState> };
export function createHandyStateSession(repository: Repository, themes: ThemeRepository) {
  let snapshot = {state: {...defaultHandyState(), theme: 'psychedelic' as ThemeChoice}, loaded: false, refreshReady: false, loading: false, storageError: '', themeLoaded: false, themeError: '', themeSource: '', message: 'Loading local presets…'};
  let loading: Promise<void> | undefined;
  let legacyTheme: ThemeChoice | undefined;
  let themeGeneration = 0;
  let themeWrites = 0;
  const listeners = new Set<() => void>();
  function publish(patch: Partial<typeof snapshot>) { snapshot = {...snapshot, ...patch}; for (const listener of listeners) listener(); }
  async function loadTheme(seed = legacyTheme) {
    const generation = ++themeGeneration;
    try {
      const choice = await themes.load(seed);
      if (generation !== themeGeneration) return;
      publish({state: {...snapshot.state, theme: choice.theme}, themeLoaded: true, themeError: '', themeSource: choice.source, refreshReady: snapshot.loaded});
    } catch (error) {
      if (generation === themeGeneration) publish({themeLoaded: false, refreshReady: false, themeError: error instanceof Error ? error.message : 'Could not load the theme preference.'});
    }
  }
  async function savePresets(operation: () => Promise<HandyState>, message: string): Promise<SaveResult> {
    try {
      const state = await operation();
      publish({state: {...withoutTheme(state), theme: snapshot.state.theme}, loaded: true, refreshReady: snapshot.themeLoaded, storageError: '', message});
      return {ok: true, message};
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not save presets and settings.';
      if (error instanceof HandyStateStorageError) publish({loaded: false, refreshReady: false, storageError: message, message});
      else publish({message});
      return {ok: false, message};
    }
  }
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    load(): Promise<void> {
      if (loading) return loading;
      publish({loading: true});
      loading = Promise.resolve().then(async () => {
        const preferences = loadTheme();
        const presets = (async () => {
          try {
            const state = await repository.load();
            legacyTheme = state.theme;
            publish({state: {...withoutTheme(state), theme: snapshot.state.theme}, loaded: true, refreshReady: snapshot.themeLoaded, storageError: '', message: 'Loaded saved presets.'});
            await preferences;
            if (legacyTheme && snapshot.themeSource === 'default' && !themeWrites) await loadTheme(legacyTheme);
          } catch {
            const message = new HandyStateStorageError('read').message;
            publish({loaded: false, refreshReady: false, storageError: message, message});
          }
        })();
        await Promise.all([preferences, presets]);
      }).finally(() => { loading = undefined; publish({loading: false}); });
      return loading;
    },
    retryTheme: () => loadTheme(),
    update(mutate: StateMutation, message: string): Promise<SaveResult> {
      if (!snapshot.loaded) return Promise.resolve({ok: false, message: snapshot.storageError || 'Saved presets are still loading. Please try again.'});
      return savePresets(() => repository.update(state => withoutTheme(mutate(state))), message);
    },
    restorePresets: (state: HandyState) => savePresets(() => repository.restorePresets(state), 'Previous presets restored.'),
    async updateTheme(theme: ThemeChoice, message = 'Theme saved.'): Promise<SaveResult> {
      // This path touches only the preference vault, even if preset loading
      // failed. It never calls the preset repository or serializes empty actions.
      const generation = ++themeGeneration;
      themeWrites++;
      try {
        const saved = await themes.save(theme);
        if (generation === themeGeneration) publish({state: {...snapshot.state, theme: saved}, themeLoaded: true, themeError: '', themeSource: 'saved', refreshReady: snapshot.loaded, message: snapshot.storageError || message});
        return {ok: true, message};
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not save the theme preference.';
        if (generation === themeGeneration) publish({themeError: message, themeLoaded: false, refreshReady: false});
        return {ok: false, message};
      } finally { themeWrites--; }
    },
    setMessage(message: string) { if (!snapshot.storageError && !snapshot.themeError) publish({message}); },
  };
}
