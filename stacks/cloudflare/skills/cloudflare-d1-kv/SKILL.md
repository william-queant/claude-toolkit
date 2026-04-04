---
name: cloudflare-d1-kv
description: Cloudflare D1 SQL database and KV cache patterns
---

# Cloudflare D1 and KV Patterns

## D1 Database

D1 is Cloudflare's serverless SQLite database, accessible from Workers via env bindings.

### Prepared Statements with bind()

Always use prepared statements. Never concatenate SQL strings.

```rust
// Single query
let stmt = db.prepare("SELECT * FROM users WHERE id = ?1")
    .bind(&[id.into()])?;
let user = stmt.first::<User>(None).await?;

// Insert
let stmt = db.prepare("INSERT INTO users (id, email, name) VALUES (?1, ?2, ?3)")
    .bind(&[id.into(), email.into(), name.into()])?;
stmt.run().await?;

// Update
let stmt = db.prepare("UPDATE users SET name = ?1 WHERE id = ?2")
    .bind(&[name.into(), id.into()])?;
let result = stmt.run().await?;
```

### Batch Operations

Execute multiple statements in a single round trip for better performance.

```rust
let results = db.batch(vec![
    db.prepare("INSERT INTO events (id, name) VALUES (?1, ?2)")
        .bind(&[id1.into(), name1.into()])?,
    db.prepare("INSERT INTO event_members (event_id, user_id) VALUES (?1, ?2)")
        .bind(&[id1.into(), user_id.into()])?,
]).await?;
```

Batch operations are transactional -- all succeed or all fail.

### Migration Workflow

```bash
# Create a new migration
wrangler d1 migrations create DB "add_users_table"

# This creates: migrations/0001_add_users_table.sql
# Edit the SQL file:
```

```sql
-- migrations/0001_add_users_table.sql
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_users_email ON users(email);
```

```bash
# Apply migrations locally
wrangler d1 migrations apply DB --local

# Apply to remote
wrangler d1 migrations apply DB --remote
```

### Schema Conventions

- Use `TEXT` for IDs (UUIDs/nanoids, not auto-increment integers).
- Use `TEXT` for timestamps in ISO 8601 format.
- Always add `created_at` and `updated_at` columns.
- Always create indexes for columns used in WHERE clauses and JOINs.
- Use `IF NOT EXISTS` / `IF EXISTS` for idempotent migrations.

## KV Namespace

KV is an eventually-consistent key-value store. Best for read-heavy data that tolerates slight staleness.

### Read-Through Caching Pattern

```rust
async fn get_user_cached(kv: &KvStore, db: &D1Database, user_id: &str) -> Result<User> {
    let cache_key = format!("user:{}", user_id);

    // Try cache first
    if let Some(cached) = kv.get(&cache_key).text().await? {
        if let Ok(user) = serde_json::from_str::<User>(&cached) {
            return Ok(user);
        }
    }

    // Cache miss -- query DB
    let stmt = db.prepare("SELECT * FROM users WHERE id = ?1")
        .bind(&[user_id.into()])?;
    let user = stmt.first::<User>(None).await?
        .ok_or(AppError::NotFound("User not found".into()))?;

    // Populate cache with TTL
    let json = serde_json::to_string(&user)?;
    kv.put(&cache_key, &json)?
        .expiration_ttl(3600) // 1 hour
        .execute()
        .await?;

    Ok(user)
}
```

### TTL Strategies

| Data Type | TTL | Rationale |
|-----------|-----|-----------|
| User profile | 1 hour | Changes infrequently |
| Session data | 24 hours | Matches session lifetime |
| Config/settings | 5 minutes | Needs faster propagation |
| Public listings | 15 minutes | Balances freshness and load |

### Key Naming Conventions

Use colon-separated hierarchical keys:
```
user:{userId}
user:{userId}:profile
event:{eventId}
event:{eventId}:members
session:{sessionToken}
cache:feed:{userId}:page:{pageNum}
```

### Cache Invalidation

Invalidate on write operations:
```rust
async fn update_user(kv: &KvStore, db: &D1Database, user: &User) -> Result<()> {
    // Update DB
    let stmt = db.prepare("UPDATE users SET name = ?1, updated_at = ?2 WHERE id = ?3")
        .bind(&[user.name.clone().into(), now().into(), user.id.clone().into()])?;
    stmt.run().await?;

    // Invalidate cache
    kv.delete(&format!("user:{}", user.id)).await?;

    Ok(())
}
```

## Wrangler Configuration

```toml
# wrangler.toml
name = "my-worker"
main = "build/worker/shim.mjs"
compatibility_date = "2024-01-01"

[build]
command = "cargo install -q worker-build && worker-build --release"

[[d1_databases]]
binding = "DB"
database_name = "my-app-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"

[[kv_namespaces]]
binding = "KV"
id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

[vars]
ENVIRONMENT = "production"
```

## Local Development

```bash
# Start local dev server with all bindings
wrangler dev

# With local D1 persistence
wrangler dev --local --persist-to .wrangler/state

# Execute SQL against local D1
wrangler d1 execute DB --local --command "SELECT * FROM users"
```

## Anti-Patterns

1. **Unbounded queries** -- Always use LIMIT. D1 has a 5MB response size limit. `SELECT * FROM large_table` will fail on large datasets.
2. **Missing indexes** -- D1 is SQLite; without indexes, every query is a full table scan. Add indexes for all WHERE and JOIN columns.
3. **KV as primary data store** -- KV is eventually consistent and has no query capability. Use D1 for primary data, KV for caching only.
4. **Ignoring batch operations** -- Each D1 call is a network round trip. Batch related queries for better performance.
5. **Long-lived KV cache without TTL** -- Always set expiration_ttl. Stale data without TTL persists indefinitely.
6. **Not testing migrations locally** -- Always apply migrations locally first with `--local` before applying to remote.
