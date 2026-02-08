/**
 * HTTP fetch utility with polite scraping headers.
 */

import { RateLimiter } from "./rate-limiter";
import { withRetry } from "./retry";
import { createLogger } from "./logger";

const log = createLogger("http");

const USER_AGENT =
  "TrendLine/1.0 (Sports research project; contact: trendline@example.com)";

const defaultRateLimiter = new RateLimiter(3000);

interface FetchOptions {
  rateLimiter?: RateLimiter;
  retries?: number;
  headers?: Record<string, string>;
}

/**
 * Fetch a URL with rate limiting, retries, and polite headers.
 */
export async function fetchWithRateLimit(
  url: string,
  options: FetchOptions = {}
): Promise<string> {
  const { rateLimiter = defaultRateLimiter, retries = 3, headers = {} } = options;

  await rateLimiter.wait();

  log.info(`Fetching: ${url}`);

  const response = await withRetry(
    async () => {
      const res = await fetch(url, {
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
          ...headers,
        },
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText} for ${url}`);
      }

      return res.text();
    },
    `fetch ${url}`,
    { maxRetries: retries }
  );

  return response;
}
