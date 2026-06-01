# Channels & Staged Rollouts

> A channel is a pointer to one JS bundle. Devices subscribe to a channel; you change which bundle the channel points to. That indirection is what makes rollout and rollback instant and rebuild-free.

## The Channel Ladder

Mirror your release pipeline with channels, and version bundles with semver pre-release tags so relationships are obvious:

| Channel       | Bundle version | Audience                  |
| ------------- | -------------- | ------------------------- |
| `development` | `1.2.3-dev.1`  | dev / emulator builds     |
| `qa`          | `1.2.3-qa.1`   | QA verification           |
| `staging`     | `1.2.3-rc.1`   | production-like sign-off  |
| `production`  | `1.2.3`        | end users (store version) |

Promote a build up the ladder by uploading (or re-pointing) it to the next channel — no native rebuild between stages.

```bash
npx @capgo/cli@latest bundle upload --channel=staging       # ship to staging
# ...QA signs off...
npx @capgo/cli@latest bundle upload --channel=production     # promote to production
npx @capgo/cli@latest channel set production -s default      # ensure it's the cloud default
```

## Channel Precedence

When a device checks for updates, Capgo resolves the channel in this order (highest wins):

1. **Forced device mapping** — pin specific device IDs (testing/exception layer).
2. **Cloud per-device override** — dashboard/API change for one device (up to ~2 min to propagate).
3. **Config `defaultChannel`** — set in `capacitor.config` (baked into the binary).
4. **Cloud Default Channel** — the fallback ~99% of users follow.

**Production rule:** ship production binaries **without** `defaultChannel`. If you bake a channel into the binary, those users stop following the cloud default — which is exactly the lever you use for instant rollout and rollback. Reserve `defaultChannel` for builds you hand directly to testers.

## Runtime Switching with setChannel()

Let users opt into a beta from inside the app:

```typescript
import { CapacitorUpdater } from "@capgo/capacitor-updater";

await CapacitorUpdater.setChannel({ channel: "beta", triggerAutoUpdate: true });
```

- Requires **"Allow device self-assignment"** enabled on the target channel; otherwise the call fails.
- In **plugin v8+**, `setChannel` stores the choice **locally on the device** and takes effect on the next update check — no 2-minute backend replication lag. The backend still validates the self-assignment permission at check time.

```bash
npx @capgo/cli@latest channel set beta --self-assign        # enable opt-in
```

## Version Gates: Enforce the Native/Web Contract

Channels can refuse updates that cross a version boundary the native shell can't honor:

```bash
# Block cross-major OTA on production (e.g. don't push a 2.x bundle to 1.x shells)
npx @capgo/cli@latest channel set production --disable-auto-update major
```

| `--disable-auto-update` | Allows                                              |
| ----------------------- | --------------------------------------------------- |
| `major`                 | minor + patch within the same major                 |
| `minor`                 | patch only within the same major.minor              |
| `patch`                 | patch increments only                               |
| `metadata`              | requires minimum version metadata on bundles        |
| `none`                  | all semver-compatible updates                       |

Also available: **disable auto-downgrade** (don't send a bundle older than the device's native version) and per-platform targeting (`--ios`, `--android`). These gates are how you keep a web bundle from landing on a shell that can't run it.

## Staged Rollout Playbook

1. **Canary** — point the channel at the new bundle for ~10% of users (or a dedicated `canary` channel).
2. **Observe** — watch the success signal for 1–2 hours (next section).
3. **Widen** — ramp to 100% over ~24h if healthy.
4. **Schedule** — time heavy rollouts for **1–4 AM local**, Wi-Fi-preferred, so downloads don't compete with active use.

**Benchmarks:** aim for **~95% adoption within 24h** and **~82% global success rate**. Falling short is a signal to pause and investigate, not to widen.

## Rollback

Instant and rebuild-free — the core OTA payoff:

1. Open the channel in the Capgo dashboard.
2. Find the previous good build and click the **crown icon**.
3. Confirm. The channel now points at the old bundle; devices pick it up on next check-in.

Because rollback is this cheap, bias toward shipping small and reverting fast over holding releases for exhaustive pre-launch testing.

## Monitoring

- **`appReady` vs `downloadFailed`** — the health ratio. A `downloadFailed` spike, or `appReady` events not keeping pace with downloads, means bundles are failing to boot → roll back.
- **Capgo stats dashboard** — adoption curve and per-version success rate. Compare against the 95% / 82% benchmarks.
- **Alert, then act** — wire a threshold alert so a bad canary pages you before you widen.

## See Also

- [Live Updates & OTA Strategy](live-updates-ota.md) — why staged rollout is the whole point
- [Capacitor 8 Platform](capacitor-8.md) — what makes a bundle native-incompatible
- [Security & Encryption](security-encryption.md) — signing the bundles a channel serves
