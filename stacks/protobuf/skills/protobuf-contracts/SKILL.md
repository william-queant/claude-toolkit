---
name: protobuf-contracts
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

## Anti-Patterns

1. **Reusing field numbers** -- Causes data corruption. Always reserve removed numbers.
2. **Deep nesting** -- Hurts readability and evolution. Flatten where practical.
3. **Missing UNSPECIFIED** -- Proto3 default is 0; without UNSPECIFIED it maps to a real value.
4. **Proto2 syntax** -- Always proto3 for new projects.
5. **Skipping buf lint** -- Inconsistent naming compounds. Lint early.
6. **Large messages** -- Not for multi-MB payloads. Use streaming/chunking.
