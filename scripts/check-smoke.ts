#!/usr/bin/env bun
/**
 * Install smoke test. Packs the package, installs the tarball into a fresh consumer
 * that has a config but no .claude/, and checks that `claude-toolkit refresh`
 * generates .claude/ once and then takes the fast path.
 *
 *   bun run check:smoke
 *
 * Dev-only: scripts/ is not in package.json "files", so this file never ships.
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CONSUMER_CONFIG = `import { defineConfig } from "claude-toolkit";

export default defineConfig({ stacks: [], packageManager: "bun" });
`;

/** Run a command; throw with its output when it fails. Returns stdout. */
function run(cmd: string[], cwd: string): string {
	const r = Bun.spawnSync(cmd, { cwd, stdout: "pipe", stderr: "pipe" });
	if (r.exitCode !== 0) {
		throw new Error(`${cmd.join(" ")} exited ${r.exitCode}\n${r.stdout}\n${r.stderr}`);
	}
	return r.stdout.toString();
}

function fail(message: string): never {
	console.error(`check:smoke: ${message}`);
	process.exit(1);
}

const root = join(import.meta.dirname, "..");
const work = mkdtempSync(join(tmpdir(), "ct-smoke-"));
try {
	// npm 10 runs "prepare" despite --ignore-scripts; skip anything it printed before the JSON.
	const packOut = run(
		["npm", "pack", "--json", "--ignore-scripts", "--pack-destination", work],
		root,
	);
	const [packed] = JSON.parse(packOut.slice(packOut.indexOf("["))) as Array<{
		filename: string;
		version: string;
	}>;
	if (!packed) fail("npm pack produced no tarball");
	const tarball = join(work, packed.filename);

	const consumer = join(work, "consumer");
	mkdirSync(consumer);
	writeFileSync(join(consumer, "package.json"), '{ "name": "ct-smoke", "private": true }\n');
	writeFileSync(join(consumer, "claude-toolkit.config.ts"), CONSUMER_CONFIG);
	run([process.execPath, "add", "-d", tarball], consumer);

	const bin = Bun.which("claude-toolkit", { PATH: join(consumer, "node_modules", ".bin") });
	if (!bin) fail("node_modules/.bin/claude-toolkit was not installed");

	const first = run([bin, "refresh"], consumer);
	const marker = join(consumer, ".claude", ".toolkit-version");
	if (!existsSync(marker)) fail(`refresh did not generate .claude/ (output: ${first.trim()})`);
	const recorded = readFileSync(marker, "utf-8").trim();
	if (recorded !== packed.version) fail(`marker is ${recorded}, expected ${packed.version}`);
	if (!first.includes("Regenerated .claude/")) fail(`unexpected first-run output: ${first}`);

	const second = run([bin, "refresh"], consumer);
	if (second.trim() !== "") fail(`second refresh did not take the fast path: ${second}`);

	console.log(`check:smoke OK: ${packed.filename} installs and refreshes`);
} finally {
	rmSync(work, { recursive: true, force: true });
}
