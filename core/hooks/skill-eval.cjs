/**
 * Skill Evaluation Engine v2.0
 *
 * Intelligent skill activation based on:
 * - Keywords and patterns in prompts
 * - File paths mentioned or being edited
 * - Directory mappings
 * - Intent detection
 * - Content pattern matching
 *
 * Outputs a structured reminder with matched skills and reasons.
 */

const fs = require("node:fs");
const path = require("node:path");

// Configuration
const RULES_PATH = path.join(__dirname, "skill-rules.json");

// Cap the text handed to the (potentially quadratic) regex scans. Long single-line
// pastes — minified bundles, one-line JSON — can otherwise blow past the 5s hook timeout.
const MAX_PROMPT_LENGTH = 50_000;

/**
 * @typedef {Object} SkillMatch
 * @property {string} name - Skill name
 * @property {number} score - Confidence score
 * @property {string[]} reasons - Why this skill was matched
 * @property {number} priority - Skill priority
 */

/**
 * Load skill rules from JSON file
 * @returns {Object} Parsed skill rules
 */
function loadRules() {
	try {
		const content = fs.readFileSync(RULES_PATH, "utf-8");
		return JSON.parse(content);
	} catch (error) {
		console.error(`Failed to load skill rules: ${error.message}`);
		return null;
	}
}

/**
 * Extract file paths mentioned in the prompt
 * @param {string} prompt - User's prompt text
 * @returns {string[]} Array of detected file paths
 */
function extractFilePaths(prompt) {
	// Normalize backslashes so Windows paths match, and cap length for the regex scans.
	const text = String(prompt).slice(0, MAX_PROMPT_LENGTH).replace(/\\/g, "/");
	const paths = new Set();

	// Match explicit paths with extensions. Negative lookbehind lets a candidate start
	// after any non-path delimiter — "(", ",", ":", "=", whitespace, quotes, or BOL.
	const extensionPattern =
		/(?<![\w\-./])([\w\-./]+\.(?:[tj]sx?|json|gql|ya?ml|md|sh|rs|proto|toml|wasm))\b/gi;
	for (const match of text.matchAll(extensionPattern)) {
		paths.add(match[1]);
	}

	// Match paths starting with common directories.
	const dirPattern =
		/(?<![\w\-./])((?:src|app|components|worker|workers|proto|hooks|utils|services|styles|locales|tests|\.claude|\.github)\/[\w\-./]+)/gi;
	for (const match of text.matchAll(dirPattern)) {
		paths.add(match[1]);
	}

	// Match quoted paths.
	const quotedPattern = /["'`]([\w\-./]+\/[\w\-./]+)["'`]/g;
	for (const match of text.matchAll(quotedPattern)) {
		paths.add(match[1]);
	}

	// Require at least one letter so ratios/fractions like "3/4" are not treated as paths.
	return Array.from(paths).filter((p) => /[A-Za-z]/.test(p));
}

/**
 * Check if a pattern matches the text
 * @param {string} text - Text to search in
 * @param {string} pattern - Regex pattern
 * @param {string} flags - Regex flags
 * @returns {boolean}
 */
function matchesPattern(text, pattern, flags = "i") {
	try {
		const regex = new RegExp(pattern, flags);
		return regex.test(text);
	} catch {
		return false;
	}
}

/**
 * Check if a glob pattern matches a file path
 * @param {string} filePath - File path to check
 * @param {string} globPattern - Glob pattern (simplified)
 * @returns {boolean}
 */
function matchesGlob(filePath, globPattern) {
	const normalized = String(filePath).replace(/\\/g, "/");
	const regexPattern = globPattern
		.replace(/[.+^${}()|[\]]/g, "\\$&")
		.replace(/\*\*\//g, "<<<GLOBSTARSLASH>>>")
		.replace(/\*\*/g, "<<<GLOBSTAR>>>")
		.replace(/\*/g, "[^/]*")
		.replace(/\?/g, ".")
		.replace(/<<<GLOBSTARSLASH>>>/g, "(?:.*/)?")
		.replace(/<<<GLOBSTAR>>>/g, ".*");

	try {
		const regex = new RegExp(`^${regexPattern}$`, "i");
		return regex.test(normalized);
	} catch {
		return false;
	}
}

/**
 * Check if file path matches any directory mapping
 * @param {string} filePath - File path to check
 * @param {Object} mappings - Directory to skill mappings
 * @returns {string|null} Matched skill name or null
 */
function matchDirectoryMapping(filePath, mappings) {
	for (const [dir, skillName] of Object.entries(mappings)) {
		if (filePath === dir || filePath.startsWith(`${dir}/`)) {
			return skillName;
		}
	}
	return null;
}

/**
 * Evaluate a single skill against the prompt and context
 */
function evaluateSkill(skillName, skill, prompt, promptLower, filePaths, rules) {
	const { triggers = {}, excludePatterns = [], priority = 5 } = skill;
	const scoring = rules.scoring;

	let score = 0;
	const reasons = [];

	// Check exclude patterns first
	for (const excludePattern of excludePatterns) {
		if (matchesPattern(promptLower, excludePattern)) {
			return null;
		}
	}

	// 1. Check keywords
	if (triggers.keywords) {
		for (const keyword of triggers.keywords) {
			if (promptLower.includes(keyword.toLowerCase())) {
				score += scoring.keyword;
				reasons.push(`keyword "${keyword}"`);
			}
		}
	}

	// 2. Check keyword patterns (regex)
	if (triggers.keywordPatterns) {
		for (const pattern of triggers.keywordPatterns) {
			if (matchesPattern(promptLower, pattern)) {
				score += scoring.keywordPattern;
				reasons.push(`pattern /${pattern}/`);
			}
		}
	}

	// 3. Check intent patterns
	if (triggers.intentPatterns) {
		for (const pattern of triggers.intentPatterns) {
			if (matchesPattern(promptLower, pattern)) {
				score += scoring.intentPattern;
				reasons.push(`intent detected`);
				break;
			}
		}
	}

	// 4. Check context patterns
	if (triggers.contextPatterns) {
		for (const pattern of triggers.contextPatterns) {
			if (promptLower.includes(pattern.toLowerCase())) {
				score += scoring.contextPattern;
				reasons.push(`context "${pattern}"`);
			}
		}
	}

	// 5. Check file paths against path patterns
	if (triggers.pathPatterns && filePaths.length > 0) {
		for (const filePath of filePaths) {
			for (const pattern of triggers.pathPatterns) {
				if (matchesGlob(filePath, pattern)) {
					score += scoring.pathPattern;
					reasons.push(`path "${filePath}"`);
					break;
				}
			}
		}
	}

	// 6. Check directory mappings
	if (rules.directoryMappings && filePaths.length > 0) {
		for (const filePath of filePaths) {
			const mappedSkill = matchDirectoryMapping(filePath, rules.directoryMappings);
			if (mappedSkill === skillName) {
				score += scoring.directoryMatch;
				reasons.push(`directory mapping`);
				break;
			}
		}
	}

	// 7. Check content patterns in prompt (for code snippets)
	if (triggers.contentPatterns) {
		for (const pattern of triggers.contentPatterns) {
			if (matchesPattern(prompt, pattern)) {
				score += scoring.contentPattern;
				reasons.push(`code pattern detected`);
				break;
			}
		}
	}

	if (score > 0) {
		return { name: skillName, score, reasons: [...new Set(reasons)], priority };
	}

	return null;
}

/**
 * Get related skills that should also be suggested
 */
function getRelatedSkills(matches, skills) {
	const matchedNames = new Set(matches.map((m) => m.name));
	const related = new Set();

	for (const match of matches) {
		const skill = skills[match.name];
		if (skill?.relatedSkills) {
			for (const relatedName of skill.relatedSkills) {
				if (!matchedNames.has(relatedName)) {
					related.add(relatedName);
				}
			}
		}
	}

	return Array.from(related);
}

/**
 * Format confidence level based on score
 */
function formatConfidence(score, minScore) {
	if (score >= minScore * 3) return "HIGH";
	if (score >= minScore * 2) return "MEDIUM";
	return "LOW";
}

// Strip characters that could break out of the <user-prompt-submit-hook> block or
// forge system-reminder content when a rule-derived string is echoed into output (F04).
function sanitize(value) {
	return String(value)
		.replace(/[<>\r\n]/g, " ")
		.trim();
}

// Confirm the skill actually ships before ordering Claude to invoke it (F03).
// baseDir is .claude/skills at runtime (path.join(__dirname, "..", "skills")).
function skillExists(name, skillsDir) {
	try {
		return fs.existsSync(path.join(skillsDir, name, "SKILL.md"));
	} catch {
		return false;
	}
}

/**
 * Main evaluation function
 */
function evaluate(prompt, opts = {}) {
	const rules = opts.rules !== undefined ? opts.rules : loadRules();
	if (!rules?.skills) return "";
	const skillsDir = opts.skillsDir ?? path.join(__dirname, "..", "skills");

	const {
		minConfidenceScore = 3,
		maxSkillsToShow = 5,
		showMatchReasons = true,
	} = rules.config ?? {};

	// Cap the text before the pattern scans (F09), and coerce non-strings (F21).
	const cappedPrompt = String(prompt).slice(0, MAX_PROMPT_LENGTH);
	const promptLower = cappedPrompt.toLowerCase();
	const filePaths = extractFilePaths(cappedPrompt);
	const skills = rules.skills;

	const matches = [];
	for (const [name, skill] of Object.entries(skills)) {
		const match = evaluateSkill(name, skill, cappedPrompt, promptLower, filePaths, rules);
		if (match && match.score >= minConfidenceScore && skillExists(match.name, skillsDir)) {
			matches.push(match);
		}
	}

	if (matches.length === 0) {
		return "";
	}

	matches.sort((a, b) => {
		if (b.score !== a.score) return b.score - a.score;
		return b.priority - a.priority;
	});

	const topMatches = matches.slice(0, maxSkillsToShow);
	const relatedSkills = getRelatedSkills(topMatches, skills).filter((n) =>
		skillExists(n, skillsDir),
	);

	let output = "<user-prompt-submit-hook>\n";
	output += "SKILL ACTIVATION REQUIRED\n\n";

	if (filePaths.length > 0) {
		output += `Detected file paths: ${filePaths.map(sanitize).join(", ")}\n\n`;
	}

	output += "Matched skills (ranked by relevance):\n";

	for (let i = 0; i < topMatches.length; i++) {
		const match = topMatches[i];
		const confidence = formatConfidence(match.score, minConfidenceScore);
		output += `${i + 1}. ${sanitize(match.name)} (${confidence} confidence)\n`;
		if (showMatchReasons && match.reasons.length > 0) {
			output += `   Matched: ${match.reasons.slice(0, 3).map(sanitize).join(", ")}\n`;
		}
	}

	if (relatedSkills.length > 0) {
		output += `\nRelated skills to consider: ${relatedSkills.map(sanitize).join(", ")}\n`;
	}

	output += "\nBefore implementing, you MUST:\n";
	output += "1. EVALUATE: State YES/NO for each skill with brief reasoning\n";
	output += "2. ACTIVATE: Invoke the Skill tool for each YES skill\n";
	output += "3. IMPLEMENT: Only proceed after skill activation\n";
	output += "\nExample evaluation:\n";
	output += `- ${sanitize(topMatches[0].name)}: YES - [your reasoning]\n`;
	if (topMatches.length > 1) {
		output += `- ${sanitize(topMatches[1].name)}: NO - [your reasoning]\n`;
	}
	output += "\nDO NOT skip this step. Invoke relevant skills NOW.\n";
	output += "</user-prompt-submit-hook>";

	return output;
}

// Main execution
function main() {
	let input = "";

	process.stdin.setEncoding("utf8");

	process.stdin.on("data", (chunk) => {
		input += chunk;
	});

	// F36: never leave stdin errors unhandled (would otherwise hang to the hook timeout).
	process.stdin.on("error", () => {
		process.exitCode = 0;
	});

	process.stdin.on("end", () => {
		let prompt = "";

		try {
			const data = JSON.parse(input);
			// F21: only accept a string prompt; anything else is treated as empty.
			prompt = typeof data.prompt === "string" ? data.prompt : "";
		} catch {
			prompt = input;
		}

		if (typeof prompt !== "string" || !prompt.trim()) {
			process.exitCode = 0;
			return;
		}

		try {
			const output = evaluate(prompt);
			if (output) {
				console.log(output);
			}
		} catch (error) {
			console.error(`Skill evaluation failed: ${error.message}`);
		}

		// F35: set exitCode and let the process drain stdout naturally rather than
		// process.exit(0), which can truncate a large console.log on POSIX pipes.
		process.exitCode = 0;
	});
}

if (require.main === module) {
	main();
}

module.exports = {
	matchesGlob,
	matchesPattern,
	extractFilePaths,
	matchDirectoryMapping,
	evaluateSkill,
	getRelatedSkills,
	formatConfidence,
	skillExists,
	sanitize,
	evaluate,
};
