import AsyncStorage from '@react-native-async-storage/async-storage';

import { defaultHandyState, importHandyState, type HandyState } from './handyModel';

const HANDY_STATE_KEY = 'handy-actions/state/v1';

export async function loadHandyState(): Promise<HandyState> {
  const raw = await AsyncStorage.getItem(HANDY_STATE_KEY);
  if (!raw) return defaultHandyState();
  return importHandyState(raw);
}

export async function saveHandyState(state: HandyState): Promise<void> {
  await AsyncStorage.setItem(HANDY_STATE_KEY, JSON.stringify(state));
}
