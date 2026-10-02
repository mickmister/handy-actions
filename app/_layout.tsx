import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/components/useColorScheme';
import {
  configureNotificationSurface,
  consumeInitialNotification,
  registerNotificationEvents,
  setNotificationPressHandler,
} from '@/src/core/handyNotifications';
import { HandyStateProvider } from '@/src/hooks/HandyStateProvider';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: '(tabs)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const router = useRouter();

  useEffect(() => {
    setNotificationPressHandler((target) => {
      if (target.type === 'preset') {
        router.push({ pathname: '/preset-actions', params: { presetId: target.presetId } });
        return;
      }
      if (target.action.payload.type === 'qr') {
        router.push({ pathname: '/qr', params: { title: target.action.name, value: target.action.payload.value } });
      }
    });

    void configureNotificationSurface();
    void consumeInitialNotification();
    return registerNotificationEvents();
  }, [router]);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <HandyStateProvider>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="qr" options={{ presentation: 'modal', title: 'QR Code' }} />
          <Stack.Screen name="preset-actions" options={{ presentation: 'modal', title: 'Preset Actions' }} />
        </Stack>
      </HandyStateProvider>
    </ThemeProvider>
  );
}
