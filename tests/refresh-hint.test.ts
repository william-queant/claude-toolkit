import { describe, expect, test } from "bun:test";
import {
	buildRefreshHint,
	hasRefreshScript,
	isBefore,
	type RefreshHintInput,
} from "../src/refresh-hint.ts";

const base: RefreshHintInput = {
	scripts: {},
	packageManager: "bun",
	yarnBerry: false,
	previousVersion: null,
};

const UPGRADE_LINE =
	"Automatic regeneration on install was removed in 0.17.0 (it relied on a dependency install script).";
const HEADER_LINE =
	'Keep .claude/ in sync after toolkit upgrades — add to your package.json "scripts":';

describe("isBefore", () => {
	test.each([
		["0.16.0", true],
		["0.9.9", true],
		["0.17.0", false],
		["0.17.0-rc.0", false],
		["0.17.1", false],
		["1.0.0", false],
		["not-a-version", true],
	])("%p before 0.17.0 is %p", (version, expected) => {
		expect(isBefore(version, "0.17.0")).toBe(expected);
	});
});

describe("hasRefreshScript", () => {
	test("finds refresh in any script", () => {
		expect(hasRefreshScript({ prepare: "husky && bun run claude-toolkit:refresh" })).toBe(false);
		expect(hasRefreshScript({ "claude-toolkit:refresh": "claude-toolkit refresh || exit 0" })).toBe(
			true,
		);
		expect(hasRefreshScript({ prepare: "claude-toolkit refresh || exit 0" })).toBe(true);
	});

	test("ignores non-string script values", () => {
		expect(hasRefreshScript({ prepare: 42 })).toBe(false);
	});
});

describe("buildRefreshHint", () => {
	test("bun project without a prepare script gets the prepare line", () => {
		expect(buildRefreshHint(base)).toEqual([
			HEADER_LINE,
			'  "prepare": "claude-toolkit refresh || exit 0"',
		]);
	});

	test("nothing is printed when a script already runs refresh", () => {
		expect(
			buildRefreshHint({ ...base, scripts: { prepare: "claude-toolkit refresh || exit 0" } }),
		).toEqual([]);
	});

	test("an existing prepare gets the named-script variant", () => {
		expect(buildRefreshHint({ ...base, scripts: { prepare: "husky" } })).toEqual([
			HEADER_LINE,
			'  "claude-toolkit:refresh": "claude-toolkit refresh || exit 0"',
			'and append "&& bun run claude-toolkit:refresh" to your existing "prepare" script.',
		]);
	});

	test("npm projects get the plain-install caveat", () => {
		const lines = buildRefreshHint({ ...base, packageManager: "npm" });
		expect(lines.at(-1)).toBe(
			'npm runs "prepare" only on a plain "npm install"; after "npm install <pkg>" or "npm update", run "bunx claude-toolkit refresh".',
		);
	});

	test("pnpm projects get the add caveat and pnpm run in the named variant", () => {
		const lines = buildRefreshHint({
			...base,
			packageManager: "pnpm",
			scripts: { prepare: "husky" },
		});
		expect(lines).toContain(
			'and append "&& pnpm run claude-toolkit:refresh" to your existing "prepare" script.',
		);
		expect(lines.at(-1)).toContain('pnpm skips "prepare" on "pnpm add"');
	});

	test("Yarn Berry projects are pointed at postinstall", () => {
		expect(buildRefreshHint({ ...base, packageManager: "yarn", yarnBerry: true })).toEqual([
			HEADER_LINE,
			'  "postinstall": "claude-toolkit refresh || exit 0"',
			'Yarn 2+ never runs "prepare" for your own project; "postinstall" runs whenever your dependencies change.',
		]);
	});

	test("Yarn Berry with refresh only in prepare still gets the postinstall hint", () => {
		const lines = buildRefreshHint({
			...base,
			packageManager: "yarn",
			yarnBerry: true,
			scripts: { prepare: "claude-toolkit refresh || exit 0" },
		});
		expect(lines).toContain('  "postinstall": "claude-toolkit refresh || exit 0"');
		expect(
			buildRefreshHint({
				...base,
				packageManager: "yarn",
				yarnBerry: true,
				scripts: { postinstall: "claude-toolkit refresh || exit 0" },
			}),
		).toEqual([]);
	});

	test("an upgrade from a pre-0.17 marker leads with the removal line", () => {
		expect(buildRefreshHint({ ...base, previousVersion: "0.16.0" })[0]).toBe(UPGRADE_LINE);
		expect(buildRefreshHint({ ...base, previousVersion: "0.17.0" })).not.toContain(UPGRADE_LINE);
		expect(buildRefreshHint({ ...base, previousVersion: null })).not.toContain(UPGRADE_LINE);
	});

	test("no variant contains a URL or a .md/.sh filename", () => {
		for (const packageManager of ["bun", "npm", "pnpm", "yarn"] as const) {
			for (const yarnBerry of [false, true]) {
				for (const scripts of [{}, { prepare: "husky", postinstall: "x" }]) {
					const text = buildRefreshHint({
						scripts,
						packageManager,
						yarnBerry,
						previousVersion: "0.16.0",
					}).join("\n");
					expect(text).not.toMatch(/:\/\/|\.(md|sh)\b/);
				}
			}
		}
	});
});
