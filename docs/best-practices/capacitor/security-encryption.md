# Security & Encryption

> An OTA bundle travels over the network and lands on devices you don't control. End-to-end encryption with code signing makes each update unreadable in transit and verifiable on arrival — only your users can decrypt it, and only your signed bundles are accepted.

## Why Encrypt

A channel controls *who is eligible* for an update; it does **not** keep the bundle secret. An unencrypted bundle should be treated as a public asset. If your web layer contains anything you don't want readable — proprietary logic, embedded config — encryption is the only thing that keeps it private end to end, including from Capgo itself.

## How v2 Encryption Works (Hybrid RSA + AES)

RSA can't efficiently encrypt large payloads, so Capgo uses a hybrid scheme:

1. A **random AES-256 key** is generated for every upload and encrypts the bundle.
2. Your **private RSA-2048 key** encrypts (signs) the AES key and the bundle checksum.
3. The app holds your **public RSA key** (injected at build) and decrypts the AES key + signature.
4. The app decrypts the bundle with the AES key, recomputes the checksum, and compares it against the decrypted signature.

The result: the bundle is confidential (AES) **and** authenticated (RSA signature over the checksum). Tampering breaks the checksum match; a bundle not signed by your private key won't validate.

> Industry baseline this matches: **AES-256** for payloads, **RSA-2048** for key exchange, **SHA-256** for integrity.

## Setup

```bash
npx @capgo/cli@latest key create                            # generate the RSA key pair
npx @capgo/cli@latest bundle upload --key-v2 --channel=production
```

`key create` writes two files and injects the public key into your Capacitor config:

| File                  | Sensitivity | Rule                                                       |
| --------------------- | ----------- | ---------------------------------------------------------- |
| `.capgo_key_v2`       | **Private** | **Never commit.** Store as a CI secret. Loss = can't sign. |
| `.capgo_key_v2.pub`   | Public      | Safe to commit — it's a backup of the embedded public key. |

Add `.capgo_key_v2` to `.gitignore` immediately. The private key only ever lives on trusted dev machines and in CI secret storage; it's used at upload time to sign, never shipped to devices.

## Strict Enforcement

Once encryption is configured, the plugin **requires** a valid signature on every update — this is enforced, not advisory. An unsigned or tampered bundle is **rejected**, not applied. Practical consequences:

- Every CI upload must run with `--key-v2` and access to the private key, or devices will reject the bundle.
- Rotating keys requires shipping a new native binary with the new public key; plan it as a store release, not an OTA.
- `--no-key` (unencrypted) and encrypted uploads don't mix on the same channel for the same audience — pick one posture per channel.

## Integrity Beyond Encryption

- **Checksums** verify the decrypted bundle matches what you signed — corruption or tampering fails closed.
- **`notifyAppReady()`** is the runtime backstop: even a validly-signed bundle that crashes on boot rolls back automatically (see [Capgo Setup](capgo-setup.md)). Signing proves *authenticity*; `notifyAppReady` proves *it actually runs*. You want both.

## Store Compliance

Encryption doesn't change what you're allowed to ship — it just protects the payload. The compliance rule is unchanged: OTA of **JavaScript/HTML/CSS** is permitted (Apple Developer Agreement §3.3.2; Google Play's webview/JS-VM exemption). Encrypting that web bundle is fine. Encrypting and shipping *native* executable code OTA is still not allowed — encryption is not a loophole around the native/web boundary.

## Checklist

- [ ] `npx @capgo/cli key create` run; `.capgo_key_v2` added to `.gitignore`.
- [ ] Private key stored as a CI secret; `--key-v2` used on every production upload.
- [ ] `.capgo_key_v2.pub` committed as a backup.
- [ ] `notifyAppReady()` present so signed-but-broken bundles still self-heal.
- [ ] Key rotation planned as a native binary release, not an OTA.
- [ ] Only web-layer code shipped OTA — never native code, encrypted or not.

## See Also

- [Capgo Setup & API](capgo-setup.md) — the upload flow and `publicKey` config
- [Channels & Staged Rollouts](channels-and-rollouts.md) — per-channel encryption posture
- [Live Updates & OTA Strategy](live-updates-ota.md) — what's legal to ship over the air
