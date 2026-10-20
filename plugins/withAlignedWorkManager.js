const { withAppBuildGradle } = require('expo/config-plugins');

// Notifee pulls in WorkManager KTX 2.7.1, while Expo uses runtime 2.8.0.
// WorkManager moved Kotlin helpers into runtime in 2.8; upgrade KTX too
// so the Android app does not package those classes twice.
module.exports = function withAlignedWorkManager(config) {
  return withAppBuildGradle(config, (next) => {
    const dependency = 'implementation("androidx.work:work-runtime-ktx:2.8.0")';
    if (!next.modResults.contents.includes(dependency)) {
      next.modResults.contents += `\n// Keep WorkManager Kotlin helpers compatible with the runtime.\ndependencies {\n    ${dependency}\n}\n`;
    }
    return next;
  });
};
