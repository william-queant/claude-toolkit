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

/** Hook commands for new configs: the config template and the first run's in-memory config. */
export const DEFAULT_HOOKS = {
	formatter: "bun run biome format --write",
	testRunner: "bun run vitest run",
	typeCheck: "bun run tsc --noEmit",
} as const satisfies HookConfig;

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

/**
 * UserPromptSubmit: suggest skills that may be relevant (core/hooks/skill-eval.cjs).
 * The placeholder stays literal: Claude Code substitutes CLAUDE_PROJECT_DIR when the hook runs.
 */
export const SKILL_EVAL_COMMAND = `${TOOLKIT_HOOK_MARKER}skill-eval\nnode "\${CLAUDE_PROJECT_DIR}/.claude/hooks/skill-eval.cjs"`;

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

/** Where `has-tool` looks for a tool; see core/hooks/hook-input.cjs. */
export type Scope = "any" | "script" | "bin" | "local";

/** The tool a package-manager command needs, and where its runner looks for it. */
export interface ToolCheck {
	tool: string;
	/** Directory the command runs in, relative to the checkout root. */
	dir: string;
	/** `script`: package.json scripts only. `bin`: .bin entries here and in parent directories. `local`: .bin here only. */
	scope: Scope;
	/** The tool may also be an executable on the PATH. */
	path: boolean;
	/** Yarn Plug'n'Play has no node_modules/.bin: a .pnp.cjs satisfies the check. */
	pnp: boolean;
}

/** `check` is null when only the runner is guarded: the command runs and a failure reaches Claude. */
export interface ParsedCommand {
	runner: string;
	check: ToolCheck | null;
	/** The tool cannot be identified and the runner would download a missing package: never run. */
	blocked?: boolean;
}

/** The flags of one package manager that change how its command is read. */
interface Flags {
	/** Take a value and set the directory the command runs in. */
	dir?: string[];
	/** True when that directory is the only place the runner looks (npm's `--prefix`). */
	localDir?: boolean;
	/** Take a value and select workspaces. */
	workspace?: string[];
	/** Select workspaces without a value. */
	workspaceBool?: string[];
	/** Take a value and change nothing else. */
	values?: string[];
	/** Take no value. */
	booleans?: string[];
}

const flagTable = (f: Flags) => ({
	dir: new Set(f.dir ?? []),
	localDir: f.localDir ?? false,
	workspace: new Set(f.workspace ?? []),
	workspaceBool: new Set(f.workspaceBool ?? []),
	values: new Set(f.values ?? []),
	booleans: new Set(f.booleans ?? []),
});
type FlagTable = ReturnType<typeof flagTable>;

// Flag tables checked against bun 1.3, npm 10 and 11, pnpm 8 to 12 and Yarn 1 and 4. A flag
// that is in no table makes the command run without a tool check, never with a wrong one.
const BUN = flagTable({
	dir: ["--cwd"],
	workspace: ["--filter", "-F"],
	values: [
		"--env-file",
		"--conditions",
		"--preload",
		"-r",
		"--config",
		"-c",
		"--shell",
		"--elide-lines",
	],
	booleans: ["--bun", "-b", "--silent", "--if-present", "--no-install"],
});
const BUNX = flagTable({
	values: ["-p", "--package", "--cache-dir", "--registry", "--config"],
	booleans: ["--bun", "-b", "--silent", "--no-install", "--verbose"],
});
const NPM = flagTable({
	dir: ["--prefix", "-C"],
	localDir: true,
	workspace: ["-w", "--workspace"],
	workspaceBool: ["--workspaces", "-ws", "--include-workspace-root"],
	values: [
		"-p",
		"--package",
		"-c",
		"--call",
		"--script-shell",
		"--loglevel",
		"--registry",
		"--cache",
		"--userconfig",
		"--globalconfig",
		"--tag",
		"--otp",
		"--before",
	],
	booleans: [
		"--silent",
		"-s",
		"--if-present",
		"--ignore-scripts",
		"--yes",
		"-y",
		"--no",
		"--quiet",
		"-q",
		"--foreground-scripts",
	],
});
const PNPM = flagTable({
	dir: ["-C", "--dir"],
	workspace: ["--filter", "-F", "--filter-prod"],
	workspaceBool: ["-r", "--recursive"],
	values: ["--reporter", "--loglevel", "--workspace-concurrency"],
	booleans: [
		"--silent",
		"-s",
		"--parallel",
		"--stream",
		"--aggregate-output",
		"--if-present",
		"-w",
		"--workspace-root",
	],
});
const YARN = flagTable({
	dir: ["--cwd"],
	booleans: ["--silent", "-s", "-T", "--top-level", "-B", "--binaries-only"],
});

/** What the flags before the tool word said. */
interface FlagState {
	dir: string | null;
	/** `--cwd DIR` with a space: bun prints usage and runs nothing when it comes before `run`. */
	spaceDir: boolean;
	localDir: boolean;
	workspace: boolean;
	unknown: boolean;
}
const freshState = (): FlagState => ({
	dir: null,
	spaceDir: false,
	localDir: false,
	workspace: false,
	unknown: false,
});

/** Read flags from words[start]; return the index of the first word that is not a flag (or of `--`). */
function readFlags(words: string[], start: number, table: FlagTable, state: FlagState): number {
	let i = start;
	while (i < words.length) {
		const word = words[i] ?? "";
		if (word === "--" || !word.startsWith("-")) return i;
		const eq = word.indexOf("=");
		const name = eq === -1 ? word : word.slice(0, eq);
		const inline = eq === -1 ? undefined : word.slice(eq + 1);
		const takesValue = table.dir.has(name) || table.workspace.has(name) || table.values.has(name);
		let value = inline;
		if (takesValue && value === undefined) {
			i += 1;
			value = words[i];
		}
		if (table.dir.has(name)) {
			if (value === undefined || value === "" || value.startsWith("-")) state.unknown = true;
			else
				Object.assign(state, {
					dir: value,
					spaceDir: inline === undefined,
					localDir: table.localDir,
				});
		} else if (table.workspace.has(name) || table.workspaceBool.has(name)) {
			state.workspace = true;
		} else if (table.values.has(name)) {
			if (value === undefined) state.unknown = true;
		} else if (!table.booleans.has(name) && inline === undefined) {
			state.unknown = true;
		}
		i += 1;
	}
	return i;
}

const unversioned = (word: string) => word.replace(/(.)@[^/]*$/, "$1");
/** A word with a "/" that is not `@scope/name` names a file, not a tool. */
const isFileTarget = (word: string) =>
	(word.includes("/") && !/^@[^/]+\/[^/]+$/.test(unversioned(word))) ||
	/\.[cm]?[jt]sx?$/.test(word);

/** How a subcommand resolves its tool word. */
interface Resolution {
	scope: Scope;
	path: boolean;
	/** The runner downloads a missing package (npx, npm exec, bunx, bun x): never guess its tool. */
	downloads: boolean;
	pnp?: boolean;
}

function checkTool(
	runner: string,
	words: string[],
	from: number,
	state: FlagState,
	how: Resolution,
): ParsedCommand {
	const tool = words[words[from] === "--" ? from + 1 : from];
	const dir = state.dir ?? ".";
	if (how.downloads) {
		// An unrecognised flag or a workspace selector must not turn into "run it anyway":
		// that could download and execute a registry package. The first word is checked
		// here and in the directories above, which these runners also search. When an
		// unrecognised flag took a value, that value is checked instead of the tool; it is
		// not an installed tool, so the hook skips. A file target gets no exemption either.
		if (tool === undefined || tool.startsWith("-")) return { runner, check: null, blocked: true };
		const scope = state.localDir && state.dir !== null ? "local" : "bin";
		return { runner, check: { tool, dir, scope, path: how.path, pnp: false } };
	}
	const unchecked: ParsedCommand = { runner, check: null };
	if (tool === undefined || tool.startsWith("-") || isFileTarget(tool)) return unchecked;
	if (state.unknown || state.workspace) return unchecked;
	return { runner, check: { tool, dir, scope: how.scope, path: how.path, pnp: how.pnp ?? false } };
}

const NPM_RUN = new Set(["run", "run-script", "rum", "urn"]);

function parseBun(runner: string, words: string[]): ParsedCommand {
	const state = freshState();
	const at = readFlags(words, 0, BUN, state);
	const sub = words[at];
	if ((sub === "run" || sub === "x") && state.spaceDir) {
		return { runner, check: null }; // bun --cwd DIR run: usage text, exit 0, nothing runs
	}
	if (sub === "run") {
		const from = readFlags(words, at + 1, BUN, state);
		return checkTool(runner, words, from, state, { scope: "any", path: true, downloads: false });
	}
	if (sub === "x") {
		const from = readFlags(words, at + 1, BUNX, state);
		return checkTool(runner, words, from, state, { scope: "bin", path: true, downloads: true });
	}
	return { runner, check: null };
}

function parseBunx(runner: string, words: string[]): ParsedCommand {
	const state = freshState();
	const from = readFlags(words, 0, BUNX, state);
	return checkTool(runner, words, from, state, { scope: "bin", path: true, downloads: true });
}

function parseNpm(runner: string, words: string[]): ParsedCommand {
	const state = freshState();
	const at = readFlags(words, 0, NPM, state);
	const sub = words[at];
	if (sub !== undefined && NPM_RUN.has(sub)) {
		const from = readFlags(words, at + 1, NPM, state);
		// npm reads its own flags anywhere before "--": `npm run test --workspace web`.
		const end = words.indexOf("--", from + 1);
		const after = words.slice(from + 1, end === -1 ? undefined : end);
		for (const [k, word] of after.entries()) {
			if (word.startsWith("-")) readFlags(after, k, NPM, state);
		}
		return checkTool(runner, words, from, state, {
			scope: "script",
			path: false,
			downloads: false,
		});
	}
	if (sub === "exec" || sub === "x") {
		const from = readFlags(words, at + 1, NPM, state);
		return checkTool(runner, words, from, state, { scope: "bin", path: false, downloads: true });
	}
	return { runner, check: null };
}

function parseNpx(runner: string, words: string[]): ParsedCommand {
	const state = freshState();
	const from = readFlags(words, 0, NPM, state);
	return checkTool(runner, words, from, state, { scope: "bin", path: false, downloads: true });
}

function parsePnpm(runner: string, words: string[]): ParsedCommand {
	const state = freshState();
	const at = readFlags(words, 0, PNPM, state);
	const sub = words[at];
	if (sub === "run") {
		const from = readFlags(words, at + 1, PNPM, state);
		return checkTool(runner, words, from, state, {
			scope: "script",
			path: false,
			downloads: false,
		});
	}
	if (sub === "exec") {
		const from = readFlags(words, at + 1, PNPM, state);
		return checkTool(runner, words, from, state, { scope: "bin", path: true, downloads: false });
	}
	return { runner, check: null };
}

function parseYarn(runner: string, words: string[]): ParsedCommand {
	const state = freshState();
	const at = readFlags(words, 0, YARN, state);
	const sub = words[at];
	if (sub === "run") {
		const from = readFlags(words, at + 1, YARN, state);
		return checkTool(runner, words, from, state, {
			scope: "any",
			path: false,
			downloads: false,
			pnp: true,
		});
	}
	if (sub === "exec") {
		const from = readFlags(words, at + 1, YARN, state);
		return checkTool(runner, words, from, state, {
			scope: "bin",
			path: true,
			downloads: false,
			pnp: true,
		});
	}
	return { runner, check: null };
}

const PARSERS: Record<string, (runner: string, words: string[]) => ParsedCommand> = {
	bun: parseBun,
	bunx: parseBunx,
	npm: parseNpm,
	npx: parseNpx,
	pnpm: parsePnpm,
	yarn: parseYarn,
};

/** Package managers whose commands need `node_modules` (or Plug'n'Play) to do anything. */
const JS_RUNNERS = new Set(Object.keys(PARSERS));

/**
 * The runner of an allowlisted command (its first word after any VAR=value assignments, as
 * isAllowedHookCommand reads it) and, for bun, bunx, npm, npx, pnpm and Yarn `run`/`exec`/`x`
 * commands, the tool they run and where they look for it. Every other command, and every
 * form this does not understand, is guarded on its runner only: the command runs, and a
 * failure reaches Claude. Guessing wrong would skip a working hook with no trace.
 */
export function parseHookCommand(command: string): ParsedCommand {
	const words = command.trim().split(/\s+/);
	const at = words.findIndex((word) => !word.includes("="));
	const runner = at === -1 ? "" : (words[at] ?? "");
	const parse = PARSERS[runner];
	return parse ? parse(runner, words.slice(at + 1)) : { runner, check: null };
}

/** The runner and tool of `command`; the tool is the runner itself when no tool check applies. */
export function commandTools(command: string): { runner: string; tool: string } {
	const { runner, check } = parseHookCommand(command);
	return { runner, tool: check?.tool ?? runner };
}

/** An executable on the PATH: `command -v` also accepts builtins, and in dash any existing path. */
const ON_PATH = (tool: string) =>
	`{ found="$(command -v ${tool} 2>/dev/null)" && case "$found" in /*) ;; *) false;; esac; }`;

/** The checkout (or the checkout it is a worktree of) has dependencies installed. */
const DEPENDENCIES_LINE =
	'[ -d node_modules ] || [ -d "$top/node_modules" ] || [ -f .pnp.cjs ] || [ -f "$top/.pnp.cjs" ] || exit 0';

/**
 * sh lines that exit 0 silently unless the command can run: its runner is on the PATH and
 * its tool is where the runner will look. Everything interpolated is a word of an
 * allowlisted command (HOOK_COMMAND_PATTERN): no shell syntax.
 * `needsDependencies` (edit hooks; never the install hook, which must run in a fresh
 * checkout) also skips a JS command that has no tool check in a checkout with no
 * node_modules at all.
 */
function toolGuard(command: string, needsDependencies = false): string[] {
	const { runner, check, blocked } = parseHookCommand(command);
	const lines = [`command -v ${runner} >/dev/null 2>&1 || exit 0`];
	if (blocked) return [...lines, "exit 0"];
	if (check === null) {
		if (needsDependencies && JS_RUNNERS.has(runner)) lines.push(DEPENDENCIES_LINE);
		return lines;
	}
	const args = [check.tool];
	if (check.dir !== "." || check.scope !== "any") args.push(check.dir);
	if (check.scope !== "any") args.push(check.scope);
	const found = [`${HOOK_INPUT} has-tool ${args.join(" ")}`];
	if (check.pnp) found.unshift("[ -f .pnp.cjs ]", "[ -f .pnp.js ]");
	// A scoped package (@biomejs/biome) is not a command name; only its .bin entry can be looked up.
	if (check.path && !check.tool.includes("/")) found.push(ON_PATH(check.tool));
	lines.push(`${found.join(" || ")} || exit 0`);
	return lines;
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
		...toolGuard(hook.command, true),
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
	if (hooks.typeCheckOnEdit && hooks.typeCheck) {
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
	if (hooks.autoInstall && hooks.installCommand) {
		result.push({
			type: "command",
			command: installHookCommand(hooks.installCommand),
			timeout: 120,
		});
	}
	return result;
}
