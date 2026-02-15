"use client";
import { DailySheetHeader, DailySheetFeed, DailySheetBottomNav } from "@/components/ui-concepts/daily-sheet";
export default function DailySheetPreview() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0f]">
      <DailySheetHeader />
      <DailySheetFeed />
      <DailySheetBottomNav />
    </div>
  );
}
