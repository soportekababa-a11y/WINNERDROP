'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Calculator, LayoutDashboard, LogOut, Settings, Zap, Clock, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getUser, clearAuth, PlanType } from '@/lib/auth';
import { MomentumIcon, MomentumWordmark } from '@/components/momentum-logo';

function daysLeft(planExpiresAt: string | null): number | null {
  if (!planExpiresAt) return null;
  const diff = new Date(planExpiresAt).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

const PLAN_BADGE: Record<PlanType, { label: string; color: string; bg: string }> = {
  free:    { label: 'Free',    color: '#6b7280', bg: 'rgba(107,114,128,0.1)' },
  basic:   { label: 'Básico',  color: '#60a5fa', bg: 'rgba(96,165,250,0.1)' },
  pro:     { label: 'Pro',     color: '#a78bfa', bg: 'rgba(139,92,246,0.15)' },
  premium: { label: 'Premium', color: '#fbbf24', bg: 'rgba(251,191,36,0.1)' },
};

const NAV = [
  { href: '/dashboard', label: 'Winner', icon: LayoutDashboard, desc: 'Dashboard' },
  { href: '/calculator', label: 'Rentabilidad', icon: Calculator, desc: 'Calculadora' },
  { href: '/meta-ads', label: 'Meta Ads IA', icon: Globe, desc: 'Crear campañas' },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const user = getUser();

  return (
    <aside className="w-56 shrink-0 flex flex-col h-screen sticky top-0 z-20"
      style={{ background: 'rgba(5,5,15,0.7)', backdropFilter: 'blur(20px)', borderRight: '1px solid rgba(255,255,255,0.05)' }}>

      {/* Brand */}
      <div className="px-5 py-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <div className="flex items-center gap-3">
          <MomentumIcon size={36} />
          <MomentumWordmark className="text-sm" />
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV.map(({ href, label, icon: Icon, desc }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium transition-all duration-200 group relative overflow-hidden",
                active
                  ? "text-white"
                  : "text-gray-500 hover:text-gray-200"
              )}
              style={active ? {
                background: 'linear-gradient(135deg, rgba(124,58,237,0.2), rgba(168,85,247,0.08))',
                border: '1px solid rgba(139,92,246,0.3)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 0 20px rgba(139,92,246,0.08)',
              } : {
                border: '1px solid transparent',
              }}
            >
              {active && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full"
                  style={{ background: 'linear-gradient(to bottom, #a78bfa, #7c3aed)' }} />
              )}
              <Icon size={16} className={cn("flex-shrink-0 transition-colors", active ? "text-violet-400" : "text-gray-600 group-hover:text-gray-400")} />
              <div>
                <p className="leading-none">{label}</p>
                <p className={cn("text-[10px] mt-0.5", active ? "text-violet-500/80" : "text-gray-700")}>{desc}</p>
              </div>
            </Link>
          );
        })}
      </nav>

      {/* User */}
      {user && (
        <div className="px-4 py-3 space-y-2" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          {/* Plan badge */}
          {(() => {
            const badge = PLAN_BADGE[user.plan as PlanType] ?? PLAN_BADGE.free;
            const days = user.plan !== 'free' ? daysLeft(user.planExpiresAt) : null;
            const expired = days !== null && days <= 0;
            const urgent = days !== null && days > 0 && days <= 5;
            return (
              <div className="space-y-1.5">
                <Link href={user.plan === 'free' || user.plan === 'basic' ? '/pricing' : '#'}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg w-fit transition-all duration-200 hover:opacity-80"
                  style={{ background: badge.bg, border: `1px solid ${badge.color}22` }}>
                  <Zap size={10} style={{ color: badge.color }} />
                  <span className="text-[10px] font-bold" style={{ color: badge.color }}>{badge.label}</span>
                </Link>
                {days !== null && (
                  <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg"
                    style={{
                      background: expired ? 'rgba(239,68,68,0.12)' : urgent ? 'rgba(251,146,60,0.12)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${expired ? 'rgba(239,68,68,0.3)' : urgent ? 'rgba(251,146,60,0.3)' : 'rgba(255,255,255,0.06)'}`,
                    }}>
                    <Clock size={9} style={{ color: expired ? '#ef4444' : urgent ? '#fb923c' : '#6b7280' }} />
                    <span className="text-[10px] font-semibold" style={{ color: expired ? '#ef4444' : urgent ? '#fb923c' : '#9ca3af' }}>
                      {expired ? 'Plan vencido' : days === 1 ? 'Te queda 1 día' : `Te quedan ${days} días`}
                    </span>
                  </div>
                )}
              </div>
            );
          })()}
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-gray-700 truncate">{user.email}</p>
            <div className="flex items-center gap-1 shrink-0">
              {user.plan === 'basic' && (
                <Link href="/settings"
                  className="p-1.5 rounded-lg text-gray-700 hover:text-gray-300 hover:bg-white/5 transition-all"
                  title="Configuración">
                  <Settings size={13} />
                </Link>
              )}
              <button
                onClick={() => { clearAuth(); router.replace('/login'); }}
                className="p-1.5 rounded-lg text-gray-700 hover:text-gray-300 hover:bg-white/5 transition-all"
                title="Cerrar sesión">
                <LogOut size={13} />
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
