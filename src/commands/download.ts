import { join } from 'node:path';
import { loadConfig, getProjectPaths, updateState } from '../core/config.js';
import { downloadFirefoxSource, formatBytes } from '../core/firefox.js';
import { initRepository } from '../core/git.js';
import { pathExists, removeDir, ensureDir } from '../utils/fs.js';
import { intro, outro, spinner, info, warn } from '../utils/logger.js';
import { EngineExistsError } from '../errors/download.js';
import type { DownloadOptions } from '../types/commands.js';

/**
 * Runs the download command.
 * @param projectRoot - Root directory of the project
 * @param options - Download options
 */
export async function downloadCommand(
  projectRoot: string,
  options: DownloadOptions
): Promise<void> {
  intro('Forge Download');

  // Load configuration
  const config = await loadConfig(projectRoot);
  const paths = getProjectPaths(projectRoot);
  const version = config.firefox.version;

  info(`Firefox version: ${version}`);

  // Check if engine already exists
  if (await pathExists(paths.engine)) {
    if (!options.force) {
      throw new EngineExistsError(paths.engine);
    }

    warn('Removing existing engine directory...');
    await removeDir(paths.engine);
  }

  // Ensure cache directory exists
  const cacheDir = join(paths.forgeDir, 'cache');
  await ensureDir(cacheDir);

  // Download with progress
  const s = spinner(`Downloading Firefox ${version}...`);
  let lastPercent = 0;

  try {
    await downloadFirefoxSource(
      version,
      config.firefox.product,
      paths.engine,
      cacheDir,
      (downloaded, total) => {
        const percent = Math.floor((downloaded / total) * 100);
        if (percent !== lastPercent && percent % 5 === 0) {
          s.message(
            `Downloading Firefox ${version}... ${percent}% (${formatBytes(downloaded)} / ${formatBytes(total)})`
          );
          lastPercent = percent;
        }
      }
    );

    s.stop(`Firefox ${version} downloaded`);
  } catch (error) {
    s.error('Download failed');
    throw error;
  }

  // Initialize git repository
  const gitSpinner = spinner('Initializing git repository (this may take a few minutes)...');

  try {
    await initRepository(paths.engine, 'firefox');
    gitSpinner.stop('Git repository initialized');
  } catch (error) {
    gitSpinner.error('Failed to initialize git repository');
    throw error;
  }

  // Update state
  await updateState(projectRoot, {
    downloadedVersion: version,
  });

  outro(`Firefox ${version} is ready!`);
}
