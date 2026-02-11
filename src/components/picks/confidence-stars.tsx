"use client";

interface ConfidenceStarsProps {
  confidence: number; // 3, 4, or 5
  size?: "sm" | "md";
}

const colorMap: Record<number, string> = {
  5: "text-emerald-400",
  4: "text-blue-400",
  3: "text-amber-400",
};

export function ConfidenceStars({ confidence, size = "sm" }: ConfidenceStarsProps) {
  const color = colorMap[confidence] || "text-zinc-400";
  const starSize = size === "sm" ? "text-sm" : "text-base";

  return (
    <span className={`inline-flex gap-0.5 ${color} ${starSize}`} title={`${confidence}-star confidence`}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={i < confidence ? "" : "opacity-20"}>
          ★
        </span>
      ))}
    </span>
  );
}
