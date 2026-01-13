/**
 * Cryptographic utilities
 */

import { createHash, createHmac, randomUUID } from 'crypto';

/**
 * Generate SHA256 hash of input string
 * @param input - String to hash
 * @returns Hex-encoded hash
 */
export function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

/**
 * Generate HMAC-SHA256 signature
 * @param data - Data to sign
 * @param secret - Secret key
 * @returns Hex-encoded signature
 */
export function hmacSha256(data: string, secret: string): string {
  return createHmac('sha256', secret).update(data).digest('hex');
}

/**
 * Generate a UUID v4
 * @returns UUID string
 */
export function generateId(): string {
  return randomUUID();
}
