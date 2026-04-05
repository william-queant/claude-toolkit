# Cloudflare D1 and KV Patterns

> Cloudflare D1 SQL database and KV cache patterns.

**Type:** Stack Skill (requires `cloudflare` stack)
**Source:** [`stacks/cloudflare/skills/ct-cloudflare-d1-kv/SKILL.md`](../stacks/cloudflare/skills/ct-cloudflare-d1-kv/SKILL.md)
**Directory Mappings:** `src/db/`, `migrations/`
**File Extensions:** `.sql`

## Overview

D1 is Cloudflare's serverless SQLite database, and KV is an eventually-consistent key-value store. Together they provide primary data storage and read-heavy caching for Workers.

## D1 Database

### Prepared Statements

Always use prepared statements with `.bind()` -- never concatenate SQL strings.

```rust
let stmt = db.prepare("SELECT * FROM users WHERE id = ?1")
    .bind(&[id.into()])?;
let user = stmt.first::<User>(None).await?;
```

### Batch Operations

Execute multiple statements in a single round trip. Batch operations are transactional -- all succeed or all fail.

```rust
let results = db.batch(vec![
    db.prepare("INSERT INTO events ...").bind(&[...])?,
    db.prepare("INSERT INTO event_members ...").bind(&[...])?,
]).await?;
```

### Migration Workflow

```bash
wrangler d1 migrations create DB "add_users_table"   # Create migration
wrangler d1 migrations apply DB --local               # Apply locally
wrangler d1 migrations apply DB --remote              # Apply to remote
```

### Schema Conventions

- Use `TEXT` for IDs (UUIDs/nanoids, not auto-increment integers)
- Use `TEXT` for timestamps in ISO 8601 format
- Always add `created_at` and `updated_at` columns
- Create indexes for columns used in WHERE clauses and JOINs
- Use `IF NOT EXISTS` / `IF EXISTS` for idempotent migrations
- D1 has a **5MB response size limit** -- always use LIMIT

## KV Namespace

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

    // Cache miss -- query DB, then populate cache with TTL
    let user = /* query D1 */;
    kv.put(&cache_key, &json)?.expiration_ttl(3600).execute().await?;
    Ok(user)
}
```

### TTL Strategies

| Data Type | TTL | Rationale |
|---|---|---|
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

Invalidate on write operations by deleting the corresponding cache key after updating D1.

## Anti-patterns

| Anti-pattern | Why it's wrong |
|---|---|
| **Unbounded queries** | Always use LIMIT. D1 has a 5MB response limit. |
| **Missing indexes** | D1 is SQLite; without indexes, every query is a full table scan. |
| **KV as primary data store** | KV is eventually consistent with no query capability. Use D1 for primary data. |
| **Ignoring batch operations** | Each D1 call is a network round trip. Batch for performance. |
| **KV cache without TTL** | Stale data without TTL persists indefinitely. |
| **Not testing migrations locally** | Always apply with `--local` before `--remote`. |
