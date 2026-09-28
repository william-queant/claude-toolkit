/**
 * Input helper for the generated PostToolUse hooks. Filesystem only: it reads the
 * hook's JSON from stdin and, for has-tool, the package.json and node_modules/.bin of the
 * current directory (the hook first cds to the edited file's checkout). It never starts
 * a process and never reads environment variables.
 *
 *   node hook-input.cjs path             Print tool_input.file_path; nothing on bad input.
 *   node hook-input.cjs has-tool <name>  Exit 0 when <name> is a node_modules/.bin entry
 *                                        or a package.json script in the current
 *                                        directory; exit 1 otherwise.
 *   node hook-input.cjs context <title>  Read command output from stdin and print it as
 *                                        PostToolUse additionalContext JSON.
 */

const fs = require("node:fs");
const path = require("node:path");

// npm, pnpm and yarn create bare, .cmd and .ps1 shims; bun on Windows creates .exe and .bunx.
const BIN_SUFFIXES = ["", ".cmd", ".ps1", ".exe", ".bunx"];
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

/**
 * True when `name` is a package.json script or a node_modules/.bin entry in `root` (the
 * current directory unless given). A version suffix is ignored ("prettier@3" counts as "prettier"), and a scoped package is looked
 * up by its last segment ("@biomejs/biome" as "biome").
 */
function hasTool(name, root = process.cwd()) {
	if (typeof name !== "string" || name === "") return false;
	if (typeof readScripts(root)[name] === "string") return true;
	const bare = name.replace(/(.)@[^/]*$/, "$1");
	const binName = bare.split("/").pop() ?? "";
	if (binName === "") return false;
	const binDir = path.join(root, "node_modules", ".bin");
	return BIN_SUFFIXES.some((suffix) => fs.existsSync(path.join(binDir, binName + suffix)));
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
	const [command, arg] = argv;
	if (command === "path") {
		const filePath = filePathFrom(readStdin());
		if (filePath !== "") process.stdout.write(`${filePath}\n`);
		return 0;
	}
	if (command === "has-tool") return hasTool(arg) ? 0 : 1;
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
