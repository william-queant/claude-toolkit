import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generate } from "../src/generator.ts";

async function makeProject(): Promise<string> {
	return await mkdtemp(join(tmpdir(), "ct-gen2-"));
}

test("enabling the esnext stack installs ct-esnext-idioms", async () => {
	const dir = await makeProject();
	try {
		await generate(
			dir,
			{ stacks: ["esnext"], packageManager: "bun" },
			{ quiet: true, scaffold: false },
		);
		const skill = await readFile(
			join(dir, ".claude", "skills", "ct-esnext-idioms", "SKILL.md"),
			"utf8",
		);
		expect(skill).toContain("Temporal");
		const rules = JSON.parse(
			await readFile(join(dir, ".claude", "hooks", "skill-rules.json"), "utf8"),
		);
		expect(rules.skills["ct-esnext-idioms"]).toBeDefined();
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
});

test("ct-code-style ships as a core skill (no stacks needed)", async () => {
	const dir = await makeProject();
	try {
		await generate(dir, { stacks: [], packageManager: "bun" }, { quiet: true, scaffold: false });
		const skill = await readFile(
			join(dir, ".claude", "skills", "ct-code-style", "SKILL.md"),
			"utf8",
		);
		expect(skill).toContain("guard clause");
		const rules = JSON.parse(
			await readFile(join(dir, ".claude", "hooks", "skill-rules.json"), "utf8"),
		);
		expect(rules.skills["ct-code-style"]).toBeDefined();
		const readme = await readFile(join(dir, ".claude", "skills", "README.md"), "utf8");
		expect(readme).toContain("ct-code-style");
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
});
