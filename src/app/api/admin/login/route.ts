import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";

export const dynamic = "force-dynamic";

const COOKIE_NAME = "admin_token";
const COOKIE_MAX_AGE = 60 * 60 * 24; // 24 hours

function signToken(timestamp: number, secret: string): string {
  const hmac = createHmac("sha256", secret).update(String(timestamp)).digest("hex");
  return `${timestamp}:${hmac}`;
}

export async function POST(req: NextRequest) {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    return NextResponse.json(
      { success: false, error: "Admin access not configured" },
      { status: 503 },
    );
  }

  const body = await req.json();
  const { password } = body as { password?: string };

  if (!password || password !== adminPassword) {
    return NextResponse.json(
      { success: false, error: "Invalid password" },
      { status: 401 },
    );
  }

  const timestamp = Date.now();
  const token = signToken(timestamp, adminPassword);

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
