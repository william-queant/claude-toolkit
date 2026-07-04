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
