/**
 * Firefox product type for downloads.
 */
export type FirefoxProduct = 'firefox' | 'firefox-esr' | 'firefox-beta';

/**
 * Firefox version configuration.
 */
export interface FirefoxConfig {
  /** Firefox release version (e.g., "146.0") */
  version: string;
  /** Firefox product type */
  product: FirefoxProduct;
}

/**
 * Build configuration options.
 */
export interface BuildConfig {
  /** Number of parallel jobs for mach build */
  jobs?: number;
}

/**
 * Main forge.json configuration schema.
 */
export interface ForgeConfig {
  /** Display name of the browser */
  name: string;
  /** Vendor/company name */
  vendor: string;
  /** Application ID (e.g., "org.example.browser") */
  appId: string;
  /** Binary name for the executable */
  binaryName: string;
  /** Firefox version settings */
  firefox: FirefoxConfig;
  /** Build settings */
  build?: BuildConfig;
}

/**
 * Build mode for mach.
 */
export type BuildMode = 'dev' | 'debug' | 'release';

/**
 * Runtime state stored in .forge/state.json.
 */
export interface ForgeState {
  /** Currently active brand */
  brand?: string;
  /** Build mode: dev, debug, release */
  buildMode?: BuildMode;
  /** Last successful build timestamp (ISO string) */
  lastBuild?: string;
  /** Firefox version that was downloaded */
  downloadedVersion?: string;
}

/**
 * Project directory structure.
 */
export interface ProjectPaths {
  /** Root directory of the project */
  root: string;
  /** Path to forge.json */
  config: string;
  /** Path to .forge directory */
  forgeDir: string;
  /** Path to .forge/state.json */
  state: string;
  /** Path to engine directory (Firefox source) */
  engine: string;
  /** Path to patches directory */
  patches: string;
  /** Path to configs directory */
  configs: string;
  /** Path to src directory */
  src: string;
}
