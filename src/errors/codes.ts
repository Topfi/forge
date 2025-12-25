/**
 * Exit codes for forge CLI operations.
 * Each code represents a specific category of failure.
 */
export const ExitCode = {
  /** Operation completed successfully */
  SUCCESS: 0,
  /** Unspecified error */
  GENERAL_ERROR: 1,
  /** forge.json missing or invalid */
  CONFIG_ERROR: 2,
  /** Failed to download or extract Firefox source */
  DOWNLOAD_ERROR: 3,
  /** Git operation failed */
  GIT_ERROR: 4,
  /** mach build failed */
  BUILD_ERROR: 5,
  /** Patch application failed */
  PATCH_ERROR: 6,
  /** Required tool not found (python3.11, git, tar) */
  MISSING_DEPENDENCY: 7,
} as const;

export type ExitCode = (typeof ExitCode)[keyof typeof ExitCode];
