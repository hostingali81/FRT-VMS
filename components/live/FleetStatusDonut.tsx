"use client";

import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import type { FleetLiveCounts, LiveStatus } from "@/lib/types";
import { DONUT_ORDER, STATUS_META } from "./status-meta";

type Filter = LiveStatus | "all";
type Segment = { status: LiveStatus; name: string; count: number; hex: string; value: number };

// Equal-sized segments (value: 1) so the ring reads as a balanced wheel of
// labelled buckets — exactly like the GPS app — not a proportional pie.
function buildSegments(counts: FleetLiveCounts): Segment[] {
  return DONUT_ORDER.map((status) => ({
    status,
    name: STATUS_META[status].label,
    count: counts[status],
    hex: STATUS_META[status].hex,
    value: 1,
  }));
}

type LabelProps = {
  cx: number;
  cy: number;
  midAngle: number;
  innerRadius: number;
  outerRadius: number;
  payload: Segment;
};

function makeLabel(selected: Filter) {
  return function renderLabel({ cx, cy, midAngle, innerRadius, outerRadius, payload }: LabelProps) {
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const rad = -midAngle * (Math.PI / 180);
    const x = cx + radius * Math.cos(rad);
    const y = cy + radius * Math.sin(rad);
    const dim = selected !== "all" && selected !== payload.status;
    return (
      <text
        x={x}
        y={y}
        fill={dim ? "#475569" : "#ffffff"}
        textAnchor="middle"
        dominantBaseline="central"
        style={{ pointerEvents: "none" }}
      >
        <tspan fontSize="12" fontWeight="700">
          {payload.count}
        </tspan>
        <tspan dx="3" fontSize="10" fontWeight="600">
          {payload.name}
        </tspan>
      </text>
    );
  };
}

export function FleetStatusDonut({
  counts,
  selected,
  onSelect,
}: {
  counts: FleetLiveCounts;
  selected: Filter;
  onSelect: (filter: Filter) => void;
}) {
  // Loaded client-only via next/dynamic (ssr: false in LiveTracking), so recharts
  // — which measures the DOM and pulls in its own React/redux runtime — never
  // enters the server render. The DonutSkeleton covers the brief chunk-load gap.
  const segments = buildSegments(counts);

  return (
    <div className="relative mx-auto h-[300px] w-full max-w-[420px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          {/* Faint full outer ring, like the app's backdrop. */}
          <Pie
            data={[{ value: 1 }]}
            dataKey="value"
            cx="50%"
            cy="50%"
            innerRadius={126}
            outerRadius={131}
            fill="#e2e8f0"
            stroke="none"
            isAnimationActive={false}
          />
          <Pie
            data={segments}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={58}
            outerRadius={120}
            startAngle={90}
            endAngle={-270}
            stroke="#ffffff"
            strokeWidth={3}
            isAnimationActive={false}
            labelLine={false}
            label={makeLabel(selected) as never}
            onClick={(_, index) => {
              const seg = segments[index];
              if (!seg || seg.count === 0) return; // empty bucket isn't a useful filter
              onSelect(selected === seg.status ? "all" : seg.status);
            }}
            style={{ cursor: "pointer", outline: "none" }}
          >
            {segments.map((segment) => {
              const dim = selected !== "all" && selected !== segment.status;
              return <Cell key={segment.status} fill={segment.hex} fillOpacity={dim ? 0.25 : 1} />;
            })}
          </Pie>
        </PieChart>
      </ResponsiveContainer>

      {/* Center = tap to show all / clear the filter */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <button
          type="button"
          onClick={() => onSelect("all")}
          aria-label="Show all vehicles"
          className="pointer-events-auto flex h-[104px] w-[104px] flex-col items-center justify-center rounded-full text-center transition active:scale-95"
        >
          <span className="text-[28px] font-bold leading-none text-slate-900">{counts.total}</span>
          <span className="mt-1 text-xs font-medium text-slate-400">
            {selected === "all" ? "Total" : "Show all"}
          </span>
        </button>
      </div>
    </div>
  );
}
