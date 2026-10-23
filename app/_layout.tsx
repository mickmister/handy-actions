import { useFonts } from 'expo-font';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import 'react-native-reanimated';

import { useColorScheme } from '@/components/useColorScheme';
import {
  configureNotificationSurface,
  consumeInitialNotification,
  registerNotificationEvents,
  setNotificationPressHandler,
} from '@/src/core/handyNotifications';
import { HandyStateProvider } from '@/src/hooks/HandyStateProvider';
import { importCapturedActions } from '@/src/core/handyNotes';
import { saveEditorDraft } from '@/src/core/editorDrafts';

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
    ...FontAwesome6.font,
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
  const routedSubmissions = useRef(new Set<string>());

  useEffect(() => {
    setNotificationPressHandler((target) => {
      if(target.type==='refresh') {
        const key=`refresh:${target.token}`;
        if(routedSubmissions.current.has(key))return;
        routedSubmissions.current.add(key);
        router.push({pathname:'/refresh-lock-screen',params:{token:target.token}});
        return;
      }
      if (target.type === 'input') {
        if (routedSubmissions.current.has(target.submissionId)) return;
        routedSubmissions.current.add(target.submissionId);
        router.push({ pathname: '/capture', params: { submissionId: target.submissionId, submit: target.submit?'1':'0' } });
        return;
      }
      if(target.type==='editor') {
        router.push({pathname:'/capture',params:{draftId:target.draftId}});
        return;
      }
      if (target.type === 'preset') {
        router.push({ pathname: '/preset-actions', params: { presetId: target.presetId } });
        return;
      }
      if (target.action.payload.type === 'qr') {
        router.push({ pathname: '/qr', params: { title: target.action.name, value: target.action.payload.value } });
      }
      if (target.action.payload.type !== 'qr') {
        void saveEditorDraft(target.action,'',target.presetId).then(draft=>router.push({pathname:'/capture',params:{draftId:draft.id,submit:'1'}})).catch(console.warn);
      }
    });

    void configureNotificationSurface().catch(console.warn);
    void consumeInitialNotification().catch(console.warn);
    void importCapturedActions().catch(console.warn);
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void importCapturedActions().catch(console.warn);
    });
    const unsubscribe = registerNotificationEvents();
    return () => { unsubscribe(); appStateSubscription.remove(); };
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
