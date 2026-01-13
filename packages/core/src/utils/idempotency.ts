/**
 * Idempotency utilities for request deduplication
 */

import { sha256 } from './crypto';

/**
 * Normalize data for consistent hashing
 * Sorts object keys and handles arrays recursively
 * @param data - Data to normalize
 * @returns Stable JSON string
 */
export function normalizeForHashing(data: unknown): string {
  return JSON.stringify(sortKeys(data));
}

/**
 * Recursively sort object keys for stable serialization
 */
function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeys);
  }
  if (value !== null && typeof value === 'object') {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[key] = sortKeys((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return value;
}

/**
 * Create a fingerprint for idempotency checking
 * @param data - Request data to fingerprint
 * @returns SHA256 hex hash
 */
export function createFingerprint(data: unknown): string {
  const normalized = normalizeForHashing(data);
  return sha256(normalized);
}
