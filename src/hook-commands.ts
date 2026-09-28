/**
 * Commands for the generated Claude Code hooks. Config values are placed verbatim into
 * shell commands, so every one is checked against HOOK_COMMAND_PATTERN first
 * (assertValidHookCommands, called by resolveConfig before anything is written).
 */
import type { HookConfig } from "./types.js";

/**
 * A hook command may contain only letters, digits, spaces and . _ / @ : = + -.
 * That excludes quotes, $, backticks, ;, |, &, <, >, parentheses, globs, ~, # and
 * newlines, so the shell can only split an allowlisted value into plain words.
 * Anything more complex belongs in a package.json script, run as `bun run <script>`.
 */
export const HOOK_COMMAND_PATTERN = /^[A-Za-z0-9 ._/@:=+-]+$/;

/** HookConfig fields that hold a single command. */
const COMMAND_FIELDS = ["formatter", "testRunner", "typeCheck", "installCommand"] as const;

/** Command words that would make sh run or re-parse the edited file itself. */
const FILE_EVALUATORS = new Set(["eval", "exec", "command", ".", "source"]);
const SHELLS = new Set(["sh", "bash", "dash", "zsh"]);

/**
 * True when `command` may be placed into a generated hook command: allowlisted characters,
 * and a first word (after VAR=value assignments) that names a program, so the edited file
 * passed after it is only ever an argument.
 */
export function isAllowedHookCommand(command: string): boolean {
	if (!HOOK_COMMAND_PATTERN.test(command)) return false;
	const words = command
		.trim()
		.split(/\s+/)
		.filter((word) => !word.includes("="));
	const first = words[0];
	if (!first || first.startsWith("-") || FILE_EVALUATORS.has(first)) return false;
	return !(SHELLS.has(first) && words.includes("-c"));
}

/** Throw a clear error naming `field` and its value unless the value is an allowlisted command. */
function assertAllowed(field: string, value: unknown): void {
	if (typeof value === "string" && isAllowedHookCommand(value)) return;
	throw new Error(
		`Invalid ${field} in the claude-toolkit config: ${JSON.stringify(value)}. ` +
			"Hook commands may only contain letters, digits, spaces and . _ / @ : = + - " +
			"(no quotes, $, ;, |, &, <, > or newlines) and must start with the program to run " +
			'(not eval, exec, command, ., source, sh -c or an option). Move anything else into a package.json script and use "bun run <script>".',
	);
}

/**
 * Throw a clear error naming the first hook command that fails HOOK_COMMAND_PATTERN.
 * An unset or empty command means "no hook" and is not checked.
 */
export function assertValidHookCommands(hooks: HookConfig): void {
	const fields: Record<string, unknown> = { ...hooks };
	for (const field of COMMAND_FIELDS) {
		const value = fields[field];
		if (value === undefined || value === null || value === "") continue;
		assertAllowed(`hooks.${field}`, value);
	}
	const extraChecks: unknown = hooks.extraChecks;
	if (extraChecks === undefined) return;
	if (!Array.isArray(extraChecks)) {
		throw new Error(
			`Invalid hooks.extraChecks in the claude-toolkit config: ${JSON.stringify(extraChecks)}. Use an array of commands.`,
		);
	}
	for (const [index, check] of extraChecks.entries()) {
		assertAllowed(`hooks.extraChecks[${index}]`, check);
	}
}

/** First-line prefix of every toolkit-owned hook command in settings.json. */
export const TOOLKIT_HOOK_MARKER = "# claude-toolkit:";

/** The fs-only helper the PostToolUse hooks call (core/hooks/hook-input.cjs). */
const HOOK_INPUT = 'node "$CLAUDE_PROJECT_DIR/.claude/hooks/hook-input.cjs"';

/** Every PostToolUse hook starts here: read the edited file; a leading "-" never becomes an option. */
const PREAMBLE = [`f="$(${HOOK_INPUT} path)"`, 'case "$f" in -*) f="./$f";; esac'];

/**
 * Run from the edited file's checkout, and leave files git ignores alone. CLAUDE_PROJECT_DIR
 * stays at the main checkout when Claude works in a worktree (by default under the gitignored
 * .claude/worktrees/), so a file in another checkout of the repo runs from that checkout's root.
 */
const PROJECT_LINES = [
	'root="$CLAUDE_PROJECT_DIR"',
	'top="$(git -C "$(dirname -- "$f")" rev-parse --show-toplevel 2>/dev/null)" && [ "$top" != "$(git -C "$root" rev-parse --show-toplevel 2>/dev/null)" ] && root="$top"',
	'cd "$root" || exit 0',
	'git check-ignore -q -- "$f" 2>/dev/null && exit 0',
];

/** Files each hook reacts to, as sh `case` patterns. */
const FORMAT_PATTERNS = ["*.js", "*.jsx", "*.ts", "*.tsx", "*.mjs", "*.cjs", "*.mts", "*.cts"];
const TEST_PATTERNS = [
	"*.test.js",
	"*.test.jsx",
	"*.test.ts",
	"*.test.tsx",
	"*.spec.js",
	"*.spec.jsx",
	"*.spec.ts",
	"*.spec.tsx",
];
const TYPECHECK_PATTERNS = ["*.ts", "*.tsx", "*.mts", "*.cts"];
const EXTRA_CHECK_PATTERNS = ["*.rs"];
const INSTALL_PATTERNS = ["package.json", "*/package.json"];

/** Words after which the next non-flag word names the tool: `bun run x`, `pnpm exec x`, `npx x`. */
const TOOL_PREFIXES = new Set(["run", "exec", "x", "npx", "bunx"]);

/**
 * The executables an allowlisted command needs. `runner` is its first word (after any
 * VAR=value assignments); `tool` is the first non-flag word after run, exec, x, npx or
 * bunx, or the runner itself when there is none.
 */
export function commandTools(command: string): { runner: string; tool: string } {
	const words = command
		.trim()
		.split(/\s+/)
		.filter((word) => !word.includes("="));
	const runner = words[0] ?? "";
	const at = words.findIndex((word) => TOOL_PREFIXES.has(word));
	const tool = at === -1 ? undefined : words.slice(at + 1).find((word) => !word.startsWith("-"));
	return { runner, tool: tool ?? runner };
}

/** sh lines that exit 0 silently unless the command's runner and tool are installed. */
function toolGuard(command: string): string[] {
	// runner and tool are words of an allowlisted command (HOOK_COMMAND_PATTERN): no shell syntax.
	const { runner, tool } = commandTools(command);
	const runnerLine = `command -v ${runner} >/dev/null 2>&1 || exit 0`;
	// A bare command (no run/exec/x/npx/bunx) is found by sh through PATH only: a
	// node_modules/.bin entry or package.json script of that name cannot run it.
	if (runner === tool) return [runnerLine];
	return [
		runnerLine,
		`${HOOK_INPUT} has-tool ${tool} || command -v ${tool} >/dev/null 2>&1 || exit 0`,
	];
}

/** A PostToolUse hook that runs one allowlisted command after matching edits. */
interface EditHook {
	/** Marker id: the command's first line is `# claude-toolkit:<id>`. */
	id: string;
	/** Edited files the hook reacts to (sh `case` patterns). */
	patterns: string[];
	/** Allowlisted command to run. */
	command: string;
	/** Pass the edited file as the command's last argument. */
	withFile: boolean;
	/** Seconds before Claude Code cancels the hook. */
	timeout: number;
}

/**
 * POSIX sh for an edit hook. It never blocks: on success it prints nothing; on failure
 * it prints PostToolUse JSON whose additionalContext carries the output's last lines.
 * Both paths exit 0.
 */
function editHookCommand(hook: EditHook): string {
	// hook.command passed assertValidHookCommands (HOOK_COMMAND_PATTERN): plain words only,
	// so it is safe unquoted here and inside the double-quoted context title below.
	const run = hook.withFile ? `${hook.command} "$f"` : hook.command;
	return [
		`${TOOLKIT_HOOK_MARKER}${hook.id}`,
		...PREAMBLE,
		`case "$f" in ${hook.patterns.join("|")}) ;; *) exit 0;; esac`,
		...PROJECT_LINES,
		...toolGuard(hook.command),
		`out="$(${run} 2>&1)" && exit 0`,
		`printf '%s\\n' "$out" | ${HOOK_INPUT} context "claude-toolkit ${hook.id} hook: ${hook.command} failed for $f"`,
		"exit 0",
	].join("\n");
}

/**
 * POSIX sh for the auto-install hook. The install's last 20 output lines go to stderr
 * (Claude Code's debug log); a failure is also reported to Claude as context. Exits 0.
 */
function installHookCommand(command: string): string {
	// command passed assertValidHookCommands (HOOK_COMMAND_PATTERN): plain words only.
	return [
		`${TOOLKIT_HOOK_MARKER}install`,
		...PREAMBLE,
		`case "$f" in ${INSTALL_PATTERNS.join("|")}) ;; *) exit 0;; esac`,
		...PROJECT_LINES,
		...toolGuard(command),
		`out="$(${command} 2>&1)"`,
		"rc=$?",
		`printf '%s\\n' "$out" | tail -n 20 >&2`,
		'[ "$rc" -eq 0 ] && exit 0',
		`printf '%s\\n' "$out" | ${HOOK_INPUT} context "claude-toolkit install hook: ${command} failed after $f changed"`,
		"exit 0",
	].join("\n");
}

/** A command handler in settings.json. */
export interface CommandHook {
	type: "command";
	command: string;
	timeout: number;
}

/** The PostToolUse hooks for resolved (allowlisted) hook settings, in run order. */
export function buildPostToolUseHooks(hooks: HookConfig): CommandHook[] {
	const edits: EditHook[] = [];
	if (hooks.formatter) {
		edits.push({
			id: "format",
			patterns: FORMAT_PATTERNS,
			command: hooks.formatter,
			withFile: true,
			timeout: 30,
		});
	}
	if (hooks.testRunner) {
		edits.push({
			id: "test",
			patterns: TEST_PATTERNS,
			command: hooks.testRunner,
			withFile: true,
			timeout: 90,
		});
	}
	if (hooks.typeCheck) {
		edits.push({
			id: "typecheck",
			patterns: TYPECHECK_PATTERNS,
			command: hooks.typeCheck,
			withFile: false,
			timeout: 60,
		});
	}
	for (const [index, command] of (hooks.extraChecks ?? []).entries()) {
		edits.push({
			id: `extra-${index}`,
			patterns: EXTRA_CHECK_PATTERNS,
			command,
			withFile: false,
			timeout: 60,
		});
	}
	const result: CommandHook[] = edits.map((hook) => ({
		type: "command",
		command: editHookCommand(hook),
		timeout: hook.timeout,
	}));
	if (hooks.installCommand) {
		result.push({
			type: "command",
			command: installHookCommand(hooks.installCommand),
			timeout: 120,
		});
	}
	return result;
}
