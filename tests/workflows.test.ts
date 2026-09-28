import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

interface Step {
	uses?: string;
	run?: string;
	with?: Record<string, string>;
	env?: Record<string, string>;
}
interface Workflow {
	on: Record<string, unknown>;
	jobs: Record<string, { permissions?: Record<string, string>; steps: Step[] }>;
}

async function workflow(name: string): Promise<{ text: string; wf: Workflow }> {
	const path = fileURLToPath(new URL(`../.github/workflows/${name}`, import.meta.url));
	const text = await readFile(path, "utf8");
	return { text, wf: Bun.YAML.parse(text) as Workflow };
}

const runs = (steps: Step[]) => steps.map((s) => s.run ?? "");
const indexOfRun = (steps: Step[], fragment: string) =>
	runs(steps).findIndex((r) => r.includes(fragment));

test("publish.yml uses trusted publishing, not a token secret", async () => {
	const { text, wf } = await workflow("publish.yml");
	expect(text).not.toContain("NODE_AUTH_TOKEN");
	expect(text).not.toContain("NPM_TOKEN");
	const job = wf.jobs.publish;
	expect(job?.permissions?.["id-token"]).toBe("write");
	expect(runs(job?.steps ?? [])).toContain("npm install -g npm@^11.5.1");
});

test("publish.yml can be re-run by hand and pins bun", async () => {
	const { wf } = await workflow("publish.yml");
	expect(Object.keys(wf.on)).toEqual(["release", "workflow_dispatch"]);
	const setupBun = wf.jobs.publish?.steps.find((s) => s.uses?.startsWith("oven-sh/setup-bun"));
	expect(setupBun?.with?.["bun-version"]).toBe("1.3.11");
});

test("publish.yml checks, strips prepare, guards and smoke-tests before publishing", async () => {
	const steps = (await workflow("publish.yml")).wf.jobs.publish?.steps ?? [];
	const order = [
		"bun run typecheck && bun run lint:check && bun test",
		"npm pkg delete scripts.prepare",
		"bun run check:pack --publish",
		"bun run check:smoke",
		"npm publish",
	].map((fragment) => indexOfRun(steps, fragment));
	expect(order.every((i) => i >= 0)).toBe(true);
	expect([...order].sort((a, b) => a - b)).toEqual(order);
});

test("publish.yml routes prerelease versions to the next dist-tag", async () => {
	const { text } = await workflow("publish.yml");
	expect(text).toContain('*-*) echo "dist_tag=next"');
	expect(text).toMatch(
		/npm publish --access public --tag "\$\{\{ steps\.meta\.outputs\.dist_tag \}\}"/,
	);
});

test("ci.yml runs typecheck, lint, test, check:pack and check:smoke on push and PR", async () => {
	const { wf } = await workflow("ci.yml");
	expect(Object.keys(wf.on)).toEqual(["push", "pull_request"]);
	const all = runs(wf.jobs.check?.steps ?? []);
	for (const cmd of [
		"bun run typecheck",
		"bun run lint:check",
		"bun test",
		"bun run check:pack",
		"bun run check:smoke",
	]) {
		expect(all).toContain(cmd);
	}
});
