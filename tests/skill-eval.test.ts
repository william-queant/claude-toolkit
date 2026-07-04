import { describe, expect, test } from "bun:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const engine = require("../core/hooks/skill-eval.cjs");
const { matchesGlob } = engine;

describe("matchesGlob (F01, F24)", () => {
	test("**/ prefix matches at every depth including root", () => {
		expect(matchesGlob("tsconfig.json", "**/tsconfig.json")).toBe(true);
		expect(matchesGlob("src/tsconfig.json", "**/tsconfig.json")).toBe(true);
		expect(matchesGlob("a/b/tsconfig.json", "**/tsconfig.json")).toBe(true);
	});

	test("**/ prefix does NOT false-positive on a glued filename", () => {
		expect(matchesGlob("src/xtsconfig.json", "**/tsconfig.json")).toBe(false);
	});

	test("**/*.ext matches root and nested files", () => {
		expect(matchesGlob("foo.ts", "**/*.ts")).toBe(true);
		expect(matchesGlob("src/foo.ts", "**/*.ts")).toBe(true);
	});

	test("mid-pattern **/ matches a zero-depth interior", () => {
		expect(matchesGlob("src/foo.ts", "src/**/*.ts")).toBe(true);
	});

	test("* does not cross directory separators", () => {
		expect(matchesGlob("src/foo.ts", "src/*.ts")).toBe(true);
		expect(matchesGlob("src/a/foo.ts", "src/*.ts")).toBe(false);
	});

	test("regex metacharacters in a glob are treated literally (F24)", () => {
		// Braces are unsupported and matched literally, never as a regex group.
		expect(matchesGlob("a+b/x.ts", "a+b/*.ts")).toBe(true);
		expect(matchesGlob("aaab/x.ts", "a+b/*.ts")).toBe(false);
		expect(matchesGlob("src/{a,b}/x.ts", "src/{a,b}/*.ts")).toBe(true);
	});
});

const { extractFilePaths } = engine;

describe("extractFilePaths (F08, F22, F23, F37, F09)", () => {
	test("detects Windows backslash paths (F08)", () => {
		expect(extractFilePaths("edit src\\components\\Button.tsx please")).toEqual([
			"src/components/Button.tsx",
		]);
	});

	test("detects paths in parentheses and after commas (F22)", () => {
		expect(extractFilePaths("see (src/utils/helper.ts)")).toEqual(["src/utils/helper.ts"]);
		expect(extractFilePaths("update tsconfig.json,package.json now")).toEqual([
			"tsconfig.json",
			"package.json",
		]);
	});

	test('does NOT extract numeric ratios like "3/4" (F23)', () => {
		expect(extractFilePaths('the ratio was "3/4" exactly')).toEqual([]);
	});

	test("still detects .css.ts via the .ts branch (F37 dead-code removal)", () => {
		expect(extractFilePaths("check src/app/theme.css.ts")).toEqual(["src/app/theme.css.ts"]);
	});

	test("caps input length so a path past the cap is ignored (F09)", () => {
		const filler = "x".repeat(60_000);
		expect(extractFilePaths(`${filler} src/real.ts`)).toEqual([]);
		expect(extractFilePaths("src/real.ts")).toEqual(["src/real.ts"]);
	});
});

const { evaluate } = engine;

// A minimal ruleset with a single skill that keyword-matches "flurble".
function makeRules(overrides = {}) {
	return {
		config: {
			minConfidenceScore: 3,
			showMatchReasons: true,
			maxSkillsToShow: 5,
			...overrides,
		},
		scoring: {
			keyword: 5,
			keywordPattern: 3,
			pathPattern: 4,
			directoryMatch: 5,
			intentPattern: 4,
			contentPattern: 3,
			contextPattern: 2,
		},
		directoryMappings: {},
		skills: {
			"ct-testing-patterns": {
				description: "x",
				priority: 5,
				triggers: { keywords: ["flurble"] },
			},
		},
	};
}

// ct-testing-patterns actually ships under core/skills, so the ship-check passes.
const SKILLS_DIR = new URL("../core/skills", import.meta.url).pathname;

describe("evaluate hardening (F21, F34)", () => {
	test("coerces a non-string prompt instead of crashing (F21)", () => {
		// Must not throw; a number has no keywords, so output is empty.
		expect(evaluate(12345, { rules: makeRules(), skillsDir: SKILLS_DIR })).toBe("");
	});

	test("applies config defaults when config is absent (F34)", () => {
		const rules = makeRules();
		rules.config = undefined; // no minConfidenceScore / maxSkillsToShow at all
		const out = evaluate("please flurble this", {
			rules,
			skillsDir: SKILLS_DIR,
		});
		expect(out).toContain("ct-testing-patterns");
	});

	test("returns empty string when rules cannot be loaded", () => {
		expect(evaluate("flurble", { rules: null, skillsDir: SKILLS_DIR })).toBe("");
	});
});
