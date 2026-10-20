# Handy Actions

Local presets with QR, web, deep-link and text-input actions for iOS and Android.

## Lock-screen comparison

In **Settings → Lock-screen experiments**, independently enable **Live Activities**, **Lock Screen Widgets**, and **Preset notification panels**. Live Activities and widgets can be enabled together. Live Activities are on by default; widgets are opt-in. Native text-input notifications are available even when preset notification panels are off.

- **Live Activity:** one per enabled, nonempty preset. The first three actions have individual links; **All actions** opens the launcher. Refreshing ends the previous activities and creates new ones. A 7.5-hour stale date is not an automatic restart; iOS still limits the activity lifetime.
- **Lock Screen Widget:** choose its preset in Settings. Circular/inline open the first action; rectangular exposes the first two. To place it, long-press the iPhone Lock Screen → Customize → Lock Screen → Add Widgets → Handy Actions. It stays placed until you remove it yourself. Disabling it publishes an inactive tile; iOS controls refresh timing.
- **Notifications:** Android exposes three quick actions; iOS exposes two after expanding the notification. The notification body opens all actions in the preset.

After changing presets/actions, use **Refresh lock screen** to republish their content. Surface setting changes apply immediately. Put Add Note first to compare it across all widget sizes and Live Activities.

## Text-input actions

Create a **text-input** action in the Actions tab. **Use this app as destination** fills the current app profile's notes deep link. The URL template is configurable per action, for example `someapp://add-note?text={text}`. `{text}` is replaced with a URL-encoded note; an optional HTTP(S) fallback template can be configured too. Existing actions can be edited.

Tapping a text-input action in a Live Activity/widget opens Handy Actions and posts a notification with native input. Expand the notification and select **Add Note** to type and submit. iOS does not let the app automatically expand the notification keyboard. The app also provides a composer when notification input is inconvenient or permission is denied. This implementation uses action-specific links, so opening/unlocking the host app is part of the flow.

Submission is queued locally before launching the destination. **Settings → Notes** lists notes delivered to Handy Actions; **Recover unsent notes** lets you retry failures. Local deliveries and duplicate notification events are deduplicated by submission ID. Successful URL opening means handoff to the destination, not confirmation that an external app saved the note.

## Validation and releases

Expo compilation runs in GitHub Actions, not on the developer machine:

| Change / goal | Workflow | Execution |
| --- | --- | --- |
| Validate compilation | `validate_mobile` | Typecheck, unit tests, then `eas build --local` on CI runners: arm64 iOS simulator on macOS 26/Xcode 26.6, arm64 Android release APK on Ubuntu. Runs on pushes, same-repository PRs and manual dispatch. |
| New RN dependency, native code or native configuration | `build_mobile`, `run_on_eas=true` | Remote EAS build. Use iOS `preview`, `submit=false` for ad hoc device testing. |
| Source/assets only, compatible native runtime | `update_mobile` | EAS Update to the installed build's channel/runtime. |

`build_mobile` also supports `run_on_eas=false` for CI-runner builds; iOS uses macOS, and `all` is split into individual builds. Both release workflows already include typecheck and unit tests. `EXPO_TOKEN` must be configured in GitHub secrets. Validation simulator/unsigned Android builds do not require device-distribution signing credentials.

Validation compiles one architecture per platform to keep feedback practical; remote release profiles retain their normal architecture selection. The Android config plugin aligns WorkManager KTX with Expo/Notifee's runtime and raises Gradle's Metaspace limit after a confirmed release-lint memory failure.

Runtime versions use Expo's native fingerprint policy so updates with different native requirements do not reach incompatible older binaries. The first fingerprint-policy release requires a fresh binary. This widget release changes native extension configuration and therefore needs a remote EAS build, even though no RN dependency was added.

The last device-build blocker was remote provisioning for `com.jamtools.handyactions.preview.ExpoWidgetsTarget`. Complete interactive EAS credential setup for that extension before the preview device build. CI-local simulator compilation can validate code without that device profile. iPhone tests must still verify individual links, notification reply input, locked/unlocked/cold-start behavior, and Live Activity/widget coexistence.
