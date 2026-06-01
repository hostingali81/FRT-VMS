"use client";

import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CircleSummary } from "@/lib/types";

export function FleetStatusChart({ rows }: { rows: CircleSummary[] }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Status Comparison</CardTitle>
      </CardHeader>
      <CardContent className="h-72">
        {mounted ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="circle" tickLine={false} axisLine={false} fontSize={12} />
              <YAxis tickLine={false} axisLine={false} fontSize={12} allowDecimals={false} />
              <Tooltip cursor={{ fill: "#f8fafc" }} />
              <Bar dataKey="active" fill="#059669" radius={[4, 4, 0, 0]} />
              <Bar dataKey="maintenance" fill="#d97706" radius={[4, 4, 0, 0]} />
              <Bar dataKey="breakdown" fill="#dc2626" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full rounded-md bg-slate-50" />
        )}
      </CardContent>
    </Card>
  );
}
