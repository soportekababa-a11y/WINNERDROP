'use client';

import Link from 'next/link';
import { MomentumIcon, MomentumWordmark } from '@/components/momentum-logo';
import { Check, MessageCircle, TrendingUp, Globe, Zap, BarChart2, Search, Bot, Crown } from 'lucide-react';

const WA_NUMBER = '18299607483';
const waLink = (plan: string) =>
  `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(`Hola, quiero suscribirme al plan ${plan} de MOMENTUM`)}`;

const FEATURES = [
  { icon: TrendingUp, title: 'Productos Ganadores',  desc: 'Los productos más vendidos de Effi actualizados cada 30 minutos.' },
  { icon: BarChart2,  title: 'Historial de ventas',  desc: 'Gráficos diarios de hasta 60 días para detectar tendencias.' },
  { icon: Globe,      title: 'Multi-País',            desc: 'Rep. Dominicana, Guatemala, Ecuador, Costa Rica y Colombia.' },
  { icon: Search,     title: 'Competitor Spy',        desc: 'Encuentra los anuncios de tus competidores para cualquier producto.' },
  { icon: Zap,        title: 'Tiempo real',           desc: 'Sin recargar. Los datos se actualizan automáticamente.' },
  { icon: Bot,        title: 'AutoConfirm WhatsApp',  desc: 'Bot que confirma pedidos Shopify por WhatsApp. Solo plan Premium.' },
];

const PLANS = [
  {
    id: 'Básico',
    price: 20,
    color: '#60a5fa',
    gradient: 'rgba(96,165,250,0.07)',
    border: 'rgba(96,165,250,0.2)',
    features: ['1 país a elegir', '1 plataforma (Effi o Dropi)', 'Todos los productos', 'Historial + gráficos', 'Competitor Spy'],
  },
  {
    id: 'Pro',
    price: 29,
    color: '#a78bfa',
    gradient: 'rgba(139,92,246,0.12)',
    border: 'rgba(139,92,246,0.35)',
    popular: true,
    features: ['Todos los países', 'Effi + Dropi', 'Todos los productos', 'Historial + gráficos', 'Competitor Spy'],
  },
  {
    id: 'Premium',
    price: 46,
    color: '#fbbf24',
    gradient: 'rgba(251,191,36,0.07)',
    border: 'rgba(251,191,36,0.25)',
    features: ['Todo lo de Pro', 'Bot WhatsApp AutoConfirm', 'Todas las plataformas', 'Soporte prioritario'],
  },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-[#020209] text-white">

      {/* Nav */}
      <nav className="sticky top-0 z-50 px-6 py-4 flex items-center justify-between"
        style={{ background: 'rgba(2,2,9,0.85)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="flex items-center gap-3">
          <MomentumIcon size={32} />
          <MomentumWordmark className="text-base" />
        </div>
        <Link href="/login"
          className="px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200"
          style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', color: '#a78bfa' }}>
          Iniciar sesión
        </Link>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-24 pb-20 text-center space-y-6">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-2"
          style={{ background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.25)', color: '#a78bfa' }}>
          <Zap size={11} /> Datos en tiempo real desde Effi
        </div>
        <h1 className="text-5xl md:text-6xl font-extrabold leading-tight tracking-tight">
          Descubre los productos<br />
          <span style={{ background: 'linear-gradient(135deg, #a78bfa, #e879f9)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            que más venden hoy
          </span>
        </h1>
        <p className="text-lg text-gray-500 max-w-xl mx-auto leading-relaxed">
          Inteligencia de productos para dropshipping en Latinoamérica. Ventas reales, historial completo, análisis de competencia.
        </p>
        <div className="flex items-center justify-center gap-4 pt-2 flex-wrap">
          <a href={waLink('Pro')} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold transition-all duration-200"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)', boxShadow: '0 0 32px rgba(139,92,246,0.4)', color: 'white' }}>
            <MessageCircle size={16} /> Empezar ahora
          </a>
          <Link href="/login" className="px-6 py-3 rounded-2xl text-sm font-semibold text-gray-500 hover:text-gray-300 transition-colors">
            Ya tengo cuenta →
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-6 py-20">
        <h2 className="text-2xl font-bold text-center mb-12">Todo lo que necesitas para vender más</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="rounded-2xl p-5 space-y-3 transition-all duration-200"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.2)' }}>
                <Icon size={17} className="text-violet-400" />
              </div>
              <p className="font-semibold text-white text-sm">{title}</p>
              <p className="text-gray-600 text-xs leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-3xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-bold text-center mb-12">¿Cómo funciona?</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
          {[
            { step: '01', title: 'Elige tu plan', desc: 'Selecciona el plan que más se adapte a tu negocio y escríbeme por WhatsApp.' },
            { step: '02', title: 'Recibe tu acceso', desc: 'Te creo una cuenta con tu correo y contraseña en menos de 10 minutos.' },
            { step: '03', title: 'Empieza a ganar', desc: 'Accede al dashboard, descubre los winners y escala tus ventas.' },
          ].map(({ step, title, desc }) => (
            <div key={step} className="space-y-3">
              <div className="text-3xl font-black" style={{ color: 'rgba(139,92,246,0.35)' }}>{step}</div>
              <p className="font-semibold text-white">{title}</p>
              <p className="text-gray-600 text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="planes" className="max-w-5xl mx-auto px-6 py-20">
        <h2 className="text-2xl font-bold text-center mb-3">Planes</h2>
        <p className="text-center text-gray-600 text-sm mb-12">Activación por WhatsApp · en minutos</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-14">
          {PLANS.map(({ id, price, color, gradient, border, popular, features }) => (
            <div key={id} className="rounded-2xl p-6 flex flex-col gap-5 relative"
              style={{ background: gradient, border: `1px solid ${border}` }}>
              {popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap"
                  style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)', color: 'white' }}>
                  Popular
                </div>
              )}
              <div className="flex items-center gap-2">
                {id === 'Premium' ? <Crown size={16} style={{ color }} /> : <Zap size={16} style={{ color }} />}
                <p className="text-lg font-bold" style={{ color }}>{id}</p>
              </div>
              <div className="flex items-end gap-1">
                <span className="text-4xl font-black text-white">${price}</span>
                <span className="text-gray-500 text-sm mb-1">/mes</span>
              </div>
              <ul className="space-y-2 flex-1">
                {features.map(f => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-400">
                    <Check size={13} style={{ color }} className="shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
              <a href={waLink(id)} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200"
                style={{ background: gradient, border: `1px solid ${border}`, color }}>
                <MessageCircle size={14} /> Activar plan {id}
              </a>
            </div>
          ))}
        </div>

        {/* Ya tienes cuenta */}
        <div className="text-center rounded-2xl py-10 px-6"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
          <p className="text-white font-semibold mb-2">¿Ya tienes una cuenta activa?</p>
          <p className="text-gray-600 text-sm mb-5">Inicia sesión con el correo y contraseña que te enviamos</p>
          <Link href="/login"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all duration-200"
            style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', color: '#a78bfa' }}>
            Iniciar sesión aquí →
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 px-6 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <MomentumIcon size={20} />
          <MomentumWordmark className="text-sm" />
        </div>
        <p className="text-gray-700 text-xs">Inteligencia de productos para dropshipping · Latinoamérica</p>
      </footer>
    </div>
  );
}
