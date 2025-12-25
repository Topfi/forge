import { ForgeError } from './base.js';
import { ExitCode } from './codes.js';

/**
 * Error thrown when a build operation fails.
 */
export class BuildError extends ForgeError {
  readonly code = ExitCode.BUILD_ERROR;

  constructor(
    message: string,
    public readonly command?: string,
    cause?: Error
  ) {
    super(message, cause);
  }

  override get userMessage(): string {
    let msg = `Build Error: ${this.message}`;

    if (this.command) {
      msg += `\n\nCommand: ${this.command}`;
    }

    msg += '\n\nTo fix this:\n';
    msg += '  1. Check the build output above for specific errors\n';
    msg += '  2. Ensure all dependencies are installed with "./forge/forge bootstrap"\n';
    msg += '  3. Try a clean build by deleting obj-* directories';

    return msg;
  }
}

/**
 * Error thrown when mach is not available.
 */
export class MachNotFoundError extends BuildError {
  constructor(public readonly engineDir: string) {
    super(`mach not found in ${engineDir}`);
  }

  override get userMessage(): string {
    return (
      'Build Error: Firefox build system (mach) not found.\n\n' +
      `Expected location: ${this.engineDir}/mach\n\n` +
      'To fix this:\n' +
      '  1. Run "./forge/forge download" to download Firefox source\n' +
      '  2. Ensure the engine/ directory contains the Firefox source'
    );
  }
}

/**
 * Error thrown when python3.11 is not available.
 */
export class PythonNotFoundError extends BuildError {
  constructor() {
    super('python3.11 is not installed or not found in PATH');
  }

  override get userMessage(): string {
    return (
      'Build Error: python3.11 is required but not found.\n\n' +
      'Firefox build system requires Python 3.11.\n\n' +
      'To fix this:\n' +
      '  1. Install Python 3.11 from https://python.org/\n' +
      '  2. On macOS: brew install python@3.11\n' +
      '  3. On Ubuntu: sudo apt install python3.11\n' +
      '  4. Ensure python3.11 is in your PATH'
    );
  }
}

/**
 * Error thrown when bootstrap fails.
 */
export class BootstrapError extends BuildError {
  constructor(cause?: Error) {
    super('Bootstrap failed', 'python3.11 mach bootstrap', cause);
  }

  override get userMessage(): string {
    return (
      'Build Error: Bootstrap failed.\n\n' +
      'The Firefox build dependencies could not be installed.\n\n' +
      'To fix this:\n' +
      '  1. Check the error output above\n' +
      '  2. Ensure you have sufficient permissions\n' +
      '  3. Try running bootstrap manually:\n' +
      '     cd engine && python3.11 mach bootstrap'
    );
  }
}

/**
 * Error thrown when mozconfig generation fails.
 */
export class MozconfigError extends BuildError {
  override get userMessage(): string {
    return (
      `Build Error: ${this.message}\n\n` +
      'To fix this:\n' +
      '  1. Check that configs/ directory exists\n' +
      '  2. Ensure platform-specific mozconfig exists\n' +
      '  3. Run "./forge/forge setup" to regenerate configs'
    );
  }
}
