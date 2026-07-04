import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generate } from "../src/generator.ts";

async function makeProject(): Promise<string> {
	return await mkdtemp(join(tmpdir(), "ct-gen-"));
}

test("protobuf stack installs the proto-check command under .claude/commands/ct", async () => {
	const dir = await makeProject();
	try {
		await generate(
			dir,
			{ stacks: ["protobuf"], packageManager: "bun" },
			{ quiet: true, scaffold: false },
		);
		const cmd = join(dir, ".claude", "commands", "ct", "proto-check.md");
		const body = await readFile(cmd, "utf8");
		expect(body).toContain("Protobuf Validation");
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
});

test("without the protobuf stack, proto-check is NOT installed", async () => {
	const dir = await makeProject();
	try {
		await generate(dir, { stacks: [], packageManager: "bun" }, { quiet: true, scaffold: false });
		const cmd = join(dir, ".claude", "commands", "ct", "proto-check.md");
		expect(await Bun.file(cmd).exists()).toBe(false);
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
});
