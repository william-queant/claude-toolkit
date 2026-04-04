#!/usr/bin/env bun
/**
 * claude-toolkit CLI
 *
 * Commands:
 *   init  — Scaffold config file and generate .claude/
 *   sync  — Regenerate .claude/ from existing config
 */

import { resolve, join } from 'node:path';
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { generate } from '../src/generator.js';
import type { ClaudeToolkitConfig } from '../src/types.js';

const CONFIG_FILENAME = 'claude-toolkit.config.ts';

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
    console.log('Running sync instead...');
    return sync(projectDir);
  }

  // Copy starter config
  const templatePath = join(import.meta.dirname, '..', 'templates', 'claude-toolkit.config.ts');
  if (existsSync(templatePath)) {
    const template = await readFile(templatePath, 'utf-8');
    await writeFile(configPath, template, 'utf-8');
    console.log(`Created ${CONFIG_FILENAME}`);
  } else {
    // Inline fallback
    const defaultConfig = `import { defineConfig } from 'claude-toolkit'

export default defineConfig({
  stacks: [],
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
    await writeFile(configPath, defaultConfig, 'utf-8');
    console.log(`Created ${CONFIG_FILENAME}`);
  }

  // Generate
  return sync(projectDir);
}

async function sync(projectDir: string): Promise<void> {
  const config = await loadConfig(projectDir);
  await generate(projectDir, config);
  console.log('Sync complete.');
}

// CLI entry
const args = process.argv.slice(2);
const command = args[0];
const projectDir = resolve(args[1] ?? '.');

switch (command) {
  case 'init':
    await init(projectDir);
    break;
  case 'sync':
    await sync(projectDir);
    break;
  case undefined:
  case 'help':
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
