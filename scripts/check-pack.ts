#!/usr/bin/env bun
/**
 * Tarball guard. Asks `npm pack --dry-run --json` for the exact file list npm would
 * publish, then fails when the package could run code at install time, reach a shell
 * or the environment, or ship docs/.
 *
 *   bun run check:pack             local and CI checks
 *   bun run check:pack --publish   release checks, after `npm pkg delete scripts.prepare`
 *
 * Dev-only: scripts/ is not in package.json "files", so this file never ships.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export interface PackInput {
	/** The package.json npm packs. */
	manifest: { scripts?: Record<string, string> };
	/** Packed paths, relative to the package root, "/"-separated. */
	paths: string[];
	/** Reads a packed file's text. */
	read: (path: string) => string;
	/** Publish mode: `prepare` must be gone too. */
	publish: boolean;
}

const INSTALL_SCRIPTS = ["preinstall", "install", "postinstall"];
const CODE_FILE = /\.(?:[cm]?js|ts)$/;
const FORBIDDEN_IN_CODE: ReadonlyArray<readonly [string, RegExp]> = [
	["child_process", /child_process/],
	["process.env", /process\.env/],
	["Bun.spawn", /Bun\.spawn/],
	["Bun.$", /Bun\.\$/],
	["execSync", /execSync/],
	["execFile", /execFile/],
	["eval(", /\beval\(/],
];

/** Every reason the packed tarball must not be published; empty when it is clean. */
export function findPackProblems(input: PackInput): string[] {
	const { manifest, paths, read, publish } = input;
	const scripts = manifest.scripts ?? {};
	const problems: string[] = [];
	for (const name of INSTALL_SCRIPTS) {
		if (scripts[name] !== undefined) problems.push(`package.json has an install script: ${name}`);
	}
	if (publish && scripts.prepare !== undefined) {
		problems.push("package.json still has a prepare script (run: npm pkg delete scripts.prepare)");
	}
	for (const path of paths) {
		if (path.startsWith("docs/")) problems.push(`docs/ file is packed: ${path}`);
		if (!CODE_FILE.test(path)) continue;
		const text = read(path);
		for (const [label, pattern] of FORBIDDEN_IN_CODE) {
			if (pattern.test(text)) problems.push(`${path} contains ${label}`);
		}
	}
	return problems;
}

/** The files `npm pack` would publish from `root`, "/"-separated. */
function packedPaths(root: string): string[] {
	const r = Bun.spawnSync(["npm", "pack", "--dry-run", "--json", "--ignore-scripts"], {
		cwd: root,
		stdout: "pipe",
		stderr: "pipe",
	});
	if (r.exitCode !== 0) throw new Error(`npm pack --dry-run failed:\n${r.stderr.toString()}`);
	// npm 10 runs "prepare" despite --ignore-scripts; skip anything it printed before the JSON.
	const out = r.stdout.toString();
	const [pack] = JSON.parse(out.slice(out.indexOf("["))) as Array<{
		files: Array<{ path: string }>;
	}>;
	if (!pack) throw new Error("npm pack --dry-run returned no package");
	return pack.files.map((f) => f.path.replaceAll("\\", "/"));
}

if (import.meta.main) {
	const root = join(import.meta.dirname, "..");
	const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf-8"));
	const paths = packedPaths(root);
	const problems = findPackProblems({
		manifest,
		paths,
		read: (path) => readFileSync(join(root, path), "utf-8"),
		publish: process.argv.includes("--publish"),
	});
	if (problems.length > 0) {
		for (const p of problems) console.error(`check:pack: ${p}`);
		process.exit(1);
	}
	console.log(`check:pack OK: ${manifest.name}@${manifest.version}, ${paths.length} files`);
}
