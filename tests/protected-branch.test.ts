import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generate } from "../src/generator.ts";
import type { ClaudeToolkitConfig } from "../src/types.ts";

// On Windows, System32\bash.exe is the WSL launcher, not Git Bash — skip rather than misfire.
const found = Bun.which("bash");
const bash = found && !/system32/i.test(found) ? found : null;
const git = Bun.which("git");
// Never let an outer git hook's environment redirect these commands to the real repo.
const env: Record<string, string | undefined> = { ...process.env };
for (const key of ["GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE"]) delete env[key];

interface Settings {
	hooks: { PreToolUse?: Array<{ hooks: Array<{ command: string }> }> };
}

/** Generate .claude/ for `git` settings in a temp dir and return the parsed settings.json. */
async function settingsFor(gitConfig: ClaudeToolkitConfig["git"]): Promise<Settings> {
	const dir = await mkdtemp(join(tmpdir(), "ct-branch-"));
	try {
		const config: ClaudeToolkitConfig = { stacks: [], packageManager: "bun" };
		if (gitConfig) config.git = gitConfig;
		await generate(dir, config, { quiet: true, scaffold: false });
		return JSON.parse(await readFile(join(dir, ".claude", "settings.json"), "utf8"));
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
}

function guardCommand(settings: Settings): string {
	const command = settings.hooks.PreToolUse?.[0]?.hooks[0]?.command;
	if (!command) throw new Error("no PreToolUse guard generated");
	return command;
}

/** Run `command` with bash in a fresh repo whose current branch is `branch`; return the exit code. */
async function exitCodeOnBranch(command: string, branch: string): Promise<number> {
	const repo = await mkdtemp(join(tmpdir(), "ct-branch-repo-"));
	try {
		const run = (args: string[]) =>
			Bun.spawnSync(args, { cwd: repo, env, stdout: "pipe", stderr: "pipe" });
		expect(run([git as string, "init", "-q"]).exitCode).toBe(0);
		expect(run([git as string, "symbolic-ref", "HEAD", `refs/heads/${branch}`]).exitCode).toBe(0);
		return run([bash as string, "-c", command]).exitCode;
	} finally {
		await rm(repo, { recursive: true, force: true });
	}
}

test.skipIf(!bash || !git)("two protected branches: a feature branch may edit", async () => {
	const command = guardCommand(await settingsFor({ protectedBranches: ["main", "master"] }));
	expect(await exitCodeOnBranch(command, "feature/x")).toBe(0);
});

test.skipIf(!bash || !git)("two protected branches: each protected branch is blocked", async () => {
	const command = guardCommand(await settingsFor({ protectedBranches: ["main", "master"] }));
	expect(await exitCodeOnBranch(command, "main")).toBe(2);
	expect(await exitCodeOnBranch(command, "master")).toBe(2);
});

test.skipIf(!bash || !git)("default config protects main only", async () => {
	const command = guardCommand(await settingsFor(undefined));
	expect(await exitCodeOnBranch(command, "main")).toBe(2);
	expect(await exitCodeOnBranch(command, "develop")).toBe(0);
});

test("the guard is a case statement with single-quoted branch patterns", async () => {
	const command = guardCommand(await settingsFor({ protectedBranches: ["main", "release/1.x"] }));
	expect(command).toContain(`case "$(git branch --show-current)" in 'main'|'release/1.x')`);
	expect(command).not.toContain("&&");
});

test("an empty protectedBranches list generates no guard", async () => {
	const settings = await settingsFor({ protectedBranches: [] });
	expect(settings.hooks.PreToolUse).toBeUndefined();
});

test.each([
	["main; rm -rf ~"],
	["$(whoami)"],
	["it's"],
	["-main"],
	["a\nb"],
	[""],
])("an invalid branch name %p is rejected by name", async (name) => {
	const dir = await mkdtemp(join(tmpdir(), "ct-branch-bad-"));
	try {
		await expect(
			generate(
				dir,
				{ stacks: [], packageManager: "bun", git: { protectedBranches: ["main", name] } },
				{ quiet: true, scaffold: false },
			),
		).rejects.toThrow(`Invalid branch name in git.protectedBranches: ${JSON.stringify(name)}`);
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
});
