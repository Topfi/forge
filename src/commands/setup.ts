import * as p from '@clack/prompts';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { configExists, writeConfig, getProjectPaths } from '../core/config.js';
import { ensureDir, pathExists } from '../utils/fs.js';
import { intro, outro, spinner, cancel, isCancel } from '../utils/logger.js';
import type { ForgeConfig } from '../types/config.js';
import type { SetupOptions } from '../types/commands.js';
import {
  isValidAppId,
  isValidFirefoxVersion,
  isValidFirefoxProduct,
  inferProductFromVersion,
} from '../utils/validation.js';
import { InvalidArgumentError } from '../errors/base.js';
import { ConfigError } from '../errors/config.js';

/**
 * Gets the path to the templates directory.
 */
function getTemplatesDir(): string {
  const currentFile = fileURLToPath(import.meta.url);
  const srcDir = dirname(dirname(currentFile));
  const forgeRoot = dirname(srcDir);
  return join(forgeRoot, 'templates');
}

/**
 * Validates CLI-provided options and throws ForgeError if invalid.
 */
function validateCliOptions(options: SetupOptions): void {
  if (options.name !== undefined) {
    if (!options.name.trim()) {
      throw new InvalidArgumentError('Name is required', '--name');
    }
    if (options.name.length > 50) {
      throw new InvalidArgumentError('Name must be 50 characters or less', '--name');
    }
  }
  if (options.vendor !== undefined && !options.vendor.trim()) {
    throw new InvalidArgumentError('Vendor is required', '--vendor');
  }
  if (options.appId !== undefined && !isValidAppId(options.appId)) {
    throw new InvalidArgumentError(
      'Invalid app ID format (use reverse-domain: org.example.browser)',
      '--app-id'
    );
  }
  if (options.binaryName !== undefined && !/^[a-z][a-z0-9-]*$/.test(options.binaryName)) {
    throw new InvalidArgumentError(
      'Binary name must start with a letter and contain only lowercase letters, numbers, and hyphens',
      '--binary-name'
    );
  }
  if (options.firefoxVersion !== undefined && !isValidFirefoxVersion(options.firefoxVersion)) {
    throw new InvalidArgumentError(
      'Invalid Firefox version format (e.g., 146.0, 128.0esr, or 147.0b1)',
      '--firefox-version'
    );
  }
  if (options.product !== undefined && !isValidFirefoxProduct(options.product)) {
    throw new InvalidArgumentError(
      'Invalid product (use: firefox, firefox-esr, firefox-beta)',
      '--product'
    );
  }
}

/**
 * Runs the setup command.
 * @param projectRoot - Root directory for the project
 * @param options - CLI options for non-interactive mode
 */
export async function setupCommand(projectRoot: string, options: SetupOptions = {}): Promise<void> {
  // Validate any CLI-provided options first
  validateCliOptions(options);

  // Determine if we can run interactively
  const isInteractive = process.stdin.isTTY && process.stdout.isTTY;

  intro('Forge Setup');

  // Check if config already exists
  if (await configExists(projectRoot)) {
    if (options.force) {
      // Skip confirmation when --force is provided
    } else if (isInteractive) {
      const overwrite = await p.confirm({
        message: 'A forge.json already exists. Overwrite?',
        initialValue: false,
      });

      if (isCancel(overwrite) || !overwrite) {
        cancel('Setup cancelled');
        return;
      }
    } else {
      throw new ConfigError('forge.json already exists. Use --force to overwrite.');
    }
  }

  let finalName: string;
  let finalVendor: string;
  let finalAppId: string;
  let finalBinaryName: string;
  let finalFirefoxVersion: string;
  let finalProduct: 'firefox' | 'firefox-esr' | 'firefox-beta';

  if (
    options.name &&
    options.vendor &&
    options.appId &&
    options.binaryName &&
    options.firefoxVersion
  ) {
    // Full non-interactive mode - all values provided via CLI
    finalName = options.name;
    finalVendor = options.vendor;
    finalAppId = options.appId;
    finalBinaryName = options.binaryName;
    finalFirefoxVersion = options.firefoxVersion;
    // Use provided product, infer from version, or default to 'firefox'
    finalProduct = options.product ?? inferProductFromVersion(options.firefoxVersion) ?? 'firefox';
  } else if (!isInteractive) {
    // Non-interactive but missing required options
    throw new InvalidArgumentError(
      'Missing required options for non-interactive mode. Required: --name, --vendor, --app-id, --binary-name, --firefox-version'
    );
  } else {
    // Interactive mode - prompt for missing values only
    const project = await p.group(
      {
        name: () =>
          options.name
            ? Promise.resolve(options.name)
            : p.text({
                message: 'What is the name of your browser?',
                placeholder: 'MyBrowser',
                validate: (value) => {
                  if (!value.trim()) return 'Name is required';
                  if (value.length > 50) return 'Name must be 50 characters or less';
                  return undefined;
                },
              }),

        vendor: () =>
          options.vendor
            ? Promise.resolve(options.vendor)
            : p.text({
                message: 'What is your vendor/company name?',
                placeholder: 'My Company',
                validate: (value) => {
                  if (!value.trim()) return 'Vendor is required';
                  return undefined;
                },
              }),

        appId: ({ results }) =>
          options.appId
            ? Promise.resolve(options.appId)
            : p.text({
                message: 'Application ID (reverse-domain format)',
                placeholder: `org.${(results.name ?? 'browser').toLowerCase().replace(/[^a-z0-9]/g, '')}.browser`,
                validate: (value) => {
                  if (value && !isValidAppId(value)) {
                    return 'Must be in reverse-domain format (e.g., org.example.browser)';
                  }
                  return undefined;
                },
              }),

        binaryName: ({ results }) =>
          options.binaryName
            ? Promise.resolve(options.binaryName)
            : p.text({
                message: 'Binary name (executable name)',
                placeholder: (results.name ?? 'browser').toLowerCase().replace(/[^a-z0-9]/g, ''),
                validate: (value) => {
                  if (value && !/^[a-z][a-z0-9-]*$/.test(value)) {
                    return 'Must start with a letter and contain only lowercase letters, numbers, and hyphens';
                  }
                  return undefined;
                },
              }),

        firefoxVersion: () =>
          options.firefoxVersion
            ? Promise.resolve(options.firefoxVersion)
            : p.text({
                message: 'Firefox version to base on',
                placeholder: '146.0',
                validate: (value) => {
                  if (value && !isValidFirefoxVersion(value)) {
                    return 'Invalid Firefox version format (e.g., 146.0, 128.0esr, or 147.0b1)';
                  }
                  return undefined;
                },
              }),

        product: ({ results }) => {
          // If product was provided via CLI, use it
          if (options.product) {
            return Promise.resolve(options.product);
          }
          // Try to infer from version
          const inferredProduct = inferProductFromVersion(
            results.firefoxVersion ?? options.firefoxVersion ?? ''
          );
          if (inferredProduct) {
            return Promise.resolve(inferredProduct);
          }
          // Otherwise, prompt
          return p.select({
            message: 'Which Firefox product?',
            options: [
              { value: 'firefox', label: 'Firefox (stable releases)' },
              { value: 'firefox-esr', label: 'Firefox ESR (extended support)' },
              { value: 'firefox-beta', label: 'Firefox Beta (pre-release)' },
            ],
          });
        },
      },
      {
        onCancel: () => {
          cancel('Setup cancelled');
          process.exit(0);
        },
      }
    );

    // Apply defaults for empty inputs
    const sanitizedName = project.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    finalName = project.name;
    finalVendor = project.vendor;
    finalAppId = (project.appId as string).trim() || `org.${sanitizedName}.browser`;
    finalBinaryName = (project.binaryName as string).trim() || sanitizedName;
    finalFirefoxVersion = project.firefoxVersion.trim() || '146.0';
    finalProduct = project.product as 'firefox' | 'firefox-esr' | 'firefox-beta';
  }

  // Create configuration
  const config: ForgeConfig = {
    name: finalName,
    vendor: finalVendor,
    appId: finalAppId,
    binaryName: finalBinaryName,
    firefox: {
      version: finalFirefoxVersion,
      product: finalProduct,
    },
    build: {
      jobs: 8,
    },
  };

  const s = spinner('Creating project structure...');

  try {
    const paths = getProjectPaths(projectRoot);

    // Create directories
    await ensureDir(paths.patches);
    await ensureDir(paths.configs);
    await ensureDir(paths.forgeDir);

    // Write configuration
    await writeConfig(projectRoot, config);

    // Create root package.json to mark as private project
    const rootPackageJsonPath = join(projectRoot, 'package.json');
    if (!(await pathExists(rootPackageJsonPath))) {
      const { writeText } = await import('../utils/fs.js');
      const rootPackageJson = {
        private: true,
      };
      await writeText(rootPackageJsonPath, JSON.stringify(rootPackageJson, null, 2) + '\n');
    }

    // Copy mozconfig templates
    const templatesDir = getTemplatesDir();
    const configsTemplateDir = join(templatesDir, 'configs');

    if (await pathExists(configsTemplateDir)) {
      const configFiles = [
        'common.mozconfig',
        'darwin.mozconfig',
        'linux.mozconfig',
        'win32.mozconfig',
      ];

      for (const file of configFiles) {
        const srcPath = join(configsTemplateDir, file);
        const destPath = join(paths.configs, file);

        if (await pathExists(srcPath)) {
          // Read template and replace variables
          const { readText, writeText } = await import('../utils/fs.js');
          let content = await readText(srcPath);

          content = content
            .replace(/\$\{name\}/g, config.name)
            .replace(/\$\{vendor\}/g, config.vendor)
            .replace(/\$\{appId\}/g, config.appId)
            .replace(/\$\{binaryName\}/g, config.binaryName);

          await writeText(destPath, content);
        }
      }
    }

    s.stop('Project structure created');

    // Show next steps
    p.note(
      `Next steps:\n` +
        `  1. ./forge/forge download    # Download Firefox source\n` +
        `  2. ./forge/forge bootstrap   # Install build dependencies\n` +
        `  3. ./forge/forge build       # Build the browser\n` +
        `  4. ./forge/forge run         # Launch the browser`,
      'Getting Started'
    );

    outro(`${config.name} project created successfully!`);
  } catch (error) {
    s.error('Failed to create project');
    throw error;
  }
}
