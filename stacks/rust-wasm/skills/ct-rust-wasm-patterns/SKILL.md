---
name: ct-rust-wasm-patterns
description: Rust WASM patterns for Cloudflare Workers with worker-rs
---

# Rust WASM Patterns (Cloudflare Workers)

Target: `wasm32-unknown-unknown`. Crate type: `cdylib`. Always set `console_error_panic_hook`.

## Routing and Handlers

```rust
#[event(fetch)]
async fn fetch(req: Request, env: Env, _ctx: Context) -> Result<Response> {
    console_error_panic_hook::set_once();
    Router::new()
        .get_async("/api/users/:id", get_user)
        .post_async("/api/users", create_user)
        .run(req, env).await
}

async fn get_user(req: Request, ctx: RouteContext<()>) -> Result<Response> {
    let id = ctx.param("id").ok_or_else(|| Error::RustError("Missing id".into()))?;
    let db = ctx.env.d1("DB")?;
    match db.prepare("SELECT * FROM users WHERE id = ?1").bind(&[id.into()])?.first::<User>(None).await? {
        Some(user) => Response::from_json(&user),
        None => Response::error("Not found", 404),
    }
}
```

## Error Handling

Define a custom error type converting to `worker::Error`:

```rust
#[derive(Debug)]
pub enum AppError { NotFound(String), BadRequest(String), Internal(String), Unauthorized }

impl From<AppError> for worker::Error {
    fn from(e: AppError) -> Self { worker::Error::RustError(format!("{:?}", e)) }
}
```

## Env Bindings

```rust
let db = env.d1("DB")?;                          // D1
let kv = env.kv("MY_KV")?;                       // KV
let bucket = env.bucket("MY_BUCKET")?;            // R2
let key = env.secret("API_KEY")?.to_string();     // Secrets
let val = env.var("CONFIG_VAR")?.to_string();     // Vars
```

## Serde Conventions

```rust
#[derive(Serialize, Deserialize, Debug)]
pub struct User {
    pub id: String,
    pub email: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub avatar_url: Option<String>,
}
```

Parse body: `let body: CreateUserRequest = req.json().await?;`

## Performance

> _Verified against worker-rs / wasm32-unknown-unknown (2026-06)._

Two costs dominate on Workers: **.wasm size** (eats the startup CPU budget, the 10MB bundle limit, and worst-case cold starts) and the **JS<->WASM boundary** (large Request/Response bodies and serde payloads get *copied* across — not the cost of small calls, the cost of big bytes).

### Binary size — the release profile does the heavy lifting

Most size comes from the Rust build, not `wasm-opt`. In `Cargo.toml`:

```toml
[profile.release]
opt-level = "z"      # "z" = smallest; try "s" — sometimes smaller AND faster, always measure
lto = true           # cross-crate inlining + dead-code elimination
codegen-units = 1    # better optimization, slower build
strip = true         # drop symbols
```

Don't bother with `panic = "abort"` for size: `wasm32-unknown-unknown` already defaults to abort, so there are no unwind tables to drop. Modern `worker-build` recovers from panics automatically — a panicking request returns 500 and the instance reinitializes, no config needed. Keep `console_error_panic_hook` regardless — it surfaces the panic message in your logs.

`worker-build` runs `wasm-opt` automatically before upload (a balanced `-O`, not `-Oz`) — no manual step. For size-aggressive optimization, opt into `-Oz` via the `wasm-opt` key in your Cargo package metadata.

Targets: <1MB compressed is fine; smaller = leaner startup. Use `cargo bloat --release` to find the heavy deps before trimming.

### Boundary — pass bulk data, don't re-copy it; and cut DB round-trips

The boundary cost that bites is copying *large* payloads across JS<->WASM. Deserialize the body once (`req.json().await?`), not field-by-field, and don't shuttle the same buffer back and forth.

Separately, cut **D1 round-trips** — these are network hops, not boundary copies, and they dominate latency. One call beats N:

```rust
// SLOW: one D1 round-trip per id
for id in &ids {
    db.prepare("SELECT * FROM users WHERE id=?1").bind(&[id.into()])?.first::<User>(None).await?;
}

// FAST: expand placeholders, bind every value, one round-trip
let ph = (1..=ids.len()).map(|i| format!("?{i}")).collect::<Vec<_>>().join(",");
let binds = ids.iter().map(|id| id.into()).collect::<Vec<_>>();
let users = db.prepare(format!("SELECT * FROM users WHERE id IN ({ph})"))
    .bind(&binds)?.all().await?.results::<User>()?;
```

For many independent statements in one hop, use `db.batch(vec![...])` (statements run sequentially in a single call).

Hoist binding lookups out of loops — good hygiene, cheap to do:

```rust
let cfg = ctx.env.var("CONFIG")?.to_string();   // once, not per iteration
for row in &rows { /* use cfg */ }
```

WASM wins on CPU-bound bulk work (parsing, crypto, number crunching) kept *inside* Rust. For trivial routing/string work the marshalling overhead can exceed the win — keep those paths thin.

## Anti-Patterns

1. **Panics in production** -- Always `Result`, never `unwrap()`/`expect()`.
2. **Blocking ops** -- WASM is single-threaded. All I/O must be `async`.
3. **Large binaries** -- Minimal deps, use `wasm-opt`, target <1MB compressed.
4. **Buffering large files** -- 128MB memory limit. Stream, don't buffer.
5. **Raw SQL concatenation** -- Always `bind()` prepared statements.
6. **Missing CORS** -- Handle OPTIONS preflight for API workers.
7. **Cargo-culting `panic="abort"`** -- It's already the default on `wasm32-unknown-unknown` (no size win). Set the real size knobs (`opt-level="z"`, `lto=true`, `codegen-units=1`, `strip=true`); `worker-build` already auto-recovers from panics.
8. **Chatty D1 calls** -- Per-row queries each cost a network round-trip. Collapse into one statement (expanded `IN` with bound params) or `db.batch(...)`.
9. **WASM for trivial work** -- Boundary marshalling of small payloads can exceed the compute. Use WASM for bulk CPU work, not tiny string ops; keep large buffers from re-crossing.

## See Also

- `ct-cloudflare-d1-kv` — same D1 round-trip batching (`IN` + bound params, `db.batch()`), documented from the binding side.
- `ct-protobuf-contracts` — decode once / `bytes` over `string`; generate `bytes` fields as `bytes::Bytes` for zero-copy.
