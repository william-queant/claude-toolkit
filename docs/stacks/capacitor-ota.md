# Capacitor OTA (Capgo) Patterns

> Capacitor 8 native runtime and Capgo over-the-air live updates: channels, encryption, staged rollouts, and store-safe delivery.

**Type:** Stack Skill (requires `capacitor` stack)
**Source:** [`stacks/capacitor/skills/ct-capacitor-ota/SKILL.md`](../../stacks/capacitor/skills/ct-capacitor-ota/SKILL.md)
**Directory Mappings:** `capacitor.config.ts`, `capacitor.config.json`, `ios/`, `android/`
**File Extensions:** _(none — keyed on config + content)_

## Overview

Capacitor wraps a web app in a native iOS/Android shell. Capgo's `@capgo/capacitor-updater` lets you replace the web bundle that shell loads, shipping JS/HTML/CSS fixes in minutes instead of waiting on store review.

**Golden rule:** OTA updates the **web layer only**. Native code changes (new plugin, native dependency, Capacitor major bump) require a new store binary. Never OTA a bundle whose native contract differs from the installed shell.

## Versions (as of June 2026)

| Package                    | Version | Notes                                                            |
| -------------------------- | ------- | ---------------------------------------------------------------- |
| `@capacitor/core` & CLI    | ^8.3.x  | 8.3.1 (2026-04-16); Node 22+, SPM default for new iOS apps       |
| `@capgo/capacitor-updater` | ^8.x    | Major version tracks Capacitor major; v8 stores channels locally |
| `@capgo/cli`               | latest  | `npx @capgo/cli@latest …` — pin in CI                            |

## Setup

```bash
npm i @capgo/capacitor-updater && npx cap sync
npx @capgo/cli@latest init <API_KEY>   # adds app, injects notifyAppReady, builds, uploads, tests
```

## Critical: notifyAppReady()

Call it as early as possible after the bundle boots. If the plugin doesn't hear it within `appReadyTimeout` (default 10s), it assumes the bundle is broken and **auto-rolls back** to the previous one — the safety net that makes OTA reversible.

```typescript
import { CapacitorUpdater } from "@capgo/capacitor-updater";

CapacitorUpdater.notifyAppReady(); // top of bootstrap, before heavy async work
```

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
      autoUpdate: "atBackground", // apply when app backgrounds
      appReadyTimeout: 10000,
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

| Value                        | Behavior                                                      |
| ---------------------------- | ------------------------------------------------------------ |
| `false` / `"off"`            | No automatic updates — drive everything from JS              |
| `"atBackground"` *(default)* | Download silently, apply when app moves to background        |
| `"atInstall"`                | Apply right after a fresh install / native update            |
| `"onLaunch"`                 | Apply on next launch, then background                        |
| `"always"`                   | Apply immediately whenever a check runs                      |
| `"onlyDownload"`             | Download only; emit `updateAvailable` for you to act         |

`periodCheckDelay` sets poll frequency (seconds, **minimum 600** / 10 min).

## Channels

A channel points to one JS bundle. Swap which bundle a channel points to for instant rollout/rollback without rebuilding.

```bash
npx @capgo/cli@latest bundle upload --channel=production    # build → upload → assign
npx @capgo/cli@latest channel set production -s default     # make it the cloud default
npx @capgo/cli@latest channel set beta --self-assign        # allow in-app setChannel()
```

**Precedence** (highest first): forced device mapping → cloud per-device override → config `defaultChannel` → cloud Default Channel.

Ship production binaries **without** `defaultChannel` so users follow the cloud default. Recommended ladder:

| Channel       | Bundle version | Audience                  |
| ------------- | -------------- | ------------------------- |
| `development` | `1.2.3-dev.1`  | dev / emulator builds     |
| `qa`          | `1.2.3-qa.1`   | QA verification           |
| `staging`     | `1.2.3-rc.1`   | production-like sign-off  |
| `production`  | `1.2.3`        | end users (store version) |

```typescript
// Runtime switch — needs "Allow device self-assignment" on the channel (v8+).
await CapacitorUpdater.setChannel({ channel: "beta", triggerAutoUpdate: true });
```

## End-to-end encryption (v2)

Hybrid RSA-2048 + AES-256: a random AES key encrypts each bundle; your private RSA key signs the key + checksum; the app decrypts with the embedded public key.

```bash
npx @capgo/cli@latest key create
npx @capgo/cli@latest bundle upload --key-v2 --channel=production
```

- `.capgo_key_v2` (private) — **never commit**; store as a CI secret.
- `.capgo_key_v2.pub` (public) — safe to commit.
- With encryption configured, the plugin **strictly enforces** a valid signature; tampered/unsigned bundles are rejected.

## Staged rollouts & monitoring

- Start at ~10% of users, widen over 24h; schedule heavy rollouts 1–4 AM local, Wi-Fi-preferred.
- Targets: ~95% adoption within 24h, ~82% global success rate.
- Roll back instantly from the channel dashboard (crown icon on the previous build).
- Watch the `downloadFailed` / `appReady` ratio in Capgo stats; a spike means roll back.

## Store compliance

OTA of JS/HTML/CSS is permitted — Apple §3.3.2 (since iOS 4.3) and Google Play (webview/JS VM code is exempt). Shipping native code OTA is not.

## Anti-Patterns

| Anti-pattern                              | Why it's wrong                                                            |
| ----------------------------------------- | ------------------------------------------------------------------------ |
| **Not calling `notifyAppReady()`**        | Every bundle auto-rolls back after `appReadyTimeout`. The #1 OTA failure. |
| **OTA-ing a native change**               | Bundle needs a native API the shell lacks → crash. Bump the binary first. |
| **`defaultChannel` in production builds** | Pins users off the cloud default; breaks instant rollback.               |
| **Committing `.capgo_key_v2`**            | Leaks your signing key. Commit only the `.pub`.                          |
| **`periodCheckDelay` < 600**              | Silently clamped; never polls faster than 10 min.                        |
| **100% rollout with no canary**           | A bad bundle hits everyone at once. Stage it.                            |
| **Unpinned `@capgo/cli@latest` in CI**    | A CLI minor can change upload behavior mid-pipeline. Pin it.             |

## See Also

- [Capacitor & OTA Best Practices](../best-practices/capacitor/README.md) — full reference set
- [ct-vite-vitest-patterns](vite-vitest-patterns.md) — the build that produces `webDir`
- [ct-playwright-patterns](playwright-patterns.md) — E2E-verify a bundle before upload
