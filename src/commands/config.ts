import { loadConfig, writeConfig, configExists } from '../core/config.js';
import { intro, outro, info, error, success } from '../utils/logger.js';
import { GeneralError } from '../errors/base.js';
import type { ForgeConfig } from '../types/config.js';

/**
 * Gets a nested value from an object using dot notation.
 * @param obj - Object to traverse
 * @param path - Dot-separated path (e.g., "firefox.version")
 * @returns The value at the path, or undefined if not found
 */
function getNestedValue(obj: unknown, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Sets a nested value in an object using dot notation.
 * @param obj - Object to modify
 * @param path - Dot-separated path
 * @param value - Value to set
 */
function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.');
  let current: Record<string, unknown> = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (part === undefined) continue;

    if (current[part] === undefined || typeof current[part] !== 'object') {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }

  const lastPart = parts[parts.length - 1];
  if (lastPart !== undefined) {
    current[lastPart] = value;
  }
}

/**
 * Parses a string value into the appropriate type.
 */
function parseValue(value: string): unknown {
  // Try to parse as JSON first (handles numbers, booleans, arrays, objects)
  try {
    return JSON.parse(value);
  } catch {
    // Fall back to string
    return value;
  }
}

/**
 * Formats a value for display.
 */
function formatValue(value: unknown): string {
  if (value === undefined) {
    return '(not set)';
  }
  if (value === null || typeof value === 'object' || typeof value === 'function') {
    return JSON.stringify(value, null, 2);
  }
  return String(value as string | number | boolean | bigint | symbol);
}

/**
 * Runs the config command to get or set configuration values.
 * @param projectRoot - Root directory of the project
 * @param key - Configuration key (dot notation)
 * @param value - Optional value to set
 */
export async function configCommand(
  projectRoot: string,
  key: string,
  value?: string
): Promise<void> {
  intro('Forge Config');

  // Check if config exists
  if (!(await configExists(projectRoot))) {
    throw new GeneralError('No forge.json found. Run "./forge/forge setup" to create a project.');
  }

  const config = await loadConfig(projectRoot);

  if (value === undefined) {
    // Get mode
    const currentValue = getNestedValue(config, key);

    if (currentValue === undefined) {
      error(`Configuration key "${key}" not found`);
      info('\nAvailable top-level keys:');
      for (const k of Object.keys(config)) {
        info(`  ${k}`);
      }
    } else {
      info(`${key} = ${formatValue(currentValue)}`);
    }
  } else {
    // Set mode
    const parsedValue = parseValue(value);

    // Create a mutable copy
    const mutableConfig = JSON.parse(JSON.stringify(config)) as Record<string, unknown>;
    setNestedValue(mutableConfig, key, parsedValue);

    // Write back
    await writeConfig(projectRoot, mutableConfig as unknown as ForgeConfig);
    success(`Set ${key} = ${formatValue(parsedValue)}`);
  }

  outro('');
}
