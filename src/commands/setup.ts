import * as p from '@clack/prompts';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { configExists, writeConfig, getProjectPaths } from '../core/config.js';
import { ensureDir, pathExists } from '../utils/fs.js';
import { intro, outro, spinner, cancel, isCancel } from '../utils/logger.js';
import type { ForgeConfig } from '../types/config.js';
import { isValidAppId, isValidFirefoxVersion } from '../utils/validation.js';

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
 * Runs the interactive setup command.
 * @param projectRoot - Root directory for the project
 */
export async function setupCommand(projectRoot: string): Promise<void> {
  intro('Forge Setup');

  // Check if config already exists
  if (await configExists(projectRoot)) {
    const overwrite = await p.confirm({
      message: 'A forge.json already exists. Overwrite?',
      initialValue: false,
    });

    if (isCancel(overwrite) || !overwrite) {
      cancel('Setup cancelled');
      return;
    }
  }

  // Gather project information
  const project = await p.group(
    {
      name: () =>
        p.text({
          message: 'What is the name of your browser?',
          placeholder: 'MyBrowser',
          validate: (value) => {
            if (!value.trim()) return 'Name is required';
            if (value.length > 50) return 'Name must be 50 characters or less';
            return undefined;
          },
        }),

      vendor: () =>
        p.text({
          message: 'What is your vendor/company name?',
          placeholder: 'My Company',
          validate: (value) => {
            if (!value.trim()) return 'Vendor is required';
            return undefined;
          },
        }),

      appId: ({ results }) =>
        p.text({
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
        p.text({
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
        p.text({
          message: 'Firefox version to base on',
          placeholder: '146.0',
          validate: (value) => {
            if (value && !isValidFirefoxVersion(value)) {
              return 'Invalid Firefox version format (e.g., 146.0 or 128.0esr)';
            }
            return undefined;
          },
        }),
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
  const finalAppId = (project.appId as string).trim() || `org.${sanitizedName}.browser`;
  const finalBinaryName = (project.binaryName as string).trim() || sanitizedName;
  const finalFirefoxVersion = project.firefoxVersion.trim() || '146.0';

  // Create configuration
  const config: ForgeConfig = {
    name: project.name,
    vendor: project.vendor,
    appId: finalAppId,
    binaryName: finalBinaryName,
    firefox: {
      version: finalFirefoxVersion,
      product: 'firefox',
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
