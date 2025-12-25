import { Command } from 'commander';
import { resolve } from 'node:path';
import { setupCommand } from './commands/setup.js';
import { downloadCommand } from './commands/download.js';
import { bootstrapCommand } from './commands/bootstrap.js';
import { importCommand } from './commands/import.js';
import { buildCommand } from './commands/build.js';
import { runCommand } from './commands/run.js';
import { statusCommand } from './commands/status.js';
import { resetCommand } from './commands/reset.js';
import { discardCommand } from './commands/discard.js';
import { exportCommand } from './commands/export.js';
import { exportAllCommand } from './commands/export-all.js';
import { packageCommand } from './commands/package.js';
import { watchCommand } from './commands/watch.js';
import { configCommand } from './commands/config.js';
import { doctorCommand } from './commands/doctor.js';
import { ForgeError } from './errors/base.js';
import { ExitCode } from './errors/codes.js';
import { error as logError, cancel, setVerbose } from './utils/logger.js';

/**
 * Gets the project root directory.
 * Defaults to current working directory.
 */
function getProjectRoot(): string {
  return resolve(process.cwd());
}

/**
 * Wraps a command handler with error handling.
 */
function withErrorHandling<T extends unknown[]>(
  handler: (...args: T) => Promise<void>
): (...args: T) => Promise<void> {
  return async (...args: T) => {
    try {
      await handler(...args);
    } catch (err) {
      if (err instanceof ForgeError) {
        logError(err.userMessage);
        process.exit(err.code);
      }

      // Handle user cancellation
      if (err instanceof Error && err.message.includes('cancelled')) {
        cancel('Operation cancelled');
        process.exit(ExitCode.GENERAL_ERROR);
      }

      // Unknown error
      logError(`Unexpected error: ${err instanceof Error ? err.message : String(err)}`);
      if (err instanceof Error && err.stack) {
        console.error(err.stack);
      }
      process.exit(ExitCode.GENERAL_ERROR);
    }
  };
}

/**
 * Creates and configures the CLI program.
 */
export function createProgram(): Command {
  const program = new Command();

  program
    .name('forge')
    .description('A build tool for customizing Firefox')
    .version('0.1.0')
    .option('-v, --verbose', 'Enable debug output')
    .hook('preAction', (thisCommand) => {
      const opts = thisCommand.opts();
      if (opts['verbose']) {
        setVerbose(true);
      }
    });

  // Setup command
  program
    .command('setup')
    .description('Initialize a new Forge project')
    .option('--name <name>', 'Browser name')
    .option('--vendor <vendor>', 'Vendor/company name')
    .option('--app-id <appId>', 'Application ID (reverse-domain format)')
    .option('--binary-name <binaryName>', 'Binary name (executable name)')
    .option('--firefox-version <version>', 'Firefox version to base on')
    .option('-f, --force', 'Overwrite existing configuration without prompting')
    .action(
      withErrorHandling(
        async (options: {
          name?: string;
          vendor?: string;
          appId?: string;
          binaryName?: string;
          firefoxVersion?: string;
          force?: boolean;
        }) => {
          await setupCommand(getProjectRoot(), {
            ...(options.name !== undefined ? { name: options.name } : {}),
            ...(options.vendor !== undefined ? { vendor: options.vendor } : {}),
            ...(options.appId !== undefined ? { appId: options.appId } : {}),
            ...(options.binaryName !== undefined ? { binaryName: options.binaryName } : {}),
            ...(options.firefoxVersion !== undefined
              ? { firefoxVersion: options.firefoxVersion }
              : {}),
            ...(options.force !== undefined ? { force: options.force } : {}),
          });
        }
      )
    );

  // Download command
  program
    .command('download')
    .description('Download Firefox source')
    .option('-f, --force', 'Force re-download, removing existing source')
    .action(
      withErrorHandling(async (options: { force?: boolean }) => {
        await downloadCommand(getProjectRoot(), {
          ...(options.force !== undefined ? { force: options.force } : {}),
        });
      })
    );

  // Bootstrap command
  program
    .command('bootstrap')
    .description('Install Firefox build dependencies')
    .action(
      withErrorHandling(async () => {
        await bootstrapCommand(getProjectRoot());
      })
    );

  // Import command
  program
    .command('import')
    .description('Apply patches from the patches directory')
    .action(
      withErrorHandling(async () => {
        await importCommand(getProjectRoot());
      })
    );

  // Build command
  program
    .command('build')
    .description('Build the browser')
    .option('--ui', 'Fast UI-only rebuild')
    .option('-j, --jobs <n>', 'Number of parallel jobs', parseInt)
    .option('--brand <name>', 'Build specific brand')
    .action(
      withErrorHandling(async (options: { ui?: boolean; jobs?: number; brand?: string }) => {
        await buildCommand(getProjectRoot(), {
          ...(options.ui !== undefined ? { ui: options.ui } : {}),
          ...(options.jobs !== undefined ? { jobs: options.jobs } : {}),
          ...(options.brand !== undefined ? { brand: options.brand } : {}),
        });
      })
    );

  // Run command
  program
    .command('run')
    .description('Launch the built browser')
    .action(
      withErrorHandling(async () => {
        await runCommand(getProjectRoot());
      })
    );

  // Status command
  program
    .command('status')
    .description('Show modified files in engine/')
    .action(
      withErrorHandling(async () => {
        await statusCommand(getProjectRoot());
      })
    );

  // Reset command
  program
    .command('reset')
    .description('Reset engine/ to clean state')
    .option('-f, --force', 'Skip confirmation prompt (required for scripts/CI)')
    .action(
      withErrorHandling(async (options: { force?: boolean }) => {
        await resetCommand(getProjectRoot(), {
          ...(options.force !== undefined ? { force: options.force } : {}),
        });
      })
    );

  // Discard command
  program
    .command('discard <file>')
    .description('Discard changes to a specific file')
    .action(
      withErrorHandling(async (file: string) => {
        await discardCommand(getProjectRoot(), file);
      })
    );

  // Export command
  program
    .command('export <file>')
    .description('Export file changes as a patch')
    .option('-n, --name <name>', 'Name for the patch')
    .action(
      withErrorHandling(async (file: string, options: { name?: string }) => {
        await exportCommand(getProjectRoot(), file, {
          ...(options.name !== undefined ? { name: options.name } : {}),
        });
      })
    );

  // Export-all command
  program
    .command('export-all')
    .description('Export all changes as a patch')
    .option('--name <name>', 'Name for the patch')
    .action(
      withErrorHandling(async (options: { name?: string }) => {
        await exportAllCommand(getProjectRoot(), {
          ...(options.name !== undefined ? { name: options.name } : {}),
        });
      })
    );

  // Package command
  program
    .command('package')
    .description('Create distribution package')
    .option('--brand <name>', 'Package specific brand')
    .action(
      withErrorHandling(async (options: { brand?: string }) => {
        await packageCommand(getProjectRoot(), {
          ...(options.brand !== undefined ? { brand: options.brand } : {}),
        });
      })
    );

  // Watch command
  program
    .command('watch')
    .description('Watch for changes and auto-rebuild')
    .action(
      withErrorHandling(async () => {
        await watchCommand(getProjectRoot());
      })
    );

  // Config command
  program
    .command('config <key> [value]')
    .description('Get or set configuration values')
    .action(
      withErrorHandling(async (key: string, value?: string) => {
        await configCommand(getProjectRoot(), key, value);
      })
    );

  // Doctor command
  program
    .command('doctor')
    .description('Diagnose project issues')
    .action(
      withErrorHandling(async () => {
        await doctorCommand(getProjectRoot());
      })
    );

  return program;
}

/**
 * Main entry point.
 */
export async function main(): Promise<void> {
  const program = createProgram();
  await program.parseAsync(process.argv);
}
