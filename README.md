# Handy Actions

Local presets with QR, web, deep-link and text-input actions for iOS and Android.

## Lock-screen comparison

In **Settings → Lock-screen experiments**, independently enable **Live Activities**, **Lock Screen Widgets**, and **Preset notification panels**. Live Activities and widgets can be enabled together. Live Activities are on by default; widgets are opt-in. Native text-input notifications are available even when preset notification panels are off.

- **Live Activity:** one per enabled, nonempty preset. The first three actions have individual controls; **All actions** opens the launcher. On iOS 17+, text-input controls use a native intent to post a capture notification without opening Handy Actions. Other actions remain app-opening links. Refreshing ends the previous activities and creates new ones. A 7.5-hour stale date is not an automatic restart; iOS still limits the activity lifetime.
- **Lock Screen Widget:** choose its preset in Settings. Circular/inline open the first action; rectangular exposes the first two. To place it, long-press the iPhone Lock Screen → Customize → Lock Screen → Add Widgets → Handy Actions. It stays placed until you remove it yourself. Disabling it publishes an inactive tile; iOS controls refresh timing.
- **Notifications:** Android exposes three quick actions; iOS exposes two after expanding the notification. The notification body opens all actions in the preset.

After changing presets/actions, use **Refresh lock screen** to republish their content. Surface setting changes apply immediately. Put Add Note first to compare it across all widget sizes and Live Activities.

## Text-input actions

Create a **text-input** action in the Actions tab. **Use this app as destination** fills the current app profile's notes deep link. The URL template is configurable per action, for example `someapp://add-note?text={text}`. `{text}` is replaced with a URL-encoded note; an optional HTTP(S) fallback template can be configured too. Existing actions can be edited.

On iOS 17+, a Live Activity text-input button now targets a **native capture intent**, rather than a deep link. The intent posts the input notification without requesting foreground UI and does not rely on a running React/JS listener. Notification permission must already be granted in the app; the intent does not prompt or silently open the app if permission is denied. The new native flow is a candidate awaiting CI compilation and physical-device proof, not a verified background-delivery guarantee.

Expand the notification and select **Add Note** to type. iOS controls presentation, authentication and expansion; the app cannot force the keyboard open. **Submitting the reply still opens Handy Actions** for the existing durable queue and local/deep-link delivery. Staying on the Lock Screen through local save or a future HTTP/VD send is a separate milestone. The notification body and **All actions → Add Note** offer the existing in-app composer path.

iOS 16 uses the previous app-opening Live Activity link. Lock Screen Widgets retain their existing link flow, are currently excluded from user testing, and were not changed by this capture proof.

Submission is queued locally before launching the destination. **Settings → Notes** lists notes delivered to Handy Actions; **Recover unsent notes** lets you retry failures. Local deliveries and duplicate notification events are deduplicated by submission ID. Successful URL opening means handoff to the destination, not confirmation that an external app saved the note.

### Native capture implementation and device proof

`pnpm-workspace.yaml` pins a patch for `expo-widgets@57.0.22` in `patches/`. It extends the existing `LiveActivityUserInteraction` intent only for versioned `handy-note-capture-v1:` targets. Other Expo button targets keep their original behavior. The target carries a scoped action snapshot; posting does not read app storage. Native code registers the same text-input category and Notifee 9.1.8 notification envelope used by the existing cold-start reply handler. Recheck this contract when upgrading either package. This native patch requires a **new iOS binary**, not just an EAS Update.

After installing that binary, grant notifications, create or use an enabled preset containing a text-input action, and **Refresh lock screen**. No seed data is supplied. Lock the phone, tap the activity's note button and check that the notification appears without the app becoming visible. Repeat with the app backgrounded and terminated, from the banner and expanded Dynamic Island where available. Reply and verify one correctly encoded note reaches the selected destination through the existing foreground flow. Also check multiple presets, repeated capture taps, refresh while a capture is pending, denied notifications, and the explicit composer alternative. Record unlock prompts and OS presentation restrictions separately. Until these checks pass, this is not a proven Lock Screen-only capture flow.

## Live Activity styling

The banner and expanded Island use the installed `@expo/ui/swift-ui` stacks, SF Symbols and rounded action tiles, with a restrained mint accent, a light/dark banner palette and subdued Always-On colors. The small banner has a compact text-only layout. There is no new UI dependency.

SDK 57's widget runtime can render only its supported SwiftUI primitives, not arbitrary React Native component kits or app-level glass views. See [Expo Widgets runtime constraints](https://docs.expo.dev/versions/v57.0.0/sdk/widgets/#the-widget-directive). Layout helpers must stay inside the widget function. The native renderer supports `Button`/`Link`, stacks, spacing and the typography/background modifiers used here. Physical-device review of label clipping, tap targets and Always-On contrast is still needed.

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

The previously reported provisioning blocker for `com.jamtools.handyactions.preview.ExpoWidgetsTarget` was resolved: the user reports a working device build and generally working Live Activity. That predates the native capture patch above. CI-local simulator compilation can validate the new native code without device profiles; the capture proof then needs a fresh signed iOS preview build and physical iPhone validation. Widget device QA remains parked.
