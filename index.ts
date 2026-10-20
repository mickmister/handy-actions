import notifee from '@notifee/react-native';
import { handleNotificationEvent } from './src/core/handyNotifications';

// Register before mounting React so cold-start/background replies are persisted too.
notifee.onBackgroundEvent(handleNotificationEvent);

require('expo-router/entry');
