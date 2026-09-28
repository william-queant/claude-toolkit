import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const fromRoot = (path: string) => fileURLToPath(new URL(`../${path}`, import.meta.url));
const pkg = JSON.parse(await readFile(fromRoot("package.json"), "utf8"));

test("package.json declares no install-time lifecycle scripts", () => {
	for (const name of ["preinstall", "install", "postinstall"]) {
		expect(pkg.scripts?.[name]).toBeUndefined();
	}
});

test("the install-time entry point is gone", () => {
	expect(existsSync(fromRoot("bin/postinstall.mjs"))).toBe(false);
});

test("the CLI rejects the removed postinstall command", () => {
	const r = Bun.spawnSync([process.execPath, fromRoot("bin/cli.ts"), "postinstall"], {
		cwd: tmpdir(),
		stdout: "pipe",
		stderr: "pipe",
	});
	expect(r.exitCode).toBe(1);
	expect(r.stderr.toString()).toContain("Unknown command: postinstall");
});
