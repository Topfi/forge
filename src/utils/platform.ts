import { platform, arch } from 'node:os';

/**
 * Supported operating system platforms.
 */
export type Platform = 'darwin' | 'linux' | 'win32';

/**
 * Supported CPU architectures.
 */
export type Arch = 'x64' | 'arm64';

/**
 * Gets the current operating system platform.
 * @throws Error if running on an unsupported platform
 */
export function getPlatform(): Platform {
  const p = platform();
  if (p === 'darwin' || p === 'linux' || p === 'win32') {
    return p;
  }
  throw new Error(`Unsupported platform: ${p}. Forge supports darwin, linux, and win32.`);
}

/**
 * Gets the current CPU architecture.
 * @throws Error if running on an unsupported architecture
 */
export function getArch(): Arch {
  const a = arch();
  if (a === 'x64' || a === 'arm64') {
    return a;
  }
  throw new Error(`Unsupported architecture: ${a}. Forge supports x64 and arm64.`);
}

/**
 * Gets the mozconfig filename for the current platform.
 */
export function getMozconfigName(): string {
  return `${getPlatform()}.mozconfig`;
}

/**
 * Checks if the current platform is macOS.
 */
export function isDarwin(): boolean {
  return platform() === 'darwin';
}

/**
 * Checks if the current platform is Linux.
 */
export function isLinux(): boolean {
  return platform() === 'linux';
}

/**
 * Checks if the current platform is Windows.
 */
export function isWindows(): boolean {
  return platform() === 'win32';
}

/**
 * Gets the appropriate file extension for executables on the current platform.
 */
export function getExecutableExtension(): string {
  return isWindows() ? '.exe' : '';
}

/**
 * Gets the appropriate archive extraction command for the current platform.
 */
export function getExtractionCommand(): { command: string; args: string[] } {
  if (isWindows()) {
    // On Windows, use tar which is available in Windows 10+
    return { command: 'tar', args: ['-xf'] };
  }
  // On Unix-like systems, use tar with xz support
  return { command: 'tar', args: ['-xJf'] };
}
