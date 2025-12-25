import { loadConfig, getProjectPaths, configExists } from '../core/config.js';
import { ensureGit, isGitRepository } from '../core/git.js';
import { ensurePython, ensureMach } from '../core/mach.js';
import { countPatches } from '../core/patches.js';
import { pathExists } from '../utils/fs.js';
import { intro, outro, info, success, error, warn } from '../utils/logger.js';
import type { DoctorCheck } from '../types/commands.js';

/**
 * Runs a doctor check and returns the result.
 */
async function runCheck(
  name: string,
  check: () => void | Promise<void>,
  fix?: string
): Promise<DoctorCheck> {
  try {
    await check();
    return { name, passed: true, message: 'OK' };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const result: DoctorCheck = { name, passed: false, message };
    if (fix !== undefined) {
      result.fix = fix;
    }
    return result;
  }
}

/**
 * Runs the doctor command to diagnose issues.
 * @param projectRoot - Root directory of the project
 */
export async function doctorCommand(projectRoot: string): Promise<void> {
  intro('Forge Doctor');

  const checks: DoctorCheck[] = [];
  const paths = getProjectPaths(projectRoot);

  // Check 1: Git installed
  checks.push(
    await runCheck(
      'Git installed',
      async () => {
        await ensureGit();
      },
      'Install git from https://git-scm.com/'
    )
  );

  // Check 2: Python 3.11 installed
  checks.push(
    await runCheck(
      'Python 3.11 installed',
      async () => {
        await ensurePython();
      },
      'Install Python 3.11 from https://python.org/'
    )
  );

  // Check 3: forge.json exists
  checks.push(
    await runCheck(
      'forge.json exists',
      async () => {
        if (!(await configExists(projectRoot))) {
          throw new Error('forge.json not found');
        }
      },
      'Run "./forge/forge setup" to create a project'
    )
  );

  // Check 4: forge.json is valid
  checks.push(
    await runCheck(
      'forge.json is valid',
      async () => {
        await loadConfig(projectRoot);
      },
      'Check forge.json for syntax errors or missing fields'
    )
  );

  // Check 5: Engine directory exists
  const engineExists = await pathExists(paths.engine);
  checks.push(
    await runCheck(
      'Engine directory exists',
      () => {
        if (!engineExists) {
          throw new Error('engine/ directory not found');
        }
      },
      'Run "./forge/forge download" to download Firefox source'
    )
  );

  // Check 6: Engine is a git repository
  if (engineExists) {
    checks.push(
      await runCheck(
        'Engine is git repository',
        async () => {
          if (!(await isGitRepository(paths.engine))) {
            throw new Error('engine/ is not a git repository');
          }
        },
        'Run "./forge/forge download --force" to reinitialize'
      )
    );

    // Check 7: mach available
    checks.push(
      await runCheck(
        'mach available',
        async () => {
          await ensureMach(paths.engine);
        },
        'Firefox source may be corrupted. Re-download with "./forge/forge download --force"'
      )
    );
  }

  // Check 8: Patches directory exists
  const patchesExist = await pathExists(paths.patches);
  checks.push({
    name: 'Patches directory exists',
    passed: patchesExist,
    message: patchesExist ? 'OK' : 'No patches/ directory (optional)',
  });

  // Check 9: Patch count
  if (patchesExist) {
    const patchCount = await countPatches(paths.patches);
    checks.push({
      name: 'Patches found',
      passed: true,
      message: `${patchCount} patch${patchCount === 1 ? '' : 'es'} found`,
    });
  }

  // Check 10: Configs directory exists
  const configsExist = await pathExists(paths.configs);
  checks.push(
    await runCheck(
      'Configs directory exists',
      () => {
        if (!configsExist) {
          throw new Error('configs/ directory not found');
        }
      },
      'Run "./forge/forge setup" to create configs'
    )
  );

  // Display results
  info('');

  let passedCount = 0;
  let failedCount = 0;

  for (const check of checks) {
    if (check.passed) {
      success(`✓ ${check.name}: ${check.message}`);
      passedCount++;
    } else {
      error(`✗ ${check.name}: ${check.message}`);
      if (check.fix) {
        warn(`  Fix: ${check.fix}`);
      }
      failedCount++;
    }
  }

  info('');

  if (failedCount === 0) {
    outro(`All ${passedCount} checks passed!`);
  } else {
    outro(`${passedCount} passed, ${failedCount} failed`);
  }
}
