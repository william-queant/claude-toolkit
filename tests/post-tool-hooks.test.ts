import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generate } from "../src/generator.ts";
import { commandTools } from "../src/hook-commands.ts";
import type { ClaudeToolkitConfig, HookConfig } from "../src/types.ts";

// On Windows, System32 tools are not Git Bash; skip the shell tests rather than misfire.
const found = Bun.which("sh");
const sh = found && !/system32/i.test(found) ? found : null;
const git = Bun.which("git");
const canRunHooks = Boolean(sh && git && Bun.which("node") && Bun.which("bun"));
// Never let an outer git hook's environment redirect git to the real repo.
const env: Record<string, string | undefined> = { ...process.env };
for (const key of ["GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE"]) delete env[key];

const HOOK_INPUT = 'node "$CLAUDE_PROJECT_DIR/.claude/hooks/hook-input.cjs"';
const PREAMBLE = `f="$(${HOOK_INPUT} path)"\ncase "$f" in -*) f="./$f";; esac`;

interface Settings {
	hooks: {
		PostToolUse?: Array<{ matcher: string; hooks: Array<{ command: string; timeout: number }> }>;
	};
}

/** Generate .claude/ for `hooks` into `dir` and return the PostToolUse commands by marker id. */
async function postToolUse(dir: string, hooks: HookConfig): Promise<Map<string, string>> {
	const config: ClaudeToolkitConfig = { stacks: [], packageManager: "bun", hooks };
	await generate(dir, config, { quiet: true, scaffold: false });
	const settings: Settings = JSON.parse(
		await readFile(join(dir, ".claude", "settings.json"), "utf8"),
	);
	const commands = (settings.hooks.PostToolUse ?? []).flatMap((group) =>
		group.hooks.map((h) => h.command),
	);
	const id = (command: string) =>
		(command.split("\n", 1)[0] ?? "").replace("# claude-toolkit:", "");
	return new Map(commands.map((command) => [id(command), command]));
}

async function withDir<T>(body: (dir: string) => Promise<T>): Promise<T> {
	const dir = await mkdtemp(join(tmpdir(), "ct-post-"));
	try {
		return await body(dir);
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
}

const DEFAULTS: HookConfig = {
	formatter: "bun run biome format --write",
	testRunner: "bun run vitest run",
	typeCheck: "bun run tsc --noEmit",
};
/** Every PostToolUse hook switched on. */
const ALL: HookConfig = {
	...DEFAULTS,
	typeCheckOnEdit: true,
	autoInstall: true,
	extraChecks: ["cargo check"],
};

describe("commandTools", () => {
	test.each([
		["bun run biome format --write", "bun", "biome"],
		["bun run vitest run", "bun", "vitest"],
		["npx prettier --write", "npx", "prettier"],
		["bunx --bun biome format", "bunx", "biome"],
		["pnpm exec eslint --fix", "pnpm", "eslint"],
		["bun x tsc --noEmit", "bun", "tsc"],
		["npm run lint:check", "npm", "lint:check"],
		["NODE_ENV=test bun run vitest run", "bun", "vitest"],
		["cargo check --target wasm32-unknown-unknown", "cargo", "cargo"],
		["bun install", "bun", "bun"],
	])("%p needs runner %p and tool %p", (command, runner, tool) => {
		expect(commandTools(command)).toEqual({ runner, tool });
	});
});

describe("generated PostToolUse hooks", () => {
	test("each hook starts with its marker and the stdin preamble", async () => {
		await withDir(async (dir) => {
			const hooks = await postToolUse(dir, ALL);
			expect([...hooks.keys()]).toEqual(["format", "test", "typecheck", "extra-0", "install"]);
			for (const [id, command] of hooks) {
				expect(command.startsWith(`# claude-toolkit:${id}\n${PREAMBLE}\n`)).toBe(true);
			}
		});
	});

	test("hooks are POSIX sh, never block, and drop the old variable and feedback JSON", async () => {
		await withDir(async (dir) => {
			for (const command of (await postToolUse(dir, ALL)).values()) {
				for (const banned of [
					"CLAUDE_TOOL_INPUT_FILE_PATH",
					"[[",
					"PIPESTATUS",
					'"feedback"',
					"suppressOutput",
					"exit 1",
					"exit 2",
				]) {
					expect([banned, command.includes(banned)]).toEqual([banned, false]);
				}
				expect(command.endsWith("\nexit 0")).toBe(true);
			}
		});
	});

	test("the format hook guards on bun and biome and passes the edited file", async () => {
		await withDir(async (dir) => {
			const format = (await postToolUse(dir, DEFAULTS)).get("format") ?? "";
			expect(format).toContain(
				'case "$f" in *.js|*.jsx|*.ts|*.tsx|*.mjs|*.cjs|*.mts|*.cts) ;; *) exit 0;; esac',
			);
			expect(format).toContain('cd "$root" || exit 0');
			expect(format).toContain('git check-ignore -q -- "$f" 2>/dev/null && exit 0');
			expect(format).toContain("command -v bun >/dev/null 2>&1 || exit 0");
			expect(format).toContain(
				`${HOOK_INPUT} has-tool biome || command -v biome >/dev/null 2>&1 || exit 0`,
			);
			expect(format).toContain('out="$(bun run biome format --write "$f" 2>&1)" && exit 0');
			expect(format).toContain(
				`printf '%s\\n' "$out" | ${HOOK_INPUT} context "claude-toolkit format hook: bun run biome format --write failed for $f"`,
			);
		});
	});

	test("a bare command must be on the PATH: a node_modules/.bin entry cannot run it", async () => {
		await withDir(async (dir) => {
			const format =
				(await postToolUse(dir, { formatter: "biome format --write" })).get("format") ?? "";
			expect(format).toContain("command -v biome >/dev/null 2>&1 || exit 0");
			expect(format).not.toContain("has-tool biome");
		});
	});

	test("the test hook runs only for test files", async () => {
		await withDir(async (dir) => {
			const testHook = (await postToolUse(dir, DEFAULTS)).get("test") ?? "";
			expect(testHook).toContain(
				'case "$f" in *.test.js|*.test.jsx|*.test.ts|*.test.tsx|*.spec.js|*.spec.jsx|*.spec.ts|*.spec.tsx) ;; *) exit 0;; esac',
			);
			expect(testHook).toContain('out="$(bun run vitest run "$f" 2>&1)" && exit 0');
		});
	});

	test("an extra check's first line names its index, not its command", async () => {
		await withDir(async (dir) => {
			const hooks = await postToolUse(dir, { extraChecks: ["cargo check", "cargo clippy"] });
			expect(hooks.get("extra-1")?.split("\n", 1)[0]).toBe("# claude-toolkit:extra-1");
			expect(hooks.get("extra-1")).toContain('case "$f" in *.rs) ;; *) exit 0;; esac');
		});
	});

	test("the type-check hook runs typeCheck without the file name", async () => {
		await withDir(async (dir) => {
			const typecheck = (await postToolUse(dir, ALL)).get("typecheck") ?? "";
			expect(typecheck).toContain('case "$f" in *.ts|*.tsx|*.mts|*.cts) ;; *) exit 0;; esac');
			expect(typecheck).toContain('out="$(bun run tsc --noEmit 2>&1)" && exit 0');
		});
	});

	test("the install hook sends the last 20 output lines to stderr", async () => {
		await withDir(async (dir) => {
			const install = (await postToolUse(dir, ALL)).get("install") ?? "";
			expect(install).toContain('case "$f" in package.json|*/package.json) ;; *) exit 0;; esac');
			expect(install).toContain('out="$(bun install 2>&1)"');
			expect(install).toContain(`printf '%s\\n' "$out" | tail -n 20 >&2`);
			expect(install).not.toContain("/dev/null 2>&1 &&");
		});
	});

	test("type-check on edit is generated only with typeCheckOnEdit", async () => {
		await withDir(async (dir) => {
			expect((await postToolUse(dir, DEFAULTS)).has("typecheck")).toBe(false);
			expect(
				(await postToolUse(dir, { ...DEFAULTS, typeCheckOnEdit: true })).has("typecheck"),
			).toBe(true);
		});
	});

	test("auto-install is generated only with autoInstall", async () => {
		await withDir(async (dir) => {
			expect((await postToolUse(dir, DEFAULTS)).has("install")).toBe(false);
			expect((await postToolUse(dir, { autoInstall: true })).has("install")).toBe(true);
		});
	});

	test("hook-input.cjs is installed next to skill-eval.cjs", async () => {
		await withDir(async (dir) => {
			await postToolUse(dir, DEFAULTS);
			expect(existsSync(join(dir, ".claude", "hooks", "hook-input.cjs"))).toBe(true);
		});
	});

	test.skipIf(!sh)("every generated hook parses as sh", async () => {
		await withDir(async (dir) => {
			for (const [id, command] of await postToolUse(dir, ALL)) {
				const r = Bun.spawnSync([sh as string, "-n", "-c", command], { stderr: "pipe" });
				expect([id, r.exitCode, r.stderr.toString()]).toEqual([id, 0, ""]);
			}
		});
	});
});

describe.skipIf(!canRunHooks)("running the format hook with sh", () => {
	/** A git project whose `fmt` script records each formatted file and fails on names containing "bad". */
	async function project(dir: string, formatter: string): Promise<string> {
		expect(Bun.spawnSync([git as string, "init", "-q"], { cwd: dir, env }).exitCode).toBe(0);
		await writeFile(join(dir, ".gitignore"), "ignored/\n");
		await writeFile(
			join(dir, "package.json"),
			JSON.stringify({ name: "consumer", private: true, scripts: { fmt: "node fmt.cjs" } }),
		);
		await writeFile(
			join(dir, "fmt.cjs"),
			[
				'const file = process.argv[2] ?? "";',
				'if (file.includes("bad")) { console.log("boom: cannot format"); process.exit(1); }',
				'require("node:fs").appendFileSync(require("node:path").join(__dirname, "formatted.txt"), file + "\\n");',
			].join("\n"),
		);
		await mkdir(join(dir, "src"), { recursive: true });
		return (await postToolUse(dir, { formatter })).get("format") ?? "";
	}

	/** Run `command` the way Claude Code does: sh -c, JSON on stdin, CLAUDE_PROJECT_DIR set. */
	function runHook(dir: string, command: string, stdin: string) {
		const r = Bun.spawnSync([sh as string, "-c", command], {
			cwd: dir,
			env: { ...env, CLAUDE_PROJECT_DIR: dir },
			stdin: Buffer.from(stdin),
			stdout: "pipe",
			stderr: "pipe",
		});
		return { exitCode: r.exitCode, stdout: r.stdout.toString() };
	}

	const editOf = (file: string) =>
		JSON.stringify({ tool_name: "Edit", tool_input: { file_path: file } });
	const normalized = (p: string) => (process.platform === "win32" ? p.replace(/\\/g, "/") : p);
	const formattedLog = async (dir: string) =>
		existsSync(join(dir, "formatted.txt"))
			? await readFile(join(dir, "formatted.txt"), "utf8")
			: "";

	test("formats the edited file silently", async () => {
		await withDir(async (dir) => {
			const command = await project(dir, "bun run fmt");
			const file = join(dir, "src", "a.ts");
			expect(runHook(dir, command, editOf(file))).toEqual({ exitCode: 0, stdout: "" });
			expect(await formattedLog(dir)).toBe(`${normalized(file)}\n`);
		});
	});

	test("reports a failure to Claude as context and still exits 0", async () => {
		await withDir(async (dir) => {
			const command = await project(dir, "bun run fmt");
			const r = runHook(dir, command, editOf(join(dir, "src", "bad.ts")));
			expect(r.exitCode).toBe(0);
			const output = JSON.parse(r.stdout).hookSpecificOutput;
			expect(output.hookEventName).toBe("PostToolUse");
			expect(output.additionalContext).toContain(
				"claude-toolkit format hook: bun run fmt failed for",
			);
			expect(output.additionalContext).toContain("boom: cannot format");
		});
	});

	test("formats a file in a Claude Code worktree under the ignored .claude/worktrees/", async () => {
		await withDir(async (dir) => {
			const command = await project(dir, "bun run fmt");
			await writeFile(join(dir, ".gitignore"), "ignored/\n.claude/\n");
			const git2 = (args: string[], cwd = dir) =>
				expect(Bun.spawnSync([git as string, ...args], { cwd, env }).exitCode).toBe(0);
			git2(["add", "-A"]);
			git2(["-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "base"]);
			const tree = join(dir, ".claude", "worktrees", "feat");
			git2(["worktree", "add", "-q", tree]);
			const file = join(tree, "src", "w.ts");
			await mkdir(join(tree, "src"), { recursive: true });
			expect(runHook(dir, command, editOf(file))).toEqual({ exitCode: 0, stdout: "" });
			expect(existsSync(join(tree, "formatted.txt"))).toBe(true);
		});
	});

	test("does nothing for other files, ignored files, bad input, or a missing tool", async () => {
		await withDir(async (dir) => {
			const command = await project(dir, "bun run fmt");
			const quiet = { exitCode: 0, stdout: "" };
			expect(runHook(dir, command, editOf(join(dir, "notes.txt")))).toEqual(quiet);
			expect(runHook(dir, command, editOf(join(dir, "ignored", "bad.ts")))).toEqual(quiet);
			expect(runHook(dir, command, "not json")).toEqual(quiet);
			const missing = await project(dir, "bun run not-installed-fmt");
			expect(runHook(dir, missing, editOf(join(dir, "src", "a.ts")))).toEqual(quiet);
			expect(await formattedLog(dir)).toBe("");
		});
	});
});
