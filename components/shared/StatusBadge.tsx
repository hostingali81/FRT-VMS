import { Badge } from "@/components/ui/badge";
import type { VehicleStatus } from "@/lib/types";
import { titleCase } from "@/lib/utils/format";

const statusTone: Record<VehicleStatus, "green" | "yellow" | "red" | "gray" | "blue"> = {
  active: "green",
  maintenance: "yellow",
  breakdown: "red",
  removed: "gray",
  standby: "blue",
  accident: "red",
};

export function StatusBadge({ status }: { status: VehicleStatus }) {
  return <Badge tone={statusTone[status]}>{titleCase(status)}</Badge>;
}

