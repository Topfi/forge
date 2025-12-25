import { getProjectPaths } from '../core/config.js';
import { run } from '../core/mach.js';
import { pathExists } from '../utils/fs.js';
import { intro, info } from '../utils/logger.js';
import { GeneralError } from '../errors/base.js';
import { BuildError } from '../errors/build.js';

/**
 * Runs the run command to launch the built browser.
 * @param projectRoot - Root directory of the project
 */
export async function runCommand(projectRoot: string): Promise<void> {
  intro('Forge Run');

  const paths = getProjectPaths(projectRoot);

  // Check if engine exists
  if (!(await pathExists(paths.engine))) {
    throw new GeneralError('Firefox source not found. Run "./forge/forge download" first.');
  }

  info('Launching browser...\n');

  const exitCode = await run(paths.engine);

  if (exitCode !== 0) {
    throw new BuildError(`Browser exited with code ${exitCode}`, 'mach run');
  }
}
