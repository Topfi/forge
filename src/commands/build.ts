import { loadConfig, getProjectPaths } from '../core/config.js';
import { generateMozconfig, build, buildUI } from '../core/mach.js';
import { setupBranding, isBrandingSetup } from '../core/branding.js';
import { pathExists } from '../utils/fs.js';
import { intro, outro, info, error, spinner, verbose } from '../utils/logger.js';
import { BuildError } from '../errors/build.js';
import { GeneralError } from '../errors/base.js';
import type { BuildOptions } from '../types/commands.js';

/**
 * Runs the build command.
 * @param projectRoot - Root directory of the project
 * @param options - Build options
 */
export async function buildCommand(projectRoot: string, options: BuildOptions): Promise<void> {
  const buildType = options.ui ? 'UI-only' : 'Full';
  const brandInfo = options.brand ? ` [${options.brand}]` : '';
  intro(`Forge Build (${buildType}${brandInfo})`);

  // Load configuration
  const config = await loadConfig(projectRoot);
  const paths = getProjectPaths(projectRoot);

  // Check if engine exists
  if (!(await pathExists(paths.engine))) {
    throw new GeneralError('Firefox source not found. Run "./forge/forge download" first.');
  }

  // Log brand info if specified
  if (options.brand) {
    verbose(`Building with brand: ${options.brand}`);
    // Future: Load brand-specific config from forge.json brands section
    info(`Brand: ${options.brand}`);
  }

  // Set up custom branding directory and patch moz.configure
  const brandingConfig = {
    name: config.name,
    vendor: config.vendor,
    appId: config.appId,
    binaryName: config.binaryName,
  };
  if (!(await isBrandingSetup(paths.engine, brandingConfig))) {
    const brandingSpinner = spinner('Setting up branding...');
    try {
      await setupBranding(paths.engine, brandingConfig);
      brandingSpinner.stop('Branding configured');
    } catch (err) {
      brandingSpinner.error('Failed to set up branding');
      throw err;
    }
  }

  // Generate mozconfig
  const mozconfigSpinner = spinner('Generating mozconfig...');

  try {
    await generateMozconfig(paths.configs, paths.engine, config);
    mozconfigSpinner.stop('mozconfig generated');
  } catch (err) {
    mozconfigSpinner.error('Failed to generate mozconfig');
    throw err;
  }

  // Run build
  info(`Starting ${buildType.toLowerCase()} build...`);
  if (options.jobs) {
    info(`Using ${options.jobs} parallel jobs`);
  }
  info(''); // Empty line before build output

  const startTime = Date.now();
  let exitCode: number;

  try {
    if (options.ui) {
      exitCode = await buildUI(paths.engine);
    } else {
      exitCode = await build(paths.engine, options.jobs);
    }
  } catch (err) {
    throw new BuildError(
      'Build process failed to start',
      options.ui ? 'mach build faster' : 'mach build',
      err instanceof Error ? err : undefined
    );
  }

  const duration = Date.now() - startTime;
  const minutes = Math.floor(duration / 60000);
  const seconds = Math.floor((duration % 60000) / 1000);
  const timeStr = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;

  if (exitCode !== 0) {
    error(`Build failed after ${timeStr}`);
    throw new BuildError(
      `Build failed with exit code ${exitCode}`,
      options.ui ? 'mach build faster' : 'mach build'
    );
  }

  outro(`Build completed in ${timeStr}!`);
}
