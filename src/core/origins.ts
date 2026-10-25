import * as SecureStore from 'expo-secure-store';
import { createOriginRepository, ORIGIN_SERVICE } from './originRepository';
import { notifyOriginChanged } from './originChanges';

const options = { keychainService: ORIGIN_SERVICE, keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };
export const origins = createOriginRepository({
  getItem: key => SecureStore.getItemAsync(key, options),
  setItem: (key, value) => SecureStore.setItemAsync(key, value, options),
  removeItem: key => SecureStore.deleteItemAsync(key, options),
}, notifyOriginChanged);
