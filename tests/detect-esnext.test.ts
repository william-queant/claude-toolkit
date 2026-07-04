import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { detectStacks } from "../src/detect.ts";

/** Create a temp project populated with { relativePath: content } files. */
async function makeProject(files: Record<string, string>): Promise<string> {
	const dir = await mkdtemp(join(tmpdir(), "ct-detect-"));
	for (const [rel, content] of Object.entries(files)) {
		const full = join(dir, rel);
		await mkdir(dirname(full), { recursive: true });
		await writeFile(full, content);
	}
	return dir;
}

const detectsEsnext = (dir: string): boolean => detectStacks(dir).some((d) => d.name === "esnext");

async function withProject(
	files: Record<string, string>,
	assertion: (dir: string) => void,
): Promise<void> {
	const dir = await makeProject(files);
	try {
		assertion(dir);
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
}

test("detects esnext from tsconfig target ESNext", async () => {
	await withProject({ "tsconfig.json": `{ "compilerOptions": { "target": "ESNext" } }` }, (dir) =>
		expect(detectsEsnext(dir)).toBe(true),
	);
});

test("detects esnext from tsconfig with comments (lenient parse)", async () => {
	await withProject(
		{
			"tsconfig.json": `{
				// modern output
				"compilerOptions": { "module": "ESNext", "strict": true },
			}`,
		},
		(dir) => expect(detectsEsnext(dir)).toBe(true),
	);
});

test("detects esnext from tsconfig target ES2022 but not ES2019", async () => {
	await withProject({ "tsconfig.json": `{ "compilerOptions": { "target": "ES2022" } }` }, (dir) =>
		expect(detectsEsnext(dir)).toBe(true),
	);
	await withProject({ "tsconfig.json": `{ "compilerOptions": { "target": "ES2019" } }` }, (dir) =>
		expect(detectsEsnext(dir)).toBe(false),
	);
});

test('detects esnext from package.json "type":"module"', async () => {
	await withProject({ "package.json": `{ "name": "x", "type": "module" }` }, (dir) =>
		expect(detectsEsnext(dir)).toBe(true),
	);
});

test("detects esnext from engines.node >=20 but not >=18", async () => {
	await withProject({ "package.json": `{ "name": "x", "engines": { "node": ">=20" } }` }, (dir) =>
		expect(detectsEsnext(dir)).toBe(true),
	);
	await withProject({ "package.json": `{ "name": "x", "engines": { "node": ">=18" } }` }, (dir) =>
		expect(detectsEsnext(dir)).toBe(false),
	);
});

test("detects esnext from a .mjs file in bin/", async () => {
	await withProject(
		{ "package.json": `{ "name": "x" }`, "bin/tool.mjs": `export const x = 1;` },
		(dir) => expect(detectsEsnext(dir)).toBe(true),
	);
});

test("does NOT detect esnext from a .mjs file only inside node_modules", async () => {
	await withProject(
		{ "package.json": `{ "name": "x" }`, "node_modules/dep/index.mjs": `export const x = 1;` },
		(dir) => expect(detectsEsnext(dir)).toBe(false),
	);
});

test("does NOT detect esnext when no signal is present", async () => {
	await withProject(
		{ "package.json": `{ "name": "x", "dependencies": { "left-pad": "1.0.0" } }` },
		(dir) => expect(detectsEsnext(dir)).toBe(false),
	);
});
