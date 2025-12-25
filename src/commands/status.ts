import { getProjectPaths } from '../core/config.js';
import { getStatusWithCodes, isGitRepository } from '../core/git.js';
import { pathExists } from '../utils/fs.js';
import { intro, outro, info, warn } from '../utils/logger.js';
import { GeneralError } from '../errors/base.js';

/**
 * Status code descriptions for git status.
 */
const STATUS_DESCRIPTIONS: Record<string, string> = {
  M: 'modified',
  A: 'added',
  D: 'deleted',
  R: 'renamed',
  C: 'copied',
  U: 'unmerged',
  '?': 'untracked',
  '!': 'ignored',
};

/**
 * Gets a human-readable description for a git status code.
 */
function getStatusDescription(code: string): string {
  return STATUS_DESCRIPTIONS[code] ?? 'changed';
}

/**
 * Runs the status command to show modified files.
 * @param projectRoot - Root directory of the project
 */
export async function statusCommand(projectRoot: string): Promise<void> {
  intro('Forge Status');

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

  const files = await getStatusWithCodes(paths.engine);

  if (files.length === 0) {
    info('No modified files');
    outro('Working tree clean');
    return;
  }

  info(`${files.length} modified file${files.length === 1 ? '' : 's'}:\n`);

  // Group by status
  const grouped = new Map<string, string[]>();
  for (const { status, file } of files) {
    const existing = grouped.get(status) ?? [];
    existing.push(file);
    grouped.set(status, existing);
  }

  // Display grouped files
  for (const [status, fileList] of grouped) {
    const description = getStatusDescription(status);
    warn(`${description}:`);
    for (const file of fileList) {
      info(`  ${file}`);
    }
  }

  outro(`${files.length} file${files.length === 1 ? '' : 's'} changed`);
}
