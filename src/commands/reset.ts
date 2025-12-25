import * as p from '@clack/prompts';
import { getProjectPaths } from '../core/config.js';
import { hasChanges, resetChanges, isGitRepository } from '../core/git.js';
import { pathExists } from '../utils/fs.js';
import { intro, outro, info, warn, spinner, isCancel, cancel } from '../utils/logger.js';
import { GeneralError } from '../errors/base.js';
import type { ResetOptions } from '../types/commands.js';

/**
 * Runs the reset command to restore clean Firefox state.
 * @param projectRoot - Root directory of the project
 * @param options - Reset options
 */
export async function resetCommand(projectRoot: string, options: ResetOptions): Promise<void> {
  intro('Forge Reset');

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
  const hasUncommittedChanges = await hasChanges(paths.engine);

  if (!hasUncommittedChanges) {
    info('No changes to reset');
    outro('Working tree already clean');
    return;
  }

  // Confirm reset unless --force is specified
  if (!options.force) {
    warn('This will discard all uncommitted changes in the engine directory.');

    const confirmed = await p.confirm({
      message: 'Are you sure you want to reset?',
      initialValue: false,
    });

    if (isCancel(confirmed) || !confirmed) {
      cancel('Reset cancelled');
      return;
    }
  }

  const s = spinner('Resetting changes...');

  try {
    await resetChanges(paths.engine);
    s.stop('Changes reset');
    outro('Working tree restored to clean state');
  } catch (error) {
    s.error('Reset failed');
    throw error;
  }
}
