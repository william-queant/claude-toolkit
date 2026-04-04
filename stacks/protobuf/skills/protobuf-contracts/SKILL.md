---
name: protobuf-contracts
description: Protocol Buffer definitions and code generation for frontend/backend contracts
---

# Protobuf Contracts

## Overview

Protocol Buffers (proto3) define the API contract between the SolidJS frontend and Rust backend. Protobuf provides compact binary serialization, type safety across languages, and backward-compatible schema evolution.

## Proto3 Syntax Conventions

```protobuf
syntax = "proto3";

package rendezvous.v1;

option java_multiple_files = true;

// Use descriptive message names in PascalCase
// Use snake_case for field names
message UserProfile {
  string id = 1;
  string email = 2;
  string display_name = 3;
  optional string avatar_url = 4;
  int64 created_at_unix = 5;
}
```

## Message Design

### Field Numbering Rules
- Fields 1-15 use 1 byte for the tag -- reserve these for frequently used fields.
- Fields 16-2047 use 2 bytes.
- Never reuse a field number after removing a field.

### Reserved Fields
When removing a field, reserve the number AND name to prevent accidental reuse.
```protobuf
message Event {
  reserved 3, 8;
  reserved "old_field", "deprecated_field";

  string id = 1;
  string name = 2;
  // field 3 was removed (old_field)
}
```

### Wrapper and Common Patterns
```protobuf
// Request/Response pairs
message GetUserRequest {
  string user_id = 1;
}

message GetUserResponse {
  UserProfile user = 1;
}

// Lists with pagination
message ListEventsRequest {
  int32 page_size = 1;
  string page_token = 2;
}

message ListEventsResponse {
  repeated Event events = 1;
  string next_page_token = 2;
  int32 total_count = 3;
}

// Enums: always start with UNSPECIFIED = 0
enum EventStatus {
  EVENT_STATUS_UNSPECIFIED = 0;
  EVENT_STATUS_DRAFT = 1;
  EVENT_STATUS_PUBLISHED = 2;
  EVENT_STATUS_CANCELLED = 3;
}
```

## Service Definitions

Define API contracts as services with RPC methods.

```protobuf
service UserService {
  // Get a single user by ID
  rpc GetUser(GetUserRequest) returns (GetUserResponse);

  // Create a new user
  rpc CreateUser(CreateUserRequest) returns (CreateUserResponse);

  // List users with pagination
  rpc ListUsers(ListUsersRequest) returns (ListUsersResponse);

  // Update user profile
  rpc UpdateUser(UpdateUserRequest) returns (UpdateUserResponse);
}
```

## Code Generation

### Frontend (TypeScript) -- protoc-gen-ts
Generates TypeScript types and serialization/deserialization functions.
```bash
buf generate --template buf.gen.ts.yaml
```

### Backend (Rust) -- prost
Generates Rust structs with serde support via `prost-build`.
```rust
// build.rs
fn main() {
    prost_build::Config::new()
        .type_attribute(".", "#[derive(serde::Serialize, serde::Deserialize)]")
        .compile_protos(&["proto/user.proto"], &["proto/"])
        .unwrap();
}
```

## Buf CLI

Use Buf for linting, formatting, and breaking change detection.

### buf.yaml
```yaml
version: v2
modules:
  - path: proto
lint:
  use:
    - DEFAULT
breaking:
  use:
    - FILE
```

### Common Commands
```bash
buf lint                    # Lint proto files
buf format -w               # Format in place
buf breaking --against .git#branch=main  # Check for breaking changes
buf generate                # Run code generation
```

## Versioning Rules

1. **Never remove or renumber fields** -- use `reserved` instead.
2. **Never change a field type** -- add a new field with the correct type.
3. **Enum values are forever** -- the 0 value must always be UNSPECIFIED.
4. **Adding fields is safe** -- new fields get default values in old clients.
5. **Adding enum values is safe** -- but old clients will see the numeric value.
6. **Run `buf breaking` before merging** -- catch breaking changes in CI.

## Anti-Patterns

1. **Reusing field numbers** -- Causes data corruption. Always reserve removed field numbers.
2. **Overly nested messages** -- Deep nesting hurts readability and makes evolution harder. Flatten where practical.
3. **Missing UNSPECIFIED enum value** -- Proto3 requires 0 as default. Without UNSPECIFIED, 0 maps to a real value, causing confusion.
4. **Using proto2 syntax** -- Always use proto3 for new projects. Proto2 has different default value semantics.
5. **Skipping buf lint** -- Inconsistent naming and structure compounds over time. Lint early, lint often.
6. **Large messages** -- Protobuf is not designed for multi-MB payloads. Use streaming or chunking for large data.
