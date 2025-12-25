import * as p from '@clack/prompts';

/** Whether verbose mode is enabled */
let verboseMode = false;

/**
 * Enables or disables verbose mode.
 * @param enabled - Whether to enable verbose output
 */
export function setVerbose(enabled: boolean): void {
  verboseMode = enabled;
}

/**
 * Checks if verbose mode is enabled.
 * @returns True if verbose mode is enabled
 */
export function isVerbose(): boolean {
  return verboseMode;
}

/**
 * Displays a verbose/debug message (only shown if verbose mode is enabled).
 * @param message - Message to display
 */
export function verbose(message: string): void {
  if (verboseMode) {
    p.log.info(`[debug] ${message}`);
  }
}

/**
 * Handle returned by the spinner function.
 */
export interface SpinnerHandle {
  /** Update the spinner message */
  message: (msg: string) => void;
  /** Stop the spinner with a success message */
  stop: (msg?: string) => void;
  /** Stop the spinner with an error message */
  error: (msg?: string) => void;
}

/**
 * Displays an intro message at the start of a command.
 * @param message - Message to display
 */
export function intro(message: string): void {
  p.intro(message);
}

/**
 * Displays an outro message at the end of a command.
 * @param message - Message to display
 */
export function outro(message: string): void {
  p.outro(message);
}

/**
 * Displays an informational message.
 * @param message - Message to display
 */
export function info(message: string): void {
  p.log.info(message);
}

/**
 * Displays a success message.
 * @param message - Message to display
 */
export function success(message: string): void {
  p.log.success(message);
}

/**
 * Displays a warning message.
 * @param message - Message to display
 */
export function warn(message: string): void {
  p.log.warn(message);
}

/**
 * Displays an error message.
 * @param message - Message to display
 */
export function error(message: string): void {
  p.log.error(message);
}

/**
 * Displays a step/progress message.
 * @param message - Message to display
 */
export function step(message: string): void {
  p.log.step(message);
}

/**
 * Displays a message (generic log).
 * @param message - Message to display
 */
export function message(message: string): void {
  p.log.message(message);
}

/**
 * Creates a spinner for long-running operations.
 * @param initialMessage - Initial message to display
 * @returns Spinner handle with message(), stop(), and error() methods
 */
export function spinner(initialMessage: string): SpinnerHandle {
  const s = p.spinner();
  s.start(initialMessage);

  return {
    message: (msg: string) => {
      s.message(msg);
    },
    stop: (msg?: string) => {
      s.stop(msg ?? initialMessage);
    },
    error: (msg?: string) => {
      s.stop(msg ?? 'Failed');
    },
  };
}

/**
 * Displays a cancellation message and returns a symbol.
 * @param message - Cancellation message
 */
export function cancel(message: string): void {
  p.cancel(message);
}

/**
 * Checks if a value is a cancellation symbol.
 * @param value - Value to check
 * @returns True if the user cancelled the prompt
 */
export function isCancel(value: unknown): boolean {
  return p.isCancel(value);
}

/**
 * Displays a note with a title and body.
 * @param message - Note content
 * @param title - Note title
 */
export function note(message: string, title?: string): void {
  p.note(message, title);
}
