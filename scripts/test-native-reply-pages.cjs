const { spawnSync } = require('node:child_process');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');

if (process.env.EAS_BUILD_PLATFORM === 'android') process.exit(0);
if (process.platform !== 'darwin') {
  console.log('Native storage/layout tests require macOS; they run during the iOS EAS build.');
  process.exit(process.env.EAS_BUILD_PLATFORM === 'ios' ? 1 : 0);
}
const folder = mkdtempSync(path.join(tmpdir(), 'handy-reply-pages-'));
const binary = path.join(folder, 'reply-pages-tests');
try {
  for (const [source, tests] of [
    ['HandyReplyTextPages.swift', 'ReplyTextPagesTests.swift'],
    ['HandyReminderRecord.swift', 'ReminderRecordTests.swift'],
    ['HandySettingsRecovery.swift', 'SettingsRecoveryTests.swift'],
  ]) {
    for (const [command, args] of [
      ['xcrun', ['--sdk', 'macosx', 'swiftc', `node_modules/expo-widgets/ios/${source}`, `test/native/${tests}`, '-o', binary]],
      [binary, []],
    ]) {
      const result = spawnSync(command, args, { stdio: 'inherit' });
      if (result.error) throw result.error;
      if (result.status !== 0) process.exitCode = result.status || 1;
      if (process.exitCode) break;
    }
    if (process.exitCode) break;
  }
  if (!process.exitCode) {
    const source = 'node_modules/@react-native-async-storage/async-storage/apple/legacy_storage';
    for (const [command, args] of [
      ['xcrun', ['--sdk', 'macosx', 'clang', '-fobjc-arc', '-fblocks', '-framework', 'Foundation', '-I', source, `${source}/HandyPersistentSettings.m`, 'test/native/PersistentSettingsTests.m', '-o', binary]],
      [binary, []],
    ]) {
      const result = spawnSync(command, args, { stdio: 'inherit' });
      if (result.error) throw result.error;
      if (result.status !== 0) process.exitCode = result.status || 1;
      if (process.exitCode) break;
    }
  }
} finally {
  rmSync(folder, { recursive: true, force: true });
}
