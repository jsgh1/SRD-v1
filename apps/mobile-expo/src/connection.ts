import * as SecureStore from 'expo-secure-store';
import {Platform} from 'react-native';

type SavedConnection = {origin: string; code: string};
const connectionKey = 'srd.connection.v1';

export const connectionStore = {
  async load(): Promise<SavedConnection> {
    if (Platform.OS === 'web') return {origin: '', code: ''};
    const value = await SecureStore.getItemAsync(connectionKey);
    if (!value) return {origin: '', code: ''};
    try {
      const saved: unknown = JSON.parse(value);
      if (saved && typeof saved === 'object' &&
          'origin' in saved && typeof saved.origin === 'string' &&
          'code' in saved && typeof saved.code === 'string') {
        return {origin: saved.origin, code: saved.code};
      }
    } catch {
      // Ignore a damaged local preference and show the connection form again.
    }
    return {origin: '', code: ''};
  },
  save(origin: string, code: string): Promise<void> {
    if (Platform.OS === 'web') return Promise.resolve();
    return SecureStore.setItemAsync(connectionKey, JSON.stringify({origin, code}));
  },
  clear(): Promise<void> {
    if (Platform.OS === 'web') return Promise.resolve();
    return SecureStore.deleteItemAsync(connectionKey);
  },
};
