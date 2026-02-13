import "server-only";
import { NextRequest } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";

const COOKIE_NAME = "admin_token";
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

/** Get the HMAC signing secret (separate from admin password for security). */
function getTokenSecret(): string | undefined {
  return process.env.ADMIN_TOKEN_SECRET || process.env.AUTH_SECRET;
}

function verifyToken(token: string, secret: string): boolean {
  const [timestampStr, hash] = token.split(":");
  if (!timestampStr || !hash) return false;

  const timestamp = parseInt(timestampStr, 10);
  if (isNaN(timestamp)) return false;

  // Check expiry
  if (Date.now() - timestamp > MAX_AGE_MS) return false;

  // Verify HMAC with timing-safe comparison
  const expected = createHmac("sha256", secret).update(timestampStr).digest("hex");
  const hashBuf = Buffer.from(hash, "hex");
  const expectedBuf = Buffer.from(expected, "hex");
  if (hashBuf.length !== expectedBuf.length) return false;
  return timingSafeEqual(hashBuf, expectedBuf);
}

export function isAdminAuthenticated(req: NextRequest): boolean {
  const secret = getTokenSecret();
  if (!secret) return false;

  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return false;

  return verifyToken(token, secret);
}
