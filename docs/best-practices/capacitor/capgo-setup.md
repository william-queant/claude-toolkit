# Capgo Setup & API

> `@capgo/capacitor-updater` ships in three modes: fully managed (Capgo Cloud), self-hosted (your own update server), or manual (you drive every download/apply in JS). This guide covers the managed path and the manual escape hatch.

## Install

```bash
npm i @capgo/capacitor-updater && npx cap sync
npx @capgo/cli@latest init <API_KEY>
```

`init` is an interactive onboarding: it registers the app in Capgo Cloud, injects the `notifyAppReady()` call, builds, uploads the first bundle, and verifies the update round-trips. Run it once per app.

## notifyAppReady() — Read This First

```typescript
import { CapacitorUpdater } from "@capgo/capacitor-updater";

// As early as possible in bootstrap, before heavy async work.
CapacitorUpdater.notifyAppReady();
```

The plugin arms a timer (`appReadyTimeout`, default **10000ms**) the moment a bundle loads. Call `notifyAppReady()` before it fires and the bundle is confirmed; miss it and the plugin **auto-rolls back** to the previous bundle. This is the mechanism that makes a broken release self-heal — never remove it, and don't bury it behind slow startup code.

## Configuration Reference

```typescript
// capacitor.config.ts
import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.example.app",
  appName: "Example",
  webDir: "dist",
  plugins: {
    CapacitorUpdater: {
      autoUpdate: "atBackground",
      appReadyTimeout: 10000,
      responseTimeout: 20,
      autoDeleteFailed: true,
      autoDeletePrevious: true,
      resetWhenUpdate: true,
      // defaultChannel: "Development", // TEST/QA BUILDS ONLY
      // publicKey: "...",              // injected by `key create` for E2E encryption
    },
  },
};

export default config;
```

| Setting              | Default                                | Purpose                                                       |
| -------------------- | -------------------------------------- | ------------------------------------------------------------ |
| `autoUpdate`         | `"atBackground"`                       | When to apply downloaded updates (see table below)           |
| `appReadyTimeout`    | `10000` (ms)                           | Grace period for `notifyAppReady()` before rollback          |
| `responseTimeout`    | `20` (s)                               | Update-server API call timeout                               |
| `periodCheckDelay`   | `600` (s)                              | Poll interval; **cannot be < 600**                           |
| `autoDeleteFailed`   | `true`                                 | Remove bundles that failed to apply                          |
| `autoDeletePrevious` | `true`                                 | Remove the prior bundle after a successful update            |
| `resetWhenUpdate`    | `true`                                 | Wipe OTA bundles when the native app updates                 |
| `defaultChannel`     | _(unset)_                              | Pin a channel — **test builds only**                         |
| `allowModifyUrl`     | `false`                                | Let JS change update/stats/channel URLs at runtime           |
| `publicKey`          | _(unset)_                              | RSA public key for end-to-end encryption (v2)                |
| `updateUrl`          | `https://plugin.capgo.app/updates`     | Update-check endpoint (override for self-hosted)             |
| `statsUrl`           | `https://plugin.capgo.app/stats`       | Stats endpoint                                               |
| `channelUrl`         | `https://plugin.capgo.app/channel_self`| Channel self-assignment endpoint                            |

> `directUpdate` is deprecated. Use the `autoUpdate` string modes instead.

## autoUpdate Modes

| Value                        | Behavior                                                       |
| ---------------------------- | -------------------------------------------------------------- |
| `false` / `"off"`            | No automatic updates — you drive the lifecycle from JS         |
| `"atBackground"` *(default)* | Download silently; apply when the app moves to the background  |
| `"atInstall"`                | Apply immediately after a fresh install / native update        |
| `"onLaunch"`                 | Apply immediately on next launch, then revert to background    |
| `"always"`                   | Apply immediately whenever an update check runs                |
| `"onlyDownload"`             | Download but never auto-apply; emits `updateAvailable`         |

**Default lifecycle:** on launch Capgo checks the channel → downloads any new bundle silently → waits for background/close → user gets the update on next launch. Seamless, no spinner.

## Manual Mode

Set `autoUpdate: false` to control everything yourself — useful for custom UX (e.g. "Update available" prompts) or applying only on explicit user action.

```typescript
import { CapacitorUpdater } from "@capgo/capacitor-updater";
import { App } from "@capacitor/app";
import { SplashScreen } from "@capacitor/splash-screen";

CapacitorUpdater.addListener("download", ({ percent }) => {
  console.log(`Downloading: ${percent}%`);
});

App.addListener("appStateChange", async ({ isActive }) => {
  if (isActive) {
    const latest = await CapacitorUpdater.getLatest();
    if (latest.url) {
      const bundle = await CapacitorUpdater.download({
        version: latest.version,
        url: latest.url,
      });
      await CapacitorUpdater.next({ id: bundle.id }); // queue for next background
    }
  }
});
```

### Core methods

| Method            | Purpose                                                        |
| ----------------- | -------------------------------------------------------------- |
| `notifyAppReady()`| Confirm the current bundle booted (always required)           |
| `getLatest()`     | Query the server for the latest bundle metadata                |
| `download()`      | Download a bundle by `{ version, url }`                        |
| `next({ id })`    | Queue a bundle to apply on next background                     |
| `set({ id })`     | Apply a bundle now — **destroys the JS context** (hard reload) |
| `current()`       | Inspect the active bundle + native version                    |
| `reload()`        | Apply a pending update without backgrounding                   |
| `reset()`         | Revert to the bundle baked into the native binary             |
| `setChannel()`    | Switch the device's channel at runtime (v8+, self-assign)     |

### Events

`download` · `downloadComplete` · `updateAvailable` · `downloadFailed` · `appReady` · `majorAvailable`

Subscribe to `downloadFailed` and `appReady` for monitoring; subscribe to `majorAvailable` to detect a bundle that requires a native update you can't OTA.

## CLI Cheat Sheet

```bash
npx @capgo/cli@latest login <API_KEY>                       # store key (--local to scope to repo)
npx @capgo/cli@latest app add com.example.app               # register an app
npx @capgo/cli@latest bundle upload --channel=production     # build → upload → assign
npx @capgo/cli@latest bundle upload --key-v2 --channel=production   # encrypted upload
npx @capgo/cli@latest bundle upload --delta-only            # require delta-capable clients
npx @capgo/cli@latest bundle compatibility -c production    # check native compatibility first
npx @capgo/cli@latest channel set production -s default     # set the cloud default channel
npx @capgo/cli@latest key create                            # generate the E2E key pair
```

Useful `bundle upload` flags: `--channel`, `--key-v2` / `--no-key`, `--delta` / `--delta-only`, `--external` (link your own storage), `--tus` (resumable upload), `--encrypted-checksum`.

**Pin the CLI version in CI** (`@capgo/cli@8.x` rather than `@latest`) so upload behavior doesn't change between pipeline runs.

## See Also

- [Channels & Staged Rollouts](channels-and-rollouts.md) — what `--channel` and `setChannel` actually do
- [Security & Encryption](security-encryption.md) — the `--key-v2` flow in full
- [Live Updates & OTA Strategy](live-updates-ota.md) — when to use each `autoUpdate` mode
