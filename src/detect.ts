import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { StackName } from "./types.js";

/** Result of detecting a stack in a project */
export interface DetectedStack {
	name: StackName;
	reason: string;
}

interface PackageJson {
	dependencies?: Record<string, string>;
	devDependencies?: Record<string, string>;
	workspaces?: string[] | { packages?: string[] };
	type?: string;
	engines?: { node?: string };
}

/** A directory to inspect for stack markers, with its project-relative label */
interface ScanRoot {
	/** Absolute path */
	dir: string;
	/** Project-relative path ("." for the project root) */
	rel: string;
}

/** Pre-resolved view of the project: every package and directory worth scanning */
interface DetectContext {
	projectDir: string;
	/** Package.json files found at the root and across workspaces/subdirs */
	packages: { rel: string; pkg: PackageJson }[];
	/** Directories to check for marker files (root + subdirs + workspace packages) */
	scanRoots: ScanRoot[];
}

interface StackDetector {
	name: StackName;
	detect: (ctx: DetectContext) => DetectedStack | null;
}

/** Directories never worth scanning into */
const IGNORE_DIRS = new Set([
	"node_modules",
	"dist",
	"build",
	"out",
	"target",
	"coverage",
	".git",
	".wrangler",
	".next",
	".cache",
	".vercel",
	".turbo",
	"playwright-report",
	"test-results",
]);

/** Node major version at/above which modern ESNext runtime features are assumed available. */
const MIN_MODERN_NODE_MAJOR = 20;

function readPackageJson(dir: string): PackageJson | null {
	const pkgPath = join(dir, "package.json");
	if (!existsSync(pkgPath)) return null;
	try {
		return JSON.parse(readFileSync(pkgPath, "utf-8")) as PackageJson;
	} catch {
		return null;
	}
}

/** Immediate, non-ignored subdirectory names of a directory */
function listSubdirs(dir: string): string[] {
	try {
		return readdirSync(dir, { withFileTypes: true })
			.filter((e) => e.isDirectory() && !IGNORE_DIRS.has(e.name) && !e.name.startsWith("."))
			.map((e) => e.name);
	} catch {
		return [];
	}
}

/** Resolve workspace package directories (project-relative) from the root package.json */
function resolveWorkspaceDirs(projectDir: string, rootPkg: PackageJson | null): string[] {
	const ws = rootPkg?.workspaces;
	const patterns = Array.isArray(ws) ? ws : (ws?.packages ?? []);
	const dirs: string[] = [];
	for (const pattern of patterns) {
		if (pattern.includes("*")) {
			// Resolve a glob like "packages/*" or "apps/*" to concrete package dirs
			const glob = new Bun.Glob(`${pattern}/package.json`);
			for (const match of glob.scanSync({ cwd: projectDir, onlyFiles: true })) {
				dirs.push(match.replace(/[/\\]package\.json$/, "").replace(/\\/g, "/"));
			}
		} else {
			dirs.push(pattern.replace(/\\/g, "/"));
		}
	}
	return dirs;
}

/** Build the set of directories and package.json files worth inspecting */
function buildContext(projectDir: string): DetectContext {
	const rootPkg = readPackageJson(projectDir);

	// Root + immediate subdirs + workspace packages (deduped)
	const rels = new Set<string>(["."]);
	for (const name of listSubdirs(projectDir)) rels.add(name);
	for (const dir of resolveWorkspaceDirs(projectDir, rootPkg)) rels.add(dir);

	const scanRoots: ScanRoot[] = [...rels].map((rel) => ({
		rel,
		dir: rel === "." ? projectDir : join(projectDir, rel),
	}));

	const packages: { rel: string; pkg: PackageJson }[] = [];
	for (const { rel, dir } of scanRoots) {
		const pkg = rel === "." ? rootPkg : readPackageJson(dir);
		if (pkg) packages.push({ rel, pkg });
	}

	return { projectDir, packages, scanRoots };
}

function pkgHasDep(pkg: PackageJson, name: string): boolean {
	return name in (pkg.dependencies ?? {}) || name in (pkg.devDependencies ?? {});
}

function pkgLabel(rel: string): string {
	return rel === "." ? "root package.json" : `${rel}/package.json`;
}

function relPath(rel: string, name: string): string {
	return rel === "." ? name : `${rel}/${name}`;
}

/** First package (project-relative dir) declaring `name`, or null */
function findDep(ctx: DetectContext, name: string): string | null {
	for (const { rel, pkg } of ctx.packages) {
		if (pkgHasDep(pkg, name)) return rel;
	}
	return null;
}

/** First scan root containing a file/dir named `name` (top-level only), as a project-relative path */
function findFile(ctx: DetectContext, name: string): string | null {
	for (const { rel, dir } of ctx.scanRoots) {
		if (existsSync(join(dir, name))) return relPath(rel, name);
	}
	return null;
}

/** First scan root containing a `${prefix}.*` config file (top-level only) */
function findConfig(ctx: DetectContext, prefix: string): string | null {
	for (const { rel, dir } of ctx.scanRoots) {
		const glob = new Bun.Glob(`${prefix}.*`);
		for (const match of glob.scanSync({ cwd: dir, onlyFiles: true })) {
			return relPath(rel, match);
		}
	}
	return null;
}

/** Look for `*.proto` files directly in scan roots or under a conventional `proto/` dir */
function findProtoFiles(ctx: DetectContext): string | null {
	for (const { rel, dir } of ctx.scanRoots) {
		const direct = new Bun.Glob("*.proto");
		for (const match of direct.scanSync({ cwd: dir, onlyFiles: true })) {
			return relPath(rel, match);
		}
		const protoDir = join(dir, "proto");
		if (existsSync(protoDir)) {
			const nested = new Bun.Glob("**/*.proto");
			for (const match of nested.scanSync({ cwd: protoDir, onlyFiles: true })) {
				return relPath(rel, `proto/${match}`);
			}
		}
	}
	return null;
}

/** Read a file's text, or null if missing/unreadable (tolerates comments/trailing commas). */
function readTextFile(path: string): string | null {
	try {
		return readFileSync(path, "utf-8");
	} catch {
		return null;
	}
}

/**
 * First scan root whose tsconfig.json sets target/module/lib to ESNext or ES2022+.
 * Uses a lenient text scan because tsconfig files routinely carry comments and
 * trailing commas that would break JSON.parse.
 */
function tsconfigTargetsEsnext(ctx: DetectContext): string | null {
	const modern = /es(?:next|20(?:2[2-9]|[3-9]\d))/i; // ESNext or ES2022..ES2099
	const keyValue = /"(?:target|module|lib)"\s*:\s*(?:"([^"]*)"|\[([^\]]*)\])/gi;
	for (const { rel, dir } of ctx.scanRoots) {
		const text = readTextFile(join(dir, "tsconfig.json"));
		if (!text) continue;
		for (const m of text.matchAll(keyValue)) {
			if (modern.test(m[1] ?? m[2] ?? "")) return relPath(rel, "tsconfig.json");
		}
	}
	return null;
}

/** Whether a package.json's engines.node floor is >= `major` (first integer in the range). */
function enginesNodeAtLeast(pkg: PackageJson, major: number): boolean {
	const range = pkg.engines?.node;
	if (!range) return false;
	const m = range.match(/(\d+)/);
	return m ? Number(m[1]) >= major : false;
}

/** First `.mjs` file in a bounded search: each scan root's top level + bin/, src/, scripts/. */
function findMjs(ctx: DetectContext): string | null {
	const subs = ["", "bin", "src", "scripts"];
	for (const { rel, dir } of ctx.scanRoots) {
		for (const sub of subs) {
			const searchDir = sub ? join(dir, sub) : dir;
			if (!existsSync(searchDir)) continue;
			const glob = new Bun.Glob("*.mjs"); // non-recursive: never descends into node_modules
			for (const match of glob.scanSync({ cwd: searchDir, onlyFiles: true })) {
				return relPath(rel, sub ? `${sub}/${match}` : match);
			}
		}
	}
	return null;
}

const DETECTORS: StackDetector[] = [
	{
		name: "solidjs",
		detect: (ctx) => {
			const at = findDep(ctx, "solid-js");
			return at ? { name: "solidjs", reason: `found solid-js in ${pkgLabel(at)}` } : null;
		},
	},
	{
		name: "vite",
		detect: (ctx) => {
			const dep = findDep(ctx, "vite");
			if (dep) return { name: "vite", reason: `found vite in ${pkgLabel(dep)}` };
			const config = findConfig(ctx, "vite.config") ?? findConfig(ctx, "vitest.config");
			return config ? { name: "vite", reason: `found ${config}` } : null;
		},
	},
	{
		name: "vanilla-extract",
		detect: (ctx) => {
			const at = findDep(ctx, "@vanilla-extract/css");
			return at
				? { name: "vanilla-extract", reason: `found @vanilla-extract/css in ${pkgLabel(at)}` }
				: null;
		},
	},
	{
		name: "rust-wasm",
		detect: (ctx) => {
			const f = findFile(ctx, "Cargo.toml");
			return f ? { name: "rust-wasm", reason: `found ${f}` } : null;
		},
	},
	{
		name: "protobuf",
		detect: (ctx) => {
			const buf =
				findFile(ctx, "buf.yaml") ??
				findFile(ctx, "buf.gen.yaml") ??
				findFile(ctx, "buf.work.yaml");
			if (buf) return { name: "protobuf", reason: `found ${buf}` };
			const proto = findProtoFiles(ctx);
			return proto ? { name: "protobuf", reason: `found ${proto}` } : null;
		},
	},
	{
		name: "cloudflare",
		detect: (ctx) => {
			const f =
				findFile(ctx, "wrangler.toml") ??
				findFile(ctx, "wrangler.jsonc") ??
				findFile(ctx, "wrangler.json");
			return f ? { name: "cloudflare", reason: `found ${f}` } : null;
		},
	},
	{
		name: "i18n-typesafe",
		detect: (ctx) => {
			const at = findDep(ctx, "typesafe-i18n");
			if (at) return { name: "i18n-typesafe", reason: `found typesafe-i18n in ${pkgLabel(at)}` };
			const f = findFile(ctx, ".typesafe-i18n.json");
			return f ? { name: "i18n-typesafe", reason: `found ${f}` } : null;
		},
	},
	{
		name: "playwright",
		detect: (ctx) => {
			const dep = findDep(ctx, "@playwright/test");
			if (dep) return { name: "playwright", reason: `found @playwright/test in ${pkgLabel(dep)}` };
			const config = findConfig(ctx, "playwright.config");
			return config ? { name: "playwright", reason: `found ${config}` } : null;
		},
	},
	{
		name: "storybook",
		detect: (ctx) => {
			const dep = findDep(ctx, "storybook");
			if (dep) return { name: "storybook", reason: `found storybook in ${pkgLabel(dep)}` };
			const dir = findFile(ctx, ".storybook");
			return dir ? { name: "storybook", reason: `found ${dir}/ directory` } : null;
		},
	},
	{
		name: "capacitor",
		detect: (ctx) => {
			const capgo = findDep(ctx, "@capgo/capacitor-updater");
			if (capgo)
				return {
					name: "capacitor",
					reason: `found @capgo/capacitor-updater in ${pkgLabel(capgo)}`,
				};
			const core = findDep(ctx, "@capacitor/core");
			if (core) return { name: "capacitor", reason: `found @capacitor/core in ${pkgLabel(core)}` };
			const config = findConfig(ctx, "capacitor.config");
			return config ? { name: "capacitor", reason: `found ${config}` } : null;
		},
	},
	{
		name: "esnext",
		detect: (ctx) => {
			const ts = tsconfigTargetsEsnext(ctx);
			if (ts) return { name: "esnext", reason: `found ESNext target in ${ts}` };
			const mod = ctx.packages.find(({ pkg }) => pkg.type === "module");
			if (mod) return { name: "esnext", reason: `found "type":"module" in ${pkgLabel(mod.rel)}` };
			const eng = ctx.packages.find(({ pkg }) => enginesNodeAtLeast(pkg, MIN_MODERN_NODE_MAJOR));
			if (eng) return { name: "esnext", reason: `found engines.node >=20 in ${pkgLabel(eng.rel)}` };
			const mjs = findMjs(ctx);
			if (mjs) return { name: "esnext", reason: `found ${mjs}` };
			return null;
		},
	},
];

/** Scan a project directory (root + subdirs + workspace packages) and detect which stacks are present */
export function detectStacks(projectDir: string): DetectedStack[] {
	const ctx = buildContext(projectDir);
	const detected: DetectedStack[] = [];
	for (const detector of DETECTORS) {
		const result = detector.detect(ctx);
		if (result) detected.push(result);
	}
	return detected;
}
