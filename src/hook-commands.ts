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
