import { ExitCode } from './codes.js';

/**
 * Base error class for all Forge errors.
 * Provides structured error information with exit codes and user-friendly messages.
 */
export abstract class ForgeError extends Error {
  /** Exit code to use when this error causes process termination */
  abstract readonly code: ExitCode;

  /**
   * Creates a new ForgeError.
   * @param message - Technical error message for logging
   * @param cause - The underlying error that caused this error
   */
  override readonly cause?: Error;

  constructor(message: string, cause?: Error) {
    super(message);
    this.name = this.constructor.name;
    if (cause !== undefined) {
      this.cause = cause;
    }

    // Maintains proper stack trace in V8 environments
    if (typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * User-friendly error message with context and suggested fixes.
   * Override in subclasses to provide specific guidance.
   */
  get userMessage(): string {
    return this.message;
  }
}

/**
 * General error for unexpected failures.
 */
export class GeneralError extends ForgeError {
  readonly code = ExitCode.GENERAL_ERROR;
}

/**
 * Error thrown when a command-line argument is invalid.
 */
export class InvalidArgumentError extends ForgeError {
  readonly code = ExitCode.INVALID_ARGUMENT;

  constructor(
    message: string,
    public readonly argument?: string,
    cause?: Error
  ) {
    super(message, cause);
  }

  override get userMessage(): string {
    let msg = `Invalid Argument: ${this.message}`;

    if (this.argument) {
      msg += `\n\nArgument: ${this.argument}`;
    }

    return msg;
  }
}
