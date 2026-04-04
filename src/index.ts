export type {
  ClaudeToolkitConfig,
  StackName,
  HookConfig,
  GitConfig,
  ProjectInfo,
  StackPack,
  ResolvedConfig,
} from './types.js';

/**
 * Define a claude-toolkit configuration with full type safety.
 *
 * @example
 * ```ts
 * import { defineConfig } from 'claude-toolkit'
 *
 * export default defineConfig({
 *   stacks: ['solidjs', 'rust-wasm', 'cloudflare'],
 *   packageManager: 'bun',
 *   hooks: {
 *     formatter: 'bun run prettier --write',
 *     testRunner: 'bun run vitest run',
 *   },
 * })
 * ```
 */
export function defineConfig(config: import('./types.js').ClaudeToolkitConfig) {
  return config;
}
