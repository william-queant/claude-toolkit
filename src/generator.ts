import { copyFile as fsCopyFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { ClaudeToolkitConfig, ResolvedConfig, StackPack } from "./types.js";
import { copyDir, exists, readJson, writeFileEnsureDir } from "./utils.js";

const TOOLKIT_ROOT = resolve(import.meta.dirname, "..");

/** Resolve the full configuration by merging core + stacks + project config */
async function resolveConfig(config: ClaudeToolkitConfig): Promise<ResolvedConfig> {
	const stacks: StackPack[] = [];
	const allMappings: Record<string, string> = {};

	// Load stack packs
	for (const stackName of config.stacks) {
		const stackDir = join(TOOLKIT_ROOT, "stacks", stackName);
		const stackJsonPath = join(stackDir, "stack.json");
		if (exists(stackJsonPath)) {
			const pack = await readJson<StackPack>(stackJsonPath);
			stacks.push(pack);
			Object.assign(allMappings, pack.defaultMappings);
		}
	}

	// Project mappings override stack defaults
	if (config.directoryMappings) {
		Object.assign(allMappings, config.directoryMappings);
	}

	// Resolve hooks with package manager defaults
	const installCmd =
		config.hooks?.installCommand ??
		(config.packageManager === "bun" ? "bun install" : `${config.packageManager} install`);

	const hooks = {
		...config.hooks,
		installCommand: installCmd,
	};

	// Collect skill names
	const skills = [
		"ct-systematic-debugging",
		"ct-testing-patterns",
		"ct-typescript-conventions",
		"ct-verification-before-completion",
		...(config.excludeSkills ? [] : []),
	].filter((s) => !config.excludeSkills?.includes(s));

	return { config, skills, directoryMappings: allMappings, hooks, stacks };
}

/** Generate the .claude/ directory from resolved config */
export async function generate(projectDir: string, config: ClaudeToolkitConfig): Promise<void> {
	const resolved = await resolveConfig(config);
	const claudeDir = join(projectDir, ".claude");

	// 1. Copy core hooks
	await copyDir(join(TOOLKIT_ROOT, "core", "hooks"), join(claudeDir, "hooks"));

	// 2. Copy core skills
	await copyDir(join(TOOLKIT_ROOT, "core", "skills"), join(claudeDir, "skills"));

	// 3. Copy core commands (namespaced under ct/)
	await copyDir(join(TOOLKIT_ROOT, "core", "commands", "ct"), join(claudeDir, "commands", "ct"));

	// 4. Copy core agents
	await copyDir(join(TOOLKIT_ROOT, "core", "agents"), join(claudeDir, "agents"));

	// 5. Copy stack-specific skills
	for (const stackName of config.stacks) {
		const stackSkillsDir = join(TOOLKIT_ROOT, "stacks", stackName, "skills");
		if (exists(stackSkillsDir)) {
			await copyDir(stackSkillsDir, join(claudeDir, "skills"));
		}
	}

	// 6. Generate skill-rules.json
	await generateSkillRules(claudeDir, resolved);

	// 7. Generate settings.json
	await generateSettings(claudeDir, resolved);

	// 8. Generate .claude/.gitignore
	await writeFileEnsureDir(
		join(claudeDir, ".gitignore"),
		[
			"# User-specific configuration",
			"user-team-info.json",
			"",
			"# Local settings (personal overrides)",
			"settings.local.json",
			"",
			"# Task-specific context",
			"tasks/",
			"",
		].join("\n"),
	);

	// 9. Scaffold base configs
	await scaffoldConfigs(projectDir, resolved);

	// 10. Generate skills README
	await generateSkillsReadme(claudeDir, resolved);

	console.log(
		`Generated .claude/ with ${resolved.stacks.length} stack(s) and ${resolved.skills.length} core skills`,
	);
}

/** Generate skill-rules.json from resolved config */
async function generateSkillRules(claudeDir: string, resolved: ResolvedConfig): Promise<void> {
	// Load all SKILL.md files to build the rules
	const rules: Record<string, unknown> = {};

	// Load skill rules from each stack's stack.json
	for (const stackName of resolved.config.stacks) {
		const stackJsonPath = join(TOOLKIT_ROOT, "stacks", stackName, "stack.json");
		if (exists(stackJsonPath)) {
			const pack = await readJson<StackPack & { skillRules?: Record<string, unknown> }>(
				stackJsonPath,
			);
			if (pack.skillRules) {
				Object.assign(rules, pack.skillRules);
			}
		}
	}

	// Load core skill rules template
	const coreRulesPath = join(TOOLKIT_ROOT, "templates", "skill-rules.base.json");
	const baseRules = exists(coreRulesPath)
		? await readJson<Record<string, unknown>>(coreRulesPath)
		: {};

	const skillRules = {
		$schema: "./skill-rules.schema.json",
		version: "2.0",
		config: {
			minConfidenceScore: 3,
			showMatchReasons: true,
			maxSkillsToShow: 5,
		},
		scoring: {
			keyword: 2,
			keywordPattern: 3,
			pathPattern: 4,
			directoryMatch: 5,
			intentPattern: 4,
			contentPattern: 3,
			contextPattern: 2,
		},
		directoryMappings: resolved.directoryMappings,
		skills: {
			...(((baseRules as Record<string, unknown>).skills as Record<string, unknown>) ?? {}),
			...rules,
		},
	};

	await writeFileEnsureDir(
		join(claudeDir, "hooks", "skill-rules.json"),
		`${JSON.stringify(skillRules, null, 2)}\n`,
	);
}

/** Generate settings.json with hooks */
async function generateSettings(claudeDir: string, resolved: ResolvedConfig): Promise<void> {
	const { hooks, config } = resolved;
	const protectedBranches = config.git?.protectedBranches ?? ["main"];

	const branchCheck = protectedBranches
		.map((b) => `"$(git branch --show-current)" != "${b}"`)
		.join(" && ");

	const postToolUseHooks: unknown[] = [];

	// Auto-format
	if (hooks.formatter) {
		const extensions = ["js", "jsx", "ts", "tsx"];
		// Add stack-specific extensions
		for (const stack of resolved.stacks) {
			for (const ext of stack.fileExtensions) {
				if (!extensions.includes(ext)) extensions.push(ext);
			}
		}
		const extPattern = extensions.join("|");

		postToolUseHooks.push({
			type: "command",
			command: `# Auto-format files\nif [[ "$CLAUDE_TOOL_INPUT_FILE_PATH" =~ \\.(${extPattern})$ ]]; then\n  file_path="$CLAUDE_TOOL_INPUT_FILE_PATH"\n  ${hooks.formatter} "$file_path" 2>&1\n  exit_code=$?\n  if [ $exit_code -ne 0 ]; then\n    echo '{"feedback": "Formatting failed. Check file for syntax errors."}' >&2\n    exit 1\n  else\n    echo '{"feedback": "Formatting applied.", "suppressOutput": true}'\n  fi\nfi`,
			timeout: 30,
		});
	}

	// Auto-install
	const installCmd = hooks.installCommand ?? `${config.packageManager} install`;
	postToolUseHooks.push({
		type: "command",
		command: `# Auto-install dependencies when package.json changes\nif [[ "$CLAUDE_TOOL_INPUT_FILE_PATH" =~ package\\.json$ ]]; then\n  echo '{"feedback": "Installing dependencies..."}' >&2\n  ${installCmd} >/dev/null 2>&1 && echo '{"feedback": "Dependencies installed.", "suppressOutput": true}' || {\n    echo '{"feedback": "Failed to install dependencies."}' >&2\n    exit 1\n  }\nfi`,
		timeout: 60,
	});

	// Auto-run tests
	if (hooks.testRunner) {
		postToolUseHooks.push({
			type: "command",
			command: `# Auto-run tests when test files change\nif [[ "$CLAUDE_TOOL_INPUT_FILE_PATH" =~ \\.test\\.(js|jsx|ts|tsx)$ ]] || [[ "$CLAUDE_TOOL_INPUT_FILE_PATH" =~ \\.spec\\.(js|jsx|ts|tsx)$ ]]; then\n  echo '{"feedback": "Running tests..."}' >&2\n  ${hooks.testRunner} "$CLAUDE_TOOL_INPUT_FILE_PATH" 2>&1 | tail -30\n  exit_code=\${PIPESTATUS[0]}\n  if [ $exit_code -eq 0 ]; then\n    echo '{"feedback": "Tests passed."}'\n  else\n    echo '{"feedback": "Tests failed. See output above."}' >&2\n  fi\nfi`,
			timeout: 90,
		});
	}

	// Type-check
	if (hooks.typeCheck) {
		postToolUseHooks.push({
			type: "command",
			command: `# Type-check TypeScript files\nif [[ "$CLAUDE_TOOL_INPUT_FILE_PATH" =~ \\.(ts|tsx)$ ]]; then\n  echo '{"feedback": "Checking TypeScript types..."}' >&2\n  output=$(${hooks.typeCheck} 2>&1)\n  exit_code=$?\n  if [ $exit_code -eq 0 ]; then\n    echo '{"feedback": "No TypeScript errors.", "suppressOutput": true}'\n  else\n    errors=$(echo "$output" | grep -A 2 "error TS" | head -30)\n    if [ -n "$errors" ]; then\n      echo '{"feedback": "TypeScript found type errors:"}' >&2\n      echo "$errors" >&2\n    fi\n  fi\n  exit 0\nfi`,
			timeout: 30,
		});
	}

	// Extra checks (e.g., cargo check for Rust)
	if (hooks.extraChecks) {
		for (const check of hooks.extraChecks) {
			postToolUseHooks.push({
				type: "command",
				command: `# Extra check: ${check}\nif [[ "$CLAUDE_TOOL_INPUT_FILE_PATH" =~ \\.rs$ ]]; then\n  echo '{"feedback": "Running extra check..."}' >&2\n  output=$(${check} 2>&1)\n  exit_code=$?\n  if [ $exit_code -eq 0 ]; then\n    echo '{"feedback": "Check passed.", "suppressOutput": true}'\n  else\n    echo '{"feedback": "Check failed:"}' >&2\n    echo "$output" | tail -20 >&2\n  fi\n  exit 0\nfi`,
				timeout: 60,
			});
		}
	}

	const settings = {
		includeCoAuthoredBy: true,
		env: {
			INSIDE_CLAUDE_CODE: "1",
			BASH_DEFAULT_TIMEOUT_MS: "420000",
			BASH_MAX_TIMEOUT_MS: "420000",
		},
		hooks: {
			UserPromptSubmit: [
				{
					hooks: [
						{
							type: "command",
							command: '"$CLAUDE_PROJECT_DIR"/.claude/hooks/skill-eval.sh',
							timeout: 5,
						},
					],
				},
			],
			PreToolUse: [
				{
					matcher: "Edit|MultiEdit|Write",
					hooks: [
						{
							type: "command",
							command: `# Prevent editing on protected branches\n[ ${branchCheck} ] || { echo '{"block": true, "message": "Cannot edit files on a protected branch. Create a feature branch first."}' >&2; exit 2; }`,
							timeout: 5,
						},
					],
				},
			],
			PostToolUse: postToolUseHooks.map((hook) => ({
				matcher: "Edit|MultiEdit|Write",
				hooks: [hook],
			})),
		},
	};

	await writeFileEnsureDir(
		join(claudeDir, "settings.json"),
		`${JSON.stringify(settings, null, 2)}\n`,
	);
}

/** Scaffold base config files (biome.json, tsconfig.json) into the project */
async function scaffoldConfigs(projectDir: string, resolved: ResolvedConfig): Promise<void> {
	if (resolved.config.scaffoldConfigs === false) return;

	const configsDir = join(TOOLKIT_ROOT, "templates", "configs");
	const configs = [
		{ src: "biome.base.json", dest: "biome.json" },
		{ src: "tsconfig.base.json", dest: "tsconfig.json" },
	];

	for (const { src, dest } of configs) {
		const destPath = join(projectDir, dest);
		if (exists(destPath)) {
			console.log(`  Skipped ${dest} (already exists)`);
		} else {
			await fsCopyFile(join(configsDir, src), destPath);
			console.log(`  Scaffolded ${dest}`);
		}
	}
}

/** Generate skills/README.md */
async function generateSkillsReadme(claudeDir: string, resolved: ResolvedConfig): Promise<void> {
	let content = "# Claude Code Skills\n\n";
	content += "Auto-generated by claude-toolkit. Do not edit manually.\n\n";
	content += "## Core Skills\n\n";
	content += "| Skill | Description |\n";
	content += "|-------|-------------|\n";
	content +=
		"| ct-systematic-debugging | Four-phase debugging methodology, root cause analysis |\n";
	content += "| ct-testing-patterns | Test-driven development workflow and patterns |\n";
	content += "| ct-typescript-conventions | TypeScript strict mode and conventions |\n";
	content += "| ct-verification-before-completion | Evidence-based completion claims protocol |\n";
	content += "\n## Stack Skills\n\n";
	content += "| Skill | Stack | Description |\n";
	content += "|-------|-------|-------------|\n";

	for (const stack of resolved.stacks) {
		content += `| ${stack.name} | ${stack.name} | ${stack.description} |\n`;
	}

	content += "\n---\n\n*Generated from claude-toolkit.config.ts*\n";

	await writeFileEnsureDir(join(claudeDir, "skills", "README.md"), content);
}
