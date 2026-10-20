const { withAppBuildGradle, withGradleProperties } = require('expo/config-plugins');

// Notifee pulls in WorkManager KTX 2.7.1, while Expo uses runtime 2.8.0.
// WorkManager moved Kotlin helpers into runtime in 2.8; upgrade KTX too
// so the Android app does not package those classes twice.
module.exports = function withAndroidBuildCompatibility(config) {
  config = withAppBuildGradle(config, (next) => {
    const dependency = 'implementation("androidx.work:work-runtime-ktx:2.8.0")';
    if (!next.modResults.contents.includes(dependency)) {
      next.modResults.contents += `\n// Keep WorkManager Kotlin helpers compatible with the runtime.\ndependencies {\n    ${dependency}\n}\n`;
    }
    return next;
  });
  return withGradleProperties(config, (next) => {
    // SDK 57's release lint/classpath exceeds the template's Metaspace cap.
    // Fail promptly on exhaustion instead of leaving the Gradle daemon stalled.
    const key = 'org.gradle.jvmargs';
    const value = '-Xmx4096m -XX:MaxMetaspaceSize=2048m -XX:+HeapDumpOnOutOfMemoryError -XX:+ExitOnOutOfMemoryError';
    const existing = next.modResults.find((entry) => entry.type === 'property' && entry.key === key);
    if (existing) existing.value = value;
    else next.modResults.push({ type: 'property', key, value });
    return next;
  });
};
