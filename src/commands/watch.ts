import { loadConfig, getProjectPaths } from '../core/config.js';
import { generateMozconfig, watch, hasBuildArtifacts } from '../core/mach.js';
import { pathExists } from '../utils/fs.js';
import { intro, outro, info, spinner } from '../utils/logger.js';
import { BuildError } from '../errors/build.js';
import { GeneralError } from '../errors/base.js';

/**
 * Runs the watch command for auto-rebuilding.
 * @param projectRoot - Root directory of the project
 */
export async function watchCommand(projectRoot: string): Promise<void> {
  intro('Forge Watch');

  // Load configuration
  const config = await loadConfig(projectRoot);
  const paths = getProjectPaths(projectRoot);

  // Check if engine exists
  if (!(await pathExists(paths.engine))) {
    throw new GeneralError('Firefox source not found. Run "./forge/forge download" first.');
  }

  // Check for build artifacts before starting watch
  const buildCheck = await hasBuildArtifacts(paths.engine);
  if (!buildCheck.exists) {
    const detail = buildCheck.objDir
      ? `Build artifacts incomplete in ${buildCheck.objDir}/`
      : 'No build artifacts found (obj-*/ directory missing)';
    throw new GeneralError(
      `Watch mode requires a completed build. ${detail}\n\n` +
        "Run 'forge build' first to create the initial build, then run 'forge watch'."
    );
  }

  info(`Using build artifacts from ${buildCheck.objDir}/`);

  // Generate mozconfig (in case it's not up to date)
  const mozconfigSpinner = spinner('Generating mozconfig...');

  try {
    await generateMozconfig(paths.configs, paths.engine, config);
    mozconfigSpinner.stop('mozconfig generated');
  } catch (err) {
    mozconfigSpinner.error('Failed to generate mozconfig');
    throw err;
  }

  info('Starting watch mode...');
  info('Press Ctrl+C to stop\n');

  let exitCode: number;

  try {
    exitCode = await watch(paths.engine);
  } catch (err) {
    throw new BuildError(
      'Watch process failed to start',
      'mach watch',
      err instanceof Error ? err : undefined
    );
  }

  if (exitCode !== 0 && exitCode !== 130) {
    // 130 is SIGINT (Ctrl+C), which is expected
    throw new BuildError(
      `Watch failed with exit code ${exitCode}. Check the output above for details.\n\n` +
        'Common causes:\n' +
        '  - Missing build: Run "./forge/forge build" first\n' +
        '  - Missing dependencies: Run "./forge/forge bootstrap"',
      'mach watch'
    );
  }

  outro('Watch mode stopped');
}
