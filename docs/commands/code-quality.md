# /code-quality

> Run code quality checks (lint, typecheck, format) on a directory or file.

**Type:** Command (slash command)
**Source:** [`core/commands/ct/code-quality.md`](../core/commands/ct/code-quality.md)
**Allowed Tools:** Bash, Read, Glob, Grep

## Usage

```bash
/code-quality [path]
```

## Workflow

1. **Detect project tooling** -- reads `package.json`, `pyproject.toml`, `Makefile`, `Cargo.toml`, or equivalent to identify the linter, typechecker, and formatter configured in the project
2. **Run linting** -- uses the project-configured linter (e.g., `eslint`, `ruff`, `clippy`, `golangci-lint`)
3. **Run type checking** -- uses the project-configured typechecker (e.g., `tsc --noEmit`, `mypy`, `pyright`)
4. **Run format checking** -- uses the project-configured formatter in check mode (e.g., `prettier --check`, `black --check`, `rustfmt --check`)
5. **Compile results** -- produces a structured report

## Output Format

The command produces a structured report with:

- **Lint Issues** -- table with file, line, rule, message, and severity
- **Type Errors** -- table with file, line, and message
- **Format Issues** -- table with file and status
- **Summary** -- total issues across files with actionable suggestions

## Best Practices Reference

| Topic | Guide |
| --- | --- |
| Recommended `tsconfig.json` settings | [TSConfig Cheat Sheet](../best-practices/typescript/tsconfig-cheat-sheet.md) |

## Notes

- Always uses the project's own configuration; does not impose external rules
- For monorepos, scopes checks to the target directory rather than the entire repo
- If a tool is not configured, it is noted and skipped
