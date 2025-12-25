import { join } from 'node:path';
import { readText, writeText, pathExists, copyDir } from '../utils/fs.js';
import { ForgeError } from '../errors/base.js';
import { ExitCode } from '../errors/codes.js';

/**
 * Error thrown when branding operations fail.
 */
export class BrandingError extends ForgeError {
  readonly code = ExitCode.PATCH_ERROR;

  override get userMessage(): string {
    return `Branding Error: ${this.message}\n\nBranding is required to set MOZ_APP_VENDOR, MOZ_MACBUNDLE_ID, and other Firefox identity values.`;
  }
}

/**
 * Full branding configuration.
 */
export interface BrandingConfig {
  /** Display name (e.g., "MyBrowser") */
  name: string;
  /** Vendor name (e.g., "My Company") */
  vendor: string;
  /** Application ID in reverse-domain format (e.g., "org.mybrowser.browser") */
  appId: string;
  /** Binary/branding directory name (e.g., "mybrowser") */
  binaryName: string;
}

/**
 * Sets up the custom branding directory for the browser.
 *
 * This creates a branding directory based on Firefox's unofficial branding,
 * with customized values for:
 * - configure.sh: MOZ_APP_DISPLAYNAME, MOZ_MACBUNDLE_ID
 * - brand.properties: brandShorterName, brandShortName, brandFullName
 * - brand.ftl: -brand-shorter-name, -brand-short-name, etc.
 *
 * @param engineDir - Path to the engine directory
 * @param config - Branding configuration
 */
export async function setupBranding(engineDir: string, config: BrandingConfig): Promise<void> {
  const brandingDir = join(engineDir, 'browser', 'branding', config.binaryName);
  const unofficialDir = join(engineDir, 'browser', 'branding', 'unofficial');

  // Check if unofficial branding exists as our base
  if (!(await pathExists(unofficialDir))) {
    throw new BrandingError(`Unofficial branding directory not found at ${unofficialDir}`);
  }

  // Copy unofficial branding as base (if our branding doesn't exist yet)
  if (!(await pathExists(brandingDir))) {
    await copyDir(unofficialDir, brandingDir);
  }

  // Create/update configure.sh with custom values
  await createConfigureScript(brandingDir, config);

  // Update localization files
  await updateBrandProperties(brandingDir, config);
  await updateBrandFtl(brandingDir, config);

  // Patch moz.configure for MOZ_APP_VENDOR
  await patchMozConfigure(engineDir, config);
}

/**
 * Creates the branding configure.sh script.
 */
async function createConfigureScript(brandingDir: string, config: BrandingConfig): Promise<void> {
  const configureShPath = join(brandingDir, 'configure.sh');

  const content = `# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

MOZ_APP_DISPLAYNAME="${config.name}"
MOZ_MACBUNDLE_ID="${config.appId}"
`;

  await writeText(configureShPath, content);
}

/**
 * Updates the brand.properties localization file.
 */
async function updateBrandProperties(brandingDir: string, config: BrandingConfig): Promise<void> {
  const propsPath = join(brandingDir, 'locales', 'en-US', 'brand.properties');

  if (!(await pathExists(propsPath))) {
    return; // Skip if file doesn't exist
  }

  const content = `# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

brandShorterName=${config.name}
brandShortName=${config.name}
brandFullName=${config.name}
`;

  await writeText(propsPath, content);
}

/**
 * Updates the brand.ftl localization file.
 */
async function updateBrandFtl(brandingDir: string, config: BrandingConfig): Promise<void> {
  const ftlPath = join(brandingDir, 'locales', 'en-US', 'brand.ftl');

  if (!(await pathExists(ftlPath))) {
    return; // Skip if file doesn't exist
  }

  const content = `# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

## Brand names
##
## These brand names can be used in messages.

-brand-shorter-name = ${config.name}
-brand-short-name = ${config.name}
-brand-shortcut-name = ${config.name}
-brand-full-name = ${config.name}
-brand-product-name = ${config.name}
-vendor-short-name = ${config.vendor}
trademarkInfo = { " " }
`;

  await writeText(ftlPath, content);
}

/**
 * Patches browser/moz.configure to set custom vendor.
 *
 * Mozilla's build system requires MOZ_APP_VENDOR to be set via imply_option
 * in moz.configure, not through mozconfig.
 */
async function patchMozConfigure(engineDir: string, config: BrandingConfig): Promise<void> {
  const mozConfigurePath = join(engineDir, 'browser', 'moz.configure');

  if (!(await pathExists(mozConfigurePath))) {
    throw new BrandingError(`browser/moz.configure not found at ${mozConfigurePath}`);
  }

  let content = await readText(mozConfigurePath);

  // Replace MOZ_APP_VENDOR imply_option
  const vendorRegex = /imply_option\("MOZ_APP_VENDOR",\s*"[^"]*"\)/;
  if (!vendorRegex.test(content)) {
    throw new BrandingError('Could not find MOZ_APP_VENDOR imply_option in browser/moz.configure');
  }
  content = content.replace(
    vendorRegex,
    `imply_option("MOZ_APP_VENDOR", "${escapeString(config.vendor)}")`
  );

  await writeText(mozConfigurePath, content);
}

/**
 * Escapes a string for use in Python/configure file.
 */
function escapeString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/**
 * Checks if branding has been set up for the given configuration.
 *
 * @param engineDir - Path to the engine directory
 * @param config - Branding configuration to check for
 * @returns true if branding is already set up
 */
export async function isBrandingSetup(engineDir: string, config: BrandingConfig): Promise<boolean> {
  const brandingDir = join(engineDir, 'browser', 'branding', config.binaryName);
  const configureShPath = join(brandingDir, 'configure.sh');

  // Check if our branding directory exists with configure.sh
  if (!(await pathExists(configureShPath))) {
    return false;
  }

  // Check if configure.sh has our app ID
  const content = await readText(configureShPath);
  return content.includes(`MOZ_MACBUNDLE_ID="${config.appId}"`);
}
