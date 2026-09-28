import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const CLI = fileURLToPath(new URL("../bin/cli.ts", import.meta.url));
const { version: VERSION } = JSON.parse(
	await readFile(fileURLToPath(new URL("../package.json", import.meta.url)), "utf8"),
);

const PLAIN_CONFIG = 'export default { stacks: [], packageManager: "bun" };\n';
const THROWING_CONFIG = 'throw new Error("config was imported");\n';
const PACKAGE_JSON = `${JSON.stringify({ name: "consumer", private: true }, null, 2)}\n`;

interface CliResult {
	exitCode: number;
	stdout: string;
	stderr: string;
}

function cli(...args: string[]): CliResult {
	const r = Bun.spawnSync([process.execPath, CLI, ...args], { stdout: "pipe", stderr: "pipe" });
	return { exitCode: r.exitCode, stdout: r.stdout.toString(), stderr: r.stderr.toString() };
}

/** A temp consumer project: package.json, optional config, optional marker. */
async function project(opts: { config?: string; marker?: string } = {}): Promise<string> {
	const dir = await mkdtemp(join(tmpdir(), "ct-refresh-"));
	await writeFile(join(dir, "package.json"), PACKAGE_JSON);
	if (opts.config !== undefined) {
		await writeFile(join(dir, "claude-toolkit.config.ts"), opts.config);
	}
	if (opts.marker !== undefined) {
		await mkdir(join(dir, ".claude"), { recursive: true });
		await writeFile(join(dir, ".claude", ".toolkit-version"), `${opts.marker}\n`);
	}
	return dir;
}

async function withProject(
	opts: { config?: string; marker?: string },
	body: (dir: string) => Promise<void>,
): Promise<void> {
	const dir = await project(opts);
	try {
		await body(dir);
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
}

test("refresh with no config exits 0, writes nothing, and prints the setup line", async () => {
	await withProject({}, async (dir) => {
		const r = cli("refresh", dir);
		expect(r.exitCode).toBe(0);
		expect(r.stdout.trim()).toBe(
			'[claude-toolkit] No config found — run "bunx claude-toolkit" to set up .claude/.',
		);
		expect(existsSync(join(dir, ".claude"))).toBe(false);
		expect(existsSync(join(dir, "claude-toolkit.config.ts"))).toBe(false);
	});
});

test("refresh --quiet with no config prints nothing", async () => {
	await withProject({}, async (dir) => {
		const r = cli("refresh", dir, "--quiet");
		expect(r.exitCode).toBe(0);
		expect(r.stdout).toBe("");
	});
});

test("refresh with a matching marker never imports the config", async () => {
	await withProject({ config: THROWING_CONFIG, marker: VERSION }, async (dir) => {
		const r = cli("refresh", dir);
		expect(r.exitCode).toBe(0);
		expect(r.stdout).toBe("");
		expect(r.stderr).toBe("");
	});
});

test("refresh with a matching marker does not recreate a deleted generated file", async () => {
	await withProject({ config: PLAIN_CONFIG }, async (dir) => {
		expect(cli("refresh", dir).exitCode).toBe(0);
		const rules = join(dir, ".claude", "hooks", "skill-rules.json");
		await rm(rules);
		const r = cli("refresh", dir);
		expect(r.exitCode).toBe(0);
		expect(r.stdout).toBe("");
		expect(existsSync(rules)).toBe(false);
	});
});

test.each([
	["a missing marker", undefined],
	["a stale marker", "0.0.1"],
])("refresh with %s regenerates without touching committed files", async (_label, marker) => {
	const opts = marker === undefined ? { config: PLAIN_CONFIG } : { config: PLAIN_CONFIG, marker };
	await withProject(opts, async (dir) => {
		const r = cli("refresh", dir);
		expect(r.exitCode).toBe(0);
		expect(r.stdout.trim()).toBe(`[claude-toolkit] Regenerated .claude/ for toolkit ${VERSION}.`);
		expect(await readFile(join(dir, ".claude", ".toolkit-version"), "utf8")).toBe(`${VERSION}\n`);
		expect(existsSync(join(dir, ".claude", "settings.json"))).toBe(true);
		expect(existsSync(join(dir, "biome.json"))).toBe(false);
		expect(existsSync(join(dir, "tsconfig.json"))).toBe(false);
		expect(await readFile(join(dir, "claude-toolkit.config.ts"), "utf8")).toBe(PLAIN_CONFIG);
		expect(await readFile(join(dir, "package.json"), "utf8")).toBe(PACKAGE_JSON);
	});
});

test("refresh --quiet regenerates silently", async () => {
	await withProject({ config: PLAIN_CONFIG }, async (dir) => {
		const r = cli("refresh", dir, "--quiet");
		expect(r.exitCode).toBe(0);
		expect(r.stdout).toBe("");
		expect(existsSync(join(dir, ".claude", ".toolkit-version"))).toBe(true);
	});
});

test("refresh finds a claude-toolkit.config.js", async () => {
	const dir = await project();
	try {
		await writeFile(join(dir, "claude-toolkit.config.js"), PLAIN_CONFIG);
		const r = cli("refresh", dir);
		expect(r.exitCode).toBe(0);
		expect(existsSync(join(dir, ".claude", ".toolkit-version"))).toBe(true);
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
});

test("refresh with a broken config exits 1 and reports the error", async () => {
	await withProject({ config: THROWING_CONFIG }, async (dir) => {
		const r = cli("refresh", dir);
		expect(r.exitCode).toBe(1);
		expect(r.stderr).toContain("config was imported");
	});
});

test("a bare run in a .js-config project does not scaffold a second .ts config", async () => {
	const dir = await project();
	try {
		await writeFile(join(dir, "claude-toolkit.config.js"), PLAIN_CONFIG);
		const r = cli(dir, "--quiet");
		expect(r.exitCode).toBe(0);
		expect(existsSync(join(dir, "claude-toolkit.config.ts"))).toBe(false);
		expect(await readFile(join(dir, "claude-toolkit.config.js"), "utf8")).toBe(PLAIN_CONFIG);
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
});
