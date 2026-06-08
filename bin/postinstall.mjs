#!/usr/bin/env node

/**
 * claude-toolkit postinstall
 *
 * Runs in the consumer project after install. If a claude-toolkit.config.ts
 * exists, it regenerates .claude/ — but only when the installed toolkit version
 * differs from the one that last generated it, so it fires on a toolkit update,
 * not on every install.
 *
 * Guarantees:
 *  - Never fails the consumer's install (all errors swallowed; always exit 0).
 *  - Never runs inside the toolkit's own repo (dev install).
 *  - Never creates or edits the committed config — only regenerates .claude/.
 *  - Writes no committed files when there's no config (prints a one-line nudge).
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

function readJsonSafe(path) {
	try {
		return JSON.parse(readFileSync(path, "utf8"));
	} catch {
		return null;
	}
}

try {
	const toolkitDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
	// INIT_CWD is set by npm/bun/pnpm/yarn to the dir where install was invoked.
	const consumerRoot = resolve(process.env.INIT_CWD || process.cwd());

	// 1. Skip when running inside the toolkit's own repo (dev install).
	if (consumerRoot === toolkitDir) process.exit(0);
	const consumerPkg = readJsonSafe(join(consumerRoot, "package.json"));
	if (consumerPkg?.name === "claude-toolkit") process.exit(0);

	// 2. No config -> stay hands-off; just nudge once. Never write committed files.
	const hasConfig =
		existsSync(join(consumerRoot, "claude-toolkit.config.ts")) ||
		existsSync(join(consumerRoot, "claude-toolkit.config.js"));
	if (!hasConfig) {
		console.log(
			'[claude-toolkit] Run "bunx claude-toolkit" to set up your Claude Code config (.claude/).',
		);
		process.exit(0);
	}

	// 3. Only regenerate when the toolkit version changed since the last generation.
	const toolkitVersion = readJsonSafe(join(toolkitDir, "package.json"))?.version;
	const markerPath = join(consumerRoot, ".claude", ".toolkit-version");
	const lastVersion = existsSync(markerPath) ? readFileSync(markerPath, "utf8").trim() : null;
	if (toolkitVersion && lastVersion === toolkitVersion) process.exit(0);

	// 4. Regenerate via the CLI (reuses config loading + clean rebuild). Best-effort:
	//    spawnSync sets `.error` if bun is missing — we ignore it rather than fail.
	spawnSync("bun", [join(toolkitDir, "bin", "cli.ts"), "postinstall"], {
		cwd: consumerRoot,
		stdio: "inherit",
		env: { ...process.env, INIT_CWD: consumerRoot },
	});
} catch {
	// Never break the consumer's install over config regeneration.
}

process.exit(0);
