---
name: ct-capacitor-ui
description: Capacitor webview UI performance and native feel — safe areas, touch targets, tap feedback, compositor-only animation, and on-device profiling
---

# Capacitor Webview UI & Native Feel

> _Verified against Capacitor 8 (iOS 15 floor; `content-visibility` on iOS 18+) (2026-06)._

The webview *is* the runtime. A Capacitor app lives or dies on whether it feels native — safe-area-aware, instant to tap, smooth to scroll — on a low-end phone, not on your desktop. This skill is the UI/runtime side; OTA delivery lives in `ct-capacitor-ota`.

## Performance & Native Feel

The webview *is* the runtime — budget like a low-end Android phone, not desktop Chrome. Profile on a real cheap device or throttled emulation (4x CPU, "Slow 4G"); effects that are free on a desktop GPU jank in WebView.

```html
<!-- index.html — required for env() safe-area tokens to resolve to non-zero -->
<meta name="viewport"
      content="width=device-width, initial-scale=1, viewport-fit=cover" />
```

`width=device-width` (above) already removes the legacy ~300ms tap delay on modern iOS/Android WebViews. The block below is about *tap feel*, not latency:

```css
/* No grey tap-flash; suppress double-tap-to-zoom pause on controls */
* { -webkit-tap-highlight-color: transparent; }
button, a, [role="button"], input, label { touch-action: manipulation; }

/* If you kill the default highlight, give back your OWN press feedback —
   otherwise buttons feel dead. */
button:active, [role="button"]:active { opacity: 0.7; }
:focus-visible { outline: 2px solid; outline-offset: 2px; }
```

```css
/* Respect notch / home indicator — paint edge-to-edge, pad with env() */
.app-header { padding-top: env(safe-area-inset-top); }
.app-footer { padding-bottom: env(safe-area-inset-bottom); }

/* Native scroll feel */
:where(html, body) { overscroll-behavior: none; }   /* no rubber-band on the shell */
.scroll-region { overflow-y: auto; overscroll-behavior: contain; }
```

| Concern       | Do                                                              | Why                                              |
| ------------- | -------------------------------------------------------------- | ------------------------------------------------ |
| Touch targets | min 44x44px (iOS) / 48dp (Android)                             | HIG / Material minimum; fewer mis-taps           |
| Animation     | animate `transform` / `opacity` only                          | compositor-only; skips layout & paint            |
| Long lists    | `content-visibility: auto` + `contain-intrinsic-size`         | skips offscreen layout on Android & iOS 18+ WebView; older iOS ignores it (harmless). Need it everywhere → use a JS virtualizer |
| Scroll jank   | avoid `box-shadow` / `filter` / `backdrop-filter` on scrolled nodes | repaint per frame on low-end GPUs           |

Keep the webview locked down regardless of perf work: tight `server.allowNavigation`, no loading remote origins into the shell, and web debugging off in production builds.

## Anti-Patterns

1. **Profiling only in desktop Chrome** — desktop GPU hides jank that cripples low-end Android WebView. Test on a real cheap device or throttled emulation.
2. **Omitting `viewport-fit=cover`** — `env(safe-area-inset-*)` resolves to 0; content slides under the notch / home indicator and looks like a wrapped website.
3. **Killing `-webkit-tap-highlight-color` without a replacement press state** — buttons feel dead (no touch acknowledgement). Remove the grey flash *and* add your own `:active` / `:focus-visible` feedback. (Note: the legacy 300ms delay is already gone on modern WebViews via `width=device-width`; `touch-action: manipulation` only suppresses the double-tap-zoom pause.)
4. **Animating `top` / `left` / `width` or shadows on scroll** — forces layout/paint each frame; use `transform` / `opacity`.

## See Also

- `ct-capacitor-ota` — OTA delivery, channels, `notifyAppReady`, and the splash/boot-ordering note.
- `ct-solidjs-patterns` — `lazy()` + `<Suspense>` screen splitting protects webview cold-start.
- `ct-vanilla-extract-patterns` — author the safe-area / logical-property styles; animate `transform`/`opacity` only.
- `ct-i18n-typesafe` — defer locale loading so first paint isn't blocked.
