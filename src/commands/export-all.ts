import * as p from '@clack/prompts';
import { join } from 'node:path';
import { getProjectPaths } from '../core/config.js';
import { getAllDiff, isGitRepository, hasChanges } from '../core/git.js';
import { getNextPatchNumber } from '../core/patches.js';
import { pathExists, writeText, ensureDir } from '../utils/fs.js';
import { intro, outro, info, spinner, isCancel, cancel } from '../utils/logger.js';
import { GeneralError } from '../errors/base.js';
import type { ExportOptions } from '../types/commands.js';

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
 * Runs the export-all command to export all changes as a patch.
 * @param projectRoot - Root directory of the project
 * @param options - Export options
 */
export async function exportAllCommand(
  projectRoot: string,
  options: ExportOptions = {}
): Promise<void> {
  intro('Forge Export All');

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

  // Check for changes
  if (!(await hasChanges(paths.engine))) {
    info('No changes to export');
    outro('Nothing to export');
    return;
  }

  // Get the full diff
  const diff = await getAllDiff(paths.engine);

  if (!diff.trim()) {
    info('No diff content to export');
    outro('Nothing to export');
    return;
  }

  // Get or prompt for patch name
  let patchName = options.name;

  if (!patchName) {
    const nameResult = await p.text({
      message: 'Enter a name for this patch:',
      placeholder: 'my-changes',
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

  const s = spinner(`Exporting all changes to ${patchFilename}...`);

  try {
    await writeText(patchPath, diff);
    s.stop(`Exported to ${patchFilename}`);

    // Count lines in diff for info
    const lineCount = diff.split('\n').length;
    info(`\nPatch saved to: patches/${patchFilename}`);
    info(`Diff size: ${lineCount} lines`);

    outro('Export complete');
  } catch (error) {
    s.error('Export failed');
    throw error;
  }
}
