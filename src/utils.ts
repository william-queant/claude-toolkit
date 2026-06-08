import { existsSync } from "node:fs";
import { copyFile, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

/** Recursively copy a directory */
export async function copyDir(src: string, dest: string): Promise<void> {
	await mkdir(dest, { recursive: true });
	const entries = await readdir(src, { withFileTypes: true });
	for (const entry of entries) {
		const srcPath = join(src, entry.name);
		const destPath = join(dest, entry.name);
		if (entry.isDirectory()) {
			await copyDir(srcPath, destPath);
		} else {
			await mkdir(dirname(destPath), { recursive: true });
			await copyFile(srcPath, destPath);
		}
	}
}

/** Remove a file or directory recursively. No-op if the path doesn't exist. */
export async function removePath(path: string): Promise<void> {
	await rm(path, { recursive: true, force: true });
}

/** Write a file, creating parent directories as needed */
export async function writeFileEnsureDir(filePath: string, content: string): Promise<void> {
	await mkdir(dirname(filePath), { recursive: true });
	await writeFile(filePath, content, "utf-8");
}

/** Read JSON file with type */
export async function readJson<T>(filePath: string): Promise<T> {
	const content = await readFile(filePath, "utf-8");
	return JSON.parse(content) as T;
}

/** Check if a path exists */
export function exists(filePath: string): boolean {
	return existsSync(filePath);
}

/** Simple template replacement: {{key}} → value */
export function renderTemplate(template: string, vars: Record<string, string>): string {
	return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");
}
