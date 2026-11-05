import { importHandyState, validateHandyState, type HandyState } from './handyModel.ts';

export type RecoveryCandidate = {id: string; source: string; modifiedAt?: number; state: HandyState};
export function presetRecoveryCandidates(files: {id: string; source: string; raw: string; modifiedAt?: number}[]): RecoveryCandidate[] {
  const result: RecoveryCandidate[] = [];
  const seen = new Set<string>();
  for (const file of files) {
    let parsed: unknown;
    try { parsed = JSON.parse(file.raw); } catch { continue; }
    const value = parsed as {presets?: unknown; state?: unknown; legacyBase?: unknown} | null;
    const possibilities: {value: unknown; suffix: string}[] = [{value: parsed, suffix: ''}];
    if (value?.state) possibilities.push({value: value.state, suffix: ' · recovery snapshot'});
    if (typeof value?.legacyBase === 'string') {
      try { possibilities.push({value: JSON.parse(value.legacyBase), suffix: ' · earlier snapshot'}); } catch { /* Ignore invalid embedded data. */ }
    }
    for (const candidate of possibilities) {
      const presets = (candidate.value as {presets?: unknown} | null)?.presets;
      // Recover presets only. A candidate's old theme or surface preferences
      // must not overwrite the current, independently saved preferences.
      const state = {presets};
      if (!validateHandyState(state).ok || !(presets as unknown[]).length) continue;
      const valid = importHandyState(JSON.stringify(state));
      const signature = JSON.stringify(valid.presets);
      if (seen.has(signature)) continue;
      seen.add(signature);
      result.push({id: `${file.id}:${candidate.suffix}`, source: file.source + candidate.suffix, modifiedAt: file.modifiedAt, state: valid});
    }
  }
  return result;
}
export function mergeRecoveredPresets(current: HandyState, recovered: HandyState): HandyState {
  const presets = current.presets.map(preset => {
    const old = recovered.presets.find(candidate => candidate.id === preset.id);
    return old ? {...preset, actions: [...preset.actions, ...old.actions.filter(action => !preset.actions.some(existing => existing.id === action.id))]} : preset;
  });
  return {...current, presets: [...presets, ...recovered.presets.filter(preset => !current.presets.some(existing => existing.id === preset.id))]};
}
export function withoutTheme(state: HandyState): HandyState { const {theme: _theme, ...presets} = state; return presets; }
