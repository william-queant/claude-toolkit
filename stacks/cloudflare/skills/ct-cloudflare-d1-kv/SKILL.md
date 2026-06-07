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

## Hyperdrive (External Database Acceleration)

Hyperdrive accelerates connections to external PostgreSQL/MySQL databases from Workers by maintaining regional connection pools. Use it when D1 is insufficient and you need a full relational database.

```toml
# wrangler.toml
[[hyperdrive]]
binding = "HYPERDRIVE"
id = "<hyperdrive-config-id>"
```

```typescript
const sql = env.HYPERDRIVE.connectionString;
// Pass to your Postgres/MySQL client (e.g., node-postgres, drizzle)
```

Key points:
- Eliminates per-request TCP/TLS handshake overhead.
- Caches common read queries automatically.
- Always use Hyperdrive for external database connections from Workers.
- Connection pool size is configurable per Hyperdrive config.

## Performance

> _Verified against Cloudflare Workers / D1 / KV (2026-06)._

Latency on Workers is dominated by **network round trips**, not CPU. Every `await` on D1/KV/`fetch` is a hop -- collapse and parallelize them.

### Don't serialize independent round trips

```rust
// BAD: ~2x latency -- two independent reads run back to back
let user = get_user(&db, id).await?;
let prefs = get_prefs(&kv, id).await?;

// GOOD: one round-trip wall-time -- run concurrently
let (user, prefs) = futures::try_join!(get_user(&db, id), get_prefs(&kv, id))?;
```
```typescript
// TS equivalent
const [user, prefs] = await Promise.all([getUser(db, id), getPrefs(kv, id)]);
```

I/O overlaps in the single-threaded isolate, so wall-time approaches the slowest call. (A Worker can have only ~6 connections waiting on response headers at once -- so fan-out is no substitute for collapsing N reads into one query.)

Kill N+1: never loop per-row queries. Use one `IN (...)`/JOIN, or `db.batch()` of selects.

```rust
// BAD: 1 + N round trips
for id in ids { rows.push(db.prepare("SELECT * FROM u WHERE id=?1").bind(&[id.into()])?.first(None).await?); }
// GOOD: 1 round trip
let placeholders = ids.iter().map(|_| "?").collect::<Vec<_>>().join(",");
let users = db.prepare(&format!("SELECT * FROM u WHERE id IN ({placeholders})"))
    .bind(&binds)?.all().await?.results::<User>()?;   // .all() -> D1Result; .results() -> typed rows
```

### Verify the index is actually used

An index exists != the planner uses it. Functions on columns, leading-`%` LIKE, and TEXT/INT mismatches force a SCAN.

```sql
EXPLAIN QUERY PLAN SELECT * FROM users WHERE email = ?1;
-- want: SEARCH users USING INDEX idx_users_email   (NOT: SCAN users)
```

### Cache API for full responses (not just KV)

`caches.default` is data-center-local (contents don't replicate across colos): sub-ms in-colo, cheaper than a KV read, no eventual-consistency lag. Use it for whole GET responses (only GET is cacheable); use KV read-through for sub-response values. Fill the cache off the response path with `waitUntil`.

```typescript
const cache = caches.default;
let res = await cache.match(request);
if (!res) {
  res = await render(request);                 // Cache-Control sets TTL
  ctx.waitUntil(cache.put(request, res.clone())); // non-blocking write
}
return res;
```

`cache.put` rejects non-GET, `206`, `Vary: *`, and `Set-Cookie` responses (strip the cookie or set `Cache-Control: private=Set-Cookie` first).

Same rule for cache/KV writes and invalidation: `ctx.waitUntil(kv.put(...))` so writes never add to TTFB.

### Stream instead of buffering

Buffering the full body adds total generation time to TTFB. Return a `ReadableStream` (or pipe an upstream body) so bytes flush as produced.

### Smart Placement for origin/Hyperdrive-heavy Workers

Smart Placement moves the isolate closer to your **back-end** (origin APIs, or an external Postgres/MySQL behind Hyperdrive) when latency is dominated by multiple **sequential** calls to it:

```toml
# wrangler.toml
[placement]
mode = "smart"
```

It does **not** help D1 or KV: D1 routing is governed by the primary-instance location + read replication (use the Sessions API to read from a nearby replica), and KV is already served from the data center the Worker runs in. Leave Smart Placement off for single-hop, D1/KV-only, or static-heavy Workers.

## Anti-Patterns

1. **Unbounded queries** -- Always LIMIT. D1 has 5MB response cap.
2. **Missing indexes** -- D1 is SQLite; no index = full table scan.
3. **KV as primary store** -- Eventually consistent, no queries. Cache only.
4. **Skipping batch** -- Each D1 call is a network round trip.
5. **KV without TTL** -- Stale data persists indefinitely.
6. **Untested migrations** -- Always `--local` before `--remote`.
7. **Sequential awaits on independent reads** -- each is a round trip; use `try_join!`/`Promise.all`.
8. **Per-row query loops (N+1)** -- batch into one `IN (...)`/JOIN or `db.batch()`.
9. **Awaiting cache/KV writes before responding** -- use `ctx.waitUntil()` so puts don't add to TTFB.
10. **Assuming the index is used** -- check `EXPLAIN QUERY PLAN` for `USING INDEX`, not `SCAN`.
11. **Smart Placement for D1/KV latency** -- it targets origins/Hyperdrive, not D1/KV; use D1 read replication (Sessions API) instead.

## See Also

- `ct-rust-wasm-patterns` — the same D1 round-trip / `IN`-with-bound-params batching, from the Rust handler side.
