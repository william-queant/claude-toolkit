import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generate } from "../src/generator.ts";
import { commandTools, parseHookCommand, type Scope } from "../src/hook-commands.ts";
import type { ClaudeToolkitConfig, HookConfig } from "../src/types.ts";

// On Windows, System32 tools are not Git Bash; skip the shell tests rather than misfire.
const found = Bun.which("sh");
const sh = found && !/system32/i.test(found) ? found : null;
const git = Bun.which("git");
const canRunHooks = Boolean(sh && git && Bun.which("node") && Bun.which("bun"));
// Debian and Ubuntu run hooks with dash; macOS and Git Bash with bash.
const SHELLS = ["sh", "bash", "dash"]
	.map((name) => [name, Bun.which(name)] as const)
	.filter(
		(entry): entry is readonly [string, string] => entry[1] !== null && !/system32/i.test(entry[1]),
	);
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

const check = (tool: string, dir: string, scope: Scope, path: boolean, pnp = false) => ({
	tool,
	dir,
	scope,
	path,
	pnp,
});

describe("parseHookCommand", () => {
	test.each([
		["bun run --cwd apps/web vitest run", check("vitest", "apps/web", "any", true)],
		["bun run --cwd=apps/web vitest run", check("vitest", "apps/web", "any", true)],
		["bun --cwd=apps/web run vitest run", check("vitest", "apps/web", "any", true)],
		["bun run --env-file .env.test vitest run", check("vitest", ".", "any", true)],
		["bun run --bun --silent vitest run", check("vitest", ".", "any", true)],
		["NODE_ENV=test bun run vitest run", check("vitest", ".", "any", true)],
		["bun x tsc --noEmit", check("tsc", ".", "bin", true)],
		["bunx -p typescript tsc --noEmit", check("tsc", ".", "bin", true)],
		["bunx --bun biome format", check("biome", ".", "bin", true)],
		["npm --prefix apps/web run test", check("test", "apps/web", "script", false)],
		["npm -C apps/web run test", check("test", "apps/web", "script", false)],
		["npm run lint:check", check("lint:check", ".", "script", false)],
		["npm exec -w web -- vitest run", check("vitest", ".", "bin", false)],
		["npm --prefix apps/web exec -- vitest run", check("vitest", "apps/web", "local", false)],
		["npx -p typescript tsc --noEmit", check("tsc", ".", "bin", false)],
		["npx prettier --write", check("prettier", ".", "bin", false)],
		["npx lint", check("lint", ".", "bin", false)],
		["pnpm -C apps/web exec vitest run", check("vitest", "apps/web", "bin", true)],
		["pnpm --dir apps/web exec vitest run", check("vitest", "apps/web", "bin", true)],
		["pnpm exec eslint --fix", check("eslint", ".", "bin", true)],
		["pnpm run vitest run", check("vitest", ".", "script", false)],
		["yarn --cwd apps/web run vitest run", check("vitest", "apps/web", "any", false, true)],
		["yarn exec vitest run", check("vitest", ".", "bin", true, true)],
		["npx --registry https://r.example vitest", check("vitest", ".", "bin", false)],
		["npx --cache /tmp/c vitest run", check("vitest", ".", "bin", false)],
		["npx --cache x vitest", check("vitest", ".", "bin", false)],
		["bunx --registry https://r.example/ vitest", check("vitest", ".", "bin", true)],
		["bunx --cache-dir x tsc", check("tsc", ".", "bin", true)],
		["npm --userconfig x run test", check("test", ".", "script", false)],
	])("%p is checked as %o", (command, expected) => {
		expect(parseHookCommand(command).check).toEqual(expected);
	});

	test.each([
		"bun run --filter web test",
		"bun run -F web test",
		"pnpm --filter web exec vitest run",
		"pnpm -r run typecheck",
		"npm run test --workspace web",
		"yarn workspace web run vitest run",
		"bun run --some-new-flag vitest run",
		// bun prints usage and runs nothing.
		"bun --cwd apps/web run vitest run",
		"bun run scripts/fmt.mjs",
		"bun run check.ts",
		"bun run build.mjs",
		"bun turbo run typecheck",
		"pnpm turbo run typecheck",
		"pnpm nx run web:typecheck",
		"pnpm vitest run --project unit",
		"pnpm recursive run typecheck",
		"turbo run typecheck",
		"nx run web:test",
		"vitest run --dir src",
		"cargo run --bin check",
		"cargo run -p xtask -- lint",
		"docker compose exec -T app npx tsc --noEmit",
		"bun test",
		"bun install",
	])("%p is guarded on its runner only", (command) => {
		expect(parseHookCommand(command).check).toBeNull();
	});

	test.each([
		"npx --unknown-flag https://r.example vitest",
		"bun x --cwd apps/web vitest",
		"bunx --cwd apps/web vitest",
		"npm exec --unknown-flag /tmp/x -- vitest",
		"npx --yes",
		"npx",
		"bunx",
	])("%p never runs unchecked", (command) => {
		const parsed = parseHookCommand(command);
		expect([command, parsed.check !== null || parsed.blocked === true]).toEqual([command, true]);
	});

	test("a blocked command skips right after the runner check", async () => {
		await withDir(async (dir) => {
			const hook = (await postToolUse(dir, { testRunner: "npx --yes" })).get("test") ?? "";
			expect(hook).toContain("command -v npx >/dev/null 2>&1 || exit 0\nexit 0\n");
		});
	});

	test("the runner is the first word that is not a VAR=value assignment", () => {
		expect(parseHookCommand("NODE_ENV=test CI=1 bun run vitest run").runner).toBe("bun");
		expect(parseHookCommand("cargo check").runner).toBe("cargo");
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
				`${HOOK_INPUT} has-tool biome || { found="$(command -v biome 2>/dev/null)" && case "$found" in /*) ;; *) false;; esac; } || exit 0`,
			);
			expect(format).not.toContain("command -v biome >/dev/null");
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

	test("the reported --cwd command is looked up in that directory, not read as the tool", async () => {
		await withDir(async (dir) => {
			const hooks = await postToolUse(dir, { testRunner: "bun run --cwd apps/web vitest run" });
			const testHook = hooks.get("test") ?? "";
			expect(testHook).toContain(`${HOOK_INPUT} has-tool vitest apps/web ||`);
			expect(testHook).not.toContain("apps/web >/dev/null");
			expect(testHook).toContain('out="$(bun run --cwd apps/web vitest run "$f" 2>&1)" && exit 0');
		});
	});

	test("no hook asks the shell about a word that is a path, and npx or npm exec never use the PATH", async () => {
		await withDir(async (dir) => {
			const commands = [
				"bun run --cwd apps/web vitest run",
				"bun run scripts/fmt.mjs",
				"npx -p typescript tsc --noEmit",
				"npm exec -w web -- vitest run",
				"pnpm -C apps/web exec vitest run",
				"yarn run vitest run",
			];
			for (const testRunner of commands) {
				const hook = (await postToolUse(dir, { testRunner })).get("test") ?? "";
				const words = [...hook.matchAll(/command -v (\S+)/g)].map((m) => m[1] ?? "");
				expect([testRunner, words.length > 0]).toEqual([testRunner, true]);
				for (const word of words) {
					expect([testRunner, word, word.includes("/")]).toEqual([testRunner, word, false]);
				}
				if (/^(npx|npm) /.test(testRunner)) {
					expect([testRunner, hook.includes("found=")]).toEqual([testRunner, false]);
				}
			}
		});
	});

	test("a yarn hook also runs under Plug'n'Play, which has no node_modules", async () => {
		await withDir(async (dir) => {
			const hooks = await postToolUse(dir, { testRunner: "yarn run vitest run" });
			expect(hooks.get("test")).toContain(
				`[ -f .pnp.cjs ] || [ -f .pnp.js ] || ${HOOK_INPUT} has-tool vitest ||`,
			);
		});
	});

	test("a JS command run without a tool check skips a checkout with no installed dependencies", async () => {
		await withDir(async (dir) => {
			const skip =
				'[ -d node_modules ] || [ -d "$top/node_modules" ] || [ -f .pnp.cjs ] || [ -f "$top/.pnp.cjs" ] || exit 0';
			const unguarded = (await postToolUse(dir, { testRunner: "bun run --filter web test" })).get(
				"test",
			);
			expect(unguarded).toContain(skip);
			// The install hook must run in a fresh checkout.
			const checked = (await postToolUse(dir, { testRunner: "bun run vitest run" })).get("test");
			expect(checked).not.toContain(skip);
			const cargo = (await postToolUse(dir, { extraChecks: ["cargo check"] })).get("extra-0");
			expect(cargo).not.toContain(skip);
			const install = (await postToolUse(dir, { autoInstall: true })).get("install");
			expect(install).not.toContain(skip);
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

	test.each(SHELLS)("every generated hook parses as %s", async (_name, shell) => {
		await withDir(async (dir) => {
			const hooks = await postToolUse(dir, {
				...ALL,
				testRunner: "bun run --cwd apps/web vitest run",
				extraChecks: ["cargo check", "yarn run lint", "npx -p typescript tsc --noEmit"],
			});
			for (const [id, command] of hooks) {
				const r = Bun.spawnSync([shell, "-n", "-c", command], { stderr: "pipe" });
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
