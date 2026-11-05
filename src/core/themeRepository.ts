import type { HandyState } from './handyModel.ts';

export type ThemeChoice = NonNullable<HandyState['theme']>;
export const THEME_PREFERENCE_KEY = 'handy-actions.theme.v1';
export const THEME_PREFERENCE_SERVICE = 'handy-actions-theme-v1';
type Vault = {getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void>};
export type ThemeResult = {theme: ThemeChoice; source: 'saved' | 'legacy' | 'default'};
function valid(value: unknown): value is ThemeChoice { return ['psychedelic', 'midnight', 'paper'].includes(String(value)); }

export function createThemeRepository(vault: Vault) {
  let queue: Promise<unknown> = Promise.resolve();
  function serial<T>(operation: () => Promise<T>): Promise<T> {
    const result = queue.then(operation); queue = result.catch(() => {}); return result;
  }
  async function write(theme: ThemeChoice) {
    if (!valid(theme)) throw new Error('Choose a supported theme.');
    try { await vault.setItem(THEME_PREFERENCE_KEY, JSON.stringify({version: 1, theme})); }
    catch { throw new Error('Could not save the theme preference. Presets were not changed.'); }
  }
  return {
    load(legacyTheme?: ThemeChoice): Promise<ThemeResult> {
      return serial(async () => {
        let raw: string | null;
        try { raw = await vault.getItem(THEME_PREFERENCE_KEY); }
        catch { throw new Error('Could not load the theme preference. Retry or choose a theme.'); }
        if (raw !== null) {
          try { const value = JSON.parse(raw); if (value.version === 1 && valid(value.theme)) return {theme: value.theme, source: 'saved'}; } catch { /* Preserve unreadable preferences. */ }
          throw new Error('The saved theme preference could not be read. Choose a theme to replace it.');
        }
        if (legacyTheme && valid(legacyTheme)) { await write(legacyTheme); return {theme: legacyTheme, source: 'legacy'}; }
        return {theme: 'psychedelic', source: 'default'};
      });
    },
    save(theme: ThemeChoice): Promise<ThemeChoice> { return serial(async () => { await write(theme); return theme; }); },
  };
}
export type ThemeRepository = ReturnType<typeof createThemeRepository>;
