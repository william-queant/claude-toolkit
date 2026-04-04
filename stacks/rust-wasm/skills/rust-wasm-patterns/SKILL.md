---
name: rust-wasm-patterns
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

## Anti-Patterns

1. **Panics in production** -- Always `Result`, never `unwrap()`/`expect()`.
2. **Blocking ops** -- WASM is single-threaded. All I/O must be `async`.
3. **Large binaries** -- Minimal deps, use `wasm-opt`, target <1MB compressed.
4. **Buffering large files** -- 128MB memory limit. Stream, don't buffer.
5. **Raw SQL concatenation** -- Always `bind()` prepared statements.
6. **Missing CORS** -- Handle OPTIONS preflight for API workers.
