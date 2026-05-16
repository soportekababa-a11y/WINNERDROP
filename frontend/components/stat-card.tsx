import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  trend?: number;
  icon?: React.ReactNode;
  highlight?: boolean;
  color?: 'violet' | 'amber' | 'emerald' | 'fuchsia';
}

const colorMap = {
  violet:  { icon: 'text-indigo-500 bg-indigo-50', num: 'text-indigo-600' },
  amber:   { icon: 'text-amber-500 bg-amber-50',   num: 'text-amber-600' },
  emerald: { icon: 'text-emerald-500 bg-emerald-50',num: 'text-emerald-600' },
  fuchsia: { icon: 'text-violet-500 bg-violet-50',  num: 'text-violet-600' },
};

export function StatCard({ label, value, sub, trend, icon, highlight, color = 'violet' }: StatCardProps) {
  const c = colorMap[color];
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 flex flex-col gap-3 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">{label}</p>
        {icon && (
          <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", c.icon)}>
            {icon}
          </div>
        )}
      </div>
      <div>
        <p className={cn("text-3xl font-bold tracking-tight", highlight ? c.num : 'text-gray-900')}>{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
      {trend !== undefined && (
        <div className={cn(
          "inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg w-fit",
          trend > 0 ? 'bg-emerald-50 text-emerald-600' :
          trend < 0 ? 'bg-red-50 text-red-500' :
                      'bg-gray-100 text-gray-500'
        )}>
          <span>{trend > 0 ? '▲' : trend < 0 ? '▼' : '—'}</span>
          <span>{Math.abs(trend)}% vs ayer</span>
        </div>
      )}
    </div>
  );
}
