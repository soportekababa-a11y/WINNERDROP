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
  violet:  { iconBg: 'rgba(124,58,237,0.15)', iconColor: '#a78bfa', gradFrom: '#c4b5fd', gradTo: '#8b5cf6' },
  amber:   { iconBg: 'rgba(245,158,11,0.15)', iconColor: '#fbbf24', gradFrom: '#fde68a', gradTo: '#f59e0b' },
  emerald: { iconBg: 'rgba(16,185,129,0.15)', iconColor: '#34d399', gradFrom: '#6ee7b7', gradTo: '#10b981' },
  fuchsia: { iconBg: 'rgba(168,85,247,0.15)', iconColor: '#c084fc', gradFrom: '#e879f9', gradTo: '#a855f7' },
};

export function StatCard({ label, value, sub, trend, icon, highlight, color = 'violet' }: StatCardProps) {
  const c = colorMap[color];
  return (
    <div
      className="rounded-2xl p-5 flex flex-col gap-3 transition-all duration-300 group cursor-default"
      style={{
        background: 'rgba(255,255,255,0.025)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.07)',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.border = `1px solid rgba(139,92,246,0.25)`;
        (e.currentTarget as HTMLElement).style.boxShadow = '0 0 40px rgba(139,92,246,0.08), 0 8px 32px rgba(0,0,0,0.3)';
        (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.border = '1px solid rgba(255,255,255,0.07)';
        (e.currentTarget as HTMLElement).style.boxShadow = 'none';
        (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
      }}
    >
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-600">{label}</p>
        {icon && (
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: c.iconBg, color: c.iconColor }}>
            {icon}
          </div>
        )}
      </div>
      <div>
        <p className={cn("text-3xl font-bold tracking-tight", highlight ? "bg-clip-text text-transparent" : "text-white")}
          style={highlight ? { backgroundImage: `linear-gradient(135deg, ${c.gradFrom}, ${c.gradTo})` } : {}}>
          {value}
        </p>
        {sub && <p className="text-xs text-gray-600 mt-0.5">{sub}</p>}
      </div>
      {trend !== undefined && (
        <div className={cn("inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg w-fit")}
          style={trend > 0
            ? { background: 'rgba(16,185,129,0.1)', color: '#34d399', border: '1px solid rgba(16,185,129,0.15)' }
            : trend < 0
            ? { background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.15)' }
            : { background: 'rgba(255,255,255,0.04)', color: '#6b7280', border: '1px solid rgba(255,255,255,0.06)' }
          }>
          <span>{trend > 0 ? '▲' : trend < 0 ? '▼' : '—'}</span>
          <span>{Math.abs(trend)}% vs ayer</span>
        </div>
      )}
    </div>
  );
}
