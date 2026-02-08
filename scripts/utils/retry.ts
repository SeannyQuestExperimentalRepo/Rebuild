/**
 * Retry utility with exponential backoff.
 */

import { createLogger } from "./logger";

const log = createLogger("retry");

interface RetryOptions {
  /** Maximum number of retry attempts. Default: 3 */
  maxRetries?: number;
  /** Initial delay in ms before first retry. Default: 1000 */
  initialDelayMs?: number;
  /** Multiplier for each subsequent delay. Default: 2 */
  backoffMultiplier?: number;
  /** Maximum delay between retries in ms. Default: 30000 */
  maxDelayMs?: number;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelayMs = 1000,
    backoffMultiplier = 2,
    maxDelayMs = 30000,
  } = options;

  let lastError: Error | undefined;
  let delay = initialDelayMs;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === maxRetries) {
        log.error(`${label}: All ${maxRetries + 1} attempts failed`, {
          error: lastError.message,
        });
        throw lastError;
      }

      log.warn(`${label}: Attempt ${attempt + 1} failed, retrying in ${delay}ms`, {
        error: lastError.message,
        nextAttempt: attempt + 2,
      });

      await new Promise((resolve) => setTimeout(resolve, delay));
      delay = Math.min(delay * backoffMultiplier, maxDelayMs);
    }
  }

  // TypeScript needs this but it's unreachable
  throw lastError;
}
