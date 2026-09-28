import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const HELPER = fileURLToPath(new URL("../core/hooks/hook-input.cjs", import.meta.url));
const { filePathFrom, hasTool, contextJson } = require(HELPER);
const node = Bun.which("node");

/** Run the helper with node, the way a generated hook does. */
function runHelper(args: string[], stdin = ""): { exitCode: number; stdout: string } {
	const r = Bun.spawnSync([node as string, HELPER, ...args], {
		stdin: Buffer.from(stdin),
		stdout: "pipe",
		stderr: "pipe",
	});
	return { exitCode: r.exitCode, stdout: r.stdout.toString() };
}

const edit = (file_path: unknown) =>
	JSON.stringify({ hook_event_name: "PostToolUse", tool_name: "Edit", tool_input: { file_path } });

describe("path", () => {
	test("extracts tool_input.file_path", () => {
		expect(filePathFrom(edit("/repo/src/a.ts"), "linux")).toBe("/repo/src/a.ts");
	});

	test("turns Windows separators into / on win32 only", () => {
		expect(filePathFrom(edit("C:\\repo\\src\\a.ts"), "win32")).toBe("C:/repo/src/a.ts");
		expect(filePathFrom(edit("/repo/we\\ird.ts"), "linux")).toBe("/repo/we\\ird.ts");
	});

	test.each([
		["not json"],
		[""],
		['{"tool_input":{}}'],
		['{"tool_input":{"file_path":42}}'],
		['{"tool_input":null}'],
		[edit("/repo/a.ts\nrm -rf ~")],
	])("prints nothing for bad input %p", (raw) => {
		expect(filePathFrom(raw, "linux")).toBe("");
	});

	test.skipIf(!node)("the CLI prints the path from stdin", () => {
		expect(runHelper(["path"], edit("/repo/src/a.ts"))).toEqual({
			exitCode: 0,
			stdout: "/repo/src/a.ts\n",
		});
	});

	test.skipIf(!node)("the CLI prints nothing and exits 0 on bad JSON", () => {
		expect(runHelper(["path"], "{oops")).toEqual({ exitCode: 0, stdout: "" });
	});
});

describe("has-tool", () => {
	async function project(): Promise<string> {
		const dir = await mkdtemp(join(tmpdir(), "ct-hasTool-"));
		await writeFile(
			join(dir, "package.json"),
			JSON.stringify({ scripts: { "lint:check": "biome check", fmt: "biome format" } }),
		);
		await mkdir(join(dir, "node_modules", ".bin"), { recursive: true });
		await writeFile(join(dir, "node_modules", ".bin", "vitest"), "");
		await writeFile(join(dir, "node_modules", ".bin", "biome.exe"), "");
		return dir;
	}

	test("finds package.json scripts and node_modules/.bin entries (any shim suffix)", async () => {
		const dir = await project();
		try {
			for (const name of ["lint:check", "fmt", "vitest", "biome", "@biomejs/biome", "biome@2"]) {
				expect([name, hasTool(name, dir)]).toEqual([name, true]);
			}
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});

	test("reports a missing tool", async () => {
		const dir = await project();
		try {
			for (const name of ["prettier", "tsc", "", "lint", "@scope/"]) {
				expect([name, hasTool(name, dir)]).toEqual([name, false]);
			}
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});

	test("a project without package.json or node_modules has no tools", async () => {
		const dir = await mkdtemp(join(tmpdir(), "ct-hasTool-empty-"));
		try {
			expect(hasTool("biome", dir)).toBe(false);
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});

	test.skipIf(!node)("the CLI exits 1 for a tool that is not installed", () => {
		expect(runHelper(["has-tool", "definitely-not-a-real-tool-xyz"]).exitCode).toBe(1);
	});
});

describe("context", () => {
	test("wraps the tail of the output as PostToolUse additionalContext", () => {
		const output = Array.from({ length: 50 }, (_, i) => `line ${i + 1}`).join("\r\n");
		const json = JSON.parse(contextJson("claude-toolkit test hook: failed", output));
		expect(json.hookSpecificOutput.hookEventName).toBe("PostToolUse");
		const text: string = json.hookSpecificOutput.additionalContext;
		expect(
			text.startsWith("claude-toolkit test hook: failed\nLast lines of output:\nline 21\n"),
		).toBe(true);
		expect(text.endsWith("line 50")).toBe(true);
		expect(text).not.toContain("\r");
	});

	test("escapes quotes and control characters in the output", () => {
		const json = contextJson("t", 'say "hi"\u001b[31m');
		expect(JSON.parse(json).hookSpecificOutput.additionalContext).toBe(
			't\nLast lines of output:\nsay "hi"\u001b[31m',
		);
	});

	test.skipIf(!node)("the CLI prints one JSON object and exits 0", () => {
		const r = runHelper(["context", "title"], "boom\n");
		expect(r.exitCode).toBe(0);
		expect(JSON.parse(r.stdout)).toEqual({
			hookSpecificOutput: {
				hookEventName: "PostToolUse",
				additionalContext: "title\nLast lines of output:\nboom",
			},
		});
	});
});

test("hook-input.cjs never spawns processes or reads the environment", async () => {
	const source = await readFile(HELPER, "utf8");
	for (const banned of ["child_process", "process.env", "execSync", "spawn", "eval("]) {
		expect([banned, source.includes(banned)]).toEqual([banned, false]);
	}
});
