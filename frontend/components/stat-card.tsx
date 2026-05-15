import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  trend?: number;
  icon?: React.ReactNode;
  highlight?: boolean;
}

export function StatCard({ label, value, sub, trend, icon, highlight }: StatCardProps) {
  return (
    <div className={cn(
      "rounded-2xl border p-5 flex flex-col gap-3",
      highlight
        ? "bg-emerald-950/40 border-emerald-900/60"
        : "bg-zinc-900 border-zinc-800"
    )}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">{label}</p>
        {icon && <div className="text-zinc-600">{icon}</div>}
      </div>
      <div>
        <p className="text-3xl font-bold text-white tracking-tight">{value}</p>
        {sub && <p className="text-xs text-zinc-600 mt-0.5">{sub}</p>}
      </div>
      {trend !== undefined && (
        <div className={cn(
          "flex items-center gap-1 text-xs font-medium",
          trend > 0 ? "text-emerald-400" : trend < 0 ? "text-red-400" : "text-zinc-500"
        )}>
          <span>{trend > 0 ? '▲' : trend < 0 ? '▼' : '—'}</span>
          <span>{Math.abs(trend)}% vs ayer</span>
        </div>
      )}
    </div>
  );
}
