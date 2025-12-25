import { getProjectPaths } from '../core/config.js';
import { bootstrap } from '../core/mach.js';
import { pathExists } from '../utils/fs.js';
import { intro, outro, info, error } from '../utils/logger.js';
import { BootstrapError } from '../errors/build.js';
import { GeneralError } from '../errors/base.js';

/**
 * Runs the bootstrap command.
 * @param projectRoot - Root directory of the project
 */
export async function bootstrapCommand(projectRoot: string): Promise<void> {
  intro('Forge Bootstrap');

  const paths = getProjectPaths(projectRoot);

  // Check if engine exists
  if (!(await pathExists(paths.engine))) {
    throw new GeneralError('Firefox source not found. Run "./forge/forge download" first.');
  }

  info('Installing Firefox build dependencies...');
  info('This may take a while and require sudo permissions.\n');

  const exitCode = await bootstrap(paths.engine);

  if (exitCode !== 0) {
    error('Bootstrap failed');
    throw new BootstrapError();
  }

  outro('Build dependencies installed successfully!');
}
