/**
 * Merge the toolkit's hooks and defaults into an existing .claude/settings.json.
 * The toolkit owns only hook entries whose command starts with "# claude-toolkit:",
 * plus the unmarked entries 0.17.x and earlier wrote; every other key and hook is kept.
 * Pure: the caller reads and writes the file.
 */
import { TOOLKIT_HOOK_MARKER } from "./hook-commands.js";

type JsonObject = Record<string, unknown>;

/** First lines of the hook commands claude-toolkit 0.17.x and earlier wrote. */
const LEGACY_FIRST_LINES = [
	"# Auto-format files",
	"# Auto-install dependencies when package.json changes",
	"# Auto-run tests when test files change",
	"# Type-check TypeScript files",
	"# Prevent editing on protected branches",
];
/** 0.16.x extra checks started with "# Extra check: <command>". */
const LEGACY_EXTRA_CHECK_PREFIX = "# Extra check:";
/** 0.17.x and earlier registered skill-eval (.cjs, or .sh before 0.11) without a marker line. */
const LEGACY_SKILL_EVAL_PATH = ".claude/hooks/skill-eval.";

/** What the toolkit contributes to settings.json. */
export interface ToolkitSettings {
	/** Top-level keys, set only when the file has no such key. */
	defaults: JsonObject;
	/** `env` entries, each set only when absent. */
	env: Record<string, string>;
	/** Matcher groups per hook event, appended after the user's own. */
	hooks: Record<string, unknown[]>;
}

function isObject(value: unknown): value is JsonObject {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** True when a settings.json hook command was written by claude-toolkit. */
export function isToolkitHookCommand(command: unknown): boolean {
	if (typeof command !== "string") return false;
	const firstLine = command.split("\n", 1)[0] ?? "";
	return (
		firstLine.startsWith(TOOLKIT_HOOK_MARKER) ||
		LEGACY_FIRST_LINES.includes(firstLine) ||
		firstLine.startsWith(LEGACY_EXTRA_CHECK_PREFIX) ||
		command.includes(LEGACY_SKILL_EVAL_PATH)
	);
}

/** A matcher group without its toolkit hooks; null when nothing is left in it. */
function withoutToolkitHooks(group: unknown): unknown {
	if (!isObject(group) || !Array.isArray(group.hooks)) return group; // not a shape we own
	const hooks = group.hooks.filter(
		(hook) => !(isObject(hook) && isToolkitHookCommand(hook.command)),
	);
	return hooks.length === 0 ? null : { ...group, hooks };
}

/**
 * The user's hooks with toolkit entries and emptied groups removed. An event left empty
 * keeps its key (and so its position) until mergeSettings knows whether the toolkit refills it.
 */
function userHooks(hooks: unknown): JsonObject {
	if (!isObject(hooks)) return {};
	const kept: JsonObject = {};
	for (const [event, groups] of Object.entries(hooks)) {
		kept[event] = Array.isArray(groups)
			? groups.map(withoutToolkitHooks).filter((group) => group !== null)
			: groups;
	}
	return kept;
}

/**
 * The merged settings. Deterministic, so merging the result again gives the same
 * object: generation is byte-identical across runs.
 */
export function mergeSettings(existing: JsonObject, toolkit: ToolkitSettings): JsonObject {
	const merged: JsonObject = { ...existing };
	for (const [key, value] of Object.entries(toolkit.defaults)) {
		if (!Object.hasOwn(merged, key)) merged[key] = value;
	}
	const env = merged.env ?? {};
	if (isObject(env)) {
		const missing = Object.entries(toolkit.env).filter(([key]) => !Object.hasOwn(env, key));
		merged.env = { ...env, ...Object.fromEntries(missing) };
	}
	const hooks = userHooks(merged.hooks);
	for (const [event, groups] of Object.entries(toolkit.hooks)) {
		if (groups.length === 0) continue;
		const current = hooks[event];
		hooks[event] = [...(Array.isArray(current) ? current : []), ...groups];
	}
	for (const [event, groups] of Object.entries(hooks)) {
		if (Array.isArray(groups) && groups.length === 0) delete hooks[event];
	}
	merged.hooks = hooks;
	return merged;
}
