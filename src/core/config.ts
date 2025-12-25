import { join } from 'node:path';
import type { ForgeConfig, ForgeState, ProjectPaths } from '../types/config.js';
import { pathExists, readJson, writeJson } from '../utils/fs.js';
import {
  isObject,
  isString,
  isValidFirefoxVersion,
  isValidAppId,
  isNumber,
} from '../utils/validation.js';

/** Name of the configuration file */
export const CONFIG_FILENAME = 'forge.json';

/** Name of the forge data directory */
export const FORGE_DIR = '.forge';

/** Name of the state file */
export const STATE_FILENAME = 'state.json';

/** Name of the engine directory */
export const ENGINE_DIR = 'engine';

/** Name of the patches directory */
export const PATCHES_DIR = 'patches';

/** Name of the configs directory */
export const CONFIGS_DIR = 'configs';

/** Name of the source directory */
export const SRC_DIR = 'src';

/**
 * Gets all project paths based on a root directory.
 * @param root - Root directory of the project
 * @returns All project paths
 */
export function getProjectPaths(root: string): ProjectPaths {
  const forgeDir = join(root, FORGE_DIR);
  return {
    root,
    config: join(root, CONFIG_FILENAME),
    forgeDir,
    state: join(forgeDir, STATE_FILENAME),
    engine: join(root, ENGINE_DIR),
    patches: join(root, PATCHES_DIR),
    configs: join(root, CONFIGS_DIR),
    src: join(root, SRC_DIR),
  };
}

/**
 * Checks if a forge.json exists in the given directory.
 * @param root - Root directory to check
 * @returns True if forge.json exists
 */
export async function configExists(root: string): Promise<boolean> {
  const paths = getProjectPaths(root);
  return pathExists(paths.config);
}

/**
 * Validates a raw config object and returns a typed ForgeConfig.
 * @param data - Raw data to validate
 * @returns Validated ForgeConfig
 * @throws Error if validation fails
 */
export function validateConfig(data: unknown): ForgeConfig {
  if (!isObject(data)) {
    throw new Error('Config must be an object');
  }

  // Validate required string fields
  const requiredStrings = ['name', 'vendor', 'appId', 'binaryName'] as const;
  for (const field of requiredStrings) {
    if (!isString(data[field])) {
      throw new Error(`Config field "${field}" must be a string`);
    }
  }

  // Validate appId format
  if (!isValidAppId(data['appId'] as string)) {
    throw new Error(
      'Config field "appId" must be a valid reverse-domain identifier (e.g., "org.example.browser")'
    );
  }

  // Validate firefox config
  if (!isObject(data['firefox'])) {
    throw new Error('Config field "firefox" must be an object');
  }

  const firefox = data['firefox'];
  if (!isString(firefox['version'])) {
    throw new Error('Config field "firefox.version" must be a string');
  }

  if (!isValidFirefoxVersion(firefox['version'])) {
    throw new Error(
      'Config field "firefox.version" must be a valid Firefox version (e.g., "145.0")'
    );
  }

  if (!isString(firefox['product'])) {
    throw new Error('Config field "firefox.product" must be a string');
  }

  const validProducts = ['firefox', 'firefox-esr', 'firefox-beta'];
  if (!validProducts.includes(firefox['product'])) {
    throw new Error(`Config field "firefox.product" must be one of: ${validProducts.join(', ')}`);
  }

  // Validate optional build config
  if (data['build'] !== undefined) {
    if (!isObject(data['build'])) {
      throw new Error('Config field "build" must be an object');
    }
    const build = data['build'];
    if (build['jobs'] !== undefined && !isNumber(build['jobs'])) {
      throw new Error('Config field "build.jobs" must be a number');
    }
  }

  return data as unknown as ForgeConfig;
}

/**
 * Loads and validates the forge.json configuration.
 * @param root - Root directory of the project
 * @returns Validated ForgeConfig
 * @throws Error if config doesn't exist or is invalid
 */
export async function loadConfig(root: string): Promise<ForgeConfig> {
  const paths = getProjectPaths(root);

  if (!(await pathExists(paths.config))) {
    throw new Error(
      `Configuration file not found: ${paths.config}\n\n` +
        'Run "./forge/forge setup" to create a new project configuration.'
    );
  }

  const data = await readJson<unknown>(paths.config);
  return validateConfig(data);
}

/**
 * Writes a configuration to forge.json.
 * @param root - Root directory of the project
 * @param config - Configuration to write
 */
export async function writeConfig(root: string, config: ForgeConfig): Promise<void> {
  const paths = getProjectPaths(root);
  await writeJson(paths.config, config);
}

/**
 * Loads the forge state, or returns defaults if it doesn't exist.
 * @param root - Root directory of the project
 * @returns Forge state
 */
export async function loadState(root: string): Promise<ForgeState> {
  const paths = getProjectPaths(root);

  if (!(await pathExists(paths.state))) {
    return {};
  }

  try {
    return await readJson<ForgeState>(paths.state);
  } catch {
    // Return empty state if file is corrupted
    return {};
  }
}

/**
 * Saves the forge state.
 * @param root - Root directory of the project
 * @param state - State to save
 */
export async function saveState(root: string, state: ForgeState): Promise<void> {
  const paths = getProjectPaths(root);
  await writeJson(paths.state, state);
}

/**
 * Updates specific fields in the forge state.
 * @param root - Root directory of the project
 * @param updates - Fields to update
 */
export async function updateState(root: string, updates: Partial<ForgeState>): Promise<void> {
  const current = await loadState(root);
  await saveState(root, { ...current, ...updates });
}
