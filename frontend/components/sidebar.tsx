'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Zap, Calculator, LayoutDashboard, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getUser, clearAuth } from '@/lib/auth';
import { ScraperStatus } from './scraper-status';

const NAV = [
  { href: '/', label: 'Winner', icon: LayoutDashboard, desc: 'Dashboard' },
  { href: '/calculator', label: 'Rentabilidad', icon: Calculator, desc: 'Calculadora' },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const user = getUser();

  return (
    <aside className="w-52 shrink-0 bg-white border-r border-gray-200 flex flex-col h-screen sticky top-0">
      {/* Brand */}
      <div className="px-4 py-5 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-sm">
            <Zap size={14} className="text-white" />
          </div>
          <div>
            <p className="font-bold text-gray-900 text-sm leading-none">WinnerDrop</p>
            <p className="text-[10px] text-gray-400 mt-0.5">Effi RD</p>
          </div>
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
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group",
                active
                  ? "bg-indigo-50 text-indigo-700"
                  : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"
              )}
            >
              <Icon size={16} className={active ? "text-indigo-600" : "text-gray-400 group-hover:text-gray-600"} />
              <div>
                <p className="leading-none">{label}</p>
                <p className={cn("text-[10px] mt-0.5", active ? "text-indigo-400" : "text-gray-400")}>{desc}</p>
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Scraper */}
      <div className="px-4 py-3 border-t border-gray-100">
        <ScraperStatus />
      </div>

      {/* User */}
      {user && (
        <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between gap-2">
          <p className="text-xs text-gray-400 truncate">{user.email}</p>
          <button
            onClick={() => { clearAuth(); router.replace('/login'); }}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors shrink-0"
            title="Cerrar sesión"
          >
            <LogOut size={13} />
          </button>
        </div>
      )}
    </aside>
  );
}
