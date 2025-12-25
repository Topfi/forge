import { getProjectPaths } from '../core/config.js';
import { applyPatches, countPatches } from '../core/patches.js';
import { pathExists } from '../utils/fs.js';
import { intro, outro, info, success, error, spinner } from '../utils/logger.js';
import { GeneralError } from '../errors/base.js';
import { PatchError } from '../core/patches.js';

/**
 * Runs the import command to apply patches.
 * @param projectRoot - Root directory of the project
 */
export async function importCommand(projectRoot: string): Promise<void> {
  intro('Forge Import');

  const paths = getProjectPaths(projectRoot);

  // Check if engine exists
  if (!(await pathExists(paths.engine))) {
    throw new GeneralError('Firefox source not found. Run "./forge/forge download" first.');
  }

  // Check if patches directory exists
  if (!(await pathExists(paths.patches))) {
    info('No patches directory found. Nothing to import.');
    outro('Import complete (no patches)');
    return;
  }

  // Count patches
  const patchCount = await countPatches(paths.patches);

  if (patchCount === 0) {
    info('No patch files found in patches/ directory.');
    outro('Import complete (no patches)');
    return;
  }

  info(`Found ${patchCount} patch${patchCount === 1 ? '' : 'es'} to apply`);

  const s = spinner('Applying patches...');

  try {
    const results = await applyPatches(paths.patches, paths.engine);

    const successful = results.filter((r) => r.success);
    const failed = results.find((r) => !r.success);

    if (failed) {
      s.error('Patch application failed');

      error(`Failed to apply: ${failed.patch.filename}`);
      if (failed.error) {
        error(failed.error);
      }

      throw new PatchError(
        `Failed to apply patch: ${failed.patch.filename}`,
        failed.patch.filename
      );
    }

    s.stop(`Applied ${successful.length} patch${successful.length === 1 ? '' : 'es'}`);

    // List applied patches
    for (const result of successful) {
      success(`  ${result.patch.filename}`);
    }

    outro('All patches applied successfully!');
  } catch (err) {
    if (!(err instanceof PatchError)) {
      s.error('Patch application failed');
    }
    throw err;
  }
}
