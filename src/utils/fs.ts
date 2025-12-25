import {
  access,
  mkdir,
  rm,
  readFile,
  writeFile,
  copyFile as fsCopyFile,
  readdir,
} from 'node:fs/promises';
import { dirname, join } from 'node:path';

/**
 * Checks if a path exists.
 * @param path - Path to check
 */
export async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Ensures a directory exists, creating it recursively if needed.
 * @param path - Directory path to ensure
 */
export async function ensureDir(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
}

/**
 * Ensures the parent directory of a file exists.
 * @param filePath - Path to a file
 */
export async function ensureParentDir(filePath: string): Promise<void> {
  const parent = dirname(filePath);
  await ensureDir(parent);
}

/**
 * Removes a directory recursively.
 * @param path - Directory path to remove
 */
export async function removeDir(path: string): Promise<void> {
  await rm(path, { recursive: true, force: true });
}

/**
 * Removes a file.
 * @param path - File path to remove
 */
export async function removeFile(path: string): Promise<void> {
  await rm(path, { force: true });
}

/**
 * Copies a file from source to destination.
 * Creates parent directories if needed.
 * @param src - Source file path
 * @param dest - Destination file path
 */
export async function copyFile(src: string, dest: string): Promise<void> {
  await ensureParentDir(dest);
  await fsCopyFile(src, dest);
}

/**
 * Reads a JSON file and parses it.
 * @param path - Path to JSON file
 * @returns Parsed JSON content
 * @throws Error if file doesn't exist or contains invalid JSON
 */
export async function readJson<T>(path: string): Promise<T> {
  const content = await readFile(path, 'utf-8');
  return JSON.parse(content) as T;
}

/**
 * Writes data to a JSON file with pretty formatting.
 * Creates parent directories if needed.
 * @param path - Path to JSON file
 * @param data - Data to write
 */
export async function writeJson(path: string, data: unknown): Promise<void> {
  await ensureParentDir(path);
  const content = JSON.stringify(data, null, 2) + '\n';
  await writeFile(path, content, 'utf-8');
}

/**
 * Reads a text file.
 * @param path - Path to text file
 * @returns File content as string
 */
export async function readText(path: string): Promise<string> {
  return readFile(path, 'utf-8');
}

/**
 * Writes text to a file.
 * Creates parent directories if needed.
 * @param path - Path to text file
 * @param content - Content to write
 */
export async function writeText(path: string, content: string): Promise<void> {
  await ensureParentDir(path);
  await writeFile(path, content, 'utf-8');
}

/**
 * Copies a directory recursively.
 * @param src - Source directory path
 * @param dest - Destination directory path
 */
export async function copyDir(src: string, dest: string): Promise<void> {
  await ensureDir(dest);

  const entries = await readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);

    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else {
      await fsCopyFile(srcPath, destPath);
    }
  }
}
