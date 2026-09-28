import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_HOOKS, isAllowedHookCommand } from "../src/hook-commands.ts";

const fromRoot = (path: string) => fileURLToPath(new URL(`../${path}`, import.meta.url));

test("the default formatter is Biome, matching the scaffolded biome.json", () => {
	expect(DEFAULT_HOOKS).toEqual({
		formatter: "bun run biome format --write",
		testRunner: "bun run vitest run",
		typeCheck: "bun run tsc --noEmit",
	});
	for (const command of Object.values(DEFAULT_HOOKS)) {
		expect(isAllowedHookCommand(command)).toBe(true);
	}
});

test("the config template and the defineConfig example use the same defaults", async () => {
	const template = await readFile(fromRoot("templates/claude-toolkit.config.ts"), "utf8");
	for (const [key, value] of Object.entries(DEFAULT_HOOKS)) {
		expect(template).toContain(`${key}: "${value}",`);
	}
	expect(template).not.toContain("prettier");
	expect(await readFile(fromRoot("src/index.ts"), "utf8")).not.toContain("prettier");
});

test("a first run generates the format and test hooks only", async () => {
	const dir = await mkdtemp(join(tmpdir(), "ct-defaults-"));
	try {
		await writeFile(join(dir, "package.json"), '{ "name": "consumer", "private": true }\n');
		const r = Bun.spawnSync([process.execPath, fromRoot("bin/cli.ts"), dir, "--quiet"], {
			stdout: "pipe",
			stderr: "pipe",
		});
		expect(r.exitCode).toBe(0);
		const settings = JSON.parse(await readFile(join(dir, ".claude", "settings.json"), "utf8"));
		const ids = settings.hooks.PostToolUse.map(
			(group: { hooks: Array<{ command: string }> }) => group.hooks[0]?.command.split("\n", 1)[0],
		);
		expect(ids).toEqual(["# claude-toolkit:format", "# claude-toolkit:test"]);
		expect(settings.hooks.PostToolUse[0].hooks[0].command).toContain("has-tool biome");
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
});
