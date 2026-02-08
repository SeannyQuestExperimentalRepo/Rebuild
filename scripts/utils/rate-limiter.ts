/**
 * Rate limiter for respectful web scraping.
 * Enforces minimum delay between requests.
 */

export class RateLimiter {
  private lastRequestTime = 0;
  private readonly minDelayMs: number;

  /**
   * @param minDelayMs Minimum milliseconds between requests. Default: 3000 (3 seconds).
   */
  constructor(minDelayMs = 3000) {
    this.minDelayMs = minDelayMs;
  }

  /**
   * Wait until enough time has passed since the last request.
   */
  async wait(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.minDelayMs) {
      const waitTime = this.minDelayMs - elapsed;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
    this.lastRequestTime = Date.now();
  }
}
