# Capacitor & OTA Best Practices

> A curated collection of best practices for Capacitor 8 native apps and Capgo over-the-air (OTA) live updates, sourced from official Capacitor documentation, the Capgo docs and blog, and the plugin maintainers as of June 2026.

Capacitor wraps a web app (your `webDir` bundle) in a native iOS/Android shell. **OTA** lets you replace that web bundle on installed devices in minutes — without an app store review cycle. Capgo (`@capgo/capacitor-updater`) is the live-update layer that delivers, verifies, and rolls back those bundles.

```
        ┌─────────────────────────────┐
        │   Native shell (store)      │  ← Capacitor core + plugins; ships via App Store / Play
        │  ┌───────────────────────┐  │     Changes here REQUIRE a new binary.
        │  │   Web bundle (OTA)    │  │  ← JS / HTML / CSS; swapped by Capgo in minutes.
        │  │   notifyAppReady() ✓  │  │     Changes here ship over the air.
        │  └───────────────────────┘  │
        └─────────────────────────────┘
```

## The Two Layers — and the Golden Rule

| Layer          | What it is                                  | How it ships                | Review latency      |
| -------------- | ------------------------------------------- | --------------------------- | ------------------- |
| **Native**     | Capacitor core, plugins, native deps        | App Store / Google Play     | Hours to days       |
| **Web (OTA)**  | Your compiled `webDir` (JS/HTML/CSS/assets) | Capgo channel swap          | Minutes             |

**Golden rule:** OTA the web layer only. If a change needs a native API the installed shell doesn't have — a new plugin, a native dependency, a Capacitor major bump — it **must** go through the store first. OTA-ing a native contract mismatch crashes the app. Every other rule in this guide follows from this one.

## When to Use Which Channel

| Question                                                          | Answer                                  |
| ----------------------------------------------------------------- | --------------------------------------- |
| Did I change native code, add a plugin, or bump Capacitor major?  | **Store binary** (then OTA on top)      |
| Bug fix / copy change / styling / feature in JS only?             | **OTA** to `production`                 |
| Needs QA sign-off before users see it?                            | **OTA** to `staging`, promote later     |
| Testing on dev/emulator builds?                                   | **OTA** to `development`                |
| Need to undo a bad release right now?                             | **Channel rollback** (crown icon)       |

## Technology Versions (as of June 2026)

| Tool                       | Version | Notes                                                            |
| -------------------------- | ------- | ---------------------------------------------------------------- |
| `@capacitor/core` & CLI    | ^8.3.x  | 8.3.1 (2026-04-16); Node 22+ required                            |
| `@capacitor/ios`           | ^8.3.x  | iOS 15.0 target, Xcode 26+, SPM default for new projects         |
| `@capacitor/android`       | ^8.3.x  | minSdk 24, compileSdk/targetSdk 36, Gradle 8.14.3, Kotlin 2.2.20 |
| `@capgo/capacitor-updater` | ^8.x    | Major tracks Capacitor major; v8 stores channel locally          |
| `@capgo/cli`               | latest  | `npx @capgo/cli@latest …` — pin in CI                            |

## Shared Principles

1. **`notifyAppReady()` is non-negotiable.** Call it at the top of bootstrap. Without it, every OTA bundle auto-rolls back after `appReadyTimeout`.
2. **Match the bundle to the shell.** A web bundle is only valid against the native version that shipped it. Use channel version gates to prevent mismatches.
3. **Stage every rollout.** Canary to ~10%, widen over 24h. Instant rollback beats instant deploy.
4. **Sign your bundles.** End-to-end encryption (RSA-2048 + AES-256) means only your users can read an update — keep the private key out of git.
5. **Keep the cloud in control of production.** Omit `defaultChannel` from production binaries so the dashboard default governs rollout and rollback.
6. **Monitor before you widen.** Watch the `appReady` / `downloadFailed` ratio; a spike is your signal to roll back.
7. **Pin tooling.** Unpinned `@capgo/cli@latest` in CI can change upload behavior between runs.

## Guides

| Guide                                             | Summary                                                                         |
| ------------------------------------------------- | ------------------------------------------------------------------------------- |
| [Capacitor 8 Platform](capacitor-8.md)            | Version floor, breaking changes, SPM-by-default, SystemBars, upgrade checklist. |
| [Live Updates & OTA Strategy](live-updates-ota.md) | What to OTA vs ship native, performance, delta updates, scheduling.             |
| [Capgo Setup & API](capgo-setup.md)               | Plugin install, config, `notifyAppReady`, autoUpdate modes, manual flow, CLI.   |
| [Channels & Staged Rollouts](channels-and-rollouts.md) | Channel ladder, precedence, canary rollouts, rollback, monitoring.         |
| [Security & Encryption](security-encryption.md)   | E2E encryption (v2), key management, code signing, store compliance.            |
