import { Stack, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

export default function QrScreen() {
  const params = useLocalSearchParams<{ title?: string; value?: string }>();
  const title = String(params.title ?? 'QR Code');
  const value = String(params.value ?? '');

  return (
    <>
      <Stack.Screen options={{ title }} />
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>Ready to scan</Text>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.qrCard}>
          {value ? <QRCode value={value} size={260} backgroundColor="#ffffff" color="#0f172a" /> : <Text>No QR value.</Text>}
        </View>
        <Text selectable style={styles.value}>
          {value}
        </Text>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f5f7fb' },
  content: { alignItems: 'center', gap: 18, padding: 22, paddingBottom: 50 },
  eyebrow: { alignSelf: 'flex-start', color: '#53657d', fontSize: 13, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
  title: { alignSelf: 'flex-start', color: '#0f172a', fontSize: 30, fontWeight: '800', letterSpacing: -0.6 },
  qrCard: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderColor: '#e5e9f0',
    borderRadius: 28,
    borderWidth: 1,
    justifyContent: 'center',
    padding: 24,
    width: '100%',
  },
  value: { color: '#475569', fontSize: 15, lineHeight: 22, textAlign: 'center' },
});
