import AsyncStorage from '@react-native-async-storage/async-storage';

import { type HandyState } from './handyModel';
import { createPresetRepository } from './handyStateRepository';
import { themePreferences } from './themePreferences';

export const handyStateRepository = createPresetRepository(AsyncStorage);

export async function loadHandyState(): Promise<HandyState> {
  const state = await handyStateRepository.load();
  const {theme} = await themePreferences.load(state.theme);
  return {...state, theme};
}

export async function saveHandyState(state: HandyState): Promise<void> {
  await handyStateRepository.update(() => state);
}
