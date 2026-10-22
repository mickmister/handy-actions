import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AgentSession } from './handyModel';

export type Favorite = { originId: string; session: AgentSession; name: string };
const KEY = 'handy-actions/agent-favorites/v1';
let writes: Promise<unknown> = Promise.resolve();
export async function loadFavorites(): Promise<Favorite[]> { return JSON.parse(await AsyncStorage.getItem(KEY) ?? '[]'); }
export function updateFavorite(favorite: Favorite, remove = false): Promise<void> {
  const next = writes.then(async () => { const all = (await loadFavorites()).filter(f => f.originId !== favorite.originId || f.session.id !== favorite.session.id); if (!remove) all.push(favorite); await AsyncStorage.setItem(KEY, JSON.stringify(all)); });
  writes = next.catch(() => {}); return next;
}
