// Draft regression test for the reported bug: run the generated test hook under every
// available POSIX shell. CI's sh is dash, which passes the 0.18.0 guard by accident when
// the misread word is an existing directory, so bash must run too.
import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generate } from "../src/generator.ts";

const SHELLS = ["sh", "bash", "dash"]
	.map((name) => [name, Bun.which(name)] as const)
	.filter(
		(entry): entry is readonly [string, string] => entry[1] !== null && !/system32/i.test(entry[1]),
	);
const git = Bun.which("git");
const canRun = Boolean(git && Bun.which("node") && Bun.which("bun") && SHELLS.length > 0);
const env: Record<string, string | undefined> = { ...process.env };
for (const key of ["GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE"]) delete env[key];

const CHECK = [
	'const file = process.argv[2] ?? "";',
	'require("node:fs").appendFileSync(require("node:path").join(__dirname, "ran.txt"), process.cwd() + " " + file + "\\n");',
	'if (file.includes("bad")) { console.log("boom: 1 failing test"); process.exit(1); }',
].join("\n");

/** A bun workspace whose apps/web package has a "check" script (absent when installed is false). */
async function monorepo(dir: string, testRunner: string, installed = true): Promise<string> {
	expect(Bun.spawnSync([git as string, "init", "-q"], { cwd: dir, env }).exitCode).toBe(0);
	await writeFile(
		join(dir, "package.json"),
		JSON.stringify({ name: "root", private: true, workspaces: ["apps/*"] }),
	);
	await mkdir(join(dir, "apps", "web", "src"), { recursive: true });
	const scripts = installed ? { check: "node check.cjs" } : {};
	await writeFile(
		join(dir, "apps", "web", "package.json"),
		JSON.stringify({ name: "web", scripts }),
	);
	await writeFile(join(dir, "apps", "web", "check.cjs"), CHECK);
	await generate(
		dir,
		{ stacks: [], packageManager: "bun", hooks: { testRunner } },
		{ quiet: true, scaffold: false },
	);
	const settings = JSON.parse(await readFile(join(dir, ".claude", "settings.json"), "utf8"));
	const commands: string[] = settings.hooks.PostToolUse.flatMap(
		(g: { hooks: Array<{ command: string }> }) => g.hooks.map((h) => h.command),
	);
	return commands.find((c) => c.startsWith("# claude-toolkit:test")) ?? "";
}

function runHook(shell: string, dir: string, command: string, file: string) {
	const r = Bun.spawnSync([shell, "-c", command], {
		cwd: dir,
		env: { ...env, CLAUDE_PROJECT_DIR: dir },
		stdin: Buffer.from(JSON.stringify({ tool_name: "Edit", tool_input: { file_path: file } })),
		stdout: "pipe",
		stderr: "pipe",
	});
	return { exitCode: r.exitCode, stdout: r.stdout.toString() };
}

async function withDir<T>(body: (dir: string) => Promise<T>): Promise<T> {
	const dir = await mkdtemp(join(tmpdir(), "ct-mono-"));
	try {
		return await body(dir);
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
}

describe.skipIf(!canRun).each(SHELLS)("bun run --cwd apps/web under %s", (_name, shell) => {
	test("runs in the package and reports a failing test to Claude", async () => {
		await withDir(async (dir) => {
			const hook = await monorepo(dir, "bun run --cwd apps/web check");
			const r = runHook(shell, dir, hook, join(dir, "apps", "web", "src", "bad.test.ts"));
			expect(r.exitCode).toBe(0);
			expect(JSON.parse(r.stdout).hookSpecificOutput.additionalContext).toContain(
				"boom: 1 failing test",
			);
		});
	});

	test("a passing test is silent and the edited file is passed", async () => {
		await withDir(async (dir) => {
			const hook = await monorepo(dir, "bun run --cwd apps/web check");
			expect(runHook(shell, dir, hook, join(dir, "apps", "web", "src", "a.test.ts"))).toEqual({
				exitCode: 0,
				stdout: "",
			});
			expect(await readFile(join(dir, "apps", "web", "ran.txt"), "utf8")).toContain("a.test.ts");
		});
	});

	test("stays silent when the package has no such script", async () => {
		await withDir(async (dir) => {
			const hook = await monorepo(dir, "bun run --cwd apps/web check", false);
			expect(runHook(shell, dir, hook, join(dir, "apps", "web", "src", "bad.test.ts"))).toEqual({
				exitCode: 0,
				stdout: "",
			});
			expect(existsSync(join(dir, "apps", "web", "ran.txt"))).toBe(false);
		});
	});
});

const BAD = (dir: string) => join(dir, "apps", "web", "src", "bad.test.ts");
const OK = (dir: string) => join(dir, "apps", "web", "src", "a.test.ts");
const SILENT = { exitCode: 0, stdout: "" };

describe.skipIf(!canRun).each(SHELLS)("the tool guard under %s", (_name, shell) => {
	/** Run only the hook's guard lines, then print "reached": shows whether the guard let the command through. */
	function guardPasses(dir: string, hook: string, file: string): boolean {
		const lines = hook.split("\n");
		const last = lines.findLastIndex(
			(line) => line.endsWith("|| exit 0") && !line.startsWith("case"),
		);
		const guard = [...lines.slice(0, last + 1), "echo reached"].join("\n");
		return runHook(shell, dir, guard, file).stdout.includes("reached");
	}

	test("a shell builtin or a directory is not a tool on the PATH, an executable is", async () => {
		await withDir(async (dir) => {
			// "test" is a builtin and no script of that name exists; "node" is an executable on the PATH.
			const builtin = await monorepo(dir, "bun run test");
			expect(guardPasses(dir, builtin, OK(dir))).toBe(false);
			const onPath = await monorepo(dir, "bun run node");
			expect(guardPasses(dir, onPath, OK(dir))).toBe(true);
		});
	});

	test("a command with a workspace selector runs once dependencies are installed, not before", async () => {
		await withDir(async (dir) => {
			const hook = await monorepo(dir, "bun run --filter web check");
			expect(runHook(shell, dir, hook, BAD(dir))).toEqual(SILENT);
			await mkdir(join(dir, "node_modules"), { recursive: true });
			const r = runHook(shell, dir, hook, BAD(dir));
			expect(JSON.parse(r.stdout).hookSpecificOutput.additionalContext).toContain(
				"boom: 1 failing test",
			);
		});
	});

	test("a file target runs and its failure is reported", async () => {
		await withDir(async (dir) => {
			const hook = await monorepo(dir, "bun run scripts/fmt.cjs");
			await mkdir(join(dir, "scripts"), { recursive: true });
			await writeFile(join(dir, "scripts", "fmt.cjs"), CHECK);
			await mkdir(join(dir, "node_modules"), { recursive: true });
			const r = runHook(shell, dir, hook, BAD(dir));
			expect(JSON.parse(r.stdout).hookSpecificOutput.additionalContext).toContain(
				"boom: 1 failing test",
			);
			expect(runHook(shell, dir, hook, OK(dir))).toEqual(SILENT);
		});
	});

	// Bun looks for .exe and .bunx shims on Windows; a plain script stands in for a bin elsewhere.
	test.skipIf(process.platform === "win32")(
		"a bin that exists only in the package is found there",
		async () => {
			await withDir(async (dir) => {
				const hook = await monorepo(dir, "bun run --cwd=apps/web pkgtool");
				const bin = join(dir, "apps", "web", "node_modules", ".bin");
				await mkdir(bin, { recursive: true });
				await writeFile(join(bin, "pkgtool"), `#!/usr/bin/env node\n${CHECK}\n`, { mode: 0o755 });
				const r = runHook(shell, dir, hook, BAD(dir));
				expect(JSON.parse(r.stdout).hookSpecificOutput.additionalContext).toContain(
					"boom: 1 failing test",
				);
			});
		},
	);
});
