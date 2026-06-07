---
name: ct-protobuf-contracts
description: Protocol Buffer definitions and code generation for frontend/backend contracts
---

# Protobuf Contracts

Proto3 contracts between frontend (TypeScript via protoc-gen-ts) and backend (Rust via prost).

## Conventions

- PascalCase messages, snake_case fields.
- Fields 1-15 cost 1 byte -- reserve for frequent fields.
- Enums always start with `UNSPECIFIED = 0`.
- Package with versioning: `package myapp.v1;`

## Message Patterns

```protobuf
message UserProfile {
  string id = 1;
  string email = 2;
  string display_name = 3;
  optional string avatar_url = 4;
}

// Request/Response pairs
message GetUserRequest { string user_id = 1; }
message GetUserResponse { UserProfile user = 1; }

// Pagination
message ListEventsRequest { int32 page_size = 1; string page_token = 2; }
message ListEventsResponse { repeated Event events = 1; string next_page_token = 2; int32 total_count = 3; }

// Reserved fields -- never reuse removed field numbers
message Event {
  reserved 3, 8;
  reserved "old_field";
  string id = 1;
  string name = 2;
}
```

## Service Definitions

```protobuf
service UserService {
  rpc GetUser(GetUserRequest) returns (GetUserResponse);
  rpc CreateUser(CreateUserRequest) returns (CreateUserResponse);
  rpc ListUsers(ListUsersRequest) returns (ListUsersResponse);
}
```

## Code Generation

Frontend: `buf generate --template buf.gen.ts.yaml`
Backend (build.rs):
```rust
prost_build::Config::new()
    .type_attribute(".", "#[derive(serde::Serialize, serde::Deserialize)]")
    .compile_protos(&["proto/user.proto"], &["proto/"])?;
```

## Versioning Rules

- Never remove/renumber fields -- use `reserved`.
- Never change field types -- add a new field.
- Adding fields and enum values is safe.
- Run `buf breaking --against .git#branch=main` before merging.

## Performance

> _Verified against proto3 / prost / protoc-gen-ts (2026-06)._

Wire format = field tag + value. Tag size depends only on the field NUMBER (`tag = (number << 3) | wire_type`, varint-encoded), so number placement is a perf decision, not just style.

| Field number | Tag bytes |
|---|---|
| 1-15 | 1 |
| 16-2047 | 2 |
| 2048+ | 3 |

```protobuf
// Hot message decoded in tight loops -- keep it small, flat, low numbers.
message Tick {
  int64 ts       = 1;   // 1-byte tag
  double price   = 2;
  repeated int32 levels = 3;  // packed automatically in proto3 (one tag for the whole run)
  string debug_note = 16;     // rarely set -> 2-byte tag, fine up here
}
```

- **Packed repeated scalars are free wins.** `repeated int32/int64/float/double/bool/enum` are packed by default in proto3 (single tag + length, not a tag per element). `repeated string/bytes/message` are NOT packed -- prefer packed scalar arrays over `repeated SomeWrapper` in hot paths.
- **`bytes`, not `string`, for opaque data.** `string` is UTF-8-validated on every decode (prost runs `str::from_utf8` eagerly; protoc-gen-ts runs `TextDecoder` with `fatal`). Use `bytes` for hashes, tokens, IDs, and binary blobs to skip the scan; keep `string` for human-readable text.
- **Keep hot messages flat.** Each nested sub-message is a separate length-delimited decode + allocation in prost. Inline frequent fields; reserve nesting for cold/rare data.
- **Decode once.** prost decodes the whole message eagerly and allocates as it goes -- there are no lazy fields (proto3 `[lazy=true]` is not implemented by prost or protoc-gen-ts). Decode a payload one time and pass the struct around; never re-parse the same bytes. (The one zero-copy lever: generate `bytes` fields as `bytes::Bytes` via `prost_build`'s `.bytes(...)` to borrow from the input buffer instead of copying.)
- **Route without full decode.** Cheapest dispatch/filter is a transport header carried outside the message body. If you must read one field from the payload, neither prost nor protoc-gen-ts exposes a partial-decode API -- you decode the whole message -- so put any field you might hand-scan for at number 1-15 to keep that scan short.

## Anti-Patterns

1. **Reusing field numbers** -- Causes data corruption. Always reserve removed numbers.
2. **Deep nesting** -- Hurts readability and evolution. Flatten where practical.
3. **Missing UNSPECIFIED** -- Proto3 default is 0; without UNSPECIFIED it maps to a real value.
4. **Proto2 syntax** -- Always proto3 for new projects.
5. **Skipping buf lint** -- Inconsistent naming compounds. Lint early.
6. **Large messages** -- Not for multi-MB payloads. Use streaming/chunking.
7. **`string` for binary/opaque data** -- Forces UTF-8 validation on every decode. Use `bytes`.
8. **`repeated` wrapper messages for scalar arrays** -- Loses proto3 packing. Use `repeated int32/double/...` directly in hot paths.
9. **Re-decoding the same payload** -- No lazy fields; every Decode allocates (the only zero-copy path is `bytes` fields generated as `bytes::Bytes`). Decode once, reuse the struct.
10. **High field numbers on hot fields** -- Numbers >=16 cost 2+ tag bytes per occurrence. Keep frequent fields at 1-15.

## See Also

- `ct-rust-wasm-patterns` — the decode-once consumer side; generate `bytes` fields as `bytes::Bytes` to borrow from the input buffer.
