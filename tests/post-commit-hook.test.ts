import { expect, test } from "bun:test";
import { copyFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const HOOK = fileURLToPath(new URL("../.husky/post-commit", import.meta.url));
// On Windows, System32\bash.exe is the WSL launcher, not a POSIX shell for this repo.
const found = Bun.which("sh");
const sh = found && !/system32/i.test(found) ? found : null;
const git = Bun.which("git");
// Never let an outer git hook's environment redirect these commands to the real repo.
const env: Record<string, string | undefined> = { ...process.env, SKIP_POST_COMMIT: "" };
for (const key of ["GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE"]) delete env[key];

function gitIn(dir: string, ...args: string[]): string {
	const r = Bun.spawnSync([git as string, ...args], {
		cwd: dir,
		env,
		stdout: "pipe",
		stderr: "pipe",
	});
	if (r.exitCode !== 0) throw new Error(`git ${args.join(" ")} failed: ${r.stderr.toString()}`);
	return r.stdout.toString().trim();
}

/** A throwaway repo at `version` with one base commit, then `subject` committed and the hook run. */
async function commitAndRunHook(version: string, subject: string): Promise<string> {
	const dir = await mkdtemp(join(tmpdir(), "ct-hook-"));
	try {
		gitIn(dir, "init", "-q");
		gitIn(dir, "config", "user.name", "hook-test");
		gitIn(dir, "config", "user.email", "hook-test@example.invalid");
		gitIn(dir, "config", "commit.gpgsign", "false");
		await writeFile(join(dir, "package.json"), `${JSON.stringify({ version }, null, "\t")}\n`);
		await writeFile(join(dir, "CHANGELOG.md"), "# Changelog\n");
		gitIn(dir, "add", ".");
		gitIn(dir, "commit", "-q", "-m", "chore: base");
		await writeFile(join(dir, "file.txt"), "change\n");
		gitIn(dir, "add", "file.txt");
		gitIn(dir, "commit", "-q", "-m", subject);
		await copyFile(HOOK, join(dir, "post-commit.sh"));
		const r = Bun.spawnSync([sh as string, "post-commit.sh"], {
			cwd: dir,
			env,
			stdout: "pipe",
			stderr: "pipe",
		});
		expect(r.exitCode).toBe(0);
		return JSON.parse(await readFile(join(dir, "package.json"), "utf8")).version;
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
}

test.skipIf(!sh || !git)("post-commit bumps a release version on feat", async () => {
	expect(await commitAndRunHook("0.17.0", "feat: something")).toBe("0.18.0");
});

test.skipIf(!sh || !git)("post-commit leaves a prerelease version untouched on feat", async () => {
	expect(await commitAndRunHook("0.17.0-rc.0", "feat: something")).toBe("0.17.0-rc.0");
});

test.skipIf(!sh || !git)("post-commit leaves a prerelease version untouched on fix", async () => {
	expect(await commitAndRunHook("0.17.0-rc.1", "fix: something")).toBe("0.17.0-rc.1");
});
