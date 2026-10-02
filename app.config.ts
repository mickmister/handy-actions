import { type ConfigContext, type ExpoConfig } from 'expo/config';

const env = process.env as Record<string, string | undefined>;
const appProfile = env.EXPO_APP_PROFILE || 'development';
const appQualifier = appProfile.includes('production') ? '' : appProfile;
const appQualifierWithDash = appQualifier ? `${appQualifier}-` : '';
const appQualifierWithDot = appQualifier ? `.${appQualifier}` : '';
const version = '0.1.0';
const defaultEasProjectId = '680e1a0b-7078-4fca-8d3d-7afe2e877d9b';

const ids = {
  title: 'Handy Actions',
  slug: 'handy-actions',
  dot: 'com.jamtools.handyactions',
  flat: 'handyactions',
};

export default ({ config }: ConfigContext): ExpoConfig => {
  const easProjectId = env.EXPO_PROJECT_ID || env.EAS_PROJECT_ID || defaultEasProjectId;

  return {
    ...config,
    name: `${appQualifierWithDash}${ids.title}`,
    slug: ids.slug,
    version,
    scheme: `${ids.flat}${appQualifier}`,
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    userInterfaceStyle: 'automatic',
    ios: {
      supportsTablet: true,
      bundleIdentifier: `${ids.dot}${appQualifierWithDot}`,
      buildNumber: version,
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      package: `${ids.dot}${appQualifierWithDot}`,
      adaptiveIcon: {
        backgroundColor: '#E6F4FE',
        foregroundImage: './assets/images/android-icon-foreground.png',
        backgroundImage: './assets/images/android-icon-background.png',
        monochromeImage: './assets/images/android-icon-monochrome.png',
      },
      permissions: ['android.permission.POST_NOTIFICATIONS'],
      predictiveBackGestureEnabled: false,
    },
    web: {
      bundler: 'metro',
      output: 'static',
      favicon: './assets/images/favicon.png',
    },
    updates: {
      url: `https://u.expo.dev/${easProjectId}`,
    },
    plugins: [
      'expo-router',
      [
        'expo-splash-screen',
        {
          image: './assets/images/splash-icon.png',
          resizeMode: 'contain',
          backgroundColor: '#ffffff',
        },
      ],
      [
        'expo-widgets',
        {
          frequentUpdates: true,
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
    },
    runtimeVersion: {
      policy: 'appVersion',
    },
    extra: {
      ...config.extra,
      eas: {
        projectId: easProjectId,
      },
    },
  };
};
