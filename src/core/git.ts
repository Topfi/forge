import { exec, executableExists } from '../utils/process.js';
import { pathExists } from '../utils/fs.js';
import { join } from 'node:path';
import { GitError, GitNotFoundError, PatchApplyError } from '../errors/git.js';

/**
 * Ensures git is available in the system.
 * @throws GitNotFoundError if git is not installed
 */
export async function ensureGit(): Promise<void> {
  if (!(await executableExists('git'))) {
    throw new GitNotFoundError();
  }
}

/**
 * Runs a git command in the specified directory.
 * @param args - Git command arguments
 * @param cwd - Working directory
 * @returns Command output
 */
async function git(args: string[], cwd: string): Promise<string> {
  const result = await exec('git', args, { cwd });

  if (result.exitCode !== 0) {
    throw new GitError(result.stderr.trim() || 'Git command failed', args.join(' '));
  }

  return result.stdout;
}

/**
 * Checks if a directory is a git repository.
 * @param dir - Directory to check
 * @returns True if the directory is a git repository
 */
export async function isGitRepository(dir: string): Promise<boolean> {
  const gitDir = join(dir, '.git');
  return pathExists(gitDir);
}

/**
 * Initializes a new git repository with an orphan branch.
 * @param dir - Directory to initialize
 * @param branchName - Name for the initial branch
 */
export async function initRepository(dir: string, branchName: string = 'main'): Promise<void> {
  await ensureGit();

  // Initialize repository
  await git(['init'], dir);

  // Create orphan branch
  await git(['checkout', '--orphan', branchName], dir);

  // Configure git for the repository
  await git(['config', 'user.email', 'forge@localhost'], dir);
  await git(['config', 'user.name', 'Forge'], dir);

  // Add all files
  await git(['add', '-A'], dir);

  // Create initial commit
  await git(['commit', '-m', 'Initial Firefox source'], dir);
}

/**
 * Applies a patch file using git apply.
 * @param patchPath - Path to the patch file
 * @param repoDir - Repository directory
 */
export async function applyPatch(patchPath: string, repoDir: string): Promise<void> {
  await ensureGit();

  const result = await exec('git', ['apply', '--check', patchPath], { cwd: repoDir });

  if (result.exitCode !== 0) {
    throw new PatchApplyError(patchPath, new Error(result.stderr));
  }

  // Actually apply the patch
  const applyResult = await exec('git', ['apply', patchPath], { cwd: repoDir });

  if (applyResult.exitCode !== 0) {
    throw new PatchApplyError(patchPath, new Error(applyResult.stderr));
  }
}

/**
 * Applies a patch idempotently using reverse-forward pattern.
 * First tries to reverse the patch (in case it's already applied),
 * then applies it forward.
 * @param patchPath - Path to the patch file
 * @param repoDir - Repository directory
 */
export async function applyPatchIdempotent(patchPath: string, repoDir: string): Promise<void> {
  await ensureGit();

  // Try to reverse the patch (ignore errors if not applied)
  await exec('git', ['apply', '--reverse', patchPath], { cwd: repoDir });

  // Apply forward
  await applyPatch(patchPath, repoDir);
}

/**
 * Checks if the repository has uncommitted changes.
 * @param repoDir - Repository directory
 * @returns True if there are uncommitted changes
 */
export async function hasChanges(repoDir: string): Promise<boolean> {
  await ensureGit();

  const result = await exec('git', ['status', '--porcelain'], { cwd: repoDir });

  return result.stdout.trim().length > 0;
}

/**
 * Gets the current HEAD commit hash.
 * @param repoDir - Repository directory
 * @returns Commit hash
 */
export async function getHead(repoDir: string): Promise<string> {
  await ensureGit();

  const output = await git(['rev-parse', 'HEAD'], repoDir);
  return output.trim();
}

/**
 * Gets the list of modified files.
 * @param repoDir - Repository directory
 * @returns List of modified file paths
 */
export async function getModifiedFiles(repoDir: string): Promise<string[]> {
  await ensureGit();

  const result = await exec('git', ['status', '--porcelain'], { cwd: repoDir });

  return result.stdout
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => line.slice(3)); // Remove status prefix (e.g., " M ")
}

/**
 * Resets all changes in the repository.
 * @param repoDir - Repository directory
 */
export async function resetChanges(repoDir: string): Promise<void> {
  await ensureGit();

  await git(['checkout', '.'], repoDir);
  await git(['clean', '-fd'], repoDir);
}

/**
 * Creates a commit with all current changes.
 * @param repoDir - Repository directory
 * @param message - Commit message
 */
export async function commit(repoDir: string, message: string): Promise<void> {
  await ensureGit();

  await git(['add', '-A'], repoDir);
  await git(['commit', '-m', message], repoDir);
}

/**
 * Gets the diff for a specific file.
 * @param repoDir - Repository directory
 * @param filePath - Path to the file (relative to repo)
 * @returns Diff content
 */
export async function getFileDiff(repoDir: string, filePath: string): Promise<string> {
  await ensureGit();

  const result = await exec('git', ['diff', 'HEAD', '--', filePath], { cwd: repoDir });
  return result.stdout;
}

/**
 * Gets the diff for all modified files.
 * @param repoDir - Repository directory
 * @returns Diff content
 */
export async function getAllDiff(repoDir: string): Promise<string> {
  await ensureGit();

  const result = await exec('git', ['diff', 'HEAD'], { cwd: repoDir });
  return result.stdout;
}

/**
 * Discards changes to a specific file.
 * @param repoDir - Repository directory
 * @param filePath - Path to the file (relative to repo)
 */
export async function discardFile(repoDir: string, filePath: string): Promise<void> {
  await ensureGit();

  await git(['checkout', 'HEAD', '--', filePath], repoDir);
}

/**
 * Gets the status of files with their status codes.
 * @param repoDir - Repository directory
 * @returns Array of [status, filepath] tuples
 */
export async function getStatusWithCodes(
  repoDir: string
): Promise<Array<{ status: string; file: string }>> {
  await ensureGit();

  const result = await exec('git', ['status', '--porcelain'], { cwd: repoDir });

  return result.stdout
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => ({
      status: line.slice(0, 2).trim(),
      file: line.slice(3),
    }));
}
