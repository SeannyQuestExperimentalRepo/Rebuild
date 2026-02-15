import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getUnresolvedNames } from "@/lib/team-resolver";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isAdminAuthenticated(req)) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const unresolved = getUnresolvedNames();
  const entries = Array.from(unresolved.entries()).map(([name, info]) => ({
    name,
    source: info.source,
    sport: info.sport,
    count: info.count,
  }));

  // Sort by count descending (most frequent unresolved names first)
  entries.sort((a, b) => b.count - a.count);

  return NextResponse.json({
    success: true,
    total: entries.length,
    unresolved: entries,
  });
}
