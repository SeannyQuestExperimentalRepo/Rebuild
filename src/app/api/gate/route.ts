import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";

/**
 * Site-wide password gate.
 * POST /gate with { password } to set the access cookie.
 * Set SITE_PASSWORD env var to enable. Remove it to disable the gate.
 */
export async function POST(req: NextRequest) {
  const { password } = await req.json();
  const sitePassword = process.env.SITE_PASSWORD;

  if (!sitePassword || typeof password !== "string") {
    return NextResponse.json({ error: "Wrong password" }, { status: 401 });
  }

  // Timing-safe comparison to prevent timing attacks
  const inputBuf = Buffer.from(password);
  const expectedBuf = Buffer.from(sitePassword);
  const match =
    inputBuf.length === expectedBuf.length &&
    timingSafeEqual(inputBuf, expectedBuf);

  if (!match) {
    return NextResponse.json({ error: "Wrong password" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set("site_access", "granted", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: "/",
  });
  return res;
}
