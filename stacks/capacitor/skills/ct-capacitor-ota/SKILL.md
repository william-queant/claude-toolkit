---
name: ct-capacitor-ota
description: Capacitor 8 native runtime and Capgo OTA live updates — channels, encryption, staged rollouts, and store-safe over-the-air delivery
---

# Capacitor OTA (Capgo) Patterns

Ship JavaScript, HTML, and CSS changes to installed apps in minutes instead of waiting days for app store review. Capgo's `@capgo/capacitor-updater` swaps the web bundle the native shell loads; native code still ships through the stores.

**Golden rule:** OTA updates only the **web layer**. Anything that changes native code (new plugin, native dependency, Capacitor major bump) requires a new store binary. Never OTA a bundle whose native contract differs from the installed shell.

## Versions (as of June 2026)

| Package                    | Version  | Notes                                                       |
| -------------------------- | -------- | ----------------------------------------------------------- |
| `@capacitor/core` & CLI    | ^8.3.x   | 8.3.1 (2026-04-16); Node 22+, SPM default for new iOS apps  |
| `@capgo/capacitor-updater` | ^8.x     | Major version tracks Capacitor major; v8 stores channels locally |
| `@capgo/cli`               | latest   | `npx @capgo/cli@latest …` — pin in CI                       |

Capacitor 8 platform floor: Node 22, iOS deployment target 15.0 (Xcode 26+), Android `minSdk 24` / `compileSdk 36` / `targetSdk 36`, Gradle plugin 8.13.0, wrapper 8.14.3, Kotlin 2.2.20.

## Setup

```bash
npm i @capgo/capacitor-updater && npx cap sync
npx @capgo/cli@latest init <API_KEY>   # adds app, injects notifyAppReady, builds, uploads, tests
```

## Critical: notifyAppReady()

Call it **as early as possible** after the web bundle boots. If the plugin doesn't hear it within `appReadyTimeout` (default 10s), it assumes the bundle is broken and **auto-rolls back** to the previous one.

```typescript
import { CapacitorUpdater } from "@capgo/capacitor-updater";

// Run once, at the top of app bootstrap — before heavy async work.
CapacitorUpdater.notifyAppReady();
```

This is the safety net that makes OTA reversible. A bundle that white-screens never sticks.

### Boot ordering: splash vs notifyAppReady

A freshly-applied OTA bundle re-runs your bootstrap. Hide the splash *after* the first real view paints, or users see a white webview between hide and first render. Requires `launchAutoHide: false` (otherwise the OS hides the splash on its own schedule and you can't sequence it).

```typescript
// capacitor.config.ts → plugins.SplashScreen.launchAutoHide: false
import { SplashScreen } from "@capacitor/splash-screen";

CapacitorUpdater.notifyAppReady();   // fire-and-forget — never gate first paint on it
await firstMeaningfulView();         // await your app's first real paint
await SplashScreen.hide();           // only now reveal the webview
```

`notifyAppReady()` returns a Promise but the 10s `appReadyTimeout` is generous — call it early and move on; do not `await` it before painting. (Webview rendering performance and native feel live in `ct-capacitor-ui`.)

## Configuration

```typescript
// capacitor.config.ts
import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.example.app",
  appName: "Example",
  webDir: "dist",
  plugins: {
    CapacitorUpdater: {
      autoUpdate: "atBackground", // default — apply when app backgrounds
      appReadyTimeout: 10000,
      responseTimeout: 20,
      autoDeleteFailed: true,
      autoDeletePrevious: true,
      resetWhenUpdate: true, // wipe OTA bundles on native app update
      // defaultChannel: "Development", // TEST/QA BUILDS ONLY — omit in production
    },
  },
};

export default config;
```

### autoUpdate modes

| Value                       | Behavior                                                              |
| --------------------------- | -------------------------------------------------------------------- |
| `false` / `"off"`           | No automatic updates — drive everything from JS                      |
| `"atBackground"` *(default)* | Download silently, apply when app moves to background                |
| `"atInstall"`               | Apply immediately after a fresh install / native update, then background |
| `"onLaunch"`                | Apply immediately on next launch, then background                    |
| `"always"`                  | Apply immediately whenever an update check runs                      |
| `"onlyDownload"`            | Download but never auto-apply; emit `updateAvailable` for you to act |

`periodCheckDelay` controls how often the plugin polls (seconds, **minimum 600** / 10 min).

## Channels

A channel points to one JS bundle. Devices check their assigned channel; you swap which bundle a channel points to for instant rollout/rollback — no rebuild.

```bash
npx @capgo/cli@latest bundle upload --channel=production    # build → upload → assign
npx @capgo/cli@latest channel set production -s default     # make it the cloud default
npx @capgo/cli@latest channel set beta --self-assign        # allow in-app setChannel()
```

**Channel precedence** (highest first): forced device mapping → cloud per-device override → config `defaultChannel` → cloud Default Channel (the ~99% path).

**Production rule:** ship production binaries **without** `defaultChannel` so users follow the cloud default. Only set `defaultChannel` in builds explicitly handed to testers.

Recommended ladder with semver pre-release tags:

| Channel       | Bundle version  | Audience                  |
| ------------- | --------------- | ------------------------- |
| `development` | `1.2.3-dev.1`   | dev / emulator builds     |
| `qa`          | `1.2.3-qa.1`    | QA verification           |
| `staging`     | `1.2.3-rc.1`    | production-like sign-off  |
| `production`  | `1.2.3`         | end users (store version) |

### Runtime channel switching

```typescript
// Requires "Allow device self-assignment" enabled on the channel (plugin v8+).
await CapacitorUpdater.setChannel({ channel: "beta", triggerAutoUpdate: true });
```

In v8 `setChannel` stores the choice **locally** and takes effect on the next check (no replication lag). The backend still validates self-assignment permission.

## Manual / background update flow

For full control, set `autoUpdate: false` and drive the lifecycle yourself:

```typescript
import { App } from "@capacitor/app";
import { SplashScreen } from "@capacitor/splash-screen";

CapacitorUpdater.addListener("download", ({ percent }) => console.log(`↓ ${percent}%`));

App.addListener("appStateChange", async ({ isActive }) => {
  if (isActive) {
    const latest = await CapacitorUpdater.getLatest();
    if (latest.url) {
      const bundle = await CapacitorUpdater.download({ version: latest.version, url: latest.url });
      await CapacitorUpdater.next({ id: bundle.id }); // apply on next background
    }
  }
});
```

Key methods: `getLatest()`, `download()`, `next()` (queue), `set()` (apply now — destroys JS context), `current()`, `reload()`, `reset()`. Events: `download`, `downloadComplete`, `updateAvailable`, `downloadFailed`, `appReady`, `majorAvailable`.

## End-to-end encryption (v2)

Hybrid RSA-2048 + AES-256: a random AES key encrypts each bundle; your **private** RSA key signs the AES key + checksum; the app decrypts with the embedded **public** key. Only your users can read the bundle — not even Capgo.

```bash
npx @capgo/cli@latest key create          # generates the key pair
npx @capgo/cli@latest bundle upload --key-v2 --channel=production
```

- `.capgo_key_v2` (private) — **never commit**; store as a CI secret.
- `.capgo_key_v2.pub` (public) — safe to commit; injected into the app.
- Once encryption is configured, the plugin **strictly enforces** a valid signature — an unsigned/tampered bundle is rejected.

## Delta updates

Direct/instant updates auto-enable delta updates — only changed files transfer, not the whole bundle. Keep deltas small: pin build tooling and strip build timestamps so unchanged files hash identically. Use `--delta-only` to require delta-capable clients.

## Staged rollouts & monitoring

- Start at ~10% of users, widen over 24h; schedule heavy rollouts for 1–4 AM local time, Wi-Fi-preferred.
- Healthy targets: ~95% adoption within 24h, ~82% global success rate.
- Roll back instantly from the channel dashboard (crown icon on the previous build) — devices pick it up on next check-in.
- Watch the `downloadFailed` / `appReady` ratio and Capgo stats; a spike means rollback.

## Store compliance

OTA of JS/HTML/CSS is allowed: **Apple** developer agreement §3.3.2 (since iOS 4.3) and **Google Play** (code in a webview/JS VM is exempt from the non-Play update restriction). Shipping *native* code OTA is not — that's what gets apps pulled.

## Anti-Patterns

1. **Not calling `notifyAppReady()`** — every bundle auto-rolls back after `appReadyTimeout`. This is the #1 "OTA doesn't work" cause.
2. **OTA-ing a native change** — bundle that needs a plugin/native API the installed shell lacks crashes. Match the bundle to the shipped native version; bump the store binary first.
3. **`defaultChannel` in production builds** — pins users off the cloud default and breaks instant rollback. Test builds only.
4. **Committing `.capgo_key_v2`** — leaks your signing key. Commit only the `.pub`.
5. **`periodCheckDelay` < 600** — silently clamped; the plugin won't poll faster than 10 minutes.
6. **100% rollout with no canary** — a bad bundle hits everyone at once. Stage it.
7. **Unpinned `@capgo/cli@latest` in CI** — a CLI minor can change upload behavior mid-pipeline. Pin the version.

## See Also

- `ct-vite-vitest-patterns` — the build that produces `webDir`
- `ct-playwright-patterns` — E2E-verify a bundle before you upload it
- `ct-typescript-conventions` — typing `capacitor.config.ts` and the updater API
- `ct-capacitor-ui` — webview UI performance & native feel (safe areas, touch targets, compositor-only animation)
