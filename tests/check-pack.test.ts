import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";
import { findPackProblems, type PackInput } from "../scripts/check-pack.ts";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

function input(overrides: Partial<PackInput>): PackInput {
	return { manifest: {}, paths: [], read: () => "", publish: false, ...overrides };
}

test("a manifest with postinstall fails", () => {
	expect(findPackProblems(input({ manifest: { scripts: { postinstall: "node x.js" } } }))).toEqual([
		"package.json has an install script: postinstall",
	]);
});

test("preinstall and install fail too", () => {
	const problems = findPackProblems(
		input({ manifest: { scripts: { preinstall: "a", install: "b" } } }),
	);
	expect(problems).toHaveLength(2);
});

test("prepare fails only in publish mode", () => {
	const manifest = { scripts: { prepare: "husky" } };
	expect(findPackProblems(input({ manifest }))).toEqual([]);
	expect(findPackProblems(input({ manifest, publish: true }))).toHaveLength(1);
});

test("shell and env access in a packed code file fails", () => {
	const files: Record<string, string> = {
		"bin/a.mjs": 'import { spawnSync } from "node:child_process";',
		"src/b.ts": "const cwd = process.env.INIT_CWD;",
		"core/c.cjs": "eval(code);",
		"src/d.ts": "await Bun.$`ls`;",
	};
	const problems = findPackProblems(
		input({ paths: Object.keys(files), read: (p) => files[p] ?? "" }),
	);
	expect(problems).toEqual([
		"bin/a.mjs contains child_process",
		"src/b.ts contains process.env",
		"core/c.cjs contains eval(",
		"src/d.ts contains Bun.$",
	]);
});

test("markdown may mention process.env; retrieval( is not eval(", () => {
	const files: Record<string, string> = {
		"stacks/vite/skills/x/SKILL.md": "Read process.env.FOO here.",
		"src/e.ts": "const data = retrieval(1);",
	};
	expect(
		findPackProblems(input({ paths: Object.keys(files), read: (p) => files[p] ?? "" })),
	).toEqual([]);
});

test("a packed docs/ path fails", () => {
	expect(findPackProblems(input({ paths: ["docs/audit/notes.md"] }))).toEqual([
		"docs/ file is packed: docs/audit/notes.md",
	]);
});

test("check:pack passes on the repo", () => {
	const r = Bun.spawnSync([process.execPath, "scripts/check-pack.ts"], {
		cwd: ROOT,
		stdout: "pipe",
		stderr: "pipe",
	});
	expect(r.stderr.toString()).toBe("");
	expect(r.exitCode).toBe(0);
	expect(r.stdout.toString()).toContain("check:pack OK");
});
