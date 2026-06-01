import { existsSync, readFileSync } from "node:fs";
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
}

interface StackDetector {
	name: StackName;
	detect: (projectDir: string, pkg: PackageJson | null) => DetectedStack | null;
}

function loadPackageJson(projectDir: string): PackageJson | null {
	const pkgPath = join(projectDir, "package.json");
	if (!existsSync(pkgPath)) return null;
	try {
		return JSON.parse(readFileSync(pkgPath, "utf-8")) as PackageJson;
	} catch {
		return null;
	}
}

function hasDep(pkg: PackageJson | null, name: string): boolean {
	if (!pkg) return false;
	return name in (pkg.dependencies ?? {}) || name in (pkg.devDependencies ?? {});
}

function fileExists(projectDir: string, ...segments: string[]): boolean {
	return existsSync(join(projectDir, ...segments));
}

function rootConfigExists(projectDir: string, prefix: string): string | null {
	const glob = new Bun.Glob(`${prefix}.*`);
	for (const match of glob.scanSync({ cwd: projectDir, onlyFiles: true })) {
		return match;
	}
	return null;
}

const DETECTORS: StackDetector[] = [
	{
		name: "solidjs",
		detect: (_dir, pkg) =>
			hasDep(pkg, "solid-js")
				? { name: "solidjs", reason: "found solid-js in dependencies" }
				: null,
	},
	{
		name: "vite",
		detect: (dir, pkg) => {
			if (hasDep(pkg, "vite")) return { name: "vite", reason: "found vite in dependencies" };
			const viteConfig = rootConfigExists(dir, "vite.config");
			if (viteConfig) return { name: "vite", reason: `found ${viteConfig}` };
			const vitestConfig = rootConfigExists(dir, "vitest.config");
			if (vitestConfig) return { name: "vite", reason: `found ${vitestConfig}` };
			return null;
		},
	},
	{
		name: "vanilla-extract",
		detect: (_dir, pkg) =>
			hasDep(pkg, "@vanilla-extract/css")
				? { name: "vanilla-extract", reason: "found @vanilla-extract/css in dependencies" }
				: null,
	},
	{
		name: "rust-wasm",
		detect: (dir) =>
			fileExists(dir, "Cargo.toml") ? { name: "rust-wasm", reason: "found Cargo.toml" } : null,
	},
	{
		name: "protobuf",
		detect: (dir) => {
			if (fileExists(dir, "buf.yaml")) return { name: "protobuf", reason: "found buf.yaml" };
			if (fileExists(dir, "buf.gen.yaml"))
				return { name: "protobuf", reason: "found buf.gen.yaml" };
			const glob = new Bun.Glob("**/*.proto");
			for (const _match of glob.scanSync({ cwd: dir, onlyFiles: true })) {
				return { name: "protobuf", reason: "found .proto files" };
			}
			return null;
		},
	},
	{
		name: "cloudflare",
		detect: (dir) => {
			if (fileExists(dir, "wrangler.toml"))
				return { name: "cloudflare", reason: "found wrangler.toml" };
			if (fileExists(dir, "wrangler.jsonc"))
				return { name: "cloudflare", reason: "found wrangler.jsonc" };
			return null;
		},
	},
	{
		name: "i18n-typesafe",
		detect: (_dir, pkg) =>
			hasDep(pkg, "typesafe-i18n")
				? { name: "i18n-typesafe", reason: "found typesafe-i18n in dependencies" }
				: null,
	},
	{
		name: "playwright",
		detect: (dir, pkg) => {
			if (hasDep(pkg, "@playwright/test"))
				return { name: "playwright", reason: "found @playwright/test in dependencies" };
			const config = rootConfigExists(dir, "playwright.config");
			if (config) return { name: "playwright", reason: `found ${config}` };
			return null;
		},
	},
	{
		name: "storybook",
		detect: (dir, pkg) => {
			if (hasDep(pkg, "storybook"))
				return { name: "storybook", reason: "found storybook in dependencies" };
			if (fileExists(dir, ".storybook"))
				return { name: "storybook", reason: "found .storybook/ directory" };
			return null;
		},
	},
	{
		name: "capacitor",
		detect: (dir, pkg) => {
			if (hasDep(pkg, "@capgo/capacitor-updater"))
				return { name: "capacitor", reason: "found @capgo/capacitor-updater in dependencies" };
			if (hasDep(pkg, "@capacitor/core"))
				return { name: "capacitor", reason: "found @capacitor/core in dependencies" };
			const config = rootConfigExists(dir, "capacitor.config");
			if (config) return { name: "capacitor", reason: `found ${config}` };
			return null;
		},
	},
];

/** Scan a project directory and detect which stacks are present */
export function detectStacks(projectDir: string): DetectedStack[] {
	const pkg = loadPackageJson(projectDir);
	const detected: DetectedStack[] = [];
	for (const detector of DETECTORS) {
		const result = detector.detect(projectDir, pkg);
		if (result) detected.push(result);
	}
	return detected;
}
