import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { getHealth, type HealthResponse } from '@/services/health.service';

export default function HomeScreen() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getHealth()
      .then(setHealth)
      .catch((err: Error) => setError(err.message));
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Clinic Booking</Text>
      <Text>
        API status: {error ? `error (${error})` : (health?.status ?? 'checking...')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  title: { fontSize: 24, fontWeight: '700' },
});
