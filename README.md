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

On iOS 17+, a Live Activity text-input button targets a **native capture intent**, rather than a deep link. The intent posts the input notification without requesting foreground UI and does not rely on a running React/JS listener. Notification permission must already be granted in the app; the intent does not prompt or silently open the app if permission is denied.

For the standard **Use this app** destination, the new implementation keeps both capture and submission free of foreground-app requests: expand the notification, select **Add Note**, type, and save. The native reply callback writes a protected note file before completing, without requiring a JavaScript listener. A generic **Note saved** notification confirms persistence without exposing the note text. When you later open Notes, the app imports that file into the existing local notes store, preserving its text, timestamp and submission ID. Only then is the native file acknowledged/deleted. Replays after an interrupted import cannot create duplicate notes. Local preset-panel replies use the same native saver; after success the panel is reposted with a new submission token for another deliberate reply.

If native saving fails, a **Note not saved** notification retains the text in its data and offers **Retry save** without foregrounding the app. Keep that notification until retry succeeds; dismissing it discards that recovery copy. No automatic retry is scheduled. Blank input does not create a note.

iOS controls presentation, authentication and expansion; the app cannot force the keyboard open or bypass system unlock requirements. The full local-save flow is an implementation candidate requiring a **new binary, native compilation and physical-device validation**. External deep-link destinations and custom templates that transform the note text retain the foreground handoff. HTTP/VD background delivery is not implemented. The notification body and **All actions → Add Note** remain explicit app-opening composer alternatives.

iOS 16 uses the previous app-opening Live Activity link. Lock Screen Widgets retain their existing link flow, are currently excluded from user testing, and were not changed by this capture proof.

Submission is queued locally before launching the destination. **Settings → Notes** lists notes delivered to Handy Actions; **Recover unsent notes** lets you retry failures. Local deliveries and duplicate notification events are deduplicated by submission ID. Successful URL opening means handoff to the destination, not confirmation that an external app saved the note.

### Native capture implementation and device proof

`pnpm-workspace.yaml` pins patches for `expo-widgets@57.0.22` and `@notifee/react-native@9.1.8` in `patches/`:

- ExpoWidgets extends its existing `LiveActivityUserInteraction` intent only for versioned `handy-note-capture-v1:` targets. The target carries a scoped action snapshot and an explicit local-save flag. Other targets keep their original behavior. Local capture uses a separate non-foreground category; external destinations retain the foreground category.
- Notifee intercepts only marked local reply/retry actions, including eligible preset-panel replies. It atomically writes one JSON record per submission under Application Support/HandyActionsNoteInbox, with `CompleteUntilFirstUserAuthentication` file protection. Filenames are SHA-256 hashes of submission IDs, not user input. Duplicate callbacks do not overwrite an existing native record. After a reboot, protected storage is only available after the first unlock.
- ExpoWidgets exposes read/ack APIs for that inbox; JS imports into the existing repository only when Notes is loaded. An absent API in an older binary disables local non-foreground categories. Tests cover destination isolation, exact snapshot/text/time recovery, concurrent imports and interruption before acknowledgement. This is not a substitute for testing the native callback on iPhone.

Recheck these versioned category, metadata, envelope and file-format contracts when upgrading either package. Both native patches require a **new iOS binary**, not just an EAS Update.

After installing the new binary, grant notifications, create or use an enabled preset containing a text-input action with **Use this app**, and **Refresh lock screen**. No seed data is supplied. Lock the phone, tap the activity's note button, expand its notification and save a unique note. Neither posting nor saving should display Handy Actions. Repeat with the app backgrounded and terminated, from the banner and expanded Dynamic Island where available. Then deliberately open Notes: each note should appear once with its exact original text/time, including Unicode, punctuation and newlines. Restart and verify no duplicates.

Also check local preset-panel replies, multiple presets, blank/cancel, repeated capture taps, refresh while capture is pending, denied notification permission and the explicit composer alternative. Native storage-failure/retry needs an injected failure or a controlled device test; JS import-failure tests alone do not establish native recovery. External destinations should still foreground rather than silently saving locally. Record unlock prompts and OS restrictions separately. Lock Screen Widget testing remains parked. Until native build and device checks pass, this is not a proven whole-flow Lock Screen implementation.

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

The previously reported provisioning blocker for `com.jamtools.handyactions.preview.ExpoWidgetsTarget` was resolved. The capture/styling preview workflow [39813292716](https://github.com/mickmister/handy-actions/actions/runs/39813292716) succeeded at `49a35a8`. That build still foregrounds on reply and does **not** contain the new native local-save changes described above. Those need fresh native compilation and a signed iOS preview build, followed by physical iPhone validation. Widget device QA remains parked.
