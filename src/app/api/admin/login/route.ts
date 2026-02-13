import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { authFlowLimiter, applyRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const COOKIE_NAME = "admin_token";
const COOKIE_MAX_AGE = 60 * 60 * 24; // 24 hours

/** Get the HMAC signing secret (separate from admin password). */
function getTokenSecret(): string | undefined {
  return process.env.ADMIN_TOKEN_SECRET || process.env.AUTH_SECRET;
}

function signToken(timestamp: number, secret: string): string {
  const hmac = createHmac("sha256", secret).update(String(timestamp)).digest("hex");
  return `${timestamp}:${hmac}`;
}

/** Constant-time password comparison to prevent timing attacks. */
function passwordMatch(input: string, expected: string): boolean {
  const inputBuf = Buffer.from(input);
  const expectedBuf = Buffer.from(expected);
  if (inputBuf.length !== expectedBuf.length) {
    // Still do a comparison to keep timing consistent, then return false
    timingSafeEqual(expectedBuf, expectedBuf);
    return false;
  }
  return timingSafeEqual(inputBuf, expectedBuf);
}

export async function POST(req: NextRequest) {
  // Rate limit to prevent brute force
  const limited = applyRateLimit(req, authFlowLimiter);
  if (limited) return limited;

  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    return NextResponse.json(
      { success: false, error: "Admin access not configured" },
      { status: 503 },
    );
  }

  const tokenSecret = getTokenSecret();
  if (!tokenSecret) {
    return NextResponse.json(
      { success: false, error: "Admin access not configured" },
      { status: 503 },
    );
  }

  const body = await req.json();
  const { password } = body as { password?: string };

  if (!password || !passwordMatch(password, adminPassword)) {
    return NextResponse.json(
      { success: false, error: "Invalid password" },
      { status: 401 },
    );
  }

  const timestamp = Date.now();
  const token = signToken(timestamp, tokenSecret);

  const res = NextResponse.json({ success: true });
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });

  return res;
}
