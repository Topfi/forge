/**
 * Options for the setup command.
 */
export interface SetupOptions {
  /** Browser name */
  name?: string;
  /** Vendor/company name */
  vendor?: string;
  /** Application ID (reverse-domain format) */
  appId?: string;
  /** Binary name (executable name) */
  binaryName?: string;
  /** Firefox version to base on */
  firefoxVersion?: string;
  /** Overwrite existing configuration without prompting */
  force?: boolean;
}

/**
 * Options for the download command.
 */
export interface DownloadOptions {
  /** Force re-download, deleting existing engine/ */
  force?: boolean;
}

/**
 * Options for the build command.
 */
export interface BuildOptions {
  /** Fast UI-only rebuild */
  ui?: boolean;
  /** Number of parallel jobs */
  jobs?: number;
  /** Brand to build (stable, nightly, etc.) */
  brand?: string;
}

/**
 * Options for the export command.
 */
export interface ExportOptions {
  /** Name/description for the patch */
  name?: string;
}

/**
 * Options for the reset command.
 */
export interface ResetOptions {
  /** Skip confirmation prompt */
  force?: boolean;
}

/**
 * Options for the watch command.
 */
export interface WatchOptions {
  /** Watch UI files only */
  ui?: boolean;
}

/**
 * Options for the package command.
 */
export interface PackageOptions {
  /** Brand to package */
  brand?: string;
}

/**
 * Result of a doctor check.
 */
export interface DoctorCheck {
  /** Name of the check */
  name: string;
  /** Whether the check passed */
  passed: boolean;
  /** Description of the result */
  message: string;
  /** Suggested fix if check failed */
  fix?: string;
}

/**
 * Result of a build operation.
 */
export interface BuildResult {
  /** Whether build succeeded */
  success: boolean;
  /** Build duration in milliseconds */
  duration: number;
  /** Path to build output */
  outputPath?: string;
  /** Error message if failed */
  error?: string;
}

/**
 * Information about a patch file.
 */
export interface PatchInfo {
  /** Full path to patch file */
  path: string;
  /** Filename without directory */
  filename: string;
  /** Order index (extracted from filename prefix like "001-") */
  order: number;
}

/**
 * Result of patch application.
 */
export interface PatchResult {
  /** Patch that was applied */
  patch: PatchInfo;
  /** Whether application succeeded */
  success: boolean;
  /** Error message if failed */
  error?: string;
}

/**
 * Options for the import command.
 */
export interface ImportOptions {
  /** Specific patches to apply (by name) */
  patches?: string[];
}

/**
 * Options for the run command.
 */
export interface RunOptions {
  /** Additional arguments to pass to the browser */
  args?: string[];
}

/**
 * Global CLI options available to all commands.
 */
export interface GlobalOptions {
  /** Enable verbose/debug output */
  verbose?: boolean;
}

/**
 * Status of the project.
 */
export interface ProjectStatus {
  /** Whether forge.json exists */
  hasConfig: boolean;
  /** Whether engine/ exists */
  hasEngine: boolean;
  /** Whether patches/ exists */
  hasPatches: boolean;
  /** Number of patch files */
  patchCount: number;
  /** Whether build output exists */
  hasBuild: boolean;
  /** Firefox version from config */
  firefoxVersion?: string;
  /** Downloaded Firefox version */
  downloadedVersion?: string;
}
