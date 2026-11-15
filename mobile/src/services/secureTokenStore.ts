import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

let SecureStoreModule: {
  getItemAsync?: (key: string) => Promise<string | null>;
  setItemAsync?: (key: string, value: string) => Promise<void>;
  deleteItemAsync?: (key: string) => Promise<void>;
} | null = null;

try {
  // Dynamically require expo-secure-store on native iOS/Android
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  SecureStoreModule = require('expo-secure-store');
} catch {
  SecureStoreModule = null;
}

const TOKEN_KEY = 'foodies_secure_auth_token';

export async function saveSecureAuthToken(token: string): Promise<void> {
  if (Platform.OS !== 'web' && SecureStoreModule?.setItemAsync) {
    try {
      await SecureStoreModule.setItemAsync(TOKEN_KEY, token);
      return;
    } catch {
      // Fallback if device keychain unavailable
    }
  }
  await AsyncStorage.setItem(TOKEN_KEY, token);
}

export async function getSecureAuthToken(): Promise<string | null> {
  if (Platform.OS !== 'web' && SecureStoreModule?.getItemAsync) {
    try {
      return await SecureStoreModule.getItemAsync(TOKEN_KEY);
    } catch {
      // Fallback
    }
  }
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function clearSecureAuthToken(): Promise<void> {
  if (Platform.OS !== 'web' && SecureStoreModule?.deleteItemAsync) {
    try {
      await SecureStoreModule.deleteItemAsync(TOKEN_KEY);
    } catch {}
  }
  await AsyncStorage.removeItem(TOKEN_KEY);
}

