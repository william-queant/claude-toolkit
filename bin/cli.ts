#!/usr/bin/env bun

/**
 * claude-toolkit CLI
 *
 * Commands:
 *   init  — Scaffold config file and generate .claude/
 *   sync  — Regenerate .claude/ from existing config
 */

import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { detectStacks } from "../src/detect.js";
import { generate } from "../src/generator.js";
import type { ClaudeToolkitConfig } from "../src/types.js";

const CONFIG_FILENAME = "claude-toolkit.config.ts";

async function loadConfig(projectDir: string): Promise<ClaudeToolkitConfig> {
	const configPath = join(projectDir, CONFIG_FILENAME);
	if (!existsSync(configPath)) {
		throw new Error(`Config not found: ${configPath}\nRun "claude-toolkit init" first.`);
	}
	const module = await import(configPath);
	return module.default as ClaudeToolkitConfig;
}

async function init(projectDir: string): Promise<void> {
	const configPath = join(projectDir, CONFIG_FILENAME);

	if (existsSync(configPath)) {
		console.log(`Config already exists: ${configPath}`);
		console.log("Running sync instead...");
		return sync(projectDir);
	}

	// Detect stacks
	const detected = detectStacks(projectDir);
	if (detected.length > 0) {
		console.log("Detected stacks:");
		const maxLen = Math.max(...detected.map((d) => d.name.length));
		for (const d of detected) {
			console.log(`  ${d.name.padEnd(maxLen)} — ${d.reason}`);
		}
	} else {
		console.log(`No stacks detected. You can add them manually in ${CONFIG_FILENAME}`);
	}

	// Build stacks literal for config injection
	const stacksLiteral =
		detected.length > 0
			? `stacks: [${detected.map((d) => `"${d.name}"`).join(", ")}]`
			: "stacks: []";

	// Copy starter config with detected stacks injected
	const templatePath = join(import.meta.dirname, "..", "templates", "claude-toolkit.config.ts");
	if (existsSync(templatePath)) {
		const template = await readFile(templatePath, "utf-8");
		const configContent = template.replace("stacks: []", stacksLiteral);
		await writeFile(configPath, configContent, "utf-8");
		console.log(`Created ${CONFIG_FILENAME}`);
	} else {
		// Inline fallback
		const defaultConfig = `import { defineConfig } from 'claude-toolkit'

export default defineConfig({
  ${stacksLiteral},
  packageManager: 'bun',
  hooks: {
    formatter: 'bun run prettier --write',
    testRunner: 'bun run vitest run',
    typeCheck: 'bun run tsc --noEmit',
  },
  git: {
    branchPrefix: 'dev',
    protectedBranches: ['main'],
  },
})
`;
		await writeFile(configPath, defaultConfig, "utf-8");
		console.log(`Created ${CONFIG_FILENAME}`);
	}

	// Generate
	return sync(projectDir);
}

async function sync(projectDir: string): Promise<void> {
	const config = await loadConfig(projectDir);

	// Compare detected stacks against config
	const detected = detectStacks(projectDir);
	const configuredNames = new Set(config.stacks);
	const detectedNames = new Set(detected.map((d) => d.name));

	const missing = detected.filter((d) => !configuredNames.has(d.name));
	const stale = config.stacks.filter((s) => !detectedNames.has(s));

	if (missing.length > 0 || stale.length > 0) {
		console.log("\nStack drift detected:");
		if (missing.length > 0) {
			const maxLen = Math.max(...missing.map((d) => d.name.length));
			for (const d of missing) {
				console.log(`  + ${d.name.padEnd(maxLen)} — ${d.reason} (not in config)`);
			}
		}
		if (stale.length > 0) {
			for (const s of stale) {
				console.log(`  - ${s} — in config but not detected in project`);
			}
		}
		const suggested = [
			...new Set([
				...config.stacks.filter((s) => !stale.includes(s)),
				...missing.map((d) => d.name),
			]),
		];
		console.log(`\nSuggested update in ${CONFIG_FILENAME}:`);
		console.log(`  stacks: [${suggested.map((s) => `"${s}"`).join(", ")}]\n`);
	}

	await generate(projectDir, config);
	console.log("Sync complete.");
}

// CLI entry
const args = process.argv.slice(2);
const command = args[0];
const projectDir = resolve(args[1] ?? ".");

switch (command) {
	case "init":
		await init(projectDir);
		break;
	case "sync":
		await sync(projectDir);
		break;
	case undefined:
	case "help":
		console.log(`
claude-toolkit — Reusable Claude Code configuration

Commands:
  init    Scaffold config file and generate .claude/
  sync    Regenerate .claude/ from config
  help    Show this message

Usage:
  bunx claude-toolkit init [project-dir]
  bunx claude-toolkit sync [project-dir]
`);
		break;
	default:
		console.error(`Unknown command: ${command}`);
		process.exit(1);
}
