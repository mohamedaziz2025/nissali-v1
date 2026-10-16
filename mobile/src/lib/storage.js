// Jeton de session dans le trousseau sécurisé (SecureStore) ; données en cache dans AsyncStorage.
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const TOKEN_KEY = 'nissali.token';

export async function getToken() {
  if (Platform.OS === 'web') return AsyncStorage.getItem(TOKEN_KEY);
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setToken(token) {
  if (Platform.OS === 'web') return token ? AsyncStorage.setItem(TOKEN_KEY, token) : AsyncStorage.removeItem(TOKEN_KEY);
  if (token) return SecureStore.setItemAsync(TOKEN_KEY, token);
  return SecureStore.deleteItemAsync(TOKEN_KEY);
}

export async function readJson(key, fallback = null) {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export async function writeJson(key, value) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // stockage plein ou indisponible : on ignore, l'appli reste utilisable
  }
}

export async function clearCache() {
  const keys = await AsyncStorage.getAllKeys();
  await AsyncStorage.multiRemove(keys.filter((k) => k.startsWith('nissali.')));
}
