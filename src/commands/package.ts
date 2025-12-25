import { loadConfig, getProjectPaths } from '../core/config.js';
import { generateMozconfig, machPackage } from '../core/mach.js';
import { setupBranding, isBrandingSetup } from '../core/branding.js';
import { pathExists } from '../utils/fs.js';
import { intro, outro, info, error, spinner, verbose } from '../utils/logger.js';
import { BuildError } from '../errors/build.js';
import { GeneralError } from '../errors/base.js';
import type { PackageOptions } from '../types/commands.js';

/**
 * Runs the package command to create a distribution package.
 * @param projectRoot - Root directory of the project
 * @param options - Package options
 */
export async function packageCommand(projectRoot: string, options: PackageOptions): Promise<void> {
  const brandInfo = options.brand ? ` [${options.brand}]` : '';
  intro(`Forge Package${brandInfo}`);

  // Load configuration
  const config = await loadConfig(projectRoot);
  const paths = getProjectPaths(projectRoot);

  // Check if engine exists
  if (!(await pathExists(paths.engine))) {
    throw new GeneralError('Firefox source not found. Run "./forge/forge download" first.');
  }

  // Set up custom branding directory if needed
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

  // Log brand info if specified
  if (options.brand) {
    verbose(`Packaging with brand: ${options.brand}`);
    info(`Brand: ${options.brand}`);
  }

  // Generate mozconfig (in case it's not up to date)
  const mozconfigSpinner = spinner('Generating mozconfig...');

  try {
    await generateMozconfig(paths.configs, paths.engine, config);
    mozconfigSpinner.stop('mozconfig generated');
  } catch (err) {
    mozconfigSpinner.error('Failed to generate mozconfig');
    throw err;
  }

  // Run package
  info('Creating distribution package...');
  info('This may take a while.\n');

  const startTime = Date.now();
  let exitCode: number;

  try {
    exitCode = await machPackage(paths.engine);
  } catch (err) {
    throw new BuildError(
      'Package process failed to start',
      'mach package',
      err instanceof Error ? err : undefined
    );
  }

  const duration = Date.now() - startTime;
  const minutes = Math.floor(duration / 60000);
  const seconds = Math.floor((duration % 60000) / 1000);
  const timeStr = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;

  if (exitCode !== 0) {
    error(`Packaging failed after ${timeStr}`);
    throw new BuildError(`Packaging failed with exit code ${exitCode}`, 'mach package');
  }

  info(`\nPackage created in obj-*/dist/`);
  outro(`Packaging completed in ${timeStr}!`);
}
