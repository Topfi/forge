#!/usr/bin/env npx tsx
/**
 * Forge CLI entry point.
 *
 * This file is the main entry point for the forge command-line tool.
 * It uses tsx to run TypeScript directly without a build step.
 *
 * @license EUPL-1.2
 */

import { main } from '../src/index.js';

main().catch((error: unknown) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
