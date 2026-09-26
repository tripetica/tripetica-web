import { type OpsCopy } from "@/lib/ops/copy";
import { formatOpsExactCount } from "@/lib/ops/process-list-display";

type OpsOccupancyCellProps = {
  copy: Pick<OpsCopy, "occupancyPassenger" | "occupancyLuggage" | "occupancyBaby">;
  passengerCount: number | null | undefined;
  luggageCount: number | null | undefined;
  babySeatCount: number | null | undefined;
};

function OccupancyItem({ label, value }: { label: string; value: number | null | undefined }) {
  return (
    <span className="ops-occupancy-item">
      <span className="ops-occupancy-label">{label}</span>
      <span className="ops-occupancy-value">{formatOpsExactCount(value)}</span>
    </span>
  );
}

export function OpsOccupancyCell({
  copy,
  passengerCount,
  luggageCount,
  babySeatCount,
}: OpsOccupancyCellProps) {
  return (
    <span className="ops-occupancy">
      <OccupancyItem label={copy.occupancyPassenger} value={passengerCount} />
      <OccupancyItem label={copy.occupancyLuggage} value={luggageCount} />
      <OccupancyItem label={copy.occupancyBaby} value={babySeatCount} />
    </span>
  );
}
