import * as SecureStore from 'expo-secure-store';
import { createThemeRepository, THEME_PREFERENCE_SERVICE } from './themeRepository';

const options = {keychainService: THEME_PREFERENCE_SERVICE, keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY};
export const themePreferences = createThemeRepository({
  getItem: key => SecureStore.getItemAsync(key, options),
  setItem: (key, value) => SecureStore.setItemAsync(key, value, options),
});
