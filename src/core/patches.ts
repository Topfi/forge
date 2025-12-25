import { readdir } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { pathExists } from '../utils/fs.js';
import { applyPatchIdempotent } from './git.js';
import type { PatchInfo, PatchResult } from '../types/commands.js';
import { ForgeError } from '../errors/base.js';
import { ExitCode } from '../errors/codes.js';

/**
 * Error thrown when patch operations fail.
 */
export class PatchError extends ForgeError {
  readonly code = ExitCode.PATCH_ERROR;

  constructor(
    message: string,
    public readonly patchName?: string,
    cause?: Error
  ) {
    super(message, cause);
  }

  override get userMessage(): string {
    let msg = `Patch Error: ${this.message}`;

    if (this.patchName) {
      msg += `\n\nPatch: ${this.patchName}`;
    }

    msg += '\n\nTo fix this:\n';
    msg += '  1. Check if the patch is compatible with the Firefox version\n';
    msg += '  2. Use "./forge/forge reset" to start with clean source\n';
    msg += '  3. Update the patch for the current Firefox version';

    return msg;
  }
}

/**
 * Extracts the order number from a patch filename.
 * Expects format like "001-description.patch"
 * @param filename - Patch filename
 * @returns Order number, or Infinity if no prefix
 */
function extractOrder(filename: string): number {
  const match = /^(\d+)-/.exec(filename);
  if (match?.[1]) {
    return parseInt(match[1], 10);
  }
  return Infinity;
}

/**
 * Discovers patch files in a directory.
 * @param patchesDir - Path to the patches directory
 * @returns List of patch info sorted by order
 */
export async function discoverPatches(patchesDir: string): Promise<PatchInfo[]> {
  if (!(await pathExists(patchesDir))) {
    return [];
  }

  const entries = await readdir(patchesDir, { withFileTypes: true });

  const patches: PatchInfo[] = entries
    .filter((entry) => entry.isFile() && extname(entry.name) === '.patch')
    .map((entry) => ({
      path: join(patchesDir, entry.name),
      filename: entry.name,
      order: extractOrder(entry.name),
    }));

  // Sort by order number
  patches.sort((a, b) => a.order - b.order);

  return patches;
}

/**
 * Applies a single patch.
 * @param patch - Patch info
 * @param engineDir - Path to the engine directory
 * @returns Patch result
 */
async function applySinglePatch(patch: PatchInfo, engineDir: string): Promise<PatchResult> {
  try {
    await applyPatchIdempotent(patch.path, engineDir);
    return { patch, success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { patch, success: false, error: errorMessage };
  }
}

/**
 * Applies all patches in order.
 * @param patchesDir - Path to the patches directory
 * @param engineDir - Path to the engine directory
 * @returns Results for each patch
 */
export async function applyPatches(patchesDir: string, engineDir: string): Promise<PatchResult[]> {
  const patches = await discoverPatches(patchesDir);
  const results: PatchResult[] = [];

  for (const patch of patches) {
    const result = await applySinglePatch(patch, engineDir);
    results.push(result);

    // Stop on first failure
    if (!result.success) {
      break;
    }
  }

  return results;
}

/**
 * Counts the number of patch files.
 * @param patchesDir - Path to the patches directory
 * @returns Number of patches
 */
export async function countPatches(patchesDir: string): Promise<number> {
  const patches = await discoverPatches(patchesDir);
  return patches.length;
}

/**
 * Gets the next patch number for a new patch.
 * @param patchesDir - Path to the patches directory
 * @returns Next patch number (e.g., "005" for 4 existing patches)
 */
export async function getNextPatchNumber(patchesDir: string): Promise<string> {
  const patches = await discoverPatches(patchesDir);

  if (patches.length === 0) {
    return '001';
  }

  const maxOrder = Math.max(...patches.map((p) => p.order));
  const nextNumber = maxOrder === Infinity ? 1 : maxOrder + 1;

  return String(nextNumber).padStart(3, '0');
}

/**
 * Validates that all patches can be applied.
 * @param patchesDir - Path to the patches directory
 * @param engineDir - Path to the engine directory
 * @returns Validation results
 */
export async function validatePatches(
  patchesDir: string,
  engineDir: string
): Promise<{ valid: boolean; errors: string[] }> {
  const patches = await discoverPatches(patchesDir);
  const errors: string[] = [];

  for (const patch of patches) {
    const result = await applySinglePatch(patch, engineDir);
    if (!result.success && result.error) {
      errors.push(`${patch.filename}: ${result.error}`);
    }
  }

  return { valid: errors.length === 0, errors };
}
