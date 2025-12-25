/**
 * Type guards and validation utilities.
 * Used to safely narrow types from unknown values.
 */

/**
 * Checks if a value is a string.
 */
export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

/**
 * Checks if a value is a number.
 */
export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !Number.isNaN(value);
}

/**
 * Checks if a value is a boolean.
 */
export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

/**
 * Checks if a value is a non-null object.
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Checks if a value is an array.
 */
export function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

/**
 * Asserts that a value is a string or throws.
 * @param value - Value to check
 * @param name - Name of the field for error messages
 */
export function assertString(value: unknown, name: string): asserts value is string {
  if (!isString(value)) {
    throw new Error(`Expected ${name} to be a string, got ${typeof value}`);
  }
}

/**
 * Asserts that a value is a non-null object or throws.
 * @param value - Value to check
 * @param name - Name of the field for error messages
 */
export function assertObject(
  value: unknown,
  name: string
): asserts value is Record<string, unknown> {
  if (!isObject(value)) {
    throw new Error(`Expected ${name} to be an object, got ${typeof value}`);
  }
}

/**
 * Validates a Firefox version string.
 * Accepts formats like "146.0", "146.0.1", "140.0esr", "147.0b1"
 */
export function isValidFirefoxVersion(version: string): boolean {
  // Stable/ESR: 146.0, 146.0.1, 140.0esr, 128.0.1esr
  // Beta: 147.0b1, 147.0b2
  return /^\d+\.\d+(b\d+)?(\.\d+)?(esr)?$/.test(version);
}

/**
 * Validates a Firefox product string.
 * Accepts: firefox, firefox-esr, firefox-beta
 */
export function isValidFirefoxProduct(product: string): boolean {
  return ['firefox', 'firefox-esr', 'firefox-beta'].includes(product);
}

/**
 * Infers the Firefox product type from a version string.
 * Returns undefined if no clear inference can be made.
 */
export function inferProductFromVersion(
  version: string
): 'firefox' | 'firefox-esr' | 'firefox-beta' | undefined {
  if (version.toLowerCase().includes('esr')) {
    return 'firefox-esr';
  }
  if (/b\d+/.test(version)) {
    return 'firefox-beta';
  }
  return undefined;
}

/**
 * Validates an application ID string.
 * Accepts reverse-domain format like "org.example.browser"
 */
export function isValidAppId(appId: string): boolean {
  return /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/i.test(appId);
}

/**
 * Checks if a value is defined (not undefined or null).
 */
export function isDefined<T>(value: T | undefined | null): value is T {
  return value !== undefined && value !== null;
}
