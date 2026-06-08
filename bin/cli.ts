#!/usr/bin/env bun

/**
 * claude-toolkit CLI
 *
 * One idempotent command does it all:
 *   bunx claude-toolkit            Create the config if missing, then (re)generate .claude/
 *   bunx claude-toolkit --update   Also pull newly-detected stacks into the config
 *
 * Aliases / back-compat:
 *   init     Friendly name for the first run (same as the bare command)
 *   update   Same as `--update`
 *   sync     Deprecated alias of the bare command
 *
 * .claude/ is also regenerated automatically on install when the installed
 * toolkit version changes (see bin/postinstall.mjs).
 */

import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { detectStacks } from "../src/detect.js";
import { generate } from "../src/generator.js";
import type { ClaudeToolkitConfig } from "../src/types.js";

const CONFIG_FILENAME = "claude-toolkit.config.ts";

/** Build a `stacks: [...]` literal for injection into the config file. */
function buildStacksLiteral(stacks: string[]): string {
	return stacks.length > 0 ? `stacks: [${stacks.map((s) => `"${s}"`).join(", ")}]` : "stacks: []";
}

/** Rewrite the `stacks: [...]` array in an existing config file in place. */
async function updateConfigStacks(configPath: string, stacks: string[]): Promise<void> {
	const content = await readFile(configPath, "utf-8");
	const stacksArray = /stacks:\s*\[[^\]]*\]/;
	if (!stacksArray.test(content)) {
		throw new Error(
			`Could not find a "stacks: [...]" array in ${configPath} to update.\n` +
				`Add it manually: ${buildStacksLiteral(stacks)}`,
		);
	}
	await writeFile(configPath, content.replace(stacksArray, buildStacksLiteral(stacks)), "utf-8");
}

async function loadConfig(projectDir: string): Promise<ClaudeToolkitConfig> {
	const configPath = join(projectDir, CONFIG_FILENAME);
	if (!existsSync(configPath)) {
		throw new Error(`Config not found: ${configPath}\nRun "bunx claude-toolkit" first.`);
	}
	let mod: { default?: ClaudeToolkitConfig };
	try {
		mod = await import(configPath);
	} catch (err) {
		throw new Error(
			`Failed to load ${CONFIG_FILENAME}. Make sure claude-toolkit is installed in this project ` +
				`(e.g. "bun add -d claude-toolkit"), then run "bunx claude-toolkit" again.\n  ${(err as Error).message}`,
		);
	}
	return mod.default as ClaudeToolkitConfig;
}

/** Create claude-toolkit.config.ts from the template with detected stacks injected. */
async function scaffoldConfig(configPath: string, stacks: string[]): Promise<void> {
	const stacksLiteral = buildStacksLiteral(stacks);
	const templatePath = join(import.meta.dirname, "..", "templates", "claude-toolkit.config.ts");
	let content: string;
	if (existsSync(templatePath)) {
		content = (await readFile(templatePath, "utf-8")).replace("stacks: []", stacksLiteral);
	} else {
		content = `import { defineConfig } from "claude-toolkit";

export default defineConfig({
	${stacksLiteral},
	packageManager: "bun",
	hooks: {
		formatter: "bun run prettier --write",
		testRunner: "bun run vitest run",
		typeCheck: "bun run tsc --noEmit",
	},
	git: {
		branchPrefix: "dev",
		protectedBranches: ["main"],
	},
});
`;
	}
	await writeFile(configPath, content, "utf-8");
}

interface RunOptions {
	/** Also write newly-detected stacks into the config (the old `update`). */
	update?: boolean;
	/** Suppress informational output. */
	quiet?: boolean;
}

/**
 * The one command. Idempotent:
 *  - no config yet -> create it from detection
 *  - config exists -> report drift (or, with `update`, merge detected stacks in)
 * Always ends by cleanly regenerating .claude/.
 */
async function run(projectDir: string, options: RunOptions = {}): Promise<void> {
	const { update = false, quiet = false } = options;
	const log = quiet ? (_msg = "") => {} : (msg = "") => console.log(msg);
	const configPath = join(projectDir, CONFIG_FILENAME);

	let config: ClaudeToolkitConfig;

	if (!existsSync(configPath)) {
		// First run: create the config from what we detect.
		const detected = detectStacks(projectDir);
		if (detected.length > 0) {
			log("Detected stacks:");
			const pad = Math.max(...detected.map((d) => d.name.length));
			for (const d of detected) log(`  ${d.name.padEnd(pad)} — ${d.reason}`);
		} else {
			log(`No stacks detected. Add them manually in ${CONFIG_FILENAME}.`);
		}
		await scaffoldConfig(
			configPath,
			detected.map((d) => d.name),
		);
		log(`Created ${CONFIG_FILENAME}`);
		// Build the config in memory (mirroring the scaffolded template defaults) so the
		// first run never depends on importing the freshly-written config file — which
		// imports "claude-toolkit" and would fail if the package isn't installed yet.
		config = {
			stacks: detected.map((d) => d.name),
			packageManager: "bun",
			hooks: {
				formatter: "bun run prettier --write",
				testRunner: "bun run vitest run",
				typeCheck: "bun run tsc --noEmit",
			},
			git: { branchPrefix: "dev", protectedBranches: ["main"] },
		};
	} else {
		config = await loadConfig(projectDir);
		const detected = detectStacks(projectDir);
		const configured = new Set(config.stacks);
		const detectedNames = new Set(detected.map((d) => d.name));
		const missing = detected.filter((d) => !configured.has(d.name));
		const stale = config.stacks.filter((s) => !detectedNames.has(s));

		if (update) {
			if (missing.length > 0) {
				log("Adding newly detected stacks to config:");
				const pad = Math.max(...missing.map((d) => d.name.length));
				for (const d of missing) log(`  + ${d.name.padEnd(pad)} — ${d.reason}`);
				config.stacks = [...config.stacks, ...missing.map((d) => d.name)];
				await updateConfigStacks(configPath, config.stacks);
				log(`Updated ${CONFIG_FILENAME}`);
			} else {
				log("Config already includes all detected stacks.");
			}
			if (stale.length > 0) {
				log("\nIn config but not detected (left unchanged):");
				for (const s of stale) log(`  - ${s}`);
				log("Remove them from the config manually if they no longer apply.");
			}
		} else if (missing.length > 0 || stale.length > 0) {
			log("\nStack drift detected:");
			const pad = Math.max(1, ...missing.map((d) => d.name.length));
			for (const d of missing) {
				log(`  + ${d.name.padEnd(pad)} — ${d.reason} (detected, not in config)`);
			}
			for (const s of stale) log(`  - ${s} — in config, not detected`);
			if (missing.length > 0) {
				log(`\nRun "bunx claude-toolkit --update" to add detected stacks to your config.`);
			}
		}
	}

	await generate(projectDir, config, { quiet });
	log("Done.");
}

/** postinstall: quietly regenerate from an existing config. Never creates one. */
async function postinstall(projectDir: string): Promise<void> {
	if (!existsSync(join(projectDir, CONFIG_FILENAME))) return;
	const config = await loadConfig(projectDir);
	// scaffold:false — never write committed project files (biome.json/tsconfig.json) on install.
	await generate(projectDir, config, { quiet: true, scaffold: false });
	console.log("[claude-toolkit] Regenerated .claude/ for the updated toolkit version.");
}

const HELP = `
claude-toolkit — Reusable Claude Code configuration

Usage:
  bunx claude-toolkit [project-dir]            Create config if missing, then regenerate .claude/
  bunx claude-toolkit --update [project-dir]   Also add newly-detected stacks to the config

Commands (aliases):
  init      First-run friendly name (same as the bare command)
  update    Same as --update
  sync      Deprecated — use the bare command
  help      Show this message

Flags:
  --update, -u   Add newly-detected stacks to the config before regenerating
  --quiet, -q    Suppress informational output

.claude/ also regenerates automatically on install when the toolkit version changes.
`;

// ---- entry ----
const argv = process.argv.slice(2);
const flags = new Set(argv.filter((a) => a.startsWith("-")));
const positional = argv.filter((a) => !a.startsWith("-"));
const COMMANDS = new Set(["init", "update", "sync", "help", "postinstall"]);
const KNOWN_FLAGS = new Set(["--update", "-u", "--quiet", "-q"]);

// Reject unknown flags so a typo'd flag (e.g. --updat) isn't silently ignored.
for (const f of flags) {
	if (!KNOWN_FLAGS.has(f)) {
		console.error(`Unknown flag: ${f}\nRun "bunx claude-toolkit help".`);
		process.exit(1);
	}
}

const first = positional[0];
// A positional is treated as a project dir only when it's path-like (".", "..",
// "./x", or contains a separator) AND exists — so a typo'd command that happens to
// match a sibling dir name errors instead of silently generating in the wrong place.
const looksLikePath = (s: string) =>
	s === "." || s === ".." || s.startsWith(".") || /[\\/]/.test(s);
let command: string | undefined;
let dirArg: string | undefined;
if (first && COMMANDS.has(first)) {
	command = first;
	dirArg = positional[1];
} else if (first && looksLikePath(first) && existsSync(resolve(first))) {
	dirArg = first; // explicit project dir
} else if (first) {
	console.error(`Unknown command: ${first}\nRun "bunx claude-toolkit help".`);
	process.exit(1);
}

const projectDir = resolve(dirArg ?? ".");
const wantUpdate = command === "update" || flags.has("--update") || flags.has("-u");
const quiet = flags.has("--quiet") || flags.has("-q");

try {
	switch (command) {
		case "help":
			console.log(HELP);
			break;
		case "postinstall":
			await postinstall(projectDir);
			break;
		case "sync":
			if (!quiet) {
				console.log('Note: "sync" is deprecated — just run "bunx claude-toolkit".');
			}
			await run(projectDir, { update: wantUpdate, quiet });
			break;
		default:
			// undefined (bare command), "init", or "update"
			await run(projectDir, { update: wantUpdate, quiet });
			break;
	}
} catch (err) {
	console.error(`Error: ${(err as Error).message}`);
	process.exit(1);
}
