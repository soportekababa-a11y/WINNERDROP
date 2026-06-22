'use client';

import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { Check, MessageCircle, Zap, Crown, Globe } from 'lucide-react';

const PLANS = [
  {
    id: 'basic',
    name: 'Básico',
    price: '$22/mes',
    Icon: Zap,
    color: '#60a5fa',
    gradient: 'rgba(96,165,250,0.08)',
    border: 'rgba(96,165,250,0.25)',
    features: [
      '1 país a elegir',
      '1 plataforma (Effi o Dropi)',
      'Todos los productos del país',
      'Gráficos históricos',
      'Competitor Spy',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 'RD$X/mes',
    Icon: Globe,
    color: '#a78bfa',
    gradient: 'rgba(139,92,246,0.12)',
    border: 'rgba(139,92,246,0.4)',
    popular: true,
    features: [
      'Todos los países (RD, GT, EC, CR, CO)',
      'Effi + Dropi (todos los países)',
      'Todos los productos',
      'Gráficos históricos',
      'Competitor Spy',
    ],
  },
  {
    id: 'premium',
    name: 'Premium',
    price: 'RD$X/mes',
    Icon: Crown,
    color: '#fbbf24',
    gradient: 'rgba(251,191,36,0.07)',
    border: 'rgba(251,191,36,0.3)',
    features: [
      'Todo lo de Pro',
      'Bot WhatsApp (AutoConfirm)',
      'Todas las plataformas',
      'Soporte prioritario',
    ],
  },
];

const WA_NUMBER = '18299607483';

export default function PricingPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <main className="max-w-4xl mx-auto w-full px-6 py-12 space-y-10">

          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold text-white">Elige tu plan</h1>
            <p className="text-gray-600 text-sm">Activa tu suscripción por WhatsApp — activación en minutos</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {PLANS.map(({ id, name, price, Icon, color, gradient, border, popular, features }) => (
              <div key={id} className="rounded-2xl p-6 space-y-5 relative flex flex-col"
                style={{ background: gradient, border: `1px solid ${border}` }}>
                {popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap"
                    style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)', color: 'white' }}>
                    Popular
                  </div>
                )}

                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Icon size={16} style={{ color }} />
                    <p className="text-lg font-bold" style={{ color }}>{name}</p>
                  </div>
                  <p className="text-2xl font-bold text-white">{price}</p>
                </div>

                <ul className="space-y-2 flex-1">
                  {features.map(f => (
                    <li key={f} className="flex items-start gap-2 text-sm text-gray-400">
                      <Check size={13} style={{ color }} className="shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>

                <a
                  href={`https://wa.me/${WA_NUMBER}?text=Hola,%20quiero%20suscribirme%20al%20plan%20${encodeURIComponent(name)}%20de%20WinnerDrop`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-semibold transition-all duration-200"
                  style={{ background: `rgba(${color === '#60a5fa' ? '96,165,250' : color === '#a78bfa' ? '139,92,246' : '251,191,36'},0.15)`, border: `1px solid ${border}`, color }}>
                  <MessageCircle size={14} />
                  Activar por WhatsApp
                </a>
              </div>
            ))}
          </div>

          <p className="text-center text-xs text-gray-700">
            ¿Ya tienes un plan? <button onClick={() => router.push('/')} className="text-violet-500 hover:text-violet-400 transition-colors">Volver al dashboard</button>
          </p>
        </main>
      </div>
    </div>
  );
}
