---
name: rust-wasm-patterns
description: Rust WASM patterns for Cloudflare Workers with worker-rs
---

# Rust WASM Patterns (Cloudflare Workers)

## Overview

Cloudflare Workers can run Rust compiled to WebAssembly via the `worker` crate (worker-rs). The target is `wasm32-unknown-unknown`. Workers handle HTTP requests at the edge with low latency.

## Project Structure

```
worker/
  Cargo.toml
  src/
    lib.rs          # Entry point with main router
    routes/
      mod.rs
      auth.rs
      api.rs
    models/
      mod.rs
    error.rs        # Custom error types
  wrangler.toml     # Cloudflare config
```

## Cargo.toml Essentials

```toml
[package]
name = "my-worker"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib"]

[dependencies]
worker = "0.4"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
prost = "0.13"          # If using protobuf
console_error_panic_hook = "0.1"
```

## Request Routing

```rust
use worker::*;

#[event(fetch)]
async fn fetch(req: Request, env: Env, _ctx: Context) -> Result<Response> {
    console_error_panic_hook::set_once();

    Router::new()
        .get_async("/api/users/:id", get_user)
        .post_async("/api/users", create_user)
        .run(req, env)
        .await
}
```

## Handler Patterns

```rust
async fn get_user(req: Request, ctx: RouteContext<()>) -> Result<Response> {
    let id = ctx.param("id")
        .ok_or_else(|| Error::RustError("Missing id parameter".into()))?;

    let db = ctx.env.d1("DB")?;
    let stmt = db.prepare("SELECT * FROM users WHERE id = ?1")
        .bind(&[id.into()])?;

    let result = stmt.first::<User>(None).await?;

    match result {
        Some(user) => Response::from_json(&user),
        None => Response::error("Not found", 404),
    }
}
```

## Error Handling

Define a custom error type that converts to worker::Error for clean error propagation.

```rust
use worker::Error as WorkerError;

#[derive(Debug)]
pub enum AppError {
    NotFound(String),
    BadRequest(String),
    Internal(String),
    Unauthorized,
}

impl From<AppError> for WorkerError {
    fn from(e: AppError) -> Self {
        WorkerError::RustError(format!("{:?}", e))
    }
}

impl AppError {
    pub fn to_response(&self) -> worker::Result<Response> {
        match self {
            AppError::NotFound(msg) => Response::error(msg, 404),
            AppError::BadRequest(msg) => Response::error(msg, 400),
            AppError::Internal(msg) => Response::error(msg, 500),
            AppError::Unauthorized => Response::error("Unauthorized", 401),
        }
    }
}
```

## Env Bindings

Access Cloudflare services through the `Env` object.

```rust
// D1 Database
let db = env.d1("DB")?;

// KV Namespace
let kv = env.kv("MY_KV")?;
let value = kv.get("key").text().await?;
kv.put("key", "value")?.expiration_ttl(3600).execute().await?;

// R2 Bucket
let bucket = env.bucket("MY_BUCKET")?;
let object = bucket.get("file.png").execute().await?;

// Environment variables / secrets
let api_key = env.secret("API_KEY")?.to_string();
let config_val = env.var("CONFIG_VAR")?.to_string();
```

## Serde for JSON

```rust
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug)]
pub struct User {
    pub id: String,
    pub email: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub avatar_url: Option<String>,
}

// Parse request body
async fn create_user(mut req: Request, ctx: RouteContext<()>) -> Result<Response> {
    let body: CreateUserRequest = req.json().await?;
    // ...
    Response::from_json(&user)
}
```

## Anti-Patterns

1. **Panics in production** -- Always use `Result` and proper error handling. `unwrap()` and `expect()` will crash the worker. Use `console_error_panic_hook` as a safety net only.
2. **Blocking operations** -- WASM is single-threaded. Never spin-wait or use synchronous I/O. All I/O must be `async`.
3. **Large binary sizes** -- Keep dependencies minimal. Avoid pulling in heavy crates. Use `wasm-opt` for size optimization. Target under 1MB compressed.
4. **Ignoring memory limits** -- Workers have a 128MB memory limit. Do not buffer entire large files in memory; stream them.
5. **Raw SQL string concatenation** -- Always use prepared statements with `bind()` to prevent SQL injection.
6. **Missing CORS headers** -- Workers serving APIs must set appropriate CORS headers. Handle OPTIONS preflight requests.
