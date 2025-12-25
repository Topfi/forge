import { join } from 'node:path';
import { readdir } from 'node:fs/promises';
import { exec, execInherit, executableExists } from '../utils/process.js';
import { pathExists, readText, writeText } from '../utils/fs.js';
import { getPlatform } from '../utils/platform.js';
import { MachNotFoundError, PythonNotFoundError, MozconfigError } from '../errors/build.js';
import type { ForgeConfig } from '../types/config.js';

/** Python executable to use for mach */
const PYTHON = 'python3.11';

/**
 * Ensures python3.11 is available.
 * @throws PythonNotFoundError if python3.11 is not installed
 */
export async function ensurePython(): Promise<void> {
  if (!(await executableExists(PYTHON))) {
    throw new PythonNotFoundError();
  }
}

/**
 * Ensures mach is available in the engine directory.
 * @param engineDir - Path to the engine directory
 * @throws MachNotFoundError if mach is not found
 */
export async function ensureMach(engineDir: string): Promise<void> {
  const machPath = join(engineDir, 'mach');

  if (!(await pathExists(machPath))) {
    throw new MachNotFoundError(engineDir);
  }
}

/**
 * Options for running mach commands.
 */
export interface MachOptions {
  /** Additional environment variables */
  env?: Record<string, string>;
  /** Whether to inherit stdio (show output directly) */
  inherit?: boolean;
}

/**
 * Runs a mach command in the engine directory.
 * @param args - mach command and arguments
 * @param engineDir - Path to the engine directory
 * @param options - Command options
 * @returns Exit code
 */
export async function runMach(
  args: string[],
  engineDir: string,
  options: MachOptions = {}
): Promise<number> {
  await ensurePython();
  await ensureMach(engineDir);

  const machPath = join(engineDir, 'mach');

  const execOptions = {
    cwd: engineDir,
    ...(options.env ? { env: options.env } : {}),
  };

  if (options.inherit) {
    return execInherit(PYTHON, [machPath, ...args], execOptions);
  }

  const result = await exec(PYTHON, [machPath, ...args], execOptions);

  return result.exitCode;
}

/**
 * Runs mach bootstrap to install build dependencies.
 * @param engineDir - Path to the engine directory
 * @returns Exit code
 */
export async function bootstrap(engineDir: string): Promise<number> {
  return runMach(['bootstrap', '--application-choice', 'browser'], engineDir, { inherit: true });
}

/**
 * Runs a full mach build.
 * @param engineDir - Path to the engine directory
 * @param jobs - Number of parallel jobs (optional)
 * @returns Exit code
 */
export async function build(engineDir: string, jobs?: number): Promise<number> {
  const args = ['build'];

  if (jobs !== undefined) {
    args.push('-j', String(jobs));
  }

  return runMach(args, engineDir, { inherit: true });
}

/**
 * Runs a fast UI-only build.
 * @param engineDir - Path to the engine directory
 * @returns Exit code
 */
export async function buildUI(engineDir: string): Promise<number> {
  return runMach(['build', 'faster'], engineDir, { inherit: true });
}

/**
 * Runs the built browser.
 * @param engineDir - Path to the engine directory
 * @param args - Additional arguments to pass to the browser
 * @returns Exit code
 */
export async function run(engineDir: string, args: string[] = []): Promise<number> {
  return runMach(['run', ...args], engineDir, { inherit: true });
}

/**
 * Creates a distribution package.
 * @param engineDir - Path to the engine directory
 * @returns Exit code
 */
export async function machPackage(engineDir: string): Promise<number> {
  return runMach(['package'], engineDir, { inherit: true });
}

/**
 * Runs mach watch for auto-rebuilding.
 * @param engineDir - Path to the engine directory
 * @returns Exit code
 */
export async function watch(engineDir: string): Promise<number> {
  return runMach(['watch'], engineDir, { inherit: true });
}

/**
 * Result of checking for build artifacts.
 */
export interface BuildArtifactCheck {
  /** Whether build artifacts exist */
  exists: boolean;
  /** Name of the obj-* directory if found */
  objDir?: string;
}

/**
 * Checks if build artifacts exist in the engine directory.
 * Looks for obj-* directories with a dist subdirectory.
 * @param engineDir - Path to the engine directory
 * @returns Build artifact check result
 */
export async function hasBuildArtifacts(engineDir: string): Promise<BuildArtifactCheck> {
  try {
    const entries = await readdir(engineDir);
    const objDirs = entries.filter((e) => e.startsWith('obj-'));

    // Find first obj-* directory
    const objDir = objDirs[0];
    if (!objDir) {
      return { exists: false };
    }

    // Check if the obj directory has meaningful content (dist folder)
    const distPath = join(engineDir, objDir, 'dist');
    const hasContent = await pathExists(distPath);

    if (hasContent) {
      return { exists: true, objDir };
    }
    return { exists: false, objDir };
  } catch {
    return { exists: false };
  }
}

/**
 * Template variables for mozconfig generation.
 */
export interface MozconfigVariables {
  name: string;
  vendor: string;
  appId: string;
  binaryName: string;
}

/**
 * Replaces template variables in a string.
 * @param content - Content with ${variable} placeholders
 * @param variables - Variables to substitute
 * @returns Content with variables replaced
 */
function replaceVariables(content: string, variables: MozconfigVariables): string {
  return content
    .replace(/\$\{name\}/g, variables.name)
    .replace(/\$\{vendor\}/g, variables.vendor)
    .replace(/\$\{appId\}/g, variables.appId)
    .replace(/\$\{binaryName\}/g, variables.binaryName);
}

/**
 * Generates a mozconfig file from templates.
 * @param configsDir - Path to the configs directory
 * @param engineDir - Path to the engine directory
 * @param config - Forge configuration
 */
export async function generateMozconfig(
  configsDir: string,
  engineDir: string,
  config: ForgeConfig
): Promise<void> {
  const platform = getPlatform();
  const commonPath = join(configsDir, 'common.mozconfig');
  const platformPath = join(configsDir, `${platform}.mozconfig`);
  const outputPath = join(engineDir, 'mozconfig');

  const variables: MozconfigVariables = {
    name: config.name,
    vendor: config.vendor,
    appId: config.appId,
    binaryName: config.binaryName,
  };

  let content = '';

  // Read common config if it exists
  if (await pathExists(commonPath)) {
    const commonContent = await readText(commonPath);
    content += `# Common configuration\n${replaceVariables(commonContent, variables)}\n\n`;
  }

  // Read platform-specific config
  if (!(await pathExists(platformPath))) {
    throw new MozconfigError(`Platform mozconfig not found: ${platformPath}`);
  }

  const platformContent = await readText(platformPath);
  content += `# Platform configuration (${platform})\n${replaceVariables(platformContent, variables)}`;

  await writeText(outputPath, content);
}
