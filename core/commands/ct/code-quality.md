---
description: "Run code quality checks on a directory or file"
allowed-tools:
  - Bash
  - Read
  - Glob
  - Grep
---

# Code Quality Check

Run lint, typecheck, and format checks against the target directory or file. Report all issues found and suggest fixes.

## Workflow

1. **Detect project tooling** by reading `package.json`, `pyproject.toml`, `Makefile`, `Cargo.toml`, or equivalent config files in the project root. Identify which linter, typechecker, and formatter are configured.

2. **Run linting** using the project-configured linter (e.g., `eslint`, `ruff`, `clippy`, `golangci-lint`). If no linter is configured, note it and skip.

3. **Run type checking** using the project-configured typechecker (e.g., `tsc --noEmit`, `mypy`, `pyright`). If no typechecker is configured, note it and skip.

4. **Run format checking** using the project-configured formatter in check mode (e.g., `prettier --check`, `black --check`, `rustfmt --check`, `gofmt -l`). If no formatter is configured, note it and skip.

5. **Compile results** into a structured report.

## Output Format

```markdown
## Code Quality Report

**Target:** {path}
**Tools detected:** {list of tools found}

### Lint Issues ({count})
| File | Line | Rule | Message | Severity |
|------|------|------|---------|----------|
| ...  | ...  | ...  | ...     | ...      |

### Type Errors ({count})
| File | Line | Message |
|------|------|---------|
| ...  | ...  | ...     |

### Format Issues ({count})
| File | Status |
|------|--------|
| ...  | ...    |

### Summary
- {total} issues found across {files} files
- **Suggested fixes:** {actionable suggestions}
```

## Notes

- Always use the project's own configuration. Do not impose external rules.
- If a tool exits with a non-zero code, capture its output rather than treating it as a failure.
- For monorepos, scope checks to the target directory rather than the entire repo.
- If the user provides a specific file or directory, check only that scope.
