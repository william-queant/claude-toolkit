/**
 * The "keep .claude/ in sync" hint printed after a bare CLI run. The toolkit never
 * edits the consumer's package.json (a committed file); it only says what to add.
 * Wording rule: no URLs and no filename literals with a TLD-like extension, since
 * Socket's URL-strings detector reads both as links.
 */

/** Script body a consumer adds. `|| exit 0` keeps an install working when bun is missing. */
export const REFRESH_COMMAND = "claude-toolkit refresh || exit 0";
/** Script name suggested when the lifecycle script already exists. */
export const REFRESH_SCRIPT_NAME = "claude-toolkit:refresh";
/** First release that no longer regenerates .claude/ from a dependency install script. */
export const INSTALL_SCRIPT_REMOVED_IN = "0.17.0";

export type PackageManager = "bun" | "npm" | "pnpm" | "yarn";

export interface RefreshHintInput {
	/** `scripts` from the project's package.json ({} when it has none). */
	scripts: Record<string, unknown>;
	/** `packageManager` from the toolkit config. */
	packageManager: PackageManager;
	/** True when the project uses Yarn 2+ (a `.yarnrc.yml` exists). */
	yarnBerry: boolean;
	/** `.claude/.toolkit-version` as it was before this run, or null. */
	previousVersion: string | null;
}

/**
 * When each package manager runs the project's own root lifecycle scripts, verified
 * 2026-09-28 with a root project whose `prepare` and `postinstall` append to a file:
 *   bun 1.3.11                       prepare on install, add and update
 *   npm 10.9.3, 11.20.0, 12.1.0      prepare on a plain install only (not install <pkg>, not update)
 *   pnpm 10.34.5, 11.28.0, 12.6.0    prepare on install and update, not on add
 *   Yarn 4.18.1                      never prepare; postinstall whenever the dependency tree changes
 */
const CAVEATS: Record<PackageManager | "yarn-berry", string | null> = {
	bun: null,
	npm: 'npm runs "prepare" only on a plain "npm install"; after "npm install <pkg>" or "npm update", run "bunx claude-toolkit refresh".',
	pnpm: 'pnpm skips "prepare" on "pnpm add"; after upgrading claude-toolkit that way, run "bunx claude-toolkit refresh".',
	yarn: null,
	"yarn-berry":
		'Yarn 2+ never runs "prepare" for your own project; "postinstall" runs whenever your dependencies change.',
};

/** Compare x.y.z numerically. A prerelease counts as its release: 0.17.0-rc.0 is not before 0.17.0. */
export function isBefore(version: string, floor: string): boolean {
	const parts = (v: string) =>
		(v.split("-")[0] ?? "").split(".").map((n) => Number.parseInt(n, 10) || 0);
	const a = parts(version);
	const b = parts(floor);
	for (let i = 0; i < 3; i++) {
		const x = a[i] ?? 0;
		const y = b[i] ?? 0;
		if (x !== y) return x < y;
	}
	return false;
}

/** True when some package.json script already runs `claude-toolkit refresh`. */
export function hasRefreshScript(scripts: Record<string, unknown>): boolean {
	return Object.values(scripts).some(
		(s) => typeof s === "string" && s.includes("claude-toolkit refresh"),
	);
}

/** Lines of the hint, or [] when a script already runs `claude-toolkit refresh`. */
export function buildRefreshHint(input: RefreshHintInput): string[] {
	const { scripts, packageManager, yarnBerry, previousVersion } = input;
	const lifecycle = yarnBerry ? "postinstall" : "prepare";
	// Yarn 2+ never runs "prepare", so only a refresh reachable from "postinstall" counts there.
	const satisfied = yarnBerry
		? /claude-toolkit[ :]refresh/.test(String(scripts.postinstall ?? ""))
		: hasRefreshScript(scripts);
	if (satisfied) return [];

	const runner = yarnBerry ? "yarn" : packageManager;
	const lines: string[] = [];
	if (previousVersion !== null && isBefore(previousVersion, INSTALL_SCRIPT_REMOVED_IN)) {
		lines.push(
			`Automatic regeneration on install was removed in ${INSTALL_SCRIPT_REMOVED_IN} (it relied on a dependency install script).`,
		);
	}
	lines.push('Keep .claude/ in sync after toolkit upgrades — add to your package.json "scripts":');
	if (scripts[lifecycle] === undefined) {
		lines.push(`  "${lifecycle}": "${REFRESH_COMMAND}"`);
	} else {
		lines.push(`  "${REFRESH_SCRIPT_NAME}": "${REFRESH_COMMAND}"`);
		lines.push(
			`and append "&& ${runner} run ${REFRESH_SCRIPT_NAME}" to your existing "${lifecycle}" script.`,
		);
	}
	const caveat = CAVEATS[yarnBerry ? "yarn-berry" : packageManager];
	if (caveat !== null) lines.push(caveat);
	return lines;
}
