import "server-only";
import { NextRequest } from "next/server";
import { createHmac } from "crypto";

const COOKIE_NAME = "admin_token";
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

function verifyToken(token: string, secret: string): boolean {
  const [timestampStr, hash] = token.split(":");
  if (!timestampStr || !hash) return false;

  const timestamp = parseInt(timestampStr, 10);
  if (isNaN(timestamp)) return false;

  // Check expiry
  if (Date.now() - timestamp > MAX_AGE_MS) return false;

  // Verify HMAC
  const expected = createHmac("sha256", secret).update(timestampStr).digest("hex");
  return hash === expected;
}

export function isAdminAuthenticated(req: NextRequest): boolean {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) return false;

  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return false;

  return verifyToken(token, adminPassword);
}
