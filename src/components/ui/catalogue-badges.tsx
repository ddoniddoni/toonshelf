import type { ReactNode } from "react";

export function PlatformBadge({ code, children }: { code?: string; children: ReactNode }) {
  return <span className="platform-badge" data-platform={code}>{children}</span>;
}

export function TierBadge({ tier }: { tier: "S" | "A" | "B" | "C" | "D" | "F" }) {
  return <span className="tier-badge" data-tier={tier}>{tier} <span>Tier</span></span>;
}

export function ReadingBadge({ status, children }: { status: string; children: ReactNode }) {
  return <span className="reading-badge" data-status={status}>{children}</span>;
}
