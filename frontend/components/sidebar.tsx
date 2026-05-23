'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Calculator, LayoutDashboard, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getUser, clearAuth } from '@/lib/auth';
import { MomentumIcon, MomentumWordmark } from '@/components/momentum-logo';

const NAV = [
  { href: '/', label: 'Winner', icon: LayoutDashboard, desc: 'Dashboard' },
  { href: '/calculator', label: 'Rentabilidad', icon: Calculator, desc: 'Calculadora' },
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
        <div className="px-4 py-3 flex items-center justify-between gap-2" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          <p className="text-xs text-gray-700 truncate">{user.email}</p>
          <button
            onClick={() => { clearAuth(); router.replace('/login'); }}
            className="p-1.5 rounded-lg text-gray-700 hover:text-gray-300 hover:bg-white/5 transition-all shrink-0"
            title="Cerrar sesión"
          >
            <LogOut size={13} />
          </button>
        </div>
      )}
    </aside>
  );
}
