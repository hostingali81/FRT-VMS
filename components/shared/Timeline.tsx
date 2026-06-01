import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils/format";

export type TimelineItem = {
  id: string;
  date: string;
  title: string;
  description: string;
  badge?: string;
};

export function Timeline({ items }: { items: TimelineItem[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-slate-500">No history recorded yet.</p>;
  }

  return (
    <ol className="space-y-4">
      {items.map((item) => (
        <li key={item.id} className="grid grid-cols-[8rem_1fr] gap-4">
          <time className="text-sm font-medium text-slate-500">{formatDate(item.date)}</time>
          <div className="relative border-l border-slate-200 pl-5">
            <span className="absolute -left-1.5 top-1.5 h-3 w-3 rounded-full bg-slate-950" />
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-950">{item.title}</h3>
              {item.badge ? <Badge tone="indigo">{item.badge}</Badge> : null}
            </div>
            <p className="mt-1 text-sm text-slate-600">{item.description}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

