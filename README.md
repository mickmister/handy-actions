# Handy Actions

Local presets with QR, web, deep-link, text-input, HTTP and VD agent actions for iOS and Android.

## Lock-screen comparison

In **Settings → Lock-screen experiments**, independently enable **Live Activities**, **Lock Screen Widgets**, and **Preset notification panels**. Live Activities and widgets can be enabled together. Live Activities are on by default; widgets are opt-in. Native text-input notifications are available even when preset notification panels are off.

- **Live Activity:** on the updated iOS 17+ binary, one shared activity has **Actions** and **Workspaces** views. Actions show up to six controls in a three-column, two-row grid with 44-point-high buttons. Paging is only needed beyond six actions or to move between enabled presets; all actions retain their saved order. A single-page preset omits the page counter. Workspaces pages through all recent active VD workspaces, three per page. Search temporarily uses this same activity. Native input controls post capture notifications without requesting foreground UI; other actions retain app-opening links. Refreshes preserve the selected view, action/workspace pages and active search. iOS controls available height, admission and lifetime. Older iOS keeps in-app/notification action access; the interactive shared activity requires iOS 17+.
- **Lock Screen Widget:** choose its preset in Settings. On iOS 17+, circular and rectangular input buttons use the same native capture intent as Live Activities, posting a notification without requesting foreground UI. The circular widget uses the first action; rectangular exposes the first two. Inline accessories only support a text/link and explicitly show **Open …**; older iOS and non-input controls retain app-opening links. To place a widget, long-press the Lock Screen → Customize → Lock Screen → Add Widgets → Handy Actions. Disabling it publishes an inactive tile; iOS controls placement/refresh timing.
- **Notifications:** Android exposes three quick actions; iOS exposes two after expanding the notification. The notification body opens all actions in the preset.

Saved preset/action/theme/surface/origin changes automatically refresh relevant content. **Refresh lock screen** remains available for explicit renewal. Put Add Note first to compare it across widget sizes and the Actions view.

The Actions grid omits the preset heading and uses a 44-point-high navigation
footer with full-cell buttons. Titled workspace/search/reply views use a
32-point-high footer to fit their content. Flexible width and height constraints
are specified together so button backgrounds and tap areas expand beyond the
text instead of shrinking to the label.

### Shared activity ownership and recent workspaces

`HandyActivityCoordinator` is the single native host owner for creation, updates, navigation and renewal. JavaScript sends configuration/data to protected host storage; native intents and query callbacks use the same serialized lifecycle path. The activity payload contains only the visible page and short revision-checked capture references, with a serialized content budget below ActivityKit’s 4 KB limit. The renderer is `SharedHandyActivity`; the former preset, recent-workspace and search activity renderers are retired. On migration, old Handy Actions-owned activities are ended before the shared one is created. If retirement is incomplete, another activity is not started.

Enable **Settings → Recent VD workspaces**, select a saved origin, then choose **Workspaces** in the shared activity. Tapping a recent workspace resolves its newest-created session and posts a message-input notification naming that destination. Expand it and choose **Add Note** to type/send; short-tap the notification body to open `/workspaces/:workspaceId` in the VD browser. Browser authentication remains separate. The notification snapshot fixes the session while typing. Failed/uncertain sends retain their snapshot-backed editor recovery and draft; their recovery notification opens the editor.

Use **‹ / ›** to browse recent workspaces in descending update order, three per page, with the page number in the heading. The full list stays in protected host storage; only the visible three rows enter ActivityKit. Workspace paging is independent of action/search paging. The workspace page survives same-origin refreshes (including their temporary loading state), resets when the selected origin changes, and clamps to the last valid page when refreshed results shrink. Navigation updates the same activity in place.

Search and workspace selection do not send prompts. Choosing a workspace returns to the previous normal activity view after the message notification is posted. **Back** changes views without cancelling posted drafts. Late query/recent-fetch results update stored data without stealing the selected view. Notifications remain independent of the one-activity policy. At most one active Handy Actions activity is intended per app installation; iOS may dismiss, expire or deny it, so continuous exactly-one visibility is not guaranteed.

### Combined notes and agent replies

In **Notes → Select notes to combine**, select two or more pending notes. Arrange
them, choose a connection/workspace/session, then review and edit the single
message before sending. The initial draft joins original text with blank lines.
The chosen session is fixed while composing. Original notes are retained and
marked addressed together after verified send or queue acceptance, independently
of when the agent finishes. Failures/uncertain sends retain the combined draft and
ordered source links in **Recover unsent notes**. Confirmed acceptance receipts
reconcile local completion and reply-watch binding without resending the prompt.

On the updated native binary, VD agent actions use a bundled solid **robot** glyph
on the shared Live Activity and widget. Ordinary notes retain their note glyph;
workspace search retains its magnifying glass. This needs the signed binary with
the extension font resource; the About commit identifies JavaScript and does not
by itself prove which native patch is installed.

**Replies** is a separately paged section of the canonical Live Activity. Incoming
text updates its unread count without switching away from Actions, Workspaces or
Search. Opening a reply shows a bounded excerpt and up to three complete HTTP(S)
links; **Reply** posts session-specific notification input. A completion/failure/
stopped notification also offers **Reply** when expanded, and its body opens the
VD workspace in the browser. Replies send exactly the entered text to that same
session, without the original action prefix.

Host-only protected `HandyAgentReplies-v1` records retain immediate-send process
IDs and exact destination snapshots. The host reads normalized-log WebSockets for
assistant text and separately verifies process status; Ready, stream closure and
an empty queue never establish completion. Queued-message matching requires a
unique later exact user-message/process match outside the pre-send baseline;
ambiguous, cancelled/replaced or missing matches remain unverified. Local
notifications use stable IDs and durable receipts for normal restart/reconnect
deduplication. Credentials are read from Keychain, redirects/cookies are disabled,
and header values are redacted before excerpts are bounded.

There is no remote push service or VD backend change. Foreground monitoring
reconciles outstanding watches, and background monitoring has a finite UIKit
assertion capped at 25 seconds (or earlier OS expiration); unfinished watches
resume when runtime returns. Live Activities are bounded, pageable snapshots,
not scrolling app screens or an indefinite background runtime. A scheduled
eight-hour job cannot guarantee waking iOS or authorizing activity renewal.
Native compilation and physical Lock Screen validation remain required.

### Manual Live Activity renewal

Every lock-screen update upserts one **Refresh Lock Screen** notification, independently of the preset-panel toggle. Press its body (or expanded Refresh action on iOS) to intentionally open the refresh screen, end the shared activity and start one replacement with a fresh lifetime, update widget/panel content, and repost the control. The selected view/search is retained. Ordinary view/theme/content updates do not reset activity lifetime. Disabled surfaces remain disabled, and capture/recovery notifications are not cleared.

The control uses a stable ID, Android ongoing/non-auto-cancel options, and a retained/reposted iOS notification. iOS does not offer a truly nondismissible notification; if it is dismissed, the next app-requested lock-screen update restores it. Notification permission is required. This is a user-initiated workaround for ActivityKit expiry, not an automatic eight-hour scheduler or a guarantee of unattended renewal.

## Text-input actions

Create a **text-input** action in the Actions tab. **Use this app as destination** fills the current app profile's notes deep link. The URL template is configurable per action, for example `someapp://add-note?text={text}`. `{text}` is replaced with a URL-encoded note. Existing actions can be edited. Deep-link fallback fields and execution have been removed; legacy imports discard those fields. Failed handoffs leave the draft available for explicit recovery.

On iOS 17+, a Live Activity text-input button targets a **native capture intent**, rather than a deep link. The intent posts the input notification without requesting foreground UI and does not rely on a running React/JS listener. Notification permission must already be granted in the app; the intent does not prompt or silently open the app if permission is denied.

For the standard **Use this app** destination, the new implementation keeps both capture and submission free of foreground-app requests: expand the notification, select **Add Note**, type, and save. The native reply callback writes a protected note file before completing, without requiring a JavaScript listener. A generic **Note saved** notification confirms persistence without exposing the note text. When you later open Notes, the app imports that file into the existing local notes store, preserving its text, timestamp and submission ID. Only then is the native file acknowledged/deleted. Replays after an interrupted import cannot create duplicate notes. Local preset-panel replies use the same native saver; after success the panel is reposted with a new submission token for another deliberate reply.

If native saving fails, a **Note not saved** notification retains the text in its data and offers **Retry save** without foregrounding the app. Tap the notification body to edit the original destination/text in the app. Keep that notification until recovery succeeds; dismissing it discards that recovery copy. No automatic retry is scheduled. Blank input does not create a note.

iOS controls presentation, authentication and expansion; the app cannot force the keyboard open or bypass system unlock requirements. Normal note-entry notifications have only the **Add Note** reply action; there is no separate editor button. A short tap on the dedicated notification body opens the snapshot-backed editor, even after editing/deleting the configured action. The editor preserves received text, preset/session context, and subsequent edits in local recovery storage. External deep-link destinations and custom templates that transform text retain their foreground handoff.

iOS can disable empty Send and does not reliably let a background reply foreground the app. If native code receives a whitespace-only reply, it posts an editor continuation notification instead of saving/sending blank text; the user short-taps its body to continue. Continuations do not add editor menu actions. Foreground reply actions enter the editor directly on blank input. Cancel/dismiss events do neither. The single-action expanded input presentation and body-tap fallback still need physical-iPhone validation.

iOS 16 uses app-opening links. The new circular/rectangular widget capture path selects the host-process LiveActivityIntent for versioned Handy capture targets, rather than executing notification scheduling inside the widget extension or relying on React. Other Expo widget targets keep their existing intent. Widget-family behavior while locked/backgrounded/terminated still requires device proof.

Submission is queued locally before launching the destination. **Settings → Notes** lists notes delivered to Handy Actions; **Recover unsent notes** lists pending deliveries and editor drafts. Opening a recovered draft never sends automatically. HTTP/VD attempts are durably marked before sending; uncertain requests require explicit review/retry. Local deliveries and duplicate notification events are deduplicated by submission ID. Successful URL opening means handoff to the destination, not confirmation that an external app saved the note.

## Unaddressed notes inbox

Saved notes appear in **Notes → Unaddressed**. Existing notes without a processing status are treated as unaddressed without changing their IDs, text or original timestamps. Choose **Edit / send to agent** to save changes, select a configured VD action or a connection/session, and review a prefilled prompt in the existing agent editor. Drafts keep the source-note link through cancellation/restart/recovery, use a separate submission ID, and apply the selected action's prefix only once at delivery. Source-linked notes are sent through the editor so source completion remains attached to the handoff.

Confirmed agent send **or queue acceptance automatically marks the source note completed**. Completion means it has been handed off; no wait for agent execution is required. The Completed view retains the note and destination/acceptance details. Manual completion and reopening are available. Failed/cancelled/uncertain sends leave unaddressed notes recoverable and are not retried automatically.

A successful handoff is journaled before updating source status and delivery receipts. If that local update is interrupted, recovery applies the saved confirmation without sending again; replay does not re-complete an explicitly reopened note or overwrite a newer handoff. A process loss before the acceptance receipt can be persisted remains uncertain and requires destination review. Local capture-delivery receipts are separate from inbox completion, and native import replays cannot overwrite later edits/status.

## HTTP connections and actions

In **Settings → Connections**, create a named HTTP(S) origin without a path/query/credentials and add headers. The complete connection lives in Expo SecureStore; iOS uses `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY` so a background reply can access it after the first unlock. Presets, activity/notification snapshots, and exports carry only the connection ID. Imported remote actions need a matching local connection or explicit reconnection in the action editor.

Headers have **plaintext** or **secret** mode. Saved secrets are never prefilled or revealed; leave an existing secret untouched to retain it, enter a replacement, or remove the header. A mode change requires a newly entered value. Submitted secret input is cleared even when saving fails. Normal action-delivery errors omit native error strings and server bodies; VD response strings are scrubbed for saved-secret matches before display.

The origin edit form offers **Test VD Connection**. It makes a read-only, uncached `GET /api/workspaces` using the current form, resolving unchanged saved secrets in memory and including unsaved header edits/replacements. It also works for a new connection before saving and does not persist test edits. Success requires a VD success envelope with a workspace list. Failures show HTTP status, useful authentication/request-ID response headers, server response/error details, unexpected JSON/HTML, or network/TLS/timeout messages when available. Secret header values, authorization credentials without their scheme, and URL/JSON-escaped forms are redacted before display/truncation. Redirects remain refused and the 20-second deadline/no-retry policy still applies. Test details are selectable in the form; no diagnostic output is logged.

An **http** action selects a connection and relative `/path`, method (GET/POST/PUT/PATCH/DELETE), and optional JSON or text body. GET has no body. Enable text capture to substitute `{text}` in a URL path/query or string values in structured JSON/text bodies. URL substitutions are percent-encoded; JSON values are escaped via serialization. Paths cannot change origin, redirects are refused, browser cookies/credentials are omitted, and transport/system network policies still apply. Success is an accepted 2xx response; failures retain the draft and never schedule automatic retry. Foreground requests time out after 20 seconds.

## Send to VD agent

A **vd-agent** action shares those secure connections. Browse nonarchived/nondeleted workspaces ordered by recent update, then select a named session (creation time if unnamed) with its executor. Pin multiple sessions with custom aliases; favorites are scoped to the connection. Leave the action unlocked to choose a session for every fresh send, or explicitly select an action-level locked session. A missing/changed session or executor fails with the prompt retained; no alternate session is chosen automatically.

Each action captures fresh nonblank text. Its optional prefix is stored separately and composed as `prefix + "\n" + text` once per send/queue operation. **Insert tag** loads `/api/tags` and inserts the selected tag's `content` at the cursor/selection, matching VK's own editor rather than inventing an `@tag` syntax.

Delivery verifies `/api/sessions/{id}`, reads `/queue`, and checks `/conversation-preview?limit=1`. Idle agents receive `/follow-up` with `executor_config`; busy agents receive `/queue`. Existing queued content requires explicit **Append** or **Overwrite** in the editor. Append adds a newline plus the new prefixed prompt without re-prefixing old content. A queue containing redacted connection data cannot be appended safely; overwrite remains explicit. The queue is re-read before writing. **The current VD API has no atomic append/CAS**, so a final interclient race remains possible; no atomicity is claimed.

### Search VD workspaces from the Lock Screen

Add a **VD workspace search** (`vd-workspace-search`) action to an enabled preset and choose its saved VD origin. On the updated iOS 17+ binary:

1. Tap the search action in the preset Live Activity (or circular/rectangular widget).
2. Expand **Search VD workspaces**, choose **Search workspaces**, type a workspace-name query (up to 80 characters), and confirm **Search**.
3. Choose a matching workspace in the **Search** view of the same shared activity. Results are case-insensitive name matches, exclude archived/deleted workspaces, sort by recent workspace update, and show three per page with previous/next, **Back**, and **Search** controls.
4. Expand the new message notification. Its title identifies the workspace and newest-created session. Select **Add Note**, write the prompt, and send. This uses the existing native session-locked VD send/queue and draft-recovery behavior, without a prompt prefix.

Selecting a workspace does not send a prompt. The newest session is resolved at selection time by `created_at`, then stays fixed in the notification snapshot; a newer session appearing while typing does not silently retarget the message. A workspace without a session, or whose newest session has no executor, reports an error rather than selecting an older destination. After posting the notification, the activity returns to the previous normal view. Short-tap the message notification to open the workspace in the browser; search again to choose another workspace.

Search switches/reuses the shared activity from a foreground or eligible LiveActivityIntent entry point **before** notification submission; the native query callback only updates existing activity/search data. Protected on-device search records support cold-start intents and stale-result rejection. Network access and Keychain credentials stay in the host app. Search/selection use bounded, cancellable UIKit background tasks, not a persistent background service. Activity admission, authentication, keyboard/menu behavior and presentation remain controlled by iOS. Ordinary preset-notification search input uses the foreground composer fallback; use the Live Activity/widget button for the native Lock Screen flow. Older binaries show an explicit native-build requirement.

This changes the pinned ExpoWidgets native patch and requires a **fresh signed iOS build**; an OTA alone cannot install the feature. Native compilation and physical locked/background/cold-start behavior must be verified on that build.

### Native background request candidate

On a binary containing the new APIs, nonempty HTTP input replies and session-locked VD replies use non-foreground categories. Notifee invokes the ExpoWidgets host-side Swift helper directly, without waiting for React. The helper journals a protected record and durable duplicate-callback claim before requests, resolves headers from the host app's Keychain, refuses redirects, and uses an ephemeral URLSession with a bounded 20-second overall request window. Credentials are never copied into activity targets or notifications.

Native VD delivery verifies the locked session and queues only when there is no existing queued content. Existing/changed queues, unavailable credentials, timeouts, and errors retain the prompt in a recovery notification; short-tap its body for editor review/Append/Overwrite. Unlocked VD replies deliberately open the editor for session selection. Native successes produce generic confirmation and restore preset panels with a fresh submission token. Finished native records import into pending/completed receipts before acknowledgement; a killed in-flight request becomes an uncertain recovery draft after its execution window. Small native claim tombstones remain after import to suppress late duplicate callbacks. Native notification-category changes require a fresh iOS binary and device verification.

### Native capture implementation and device proof

`pnpm-workspace.yaml` pins patches for `expo-widgets@57.0.22` and `@notifee/react-native@9.1.8` in `patches/`:

- ExpoWidgets extends its existing `LiveActivityUserInteraction` intent for versioned `handy-note-capture-v1:`, `handy-workspace-search-v1:` and `handy-activity-v1:` targets. Shared activity controls resolve short references through protected host configuration; capture notifications retain scoped action snapshots. Other Expo targets keep their original behavior. Local saves and eligible network replies use separate non-foreground categories; external destinations and unlocked session selection retain foreground handoff.
- Notifee intercepts only marked local reply/retry actions, including eligible preset-panel replies. It atomically writes one JSON record per submission under Application Support/HandyActionsNoteInbox, with `CompleteUntilFirstUserAuthentication` file protection. Filenames are SHA-256 hashes of submission IDs, not user input. Duplicate callbacks do not overwrite an existing native record. After a reboot, protected storage is only available after the first unlock.
- ExpoWidgets exposes read/ack APIs for that inbox; JS imports into the existing repository only when Notes is loaded. Network drafts/receipts use a separate `HandyActionsActionInbox`, imported on app activation and recovery-screen access. Absent APIs in an older binary disable the corresponding non-foreground categories. Tests cover destination isolation, exact snapshot/text/time recovery, uncertain attempts, concurrent imports and interruption before acknowledgement. This is not a substitute for testing the native callback on iPhone.

Recheck these versioned category, metadata, envelope and file-format contracts when upgrading either package. Both native patches require a **new iOS binary**, not just an EAS Update.

After installing the new binary, grant notifications, create or use an enabled preset containing a text-input action with **Use this app**, and **Refresh lock screen**. No seed data is supplied. Lock the phone, tap the activity's note button, expand its notification and save a unique note. Neither posting nor saving should display Handy Actions. Repeat with the app backgrounded and terminated, from the banner and expanded Dynamic Island where available. Then deliberately open Notes: each note should appear once with its exact original text/time, including Unicode, punctuation and newlines. Restart and verify no duplicates.

Also check local preset-panel replies, multiple presets, blank/cancel, repeated capture taps, refresh while capture is pending, denied notification permission and the explicit composer alternative. Test circular/rectangular native widget capture and inline app-opening fallback separately. Verify manual renewal after actual ActivityKit expiry and that the refresh control survives/reposts without erasing capture notifications. Native storage-failure/retry needs an injected failure or a controlled device test; JS import-failure tests alone do not establish native recovery. Record unlock prompts and OS restrictions separately. Until native build and device checks pass, this is not a proven whole-flow Lock Screen implementation.

## App and Live Activity styling

**Settings → App & Live Activity theme** previews and persists a global **Psychedelic** (default), **Midnight**, or **Paper** palette. The saved choice controls every app screen, navigation headers/tabs, status bar, forms, switches, note/session editors, recovery views, and glass panels. Psychedelic and Midnight use dark native chrome; Paper uses light chrome, independently of the device appearance. QR codes keep a white scan area and dark ink in every theme.

App semantic color tokens live in `src/core/appTheme.ts`; use `useAppTheme()` for inline colors and `useThemeStyles()` for memoized style factories. Shared form/note styles expose `useFormStyles()` and `useNoteStyles()`. New UI should use these tokens rather than fixed colors. Contrast tests cover text, placeholders, selected controls, status labels, code blocks, QR codes, and theme previews across all three palettes.

Live Activity gradient definitions live in `src/core/handyThemes.ts`. The banner uses a native linear gradient; expanded Island content and compact accents use the selected palette with contrasting action tiles. Always-On uses a subdued solid appearance. Themes update existing tracked activities without end/restart churn or altering action destinations.

For visual verification, select each theme and visit all three tabs, preset actions, QR display, connections, capture/session selection, notes, and recovery. Check selected/unselected controls and input focus, then relaunch to confirm the choice persists. App theming is a source-only change using existing dependencies and can ship through EAS Update to a compatible installed runtime.

Psychedelic color ordering changes on app-requested content refreshes. The installed runtime supports gradients, but this implementation does not use continuous animation, JS timers, or unattended background color cycling. There is no repeating motion to suppress for Reduce Motion. Actual color transitions, Always-On readability, and Reduce Motion appearance still require an iPhone proof; continuous animated Lock Screen support is **not** established.

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

Runtime versions use Expo's native fingerprint policy so updates with different native requirements do not reach incompatible older binaries. This change adds SecureStore and changes native patches, so it requires a fresh remote EAS build rather than EAS Update. Run `pnpm test`, `pnpm run typecheck`, and `pnpm install --frozen-lockfile` for local checks. A Metro iOS export checks JS bundling, not Swift/Objective-C compilation or locked-device behavior.

The provisioning blocker for `com.jamtools.handyactions.preview.ExpoWidgetsTarget` was resolved. Capture/styling preview [39813292716](https://github.com/mickmister/handy-actions/actions/runs/39813292716) succeeded at `49a35a8`, and native local-save preview [39816893707](https://github.com/mickmister/handy-actions/actions/runs/39816893707) succeeded at `c43d18b`. Neither contains the subsequent secure connections, HTTP/VD integration, editor fallback, selectable themes, widget capture parity, manual renewal or notes inbox. Those changes need fresh native compilation and a signed preview, followed by physical iPhone validation.
