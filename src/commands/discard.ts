import { getProjectPaths } from '../core/config.js';
import { discardFile, isGitRepository, getModifiedFiles } from '../core/git.js';
import { pathExists } from '../utils/fs.js';
import { intro, outro, info, spinner } from '../utils/logger.js';
import { GeneralError } from '../errors/base.js';
import { GitError } from '../errors/git.js';

/**
 * Runs the discard command to revert changes to a specific file.
 * @param projectRoot - Root directory of the project
 * @param file - File path to discard (relative to engine/)
 */
export async function discardCommand(projectRoot: string, file: string): Promise<void> {
  intro('Forge Discard');

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

  // Check if the file has changes
  const modifiedFiles = await getModifiedFiles(paths.engine);

  if (!modifiedFiles.includes(file)) {
    info(`File "${file}" has no changes to discard`);
    outro('Nothing to discard');
    return;
  }

  const s = spinner(`Discarding changes to ${file}...`);

  try {
    await discardFile(paths.engine, file);
    s.stop(`Discarded changes to ${file}`);
    outro('File restored to original state');
  } catch (error) {
    s.error('Discard failed');
    if (error instanceof GitError) {
      throw error;
    }
    throw new GitError(
      `Failed to discard ${file}`,
      `checkout HEAD -- ${file}`,
      error instanceof Error ? error : undefined
    );
  }
}
