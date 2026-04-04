---
name: ct-cloudflare-d1-kv
description: Cloudflare D1 SQL database and KV cache patterns
---

# D1 and KV Patterns

## D1 Conventions

Always use prepared statements with `bind()`. Never concatenate SQL.

```rust
let stmt = db.prepare("SELECT * FROM users WHERE id = ?1").bind(&[id.into()])?;
let user = stmt.first::<User>(None).await?;
```

Batch related queries in a single round trip (transactional -- all succeed or all fail):

```rust
let results = db.batch(vec![
    db.prepare("INSERT INTO events (id, name) VALUES (?1, ?2)").bind(&[id.into(), name.into()])?,
    db.prepare("INSERT INTO event_members (event_id, user_id) VALUES (?1, ?2)").bind(&[id.into(), uid.into()])?,
]).await?;
```

### Schema Rules

- `TEXT` for IDs (UUIDs/nanoids, not auto-increment).
- `TEXT` for timestamps in ISO 8601.
- Always add `created_at` and `updated_at` columns.
- Always index columns used in WHERE/JOIN.
- Use `IF NOT EXISTS`/`IF EXISTS` for idempotent migrations.

### Migration Workflow

```bash
wrangler d1 migrations create DB "add_users_table"
# Edit migrations/0001_add_users_table.sql, then:
wrangler d1 migrations apply DB --local   # test locally first
wrangler d1 migrations apply DB --remote
```

## KV Conventions

KV is eventually-consistent. Use for read-heavy caching only, not primary data.

### Read-Through Cache

```rust
async fn get_cached(kv: &KvStore, db: &D1Database, id: &str) -> Result<User> {
    let key = format!("user:{}", id);
    if let Some(cached) = kv.get(&key).text().await? {
        if let Ok(user) = serde_json::from_str::<User>(&cached) { return Ok(user); }
    }
    let user = db.prepare("SELECT * FROM users WHERE id = ?1")
        .bind(&[id.into()])?.first::<User>(None).await?.ok_or(AppError::NotFound)?;
    kv.put(&key, &serde_json::to_string(&user)?)?.expiration_ttl(3600).execute().await?;
    Ok(user)
}
```

Invalidate on writes: `kv.delete(&format!("user:{}", id)).await?;`

### Key Naming

Colon-separated hierarchical: `user:{id}`, `user:{id}:profile`, `cache:feed:{uid}:page:{n}`

### TTL Guidelines

| Data | TTL | Reason |
|------|-----|--------|
| User profile | 1h | Infrequent changes |
| Session | 24h | Matches session lifetime |
| Config | 5min | Needs fast propagation |
| Public listings | 15min | Freshness vs load balance |

## Anti-Patterns

1. **Unbounded queries** -- Always LIMIT. D1 has 5MB response cap.
2. **Missing indexes** -- D1 is SQLite; no index = full table scan.
3. **KV as primary store** -- Eventually consistent, no queries. Cache only.
4. **Skipping batch** -- Each D1 call is a network round trip.
5. **KV without TTL** -- Stale data persists indefinitely.
6. **Untested migrations** -- Always `--local` before `--remote`.
