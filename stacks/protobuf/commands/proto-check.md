---
description: Validate protobuf definitions and check for breaking changes
allowed-tools:
  - Bash(buf:*)
  - Bash(protoc:*)
  - Bash(npm run:*)
  - Bash(pnpm:*)
  - Bash(bun run:*)
  - Bash(yarn:*)
  - Bash(tsc:*)
  - Bash(cargo build:*)
  - Bash(cargo check:*)
  - Bash(go build:*)
  - Read
  - Glob
  - Grep
---

# Protobuf Validation

Validate protobuf definitions for correctness, lint compliance, and backward compatibility. Regenerate types and verify the generated code compiles.

## Workflow

1. **Find proto files.** Locate all `.proto` files in the project. Identify the buf configuration (`buf.yaml`, `buf.gen.yaml`) or other protobuf tooling in use.

2. **Run lint checks.** Execute `buf lint` (or the project-configured linter) against proto definitions. Report any style or correctness violations.

3. **Check for breaking changes.** Run `buf breaking --against .git#branch=main` (or equivalent) to detect backward-incompatible changes. Common breaking changes include:
   - Removing or renaming fields
   - Changing field numbers
   - Changing field types
   - Removing services or RPCs
   - Changing RPC signatures

4. **Regenerate types.** Run `buf generate` (or the project-configured generation command) to regenerate code from proto definitions.

5. **Verify generated code compiles.** Run the project's typecheck or build command to ensure the regenerated code is valid and integrates correctly with the rest of the codebase.

6. **Report results.**

## Output Format

```markdown
## Protobuf Validation Report

**Proto files found:** {count}
**Buf config:** {path or "not found"}

### Lint Results
- **Status:** {pass | fail}
- **Issues:** {count}

| File | Line | Rule | Message |
|------|------|------|---------|
| ...  | ...  | ...  | ...     |

### Breaking Change Check
- **Status:** {pass | fail}
- **Against:** {branch or reference}
- **Breaking changes found:** {count}

| File | Change | Description |
|------|--------|-------------|
| ...  | ...    | ...         |

### Code Generation
- **Status:** {success | failure}
- **Files generated:** {count}

### Compilation Check
- **Status:** {pass | fail}
- **Errors:** {if any}

### Summary
{Overall status and recommended actions}
```

## Notes

- If `buf` is not installed, check for alternative protobuf tooling (`protoc`, `grpc_tools`, etc.) before reporting failure.
- If no proto files are found, report that clearly rather than failing silently.
- Breaking changes are not always wrong — they just need to be intentional. Flag them for human review rather than treating them as errors.
