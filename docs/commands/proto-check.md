# /ct:proto-check

> Validate protobuf definitions for correctness, lint compliance, and backward compatibility.

**Type:** Command (slash command)
**Source:** [`core/commands/ct/proto-check.md`](../core/commands/ct/proto-check.md)
**Allowed Tools:** Bash, Read, Glob, Grep

## Usage

```
/ct:proto-check
```

## Workflow

1. **Find proto files** -- locates all `.proto` files and identifies buf configuration (`buf.yaml`, `buf.gen.yaml`)
2. **Run lint checks** -- executes `buf lint` or the project-configured linter
3. **Check for breaking changes** -- runs `buf breaking --against .git#branch=main` to detect backward-incompatible changes:
   - Removing or renaming fields
   - Changing field numbers or types
   - Removing services or RPCs
   - Changing RPC signatures
4. **Regenerate types** -- runs `buf generate` or the project-configured generation command
5. **Verify generated code compiles** -- runs the project's typecheck or build command
6. **Report results**

## Output Format

```markdown
## Protobuf Validation Report

**Proto files found:** {count}
**Buf config:** {path or "not found"}

### Lint Results
- **Status:** pass | fail
- **Issues:** {count}

### Breaking Change Check
- **Status:** pass | fail
- **Against:** {branch or reference}

### Code Generation
- **Status:** success | failure
- **Files generated:** {count}

### Compilation Check
- **Status:** pass | fail

### Summary
{Overall status and recommended actions}
```

## Notes

- Checks for alternative protobuf tooling (`protoc`, `grpc_tools`) if `buf` is not installed
- Reports clearly if no proto files are found
- Breaking changes are flagged for human review, not automatically treated as errors
