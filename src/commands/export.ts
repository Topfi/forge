import * as p from '@clack/prompts';
import { join } from 'node:path';
import { getProjectPaths } from '../core/config.js';
import {
  getFileDiff,
  generateNewFileDiff,
  isGitRepository,
  getStatusWithCodes,
} from '../core/git.js';
import { getNextPatchNumber } from '../core/patches.js';
import { pathExists, writeText, ensureDir } from '../utils/fs.js';
import { intro, outro, info, spinner, isCancel, cancel } from '../utils/logger.js';
import { GeneralError, InvalidArgumentError } from '../errors/base.js';
import type { ExportOptions } from '../types/commands.js';

/**
 * Validates a patch name.
 * @param name - The patch name to validate
 * @returns Error message if invalid, undefined if valid
 */
function validatePatchName(name: string): string | undefined {
  if (!name.trim()) return 'Name is required';
  if (name.length > 50) return 'Name must be 50 characters or less';
  if (!/^[a-zA-Z0-9\-_ ]+$/.test(name))
    return 'Name can only contain letters, numbers, hyphens, underscores, and spaces';
  return undefined;
}

/**
 * Sanitizes a string for use in a filename.
 */
function sanitizeFilename(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

/**
 * Runs the export command to export file changes as a patch.
 * @param projectRoot - Root directory of the project
 * @param file - File path to export (relative to engine/)
 * @param options - Export options
 */
export async function exportCommand(
  projectRoot: string,
  file: string,
  options: ExportOptions
): Promise<void> {
  intro('Forge Export');

  const paths = getProjectPaths(projectRoot);

  // Check if engine exists
  if (!(await pathExists(paths.engine))) {
    throw new GeneralError('Firefox source not found. Run "./forge/forge download" first.');
  }

  // Check if it's a git repository
  if (!(await isGitRepository(paths.engine))) {
    throw new GeneralError(
      'Engine directory is not a git repository. Run "./forge/forge download" to initialize.'
    );
  }

  // Check if the file has changes and get its status
  const fileStatuses = await getStatusWithCodes(paths.engine);
  const fileStatus = fileStatuses.find((s) => s.file === file);

  if (!fileStatus) {
    throw new GeneralError(
      `File "${file}" has no changes to export.\n\n` +
        'Run "./forge/forge status" to see modified files.'
    );
  }

  // Check if it's a directory (git status shows directories with trailing /)
  if (file.endsWith('/')) {
    throw new GeneralError(
      `"${file}" is a directory.\n\n` +
        'Use "./forge/forge export-all" to export all changes including new directories.'
    );
  }

  // Get the diff - use different method for new files vs modified files
  const isNewFile = fileStatus.status === '??';
  const diff = isNewFile
    ? await generateNewFileDiff(paths.engine, file)
    : await getFileDiff(paths.engine, file);

  if (!diff.trim()) {
    throw new GeneralError(
      `File "${file}" has no diff content to export.\n\n` +
        'The file may be staged but unchanged, or binary.'
    );
  }

  // Get or prompt for patch name
  let patchName = options.name;

  // Validate provided name
  if (patchName) {
    const validationError = validatePatchName(patchName);
    if (validationError) {
      throw new InvalidArgumentError(validationError, '--name');
    }
  }

  // Check for non-interactive mode
  const isInteractive = process.stdin.isTTY && process.stdout.isTTY;

  if (!patchName && !isInteractive) {
    throw new InvalidArgumentError(
      'The --name flag is required in non-interactive mode',
      'Use: forge export <file> --name "my-patch-name"'
    );
  }

  if (!patchName) {
    const nameResult = await p.text({
      message: 'Enter a name for this patch:',
      placeholder: 'my-change',
      validate: (value) => {
        if (!value.trim()) return 'Name is required';
        return undefined;
      },
    });

    if (isCancel(nameResult)) {
      cancel('Export cancelled');
      return;
    }

    patchName = String(nameResult);
  }

  // Ensure patches directory exists
  await ensureDir(paths.patches);

  // Get next patch number
  const patchNumber = await getNextPatchNumber(paths.patches);
  const sanitizedName = sanitizeFilename(patchName);
  const patchFilename = `${patchNumber}-${sanitizedName}.patch`;
  const patchPath = join(paths.patches, patchFilename);

  const s = spinner(`Exporting to ${patchFilename}...`);

  try {
    await writeText(patchPath, diff);
    s.stop(`Exported to ${patchFilename}`);

    info(`\nPatch saved to: patches/${patchFilename}`);
    outro('Export complete');
  } catch (error) {
    s.error('Export failed');
    throw error;
  }
}
