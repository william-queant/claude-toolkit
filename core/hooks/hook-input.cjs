/**
 * Input helper for the generated PostToolUse hooks. Filesystem only: it reads the
 * hook's JSON from stdin and, for has-tool, the package.json and node_modules/.bin files
 * around the current directory (the hook first cds to the edited file's checkout). It
 * never starts a process and never reads environment variables.
 *
 *   node hook-input.cjs path             Print tool_input.file_path; nothing on bad input.
 *   node hook-input.cjs has-tool <name> [<dir> [<scope>]]
 *                                        Exit 0 when <name> is something a command run in
 *                                        <dir> (default ".") can find, 1 otherwise. <scope>
 *                                        is any (default), script, bin or local; see hasTool.
 *   node hook-input.cjs context <title>  Read command output from stdin and print it as
 *                                        PostToolUse additionalContext JSON.
 */

const fs = require("node:fs");
const path = require("node:path");

// npm, pnpm and yarn create bare, .cmd and .ps1 shims; bun on Windows creates .exe and .bunx.
const BIN_SUFFIXES = ["", ".cmd", ".ps1", ".exe", ".bunx"];
// Where has-tool looks; an unknown scope counts as "any", so a newer hook works with this helper.
const SCOPES = new Set(["any", "script", "bin", "local"]);
// Code points below SPACE, and DEL, are control characters (newlines included).
const SPACE = 0x20;
const DEL = 0x7f;
// Keep the context Claude reads short: the tail of the output is what explains a failure.
const MAX_CONTEXT_LINES = 30;
const MAX_CONTEXT_CHARS = 4000;

/** True when `text` contains a control character: never part of a real edit target. */
function hasControlChar(text) {
	return [...text].some((ch) => {
		const code = ch.codePointAt(0) ?? 0;
		return code < SPACE || code === DEL;
	});
}

/** stdin as text; "" when it cannot be read. */
function readStdin() {
	try {
		return fs.readFileSync(0, "utf8");
	} catch {
		return "";
	}
}

/**
 * tool_input.file_path from a hook's JSON input, or "" when the input is not JSON or
 * has no usable path. Windows separators become "/" so shell patterns stay simple.
 */
function filePathFrom(raw, platform = process.platform) {
	let data;
	try {
		data = JSON.parse(raw);
	} catch {
		return "";
	}
	const filePath = data?.tool_input?.file_path;
	if (typeof filePath !== "string" || filePath === "" || hasControlChar(filePath)) return "";
	return platform === "win32" ? filePath.replace(/\\/g, "/") : filePath;
}

/** The project's package.json scripts; {} when there are none. */
function readScripts(root) {
	try {
		const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
		return pkg && typeof pkg.scripts === "object" && pkg.scripts !== null ? pkg.scripts : {};
	} catch {
		return {};
	}
}

/** Nearest ancestor-or-self of `cwd` holding .git (a directory, or the file a worktree has); null if none. */
function checkoutTop(cwd) {
	for (let dir = cwd; ; dir = path.dirname(dir)) {
		if (fs.existsSync(path.join(dir, ".git"))) return dir;
		if (path.dirname(dir) === dir) return null;
	}
}

/**
 * `start` and its parents up to the checkout top, which is where bun, npm and pnpm look
 * for a .bin entry. A `start` outside the checkout is looked at alone: never above the top,
 * where an unrelated node_modules may sit.
 */
function lookupDirs(start, cwd) {
	const top = checkoutTop(cwd) ?? cwd;
	const rel = path.relative(top, start);
	if (rel === ".." || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) return [start];
	const dirs = [];
	for (let dir = start; ; dir = path.dirname(dir)) {
		dirs.push(dir);
		if (dir === top || path.dirname(dir) === dir) return dirs;
	}
}

/**
 * The .bin entry a name refers to: "prettier@3" is "prettier", "@biomejs/biome" is "biome",
 * and a path ("apps/web") is no package name at all.
 */
function binName(name) {
	const bare = name.replace(/(.)@[^/]*$/, "$1");
	const scoped = /^@[^/]+\/([^/]+)$/.exec(bare);
	if (scoped) return scoped[1];
	return bare.includes("/") || bare === "." || bare === ".." ? "" : bare;
}

/**
 * True when `name` is something a command run in `dir` (relative to `cwd`, the current
 * directory unless given) can find. `scope` says where it looks:
 *   any     a package.json script of `dir`, else a .bin entry in `dir` or a parent
 *   script  a package.json script of `dir`
 *   bin     a .bin entry in `dir` or a parent, up to the checkout top
 *   local   a .bin entry in `dir` only
 */
function hasTool(name, dir = ".", scope = "any", cwd = process.cwd()) {
	if (typeof name !== "string" || name === "") return false;
	const start = path.resolve(cwd, dir);
	if ((scope === "any" || scope === "script") && typeof readScripts(start)[name] === "string") {
		return true;
	}
	if (scope === "script") return false;
	const bin = binName(name);
	if (bin === "") return false;
	const dirs = scope === "local" ? [start] : lookupDirs(start, cwd);
	return dirs.some((d) =>
		BIN_SUFFIXES.some((suffix) =>
			fs.existsSync(path.join(d, "node_modules", ".bin", bin + suffix)),
		),
	);
}

/** PostToolUse JSON that hands `title` and the tail of `output` to Claude as context. */
function contextJson(title, output) {
	const lines = String(output).trimEnd().split(/\r?\n/).slice(-MAX_CONTEXT_LINES);
	const tail = lines.join("\n").slice(-MAX_CONTEXT_CHARS);
	const text = tail === "" ? String(title) : `${title}\nLast lines of output:\n${tail}`;
	return JSON.stringify({
		hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: text },
	});
}

/** Run one subcommand; returns the exit code. */
function main(argv) {
	const [command, arg, dir, scope] = argv;
	if (command === "path") {
		const filePath = filePathFrom(readStdin());
		if (filePath !== "") process.stdout.write(`${filePath}\n`);
		return 0;
	}
	if (command === "has-tool")
		return hasTool(arg, dir || ".", SCOPES.has(scope) ? scope : "any") ? 0 : 1;
	if (command === "context") {
		process.stdout.write(`${contextJson(arg ?? "", readStdin())}\n`);
		return 0;
	}
	return 2;
}

if (require.main === module) {
	process.exitCode = main(process.argv.slice(2));
}

module.exports = { filePathFrom, hasTool, contextJson, main };
