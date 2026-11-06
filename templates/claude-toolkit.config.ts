import { defineConfig } from "claude-toolkit";

export default defineConfig({
	// Stack packs to activate — each adds skills, directory mappings, and hook rules
	stacks: [],

	// Package manager used for install/run commands
	packageManager: "bun",

	// Hook automation — commands run exactly as written after Claude edits a matching file, from
	// the repo root. A command may only use letters, digits, spaces and . _ / @ : = + -; for
	// anything else, add a package.json script and reference it with your package manager
	// (e.g. "bun run <script>"). In a monorepo, target a package: "bun run --cwd apps/web vitest run".
	hooks: {
		formatter: "bun run biome format --write",
		testRunner: "bun run vitest run",
		typeCheck: "bun run tsc --noEmit",
		// typeCheckOnEdit: true, // also run typeCheck after every .ts/.tsx edit (slow on large projects)
		// autoInstall: true, // run the install command after every package.json edit
		// extraChecks: ['cargo check --target wasm32-unknown-unknown'], // runs at the repo root: add --manifest-path DIR/Cargo.toml for a crate in a subfolder
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
