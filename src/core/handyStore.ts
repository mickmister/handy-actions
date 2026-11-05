import AsyncStorage from '@react-native-async-storage/async-storage';

import { type HandyState } from './handyModel';
import { createHandyStateRepository } from './handyStateRepository';

export const handyStateRepository = createHandyStateRepository(AsyncStorage);

export async function loadHandyState(): Promise<HandyState> {
  return handyStateRepository.load();
}

export async function saveHandyState(state: HandyState): Promise<void> {
  await handyStateRepository.update(() => state);
}
