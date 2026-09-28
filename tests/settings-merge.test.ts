import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generate } from "../src/generator.ts";
import { isToolkitHookCommand } from "../src/settings-merge.ts";
import type { ClaudeToolkitConfig } from "../src/types.ts";

const CONFIG: ClaudeToolkitConfig = {
	stacks: [],
	packageManager: "bun",
	hooks: { formatter: "bun run biome format --write", testRunner: "bun run vitest run" },
};

const LEGACY_SKILL_EVAL = `node "\${CLAUDE_PROJECT_DIR}/.claude/hooks/skill-eval.cjs"`;
const USER_PRE_HOOK = { type: "command", command: "echo user-pre", timeout: 3 };
const USER_POST_GROUP = {
	matcher: "Bash",
	hooks: [{ type: "command", command: "echo user-post" }],
};

/** A settings.json as claude-toolkit 0.16.x wrote it, plus the user's own additions. */
const LEGACY_SETTINGS = {
	permissions: { allow: ["Bash(bun test:*)"], deny: ["Read(./.env)"] },
	model: "opus",
	includeCoAuthoredBy: false,
	env: { BASH_DEFAULT_TIMEOUT_MS: "60000", MY_VAR: "1" },
	hooks: {
		UserPromptSubmit: [{ hooks: [{ type: "command", command: LEGACY_SKILL_EVAL, timeout: 5 }] }],
		PreToolUse: [
			{
				matcher: "Edit|MultiEdit|Write",
				hooks: [
					{
						type: "command",
						command:
							'# Prevent editing on protected branches\n[ "$(git branch --show-current)" != "main" ] || exit 2',
						timeout: 5,
					},
					USER_PRE_HOOK,
				],
			},
		],
		PostToolUse: [
			{
				matcher: "Edit|MultiEdit|Write",
				hooks: [
					{
						type: "command",
						command: '# Auto-format files\nif [[ "$CLAUDE_TOOL_INPUT_FILE_PATH" ]]; then :; fi',
					},
				],
			},
			{
				matcher: "Edit|MultiEdit|Write",
				hooks: [
					{ type: "command", command: "# Auto-install dependencies when package.json changes\n:" },
				],
			},
			{
				matcher: "Edit|MultiEdit|Write",
				hooks: [{ type: "command", command: "# Extra check: cargo check\n:" }],
			},
			USER_POST_GROUP,
		],
		Stop: [{ hooks: [{ type: "command", command: "echo user-stop" }] }],
	},
};

async function withDir<T>(body: (dir: string, settingsPath: string) => Promise<T>): Promise<T> {
	const dir = await mkdtemp(join(tmpdir(), "ct-merge-"));
	try {
		await mkdir(join(dir, ".claude"), { recursive: true });
		return await body(dir, join(dir, ".claude", "settings.json"));
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
}

const run = (dir: string, config: ClaudeToolkitConfig = CONFIG) =>
	generate(dir, config, { quiet: true, scaffold: false });

/** Every hook command in a parsed settings.json. */
function allCommands(settings: {
	hooks: Record<string, Array<{ hooks: Array<{ command: string }> }>>;
}) {
	return Object.values(settings.hooks).flatMap((groups) =>
		groups.flatMap((group) => group.hooks.map((hook) => hook.command)),
	);
}

describe("isToolkitHookCommand", () => {
	test.each([
		["# claude-toolkit:format\nf=x"],
		["# claude-toolkit:skill-eval\nnode x"],
		["# Auto-format files\nif"],
		["# Auto-install dependencies when package.json changes\n:"],
		["# Auto-run tests when test files change\n:"],
		["# Type-check TypeScript files\n:"],
		["# Extra check: cargo check\n:"],
		["# Prevent editing on protected branches\ncase"],
		[LEGACY_SKILL_EVAL],
		['"$CLAUDE_PROJECT_DIR"/.claude/hooks/skill-eval.sh'],
	])("owns %p", (command) => {
		expect(isToolkitHookCommand(command)).toBe(true);
	});

	test.each([
		["echo user"],
		["# Auto-format files by hand\n:"],
		["# my hook\n# claude-toolkit:x"],
		[42],
	])("leaves %p to the user", (command) => {
		expect(isToolkitHookCommand(command)).toBe(false);
	});
});

describe("settings.json merge", () => {
	test("a fresh project gets the toolkit defaults and hooks", async () => {
		await withDir(async (dir, settingsPath) => {
			await run(dir);
			const settings = JSON.parse(await readFile(settingsPath, "utf8"));
			expect(Object.keys(settings)).toEqual(["includeCoAuthoredBy", "env", "hooks"]);
			expect(settings.includeCoAuthoredBy).toBe(true);
			expect(settings.env).toEqual({
				INSIDE_CLAUDE_CODE: "1",
				BASH_DEFAULT_TIMEOUT_MS: "420000",
				BASH_MAX_TIMEOUT_MS: "420000",
			});
			expect(allCommands(settings).map((c) => c.split("\n", 1)[0])).toEqual([
				"# claude-toolkit:skill-eval",
				"# claude-toolkit:protect-branch",
				"# claude-toolkit:format",
				"# claude-toolkit:test",
			]);
		});
	});

	test("an upgrade from 0.16.x keeps the user's settings and hooks and replaces the legacy ones", async () => {
		await withDir(async (dir, settingsPath) => {
			await writeFile(settingsPath, `${JSON.stringify(LEGACY_SETTINGS, null, 2)}\n`);
			await run(dir);
			const settings = JSON.parse(await readFile(settingsPath, "utf8"));
			expect(settings.permissions).toEqual(LEGACY_SETTINGS.permissions);
			expect(settings.model).toBe("opus");
			expect(settings.includeCoAuthoredBy).toBe(false);
			expect(settings.env).toEqual({
				BASH_DEFAULT_TIMEOUT_MS: "60000",
				MY_VAR: "1",
				INSIDE_CLAUDE_CODE: "1",
				BASH_MAX_TIMEOUT_MS: "420000",
			});
			expect(settings.hooks.Stop).toEqual(LEGACY_SETTINGS.hooks.Stop);
			expect(settings.hooks.PreToolUse[0].hooks).toEqual([USER_PRE_HOOK]);
			expect(settings.hooks.PostToolUse[0]).toEqual(USER_POST_GROUP);
			const commands = allCommands(settings);
			for (const legacy of [
				"# Auto-format files",
				"# Auto-install",
				"# Extra check:",
				"# Prevent editing",
			]) {
				expect([legacy, commands.some((c) => c.startsWith(legacy))]).toEqual([legacy, false]);
			}
			expect(commands.filter((c) => c.includes("skill-eval.cjs"))).toEqual([
				`# claude-toolkit:skill-eval\n${LEGACY_SKILL_EVAL}`,
			]);
			expect(commands.filter((c) => c.startsWith("# claude-toolkit:")).length).toBe(4);
		});
	});

	test("generation is byte-identical across consecutive runs", async () => {
		await withDir(async (dir, settingsPath) => {
			await writeFile(settingsPath, `${JSON.stringify(LEGACY_SETTINGS, null, 2)}\n`);
			await run(dir);
			const first = await readFile(settingsPath, "utf8");
			await run(dir);
			expect(await readFile(settingsPath, "utf8")).toBe(first);
		});
	});

	test("an event the user adds keeps the events in their order", async () => {
		await withDir(async (dir, settingsPath) => {
			await run(dir);
			const settings = JSON.parse(await readFile(settingsPath, "utf8"));
			settings.hooks.Stop = LEGACY_SETTINGS.hooks.Stop;
			await writeFile(settingsPath, `${JSON.stringify(settings, null, 2)}\n`);
			await run(dir);
			const merged = JSON.parse(await readFile(settingsPath, "utf8"));
			expect(Object.keys(merged.hooks)).toEqual([
				"UserPromptSubmit",
				"PreToolUse",
				"PostToolUse",
				"Stop",
			]);
			expect(merged.hooks.Stop).toEqual(LEGACY_SETTINGS.hooks.Stop);
		});
	});

	test("hooks the config no longer asks for are removed", async () => {
		await withDir(async (dir, settingsPath) => {
			await run(dir, { ...CONFIG, hooks: { ...CONFIG.hooks, autoInstall: true } });
			await run(dir, { ...CONFIG, git: { protectedBranches: [] } });
			const ids = allCommands(JSON.parse(await readFile(settingsPath, "utf8"))).map(
				(c) => c.split("\n", 1)[0],
			);
			expect(ids).toEqual([
				"# claude-toolkit:skill-eval",
				"# claude-toolkit:format",
				"# claude-toolkit:test",
			]);
		});
	});

	test("an invalid settings.json is backed up and replaced", async () => {
		await withDir(async (dir, settingsPath) => {
			await writeFile(settingsPath, "{ not json,\n");
			await run(dir);
			expect(await readFile(`${settingsPath}.bak`, "utf8")).toBe("{ not json,\n");
			const settings = JSON.parse(await readFile(settingsPath, "utf8"));
			expect(settings.includeCoAuthoredBy).toBe(true);
		});
	});

	test("a JSON array is not a settings object either", async () => {
		await withDir(async (dir, settingsPath) => {
			await writeFile(settingsPath, "[]\n");
			await run(dir);
			expect(existsSync(`${settingsPath}.bak`)).toBe(true);
			expect(Object.keys(JSON.parse(await readFile(settingsPath, "utf8")))).toContain("hooks");
		});
	});

	test("a valid settings.json with a byte-order mark is merged, never backed up", async () => {
		await withDir(async (dir, settingsPath) => {
			const bom = String.fromCharCode(0xfeff);
			await writeFile(settingsPath, `${bom}{ "model": "opus" }\n`);
			await run(dir);
			expect(existsSync(`${settingsPath}.bak`)).toBe(false);
			expect(JSON.parse(await readFile(settingsPath, "utf8")).model).toBe("opus");
		});
	});
});
