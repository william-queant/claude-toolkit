import { defineConfig } from "claude-toolkit";

export default defineConfig({
	// Stack packs to activate — each adds skills, directory mappings, and hook rules
	stacks: [],

	// Package manager used for install/run commands
	packageManager: "bun",

	// Hook automation — commands run automatically on file changes
	hooks: {
		formatter: "bun run prettier --write",
		testRunner: "bun run vitest run",
		typeCheck: "bun run tsc --noEmit",
		// extraChecks: ['cargo check --target wasm32-unknown-unknown'],
	},

	// Directory → skill mappings (merged with stack defaults)
	directoryMappings: {
		// 'src/components': 'my-skill',
	},

	// Git workflow configuration
	git: {
		branchPrefix: "dev",
		protectedBranches: ["main"],
	},

	// Project metadata for CLAUDE.md generation
	project: {
		name: "my-project",
		description: "Project description",
	},
});
