# Capacitor 8 Platform

> Capacitor 8 raised the platform floor across the board. Get the toolchain right before touching OTA — a mismatched native baseline is the first thing that breaks live updates.

Latest at time of writing: **8.3.1** (2026-04-16). 8.3.0 (2026-03-25) and 8.2.0 (2026-03-06) precede it.

## Minimum Requirements

| Area    | Requirement                                                                 |
| ------- | --------------------------------------------------------------------------- |
| Node    | **22+** (latest LTS recommended)                                            |
| iOS     | Xcode **26.0+**, deployment target **15.0**                                 |
| Android | Android Studio Otter (2025.2.1)+, `minSdk 24`, `compileSdk 36`, `targetSdk 36` |
| Gradle  | Android Gradle plugin **8.13.0**, wrapper **8.14.3**, Kotlin **2.2.20**     |

## Headline Changes

### Swift Package Manager is the default (iOS)

New iOS projects scaffold with **SPM instead of CocoaPods**. Existing CocoaPods projects keep working — the ecosystem is migrating, not forcing a cutover. 8.3.0 added experimental config for `swift-tools-version` and support for SPM package traits in the generated `Package.swift`.

### Edge-to-edge via the SystemBars plugin (Android)

An internal `SystemBars` plugin now handles status/navigation bar appearance for immersive layouts automatically, with a public API for fine control. It version-gates behavior and coexists with `@capacitor/status-bar`. Consequently the old config flag **`android.adjustMarginsForEdgeToEdge` was removed** — use SystemBars instead.

## Breaking Changes Checklist

When upgrading to Capacitor 8:

- [ ] **Node 22+** on every dev machine and CI runner.
- [ ] **Android config syntax:** Gradle properties now require `=` (e.g. `compileSdk = 36`, not `compileSdk 36`).
- [ ] **Android layout rename:** `bridge_layout_main.xml` → `capacitor_bridge_layout_main.xml`.
- [ ] **Android resize:** add `density` to `configChanges` in `AndroidManifest.xml` to stop the WebView reloading on resize.
- [ ] **Remove `android.adjustMarginsForEdgeToEdge`** from `capacitor.config` — replaced by SystemBars.
- [ ] **iOS `appendUserAgent`:** the fixed concatenation may need a leading space to preserve your intended user-agent string.
- [ ] **iOS lifecycle:** the framework now emits `viewDidAppear` / `viewWillTransition` — delete any custom extensions that duplicated this.

## 8.2–8.3 Notable Fixes

These land automatically on patch upgrades but are worth knowing because they touch OTA-adjacent behavior:

- **Android `server.url` with paths** is now parsed correctly (8.3.0) — relevant if you point the WebView at a custom/self-hosted update host.
- **Android `isNewBinary()`** handles a null `versionName` (8.3.1) — the check that decides whether a native update invalidates OTA bundles.
- **HTTP `fetch`** handles `URL` objects and form-data boundary extraction (8.3.0/8.3.1).
- **CLI** inlines CSS sourcemaps alongside JS (8.3.0) and respects `CAPACITOR_COCOAPODS_PATH` (8.3.1).

## Keeping Native and OTA in Lockstep

The single most important interaction: **a native upgrade invalidates incompatible OTA bundles.** `resetWhenUpdate: true` (the Capgo default) wipes downloaded bundles when the native app updates, so users fall back to the bundle baked into the new binary rather than running a stale OTA bundle against new native code. Keep it on unless you have a specific reason not to.

When you bump Capacitor or add a plugin:

1. Ship a new store binary with the updated native layer.
2. Bump your bundle's version so old shells don't pull a bundle meant for the new native contract.
3. Use channel version gates (`--disable-auto-update major|minor`) to enforce the boundary.

## See Also

- [Live Updates & OTA Strategy](live-updates-ota.md) — what's safe to OTA on top of a given binary
- [Channels & Staged Rollouts](channels-and-rollouts.md) — version gates that enforce the native/web contract
