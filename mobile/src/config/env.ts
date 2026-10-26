import { Platform } from 'react-native';

// Physical devices cannot reach "localhost": set EXPO_PUBLIC_API_URL to your
// machine's LAN IP (e.g. http://192.168.1.10:3000/api).
// Android emulator maps the host machine to 10.0.2.2.
const defaultHost = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';

export const env = {
  apiUrl: process.env.EXPO_PUBLIC_API_URL ?? `http://${defaultHost}:3000/api`,
} as const;
