import { defaultHandyState, type HandyState } from './handyModel.ts';
import { HandyStateStorageError, type StateMutation } from './handyStateRepository.ts';

export type SaveResult = { ok: true; message: string } | { ok: false; message: string };
type Repository = { load(): Promise<HandyState>; update(mutate: StateMutation): Promise<HandyState> };
export function createHandyStateSession(repository: Repository) {
  let snapshot = {state: defaultHandyState(), loaded: false, refreshReady: false, loading: false, storageError: '', message: 'Loading local presets…'};
  let loading: Promise<void> | undefined;
  const listeners = new Set<() => void>();
  function publish(patch: Partial<typeof snapshot>) {
    snapshot = {...snapshot, ...patch};
    for (const listener of listeners) listener();
  }
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    load(): Promise<void> {
      if (loading) return loading;
      publish({loading: true});
      loading = (async () => {
        try {
          const state = await repository.load();
          publish({state, loaded: true, refreshReady: true, loading: false, storageError: '', message: 'Loaded saved presets and settings.'});
        } catch {
          const message = new HandyStateStorageError('read').message;
          // Preserve the last confirmed state. Never publish defaults after an
          // unavailable protected store/cold-start read or enable destructive edits.
          publish({loaded: false, refreshReady: false, loading: false, storageError: message, message});
        } finally { loading = undefined; }
      })();
      return loading;
    },
    async update(mutate: StateMutation, message: string): Promise<SaveResult> {
      if (!snapshot.loaded) return {ok: false, message: snapshot.storageError || 'Saved settings are still loading. Please try again.'};
      try {
        const state = await repository.update(mutate);
        publish({state, loaded: true, refreshReady: true, storageError: '', message});
        return {ok: true, message};
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not save presets and settings.';
        if (error instanceof HandyStateStorageError) publish({loaded: false, refreshReady: false, storageError: message, message});
        else publish({message});
        return {ok: false, message};
      }
    },
    setMessage(message: string) { if (!snapshot.storageError) publish({message}); },
  };
}
