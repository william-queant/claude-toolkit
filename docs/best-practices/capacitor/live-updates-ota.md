# Live Updates & OTA Strategy

> OTA is a delivery mechanism for the **web layer**, not a way around the app stores. The strategy is mostly about discipline: knowing what you can ship over the air, keeping bundles small, and rolling out so a mistake is recoverable.

## What You Can — and Cannot — Ship Over the Air

| Change                                          | OTA? | Why                                                          |
| ----------------------------------------------- | ---- | ----------------------------------------------------------- |
| Bug fix in JS/TS                                | ✅   | Pure web layer                                              |
| Copy, translations, styling                     | ✅   | Static assets in the bundle                                 |
| New feature built on existing native APIs       | ✅   | No new native contract                                      |
| Web-only dependency upgrade                     | ✅   | Compiles into the bundle                                    |
| New Capacitor **plugin** (native code)          | ❌   | Native shell lacks the implementation → crash              |
| Native dependency / SDK upgrade                 | ❌   | Native binary change                                        |
| Capacitor **major** version bump                | ❌   | Native runtime change                                       |
| Permission / entitlement / manifest change      | ❌   | Declared in the native binary                               |

The failure mode is concrete: a bundle that calls `SomePlugin.doThing()` on a shell where that plugin isn't compiled in throws at runtime. **Match every bundle to the native version that can run it.**

## Store Compliance

OTA of interpreted code is explicitly permitted:

- **Apple** — Developer Agreement **§3.3.2** allows OTA of JavaScript and assets executed by the system WebView (since iOS 4.3).
- **Google Play** — the restriction on non-Play code updates **does not apply** to code running in a VM with limited API access, i.e. JavaScript in a WebView.

What gets apps pulled is shipping *native* executable code OTA. Stay in the web layer and you stay compliant.

## Performance: Keep Bundles Small

Smaller bundles download faster, fail less, and adopt quicker.

- **Delta / differential updates.** Capgo transfers only the files that changed between versions (auto-enabled with direct/instant updates). The win depends on file-level stability — see below.
- **Deterministic builds.** Strip build timestamps and pin your build tooling so unchanged source produces byte-identical output. Otherwise every file looks "changed" and the delta degrades to a full download.
- **Compression.** Capgo applies ZSTD compression to full-image updates; you don't configure it, but deterministic builds are what let delta + compression actually shrink the payload.
- **Prioritize the critical path.** Load auth and main navigation eagerly; lazy-load analytics, settings, animations, and heavy media after first paint. A small critical bundle reaches `notifyAppReady()` faster, which matters because of the rollback timeout.

## Update Timing & Scheduling

- **Off-peak rollouts.** Schedule heavy rollouts for **1–4 AM local time** and prefer Wi-Fi so you're not competing with active use or burning cellular data.
- **Background application.** The default `atBackground` mode downloads silently and applies when the app backgrounds, so users never watch a spinner. Reserve `onLaunch` / `always` for updates that must take effect immediately (e.g. a hotfix).
- **Respect `periodCheckDelay`.** Minimum 600s (10 min). Don't try to poll faster — it's clamped.

## Roll Out So You Can Roll Back

The whole point of OTA is that mistakes are cheap to undo. Treat every release as staged:

1. **Canary** to ~10% of users.
2. **Watch** the success signal (`appReady` vs `downloadFailed`, Capgo stats) for 1–2 hours.
3. **Widen** to 100% over ~24h if healthy.
4. **Roll back instantly** from the channel dashboard if not — devices pick up the previous bundle on next check-in.

Healthy benchmarks: **~95% adoption within 24h**, **~82% global success rate**. Below that, investigate before widening.

## The notifyAppReady() Safety Net

This is what makes the above safe. The plugin starts a timer (`appReadyTimeout`, default 10s) when a new bundle loads. If your JS calls `notifyAppReady()` before it fires, the bundle is "confirmed." If it doesn't — because the bundle white-screened or threw on boot — the plugin **automatically reverts** to the last good bundle. A broken OTA release self-heals on the next launch even before you notice.

Call it as early as possible, before heavy async work, so a slow boot doesn't trip the timeout on an otherwise-fine bundle.

## Anti-Patterns

| Anti-pattern                                | Consequence                                                       |
| ------------------------------------------- | ----------------------------------------------------------------- |
| OTA-ing a native change                     | Runtime crash on the mismatched shell                            |
| Non-deterministic builds                    | Delta updates degrade to full downloads                          |
| 100% rollout, no canary                     | A bad bundle hits the entire user base at once                   |
| Eager-loading everything                    | Slow boot risks tripping `appReadyTimeout` → false rollback      |
| Polling faster than 600s                    | Silently clamped; wasted assumption                             |

## See Also

- [Capacitor 8 Platform](capacitor-8.md) — keeping native and OTA in lockstep
- [Capgo Setup & API](capgo-setup.md) — config and the manual update lifecycle
- [Channels & Staged Rollouts](channels-and-rollouts.md) — the mechanics of canarying and rollback
