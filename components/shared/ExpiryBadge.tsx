import { AlertTriangle, CheckCircle2, CircleHelp, Clock3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatExpiry, getExpiryState } from "@/lib/utils/expiry";

export function ExpiryBadge({ date, label }: { date: string | null | undefined; label?: string }) {
  const state = getExpiryState(date);
  const Icon = state === "valid" ? CheckCircle2 : state === "expiring" ? Clock3 : state === "expired" ? AlertTriangle : CircleHelp;
  const tone = state === "valid" ? "green" : state === "expiring" ? "yellow" : state === "expired" ? "red" : "gray";

  return (
    <Badge tone={tone} className="gap-1.5">
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {label ? `${label}: ` : ""}
      {formatExpiry(date)}
    </Badge>
  );
}

