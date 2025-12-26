import { createWriteStream } from 'node:fs';
import { join, basename } from 'node:path';
import { rename } from 'node:fs/promises';
import { exec } from '../utils/process.js';
import { pathExists, ensureDir, removeDir } from '../utils/fs.js';
import { getPlatform } from '../utils/platform.js';
import { DownloadError, ExtractionError, VersionNotFoundError } from '../errors/download.js';
import type { FirefoxProduct } from '../types/config.js';

/**
 * Progress callback for download operations.
 */
export type ProgressCallback = (downloaded: number, total: number) => void;

/**
 * Base URL for Firefox releases on archive.mozilla.org.
 */
const ARCHIVE_BASE_URL = 'https://archive.mozilla.org/pub/firefox/releases';

/**
 * Gets the download URL for a Firefox source tarball.
 * @param version - Firefox version (e.g., "140.0esr")
 * @param product - Firefox product type
 * @returns Full URL to the source tarball
 */
export function getDownloadUrl(version: string, product: FirefoxProduct = 'firefox'): string {
  // For ESR, the version might already include "esr" or not
  const cleanVersion = version.replace(/esr$/i, '');
  const isEsr = product === 'firefox-esr' || version.toLowerCase().includes('esr');
  const versionPath = isEsr ? `${cleanVersion}esr` : version;

  return `${ARCHIVE_BASE_URL}/${versionPath}/source/firefox-${versionPath}.source.tar.xz`;
}

/**
 * Gets the filename for a Firefox source tarball.
 * @param version - Firefox version
 * @returns Tarball filename
 */
export function getTarballFilename(version: string): string {
  return `firefox-${version}.source.tar.xz`;
}

/**
 * Downloads a file from a URL with progress tracking.
 * @param url - URL to download
 * @param destPath - Destination file path
 * @param onProgress - Optional progress callback
 */
async function downloadFile(
  url: string,
  destPath: string,
  onProgress?: ProgressCallback
): Promise<void> {
  const response = await fetch(url);

  if (!response.ok) {
    if (response.status === 404) {
      throw new VersionNotFoundError(basename(url).replace('.source.tar.xz', ''));
    }
    throw new DownloadError(`HTTP ${response.status}: ${response.statusText}`, url);
  }

  if (!response.body) {
    throw new DownloadError('No response body received', url);
  }

  const totalSize = parseInt(response.headers.get('content-length') ?? '0', 10);
  let downloadedSize = 0;

  const fileStream = createWriteStream(destPath);
  const reader = response.body.getReader();

  try {
    for (;;) {
      const result = await reader.read();
      if (result.done) break;

      const chunk = result.value as Uint8Array;
      fileStream.write(chunk);
      downloadedSize += chunk.length;

      if (onProgress && totalSize > 0) {
        onProgress(downloadedSize, totalSize);
      }
    }
  } finally {
    fileStream.end();
    await new Promise<void>((resolve, reject) => {
      fileStream.on('finish', resolve);
      fileStream.on('error', reject);
    });
  }
}

/**
 * Extracts a tar.xz archive.
 * @param archivePath - Path to the archive
 * @param destDir - Destination directory
 */
async function extractTarXz(archivePath: string, destDir: string): Promise<void> {
  await ensureDir(destDir);

  const platform = getPlatform();
  let command: string;
  let args: string[];

  if (platform === 'win32') {
    // Windows: use tar (available in Windows 10+)
    command = 'tar';
    args = ['-xf', archivePath, '-C', destDir];
  } else {
    // Unix: use tar with xz decompression
    command = 'tar';
    args = ['-xJf', archivePath, '-C', destDir];
  }

  const result = await exec(command, args);

  if (result.exitCode !== 0) {
    throw new ExtractionError(archivePath, new Error(result.stderr));
  }
}

/**
 * Downloads and extracts Firefox source.
 * @param version - Firefox version to download
 * @param product - Firefox product type
 * @param destDir - Destination directory for extracted source
 * @param cacheDir - Directory to store downloaded tarball
 * @param onProgress - Optional progress callback
 */
export async function downloadFirefoxSource(
  version: string,
  product: FirefoxProduct,
  destDir: string,
  cacheDir: string,
  onProgress?: ProgressCallback
): Promise<void> {
  const url = getDownloadUrl(version, product);
  const tarballFilename = getTarballFilename(version);
  const tarballPath = join(cacheDir, tarballFilename);

  // Ensure cache directory exists
  await ensureDir(cacheDir);

  // Download if not cached
  if (!(await pathExists(tarballPath))) {
    await downloadFile(url, tarballPath, onProgress);
  }

  // Extract to a temporary directory first
  const tempDir = `${destDir}.tmp`;
  await removeDir(tempDir);
  await extractTarXz(tarballPath, tempDir);

  // Firefox source extracts to a subdirectory (e.g., firefox-140.0/)
  // Find it dynamically since ESR versions may have different naming
  const { readdir } = await import('node:fs/promises');
  const entries = await readdir(tempDir, { withFileTypes: true });
  const extractedSubdir = entries.find(
    (entry) => entry.isDirectory() && entry.name.startsWith('firefox-')
  );

  if (extractedSubdir) {
    const extractedDir = join(tempDir, extractedSubdir.name);
    await removeDir(destDir);
    await rename(extractedDir, destDir);
    await removeDir(tempDir);
  } else {
    // If no subdirectory, the temp dir is the source
    await removeDir(destDir);
    await rename(tempDir, destDir);
  }
}

/**
 * Gets the Firefox version from an existing source directory.
 * @param engineDir - Path to the engine directory
 * @returns Firefox version string
 */
export async function getFirefoxVersion(engineDir: string): Promise<string | undefined> {
  const versionPath = join(engineDir, 'browser', 'config', 'version.txt');

  if (!(await pathExists(versionPath))) {
    return undefined;
  }

  const { readText } = await import('../utils/fs.js');
  const version = await readText(versionPath);
  return version.trim();
}

/**
 * Formats bytes into a human-readable string.
 * @param bytes - Number of bytes
 * @returns Formatted string (e.g., "1.5 GB")
 */
export function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
}
