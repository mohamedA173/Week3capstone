import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Coordinates, CalculationMethod, PrayerTimes } from 'adhan';

const NAMES = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const;
type Name = (typeof NAMES)[number];
type Status = 'prayed' | 'missed';

const FALLBACK = { latitude: 44.98, longitude: -93.27, label: 'Minneapolis (default)' };

const dayKey = (d: Date) =>
  `log-${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

const fmt = (d: Date) =>
  d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

const countdown = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}h ${m}m ${sec}s`;
};

export default function App() {
  const [coords, setCoords] = useState(FALLBACK);
  const [now, setNow] = useState(new Date());
  const [logs, setLogs] = useState<Partial<Record<Name, Status>>>({});

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const pos = await Location.getCurrentPositionAsync({});
          setCoords({
            latitude: Number(pos.coords.latitude.toFixed(2)),
            longitude: Number(pos.coords.longitude.toFixed(2)),
            label: 'Your location',
          });
        }
      } catch (e) {
        // if location fails, we just keep the default city
      }
      const saved = await AsyncStorage.getItem(dayKey(new Date()));
      if (saved) setLogs(JSON.parse(saved));
    })();

    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const c = new Coordinates(coords.latitude, coords.longitude);
  const params = CalculationMethod.NorthAmerica();
  const today = new PrayerTimes(c, now, params);

  let next = { name: 'fajr' as string, time: new Date(0) };
  let found = false;
  for (const n of NAMES) {
    if (today[n] > now) {
      next = { name: n, time: today[n] };
      found = true;
      break;
    }
  }
  if (!found) {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    next = { name: 'fajr', time: new PrayerTimes(c, tomorrow, params).fajr };
  }

  const logPrayer = async (name: Name, status: Status) => {
    const updated = { ...logs, [name]: status };
    setLogs(updated);
    await AsyncStorage.setItem(dayKey(now), JSON.stringify(updated));
  };

  const prayedCount = NAMES.filter((n) => logs[n] === 'prayed').length;

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>SalahNow</Text>
      <Text style={styles.sub}>{coords.label}</Text>

      <View style={styles.nextBox}>
        <Text style={styles.nextLabel}>Next prayer</Text>
        <Text style={styles.nextName}>
          {next.name.charAt(0).toUpperCase() + next.name.slice(1)} at {fmt(next.time)}
        </Text>
        <Text style={styles.nextCount}>in {countdown(next.time.getTime() - now.getTime())}</Text>
      </View>

      <Text style={styles.goal}>Prayed today: {prayedCount} / 5</Text>

      {NAMES.map((n) => (
        <View key={n} style={styles.row}>
          <View>
            <Text style={styles.prayerName}>{n.charAt(0).toUpperCase() + n.slice(1)}</Text>
            <Text style={styles.prayerTime}>{fmt(today[n])}</Text>
          </View>
          <View style={styles.buttons}>
            <TouchableOpacity
              style={[styles.btn, logs[n] === 'prayed' && styles.btnPrayed]}
              onPress={() => logPrayer(n, 'prayed')}
            >
              <Text style={styles.btnText}>Prayed</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, logs[n] === 'missed' && styles.btnMissed]}
              onPress={() => logPrayer(n, 'missed')}
            >
              <Text style={styles.btnText}>Missed</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 20, paddingTop: 60 },
  title: { fontSize: 28, fontWeight: '700', color: '#0b6b5c' },
  sub: { color: '#666', marginBottom: 16 },
  nextBox: { backgroundColor: '#e6f4f1', borderRadius: 12, padding: 16, marginBottom: 16 },
  nextLabel: { color: '#0b6b5c' },
  nextName: { fontSize: 22, fontWeight: '600' },
  nextCount: { fontSize: 18, marginTop: 4 },
  goal: { fontSize: 16, marginBottom: 8 },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#eee',
  },
  prayerName: { fontSize: 18, fontWeight: '600' },
  prayerTime: { color: '#666' },
  buttons: { flexDirection: 'row', gap: 8 },
  btn: { backgroundColor: '#ddd', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
  btnPrayed: { backgroundColor: '#8fd3b6' },
  btnMissed: { backgroundColor: '#f0b0b0' },
  btnText: { fontWeight: '500' },
});