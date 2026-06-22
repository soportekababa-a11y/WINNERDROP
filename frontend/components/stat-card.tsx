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
  violet:  {
    iconBg: 'rgba(139,92,246,0.15)', iconColor: '#a855f7',
    gradFrom: '#e879f9', gradTo: '#7c3aed',
    glow: 'rgba(168,85,247,0.2)', border: 'rgba(168,85,247,0.2)',
  },
  amber:   {
    iconBg: 'rgba(245,158,11,0.15)', iconColor: '#fbbf24',
    gradFrom: '#fde68a', gradTo: '#f59e0b',
    glow: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.2)',
  },
  emerald: {
    iconBg: 'rgba(16,185,129,0.15)', iconColor: '#34d399',
    gradFrom: '#6ee7b7', gradTo: '#10b981',
    glow: 'rgba(16,185,129,0.15)', border: 'rgba(16,185,129,0.2)',
  },
  fuchsia: {
    iconBg: 'rgba(217,70,239,0.15)', iconColor: '#e879f9',
    gradFrom: '#f0abfc', gradTo: '#c026d3',
    glow: 'rgba(217,70,239,0.25)', border: 'rgba(217,70,239,0.25)',
  },
};

export function StatCard({ label, value, sub, trend, icon, highlight, color = 'fuchsia' }: StatCardProps) {
  const c = colorMap[color];
  return (
    <div
      className="rounded-2xl p-5 flex flex-col gap-3 transition-all duration-300 group cursor-default relative overflow-hidden"
      style={{
        background: 'rgba(60, 0, 100, 0.07)',
        backdropFilter: 'blur(16px)',
        border: `1px solid ${c.border}`,
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLElement;
        el.style.border = `1px solid ${c.glow.replace('0.2', '0.45').replace('0.25', '0.5')}`;
        el.style.boxShadow = `0 0 30px ${c.glow}, 0 0 80px ${c.glow.replace('0.2', '0.08').replace('0.25', '0.1')}, 0 20px 40px rgba(0,0,0,0.4)`;
        el.style.transform = 'translateY(-3px)';
        el.style.background = 'rgba(80, 0, 130, 0.1)';
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLElement;
        el.style.border = `1px solid ${c.border}`;
        el.style.boxShadow = 'none';
        el.style.transform = 'translateY(0)';
        el.style.background = 'rgba(60, 0, 100, 0.07)';
      }}
    >
      {/* Top gradient accent */}
      <div className="absolute top-0 left-0 right-0 h-[1px] opacity-60"
        style={{ background: `linear-gradient(90deg, transparent, ${c.iconColor}, transparent)` }} />

      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-[0.15em]"
          style={{ color: 'rgba(200,150,255,0.5)' }}>{label}</p>
        {icon && (
          <div className="w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-300 group-hover:scale-110"
            style={{
              background: c.iconBg,
              color: c.iconColor,
              boxShadow: `0 0 12px ${c.glow}`,
            }}>
            {icon}
          </div>
        )}
      </div>
      <div>
        <p className="text-3xl font-bold tracking-tight gradient-text-data">
          {value}
        </p>
        {sub && <p className="text-[11px] mt-0.5" style={{ color: 'rgba(150,220,240,0.45)' }}>{sub}</p>}
      </div>
      {trend !== undefined && (
        <div className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg w-fit"
          style={trend > 0
            ? { background: 'rgba(16,185,129,0.1)', color: '#34d399', border: '1px solid rgba(16,185,129,0.2)' }
            : trend < 0
            ? { background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }
            : { background: 'rgba(255,255,255,0.04)', color: '#6b7280', border: '1px solid rgba(255,255,255,0.06)' }
          }>
          <span>{trend > 0 ? '▲' : trend < 0 ? '▼' : '—'}</span>
          <span>{Math.abs(trend)}% vs ayer</span>
        </div>
      )}
    </div>
  );
}
