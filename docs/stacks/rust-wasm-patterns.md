# Rust WASM Patterns

> Rust WASM patterns for Cloudflare Workers with worker-rs.

**Type:** Stack Skill (requires `rust-wasm` stack)
**Source:** [`stacks/rust-wasm/skills/ct-rust-wasm-patterns/SKILL.md`](../stacks/rust-wasm/skills/ct-rust-wasm-patterns/SKILL.md)
**Directory Mappings:** `worker/`, `worker/src/`
**File Extensions:** `.rs`, `.toml`

## Overview

Cloudflare Workers can run Rust compiled to WebAssembly via the `worker` crate (worker-rs). The target is `wasm32-unknown-unknown`. Workers handle HTTP requests at the edge with low latency.

## Project Structure

```
worker/
  Cargo.toml
  src/
    lib.rs          # Entry point with main router
    routes/
    models/
    error.rs        # Custom error types
  wrangler.toml     # Cloudflare config
```

## Key Patterns

### Request Routing

```rust
#[event(fetch)]
async fn fetch(req: Request, env: Env, _ctx: Context) -> Result<Response> {
    Router::new()
        .get_async("/api/users/:id", get_user)
        .post_async("/api/users", create_user)
        .run(req, env)
        .await
}
```

### Handler Pattern

```rust
async fn get_user(req: Request, ctx: RouteContext<()>) -> Result<Response> {
    let id = ctx.param("id")
        .ok_or_else(|| Error::RustError("Missing id parameter".into()))?;
    let db = ctx.env.d1("DB")?;
    // ...
}
```

### Error Handling

Define a custom `AppError` enum that converts to `worker::Error`:

```rust
pub enum AppError {
    NotFound(String),
    BadRequest(String),
    Internal(String),
    Unauthorized,
}

impl From<AppError> for WorkerError { ... }
```

### Env Bindings

Access Cloudflare services through the `Env` object:

| Binding | Access |
|---|---|
| D1 Database | `env.d1("DB")?` |
| KV Namespace | `env.kv("MY_KV")?` |
| R2 Bucket | `env.bucket("MY_BUCKET")?` |
| Secrets | `env.secret("API_KEY")?.to_string()` |
| Variables | `env.var("CONFIG_VAR")?.to_string()` |

### Serde for JSON

Use `#[derive(Serialize, Deserialize)]` for request/response types. Parse request bodies with `req.json().await?` and respond with `Response::from_json(&data)`.

## Cargo.toml Essentials

```toml
[lib]
crate-type = ["cdylib"]

[dependencies]
worker = "0.4"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
console_error_panic_hook = "0.1"
```

## Anti-patterns

| Anti-pattern | Why it's wrong |
|---|---|
| **Panics in production** | Always use `Result`. `unwrap()` and `expect()` crash the worker. |
| **Blocking operations** | WASM is single-threaded. All I/O must be `async`. |
| **Large binary sizes** | Keep dependencies minimal. Target under 1MB compressed. |
| **Ignoring memory limits** | Workers have 128MB memory. Stream large files, don't buffer. |
| **Raw SQL string concatenation** | Always use prepared statements with `bind()`. |
| **Missing CORS headers** | Workers serving APIs must handle OPTIONS preflight requests. |
