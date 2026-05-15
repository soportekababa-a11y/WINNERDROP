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
  violet:  { card: 'bg-violet-950/40 border-violet-700/40',  num: 'text-violet-300',  badge: 'bg-violet-900/60 text-violet-300',  dot: 'bg-violet-400' },
  amber:   { card: 'bg-amber-950/40 border-amber-700/40',    num: 'text-amber-300',   badge: 'bg-amber-900/60 text-amber-300',    dot: 'bg-amber-400' },
  emerald: { card: 'bg-emerald-950/40 border-emerald-700/40',num: 'text-emerald-300', badge: 'bg-emerald-900/60 text-emerald-300',dot: 'bg-emerald-400' },
  fuchsia: { card: 'bg-fuchsia-950/40 border-fuchsia-700/40',num: 'text-fuchsia-300', badge: 'bg-fuchsia-900/60 text-fuchsia-300',dot: 'bg-fuchsia-400' },
};

export function StatCard({ label, value, sub, trend, icon, highlight, color = 'violet' }: StatCardProps) {
  const c = highlight ? colorMap[color] : colorMap.violet;
  const base = highlight ? c.card : 'bg-indigo-950/30 border-indigo-900/40';

  return (
    <div className={cn("rounded-2xl border p-5 flex flex-col gap-3 transition-all", base)}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-widest text-indigo-400">{label}</p>
        {icon && <div className="text-indigo-500">{icon}</div>}
      </div>
      <div>
        <p className={cn("text-3xl font-bold tracking-tight", highlight ? c.num : 'text-white')}>{value}</p>
        {sub && <p className="text-xs text-indigo-500 mt-0.5">{sub}</p>}
      </div>
      {trend !== undefined && (
        <div className={cn(
          "inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded-lg w-fit",
          trend > 0 ? 'bg-emerald-950/60 text-emerald-400' :
          trend < 0 ? 'bg-rose-950/60 text-rose-400' :
                      'bg-indigo-950/60 text-indigo-500'
        )}>
          <span>{trend > 0 ? '▲' : trend < 0 ? '▼' : '—'}</span>
          <span>{Math.abs(trend)}% vs ayer</span>
        </div>
      )}
    </div>
  );
}
