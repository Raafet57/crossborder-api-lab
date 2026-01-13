/**
 * Correlation ID utilities for request tracing
 */

import { generateId } from './crypto';

/** UUID v4 regex pattern */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Generate a new correlation ID
 * @returns UUID v4 string
 */
export function generateCorrelationId(): string {
  return generateId();
}

/**
 * Validate if a string is a valid correlation ID
 * @param id - String to validate
 * @returns True if valid UUID v4
 */
export function isValidCorrelationId(id: string): boolean {
  return UUID_PATTERN.test(id);
}
