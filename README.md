# Forge

A build tool for customizing Firefox. Forge helps you create, build, and maintain custom Firefox-based browsers.

## Features

- **Interactive Setup**: Create new projects with guided prompts
- **Firefox Source Management**: Download and manage Firefox source code
- **Patch System**: Apply and manage patches to Firefox source
- **Build System**: Wrapper around Mozilla's mach build system
- **TypeScript**: Written in TypeScript, runs directly with tsx (no build step)

## Requirements

- Node.js 20+
- Python 3.11 (required by Firefox build system)
- Git
- Platform-specific build tools (Xcode on macOS, build-essential on Linux, Visual Studio on Windows)

## Installation

Forge is designed to be added to an existing Firefox fork. Clone it into your fork's root directory:

```bash
cd /path/to/your-firefox-fork

# Clone forge into your fork
git clone https://github.com/user/forge.git

# Install forge's dependencies
cd forge && npm install && cd ..
```

Your directory structure should look like:

```
your-firefox-fork/
├── forge/              # This repo (cloned here)
├── forge.json          # Created by `forge setup`
├── engine/             # Firefox source (created by `forge download`)
├── patches/            # Your patches
└── configs/            # Build configurations
```

All forge commands are run from your fork's root directory, not from inside the `forge/` folder.

## Quick Start

```bash
# 1. Initialize forge (creates forge.json and configs)
./forge/forge setup

# 2. Download Firefox source
./forge/forge download

# 3. Install build dependencies
./forge/forge bootstrap

# 4. Apply patches (if any)
./forge/forge import

# 5. Build the browser
./forge/forge build

# 6. Run the browser
./forge/forge run
```

## Commands

### `forge setup`

Initialize a new Forge project. Creates `forge.json` configuration and directory structure.

```bash
./forge/forge setup
```

### `forge download`

Download Firefox source from archive.mozilla.org.

```bash
./forge/forge download           # Download Firefox source
./forge/forge download --force   # Re-download, removing existing source
```

### `forge bootstrap`

Install Firefox build dependencies using `mach bootstrap`.

```bash
./forge/forge bootstrap
```

### `forge import`

Apply patches from the `patches/` directory.

```bash
./forge/forge import
```

### `forge build`

Build the browser.

```bash
./forge/forge build              # Full build
./forge/forge build --ui         # Fast UI-only rebuild
./forge/forge build -j 16        # Use 16 parallel jobs
./forge/forge build --brand dev  # Build specific brand
```

### `forge run`

Launch the built browser.

```bash
./forge/forge run
```

### `forge status`

Show modified files in the engine directory.

```bash
./forge/forge status
```

### `forge reset`

Reset the engine directory to clean state (discard all changes).

```bash
./forge/forge reset          # Prompts for confirmation
./forge/forge reset --force  # Skip confirmation
```

### `forge discard`

Discard changes to a specific file.

```bash
./forge/forge discard browser/base/content/browser.js
```

### `forge export`

Export changes to a specific file as a patch.

```bash
./forge/forge export browser/base/content/browser.js
./forge/forge export browser/base/content/browser.js --name "fix-tabs"
```

### `forge export-all`

Export all changes as a single patch.

```bash
./forge/forge export-all
```

### `forge package`

Create a distribution package.

```bash
./forge/forge package
./forge/forge package --brand stable
```

### `forge watch`

Watch for changes and auto-rebuild.

```bash
./forge/forge watch
```

### `forge config`

Get or set configuration values.

```bash
./forge/forge config firefox.version       # Get a value
./forge/forge config firefox.version 132.0 # Set a value
./forge/forge config build.jobs 16         # Set parallel jobs
```

### `forge doctor`

Diagnose project issues and check dependencies.

```bash
./forge/forge doctor
```

## Global Options

| Option | Description |
|--------|-------------|
| `-v, --verbose` | Enable debug output |
| `-V, --version` | Show version number |
| `-h, --help` | Show help |

## Project Structure

When integrated into a browser project:

```
your-browser/
├── forge.json          # Project configuration
├── forge/              # Forge tool (this repo)
├── engine/             # Firefox source (gitignored)
├── patches/            # Your patches
│   ├── 001-branding.patch
│   └── 002-features.patch
├── configs/            # Build configurations
│   ├── common.mozconfig
│   ├── darwin.mozconfig
│   ├── linux.mozconfig
│   └── win32.mozconfig
└── .forge/             # Runtime data (gitignored)
```

## Configuration

`forge.json` defines your browser project:

```json
{
  "name": "MyBrowser",
  "vendor": "My Company",
  "appId": "org.example.mybrowser",
  "binaryName": "mybrowser",
  "firefox": {
    "version": "146.0",
    "product": "firefox"
  },
  "build": {
    "jobs": 8
  }
}
```

### Configuration Options

| Field | Description |
|-------|-------------|
| `name` | Display name of your browser |
| `vendor` | Your company/organization name |
| `appId` | Application ID (reverse-domain format) |
| `binaryName` | Executable name |
| `firefox.version` | Firefox version to base on |
| `firefox.product` | Product type: `firefox`, `firefox-esr`, `firefox-beta`, `firefox-nightly` |
| `build.jobs` | Number of parallel build jobs |

## Patches

Place patch files in the `patches/` directory. Patches are applied in alphabetical order, so use numeric prefixes:

```
patches/
├── 001-update-branding.patch
├── 002-disable-telemetry.patch
└── 003-add-features.patch
```

## Development

```bash
# Run forge directly during development
npm run forge -- setup

# Type check
npm run typecheck

# Lint
npm run lint
npm run lint:fix    # Auto-fix issues

# Format
npm run format       # Format all code
npm run format:check # Check formatting
```

### Code Quality

This project enforces code quality through:

- **TypeScript** - Strict mode with all additional checks enabled
- **ESLint** - Strict TypeScript rules (no `any`, explicit return types, etc.)
- **Prettier** - Consistent code formatting
- **Pre-commit hooks** - Automatically runs Prettier and ESLint on staged files
- **CI** - GitHub Actions runs all checks on pull requests

## License

This repository is licensed under the [European Union Public License 1.2 (EUPL-1.2)](LICENSE.md).

Firefox source code (fetched into `engine/` during setup) is subject to the [Mozilla Public License 2.0](https://www.mozilla.org/en-US/MPL/2.0/) and is not distributed by this repository.

## Soon to be Added

The following features are planned for future releases:

- **Docker builds** - Reproducible builds using Docker containers
- **CI mode** - Automated setup for continuous integration pipelines
- **Update manifests** - Generate update server manifests for auto-updates
- **UI mode** - Rebuild only UI changes for faster iteration