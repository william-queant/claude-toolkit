/** Available stack identifiers */
export type StackName =
	| "solidjs"
	| "vanilla-extract"
	| "rust-wasm"
	| "protobuf"
	| "cloudflare"
	| "i18n-typesafe"
	| (string & {});

/** Hook configuration for post-tool-use automation */
export interface HookConfig {
	/** Formatter command (e.g., "bun run prettier --write") */
	formatter?: string;
	/** Test runner command (e.g., "bun run vitest run") */
	testRunner?: string;
	/** Type checker command (e.g., "bun run tsc --noEmit") */
	typeCheck?: string;
	/** Additional check commands (e.g., ["cargo check --target wasm32-unknown-unknown"]) */
	extraChecks?: string[];
	/** Dependency install command (e.g., "bun install") — inferred from packageManager if omitted */
	installCommand?: string;
}

/** Git workflow configuration */
export interface GitConfig {
	/** Branch name prefix (e.g., "wq" → "wq/feature-name") */
	branchPrefix?: string;
	/** Branches protected from direct edits */
	protectedBranches?: string[];
	/** Commit format (default: conventional commits) */
	commitFormat?: "conventional" | "freeform";
}

/** Project metadata used in CLAUDE.md generation */
export interface ProjectInfo {
	/** Project name */
	name?: string;
	/** Short project description */
	description?: string;
	/** Key directories and their purpose */
	directories?: Record<string, string>;
	/** Common dev commands */
	commands?: Record<string, string>;
}

/** Main toolkit configuration */
export interface ClaudeToolkitConfig {
	/** Stack packs to activate */
	stacks: StackName[];
	/** Package manager to use */
	packageManager: "bun" | "npm" | "pnpm" | "yarn";
	/** Hook automation config */
	hooks?: HookConfig;
	/** Directory → skill mappings (merged with stack defaults) */
	directoryMappings?: Record<string, string>;
	/** Git workflow config */
	git?: GitConfig;
	/** Project info for CLAUDE.md generation */
	project?: ProjectInfo;
	/** Additional custom skills to include (paths relative to project root) */
	customSkills?: string[];
	/** Skills to exclude from core set */
	excludeSkills?: string[];
	/** Whether to scaffold base configs (biome.json, tsconfig.json) on init. Default: true */
	scaffoldConfigs?: boolean;
}

/** Stack pack metadata (loaded from stack.json) */
export interface StackPack {
	name: string;
	description: string;
	defaultMappings: Record<string, string>;
	fileExtensions: string[];
	hookOverrides?: Partial<HookConfig>;
}

/** Resolved configuration after merging core + stacks + project config */
export interface ResolvedConfig {
	config: ClaudeToolkitConfig;
	skills: string[];
	directoryMappings: Record<string, string>;
	hooks: HookConfig;
	stacks: StackPack[];
}
