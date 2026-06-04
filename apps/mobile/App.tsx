import { StatusBar } from 'expo-status-bar'
import { StyleSheet, Text, View } from 'react-native'

// Phase 0 placeholder. The real worker + kiosk surfaces (clock-in modes, geofenced remote
// clock, NFC, offline outbox) are built via Archon and require a dev-build (not Expo Go).
export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.brand}>
        takt<Text style={styles.tick}>.</Text>
      </Text>
      <Text style={styles.clock}>07:42:18</Text>
      <Text style={styles.sub}>Worker + kiosk app · Phase 0 scaffold</Text>
      <StatusBar style="dark" />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FBFAF8',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  brand: { fontSize: 34, fontWeight: '600', color: '#1A1916' },
  tick: { color: '#E8590C' },
  clock: { fontSize: 48, fontVariant: ['tabular-nums'], color: '#1A1916' },
  sub: { fontSize: 13, color: '#6B675E' },
})
