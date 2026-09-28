import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const CLI = fileURLToPath(new URL("../bin/cli.ts", import.meta.url));
const PLAIN_CONFIG = 'export default { stacks: [], packageManager: "bun" };\n';
const HEADER = "Keep .claude/ in sync after toolkit upgrades";
const PREPARE_LINE = '"prepare": "claude-toolkit refresh || exit 0"';
const UPGRADE_LINE = "Automatic regeneration on install was removed in 0.17.0";

interface Setup {
	scripts?: Record<string, string>;
	config?: boolean;
	marker?: string;
	yarnrc?: boolean;
}

/** Run the bare CLI in a temp project built from `setup`; return stdout. */
async function bareRun(setup: Setup, ...flags: string[]): Promise<string> {
	const dir = await mkdtemp(join(tmpdir(), "ct-hint-"));
	try {
		const pkg = { name: "consumer", private: true, scripts: setup.scripts ?? {} };
		await writeFile(join(dir, "package.json"), `${JSON.stringify(pkg, null, 2)}\n`);
		if (setup.config) await writeFile(join(dir, "claude-toolkit.config.ts"), PLAIN_CONFIG);
		if (setup.yarnrc) await writeFile(join(dir, ".yarnrc.yml"), "nodeLinker: node-modules\n");
		if (setup.marker !== undefined) {
			await mkdir(join(dir, ".claude"), { recursive: true });
			await writeFile(join(dir, ".claude", ".toolkit-version"), `${setup.marker}\n`);
		}
		const r = Bun.spawnSync([process.execPath, CLI, dir, ...flags], {
			stdout: "pipe",
			stderr: "pipe",
		});
		expect(r.exitCode).toBe(0);
		return r.stdout.toString();
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
}

test("first run prints the prepare hint", async () => {
	const out = await bareRun({});
	expect(out).toContain(HEADER);
	expect(out).toContain(PREPARE_LINE);
	expect(out).not.toContain(UPGRADE_LINE);
});

test("a later run without a refresh script prints the hint", async () => {
	expect(await bareRun({ config: true })).toContain(PREPARE_LINE);
});

test("no hint when package.json already runs claude-toolkit refresh", async () => {
	const out = await bareRun({
		config: true,
		scripts: { prepare: "claude-toolkit refresh || exit 0" },
	});
	expect(out).not.toContain(HEADER);
});

test("an upgrade from a pre-0.17 marker adds the removal line", async () => {
	const out = await bareRun({ config: true, marker: "0.16.0" });
	expect(out).toContain(UPGRADE_LINE);
	expect(out.indexOf(UPGRADE_LINE)).toBeLessThan(out.indexOf(HEADER));
});

test("an existing prepare script gets the named-script variant", async () => {
	const out = await bareRun({ config: true, scripts: { prepare: "husky" } });
	expect(out).toContain('"claude-toolkit:refresh": "claude-toolkit refresh || exit 0"');
	expect(out).toContain('"&& bun run claude-toolkit:refresh"');
});

test("a Yarn Berry project is pointed at postinstall", async () => {
	const out = await bareRun({ config: true, yarnrc: true });
	expect(out).toContain('"postinstall": "claude-toolkit refresh || exit 0"');
});

test("--quiet prints no hint", async () => {
	expect(await bareRun({ config: true, marker: "0.16.0" }, "--quiet")).toBe("");
});
