import { spawn } from 'node:child_process';

/**
 * Result of executing a command.
 */
export interface ExecResult {
  /** Standard output content */
  stdout: string;
  /** Standard error content */
  stderr: string;
  /** Process exit code */
  exitCode: number;
}

/**
 * Options for command execution.
 */
export interface ExecOptions {
  /** Working directory for the command */
  cwd?: string;
  /** Environment variables */
  env?: Record<string, string>;
  /** Timeout in milliseconds */
  timeout?: number;
}

/**
 * Executes a command and returns its output.
 * @param command - Command to execute
 * @param args - Command arguments
 * @param options - Execution options
 * @returns Execution result with stdout, stderr, and exit code
 */
export async function exec(
  command: string,
  args: string[],
  options: ExecOptions = {}
): Promise<ExecResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: options.timeout,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('close', (code) => {
      resolve({
        stdout,
        stderr,
        exitCode: code ?? 1,
      });
    });
  });
}

/**
 * Callback for streaming output.
 */
export type StreamCallback = (data: string) => void;

/**
 * Options for streaming command execution.
 */
export interface StreamOptions extends ExecOptions {
  /** Callback for stdout data */
  onStdout?: StreamCallback;
  /** Callback for stderr data */
  onStderr?: StreamCallback;
}

/**
 * Executes a command and streams its output.
 * @param command - Command to execute
 * @param args - Command arguments
 * @param options - Execution options
 * @returns Exit code of the process
 */
export async function execStream(
  command: string,
  args: string[],
  options: StreamOptions = {}
): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: options.timeout,
    });

    child.stdout.on('data', (data: Buffer) => {
      options.onStdout?.(data.toString());
    });

    child.stderr.on('data', (data: Buffer) => {
      options.onStderr?.(data.toString());
    });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('close', (code) => {
      resolve(code ?? 1);
    });
  });
}

/**
 * Executes a command and inherits stdio (shows output directly).
 * @param command - Command to execute
 * @param args - Command arguments
 * @param options - Execution options
 * @returns Exit code of the process
 */
export async function execInherit(
  command: string,
  args: string[],
  options: ExecOptions = {}
): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      stdio: 'inherit',
      timeout: options.timeout,
    });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('close', (code) => {
      resolve(code ?? 1);
    });
  });
}

/**
 * Finds an executable in the system PATH.
 * @param name - Name of the executable
 * @returns Full path to the executable, or undefined if not found
 */
export async function findExecutable(name: string): Promise<string | undefined> {
  const command = process.platform === 'win32' ? 'where' : 'which';
  try {
    const result = await exec(command, [name]);
    if (result.exitCode === 0 && result.stdout.trim()) {
      // Return the first line (first match)
      return result.stdout.trim().split('\n')[0];
    }
    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * Checks if an executable exists in the system PATH.
 * @param name - Name of the executable
 * @returns True if the executable exists
 */
export async function executableExists(name: string): Promise<boolean> {
  const path = await findExecutable(name);
  return path !== undefined;
}
