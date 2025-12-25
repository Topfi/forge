import * as p from '@clack/prompts';
import { join } from 'node:path';
import { getProjectPaths } from '../core/config.js';
import { getFileDiff, isGitRepository, getStatusWithCodes } from '../core/git.js';
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

  // Check if file is untracked
  if (fileStatus.status === '??') {
    throw new GeneralError(
      `File "${file}" is untracked (new file).\n\n` +
        'To export a new file, first stage it with: git -C engine add ' +
        file +
        '\n' +
        'Then run "./forge/forge export-all" to include it in a patch.'
    );
  }

  // Get the diff
  const diff = await getFileDiff(paths.engine, file);

  if (!diff.trim()) {
    throw new GeneralError(
      `File "${file}" has no diff content to export.\n\n` +
        'The file may be staged but unchanged, or binary.'
    );
  }

  // Get or prompt for patch name
  let patchName = options.name;

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
