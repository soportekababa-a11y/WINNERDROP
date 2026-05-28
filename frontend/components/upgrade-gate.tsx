'use client';

import { useRouter } from 'next/navigation';
import { Lock } from 'lucide-react';

interface UpgradeGateProps {
  plan?: string;
  message?: string;
  children: React.ReactNode;
}

export function UpgradeGate({ plan = 'Pro', message, children }: UpgradeGateProps) {
  const router = useRouter();
  return (
    <div className="relative">
      <div className="blur-sm pointer-events-none select-none">{children}</div>
      <div className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl"
        style={{ background: 'rgba(2,2,9,0.85)', backdropFilter: 'blur(8px)', border: '1px solid rgba(139,92,246,0.2)' }}>
        <Lock size={22} className="text-violet-500 mb-3" />
        <p className="text-white font-semibold text-sm">Requiere plan {plan}</p>
        {message && <p className="text-gray-600 text-xs mt-1 text-center max-w-[200px]">{message}</p>}
        <button
          onClick={() => router.push('/pricing')}
          className="mt-4 px-5 py-2 rounded-xl text-sm font-semibold transition-all duration-200"
          style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)', color: 'white', boxShadow: '0 0 20px rgba(139,92,246,0.3)' }}>
          Ver planes
        </button>
      </div>
    </div>
  );
}
