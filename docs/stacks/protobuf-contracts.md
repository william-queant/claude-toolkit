# Protobuf Contracts

> Protocol Buffer definitions and code generation for frontend/backend contracts.

**Type:** Stack Skill (requires `protobuf` stack)
**Source:** [`stacks/protobuf/skills/protobuf-contracts/SKILL.md`](../stacks/protobuf/skills/protobuf-contracts/SKILL.md)
**Directory Mappings:** `proto/`
**File Extensions:** `.proto`

## Overview

Protocol Buffers (proto3) define the API contract between frontend and backend. Protobuf provides compact binary serialization, type safety across languages, and backward-compatible schema evolution.

## Proto3 Conventions

- Use **PascalCase** for message names, **snake_case** for field names
- Fields 1-15 use 1 byte (reserve for frequent fields), 16-2047 use 2 bytes
- **Never reuse** a field number after removing a field
- When removing fields, reserve the number AND name
- Enums must always start with `UNSPECIFIED = 0`

## Message Patterns

### Request/Response Pairs
```protobuf
message GetUserRequest { string user_id = 1; }
message GetUserResponse { UserProfile user = 1; }
```

### Lists with Pagination
```protobuf
message ListEventsRequest {
  int32 page_size = 1;
  string page_token = 2;
}
message ListEventsResponse {
  repeated Event events = 1;
  string next_page_token = 2;
  int32 total_count = 3;
}
```

### Service Definitions
```protobuf
service UserService {
  rpc GetUser(GetUserRequest) returns (GetUserResponse);
  rpc CreateUser(CreateUserRequest) returns (CreateUserResponse);
  rpc ListUsers(ListUsersRequest) returns (ListUsersResponse);
}
```

## Code Generation

| Target | Tool | Command |
|---|---|---|
| Frontend (TypeScript) | protoc-gen-ts | `buf generate --template buf.gen.ts.yaml` |
| Backend (Rust) | prost-build | Via `build.rs` with `prost_build::Config` |

## Buf CLI Commands

| Command | Purpose |
|---|---|
| `buf lint` | Lint proto files |
| `buf format -w` | Format in place |
| `buf breaking --against .git#branch=main` | Check for breaking changes |
| `buf generate` | Run code generation |

## Versioning Rules

1. **Never remove or renumber fields** -- use `reserved` instead
2. **Never change a field type** -- add a new field with the correct type
3. **Enum values are forever** -- 0 must always be UNSPECIFIED
4. **Adding fields is safe** -- new fields get default values in old clients
5. **Run `buf breaking` before merging** -- catch breaking changes in CI

## Anti-patterns

| Anti-pattern | Why it's wrong |
|---|---|
| **Reusing field numbers** | Causes data corruption. Always reserve removed field numbers. |
| **Overly nested messages** | Deep nesting hurts readability and evolution. Flatten where practical. |
| **Missing UNSPECIFIED enum** | Proto3 requires 0 as default. Without UNSPECIFIED, 0 maps to a real value. |
| **Using proto2 syntax** | Always use proto3 for new projects. |
| **Skipping buf lint** | Inconsistent naming compounds over time. |
| **Large messages** | Protobuf is not designed for multi-MB payloads. Use streaming or chunking. |
