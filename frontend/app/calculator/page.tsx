'use client';

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { Sidebar } from "@/components/sidebar";
import { cn } from "@/lib/utils";
import { ChevronLeft, Star, Plus, Trash2 } from "lucide-react";

// RD base: envío=480, publicidad=500, ganancia=550
// Convertido a moneda local de cada país (1 USD ≈ 59 RD$)
const COUNTRY_CONFIG: Record<string, {
  currency: string; flag: string; name: string;
  shipping: number; adCost: number; profitMin: number;
  markups: number[]; profitOk: number;
}> = {
  RD: { currency: 'RD$',  flag: '🇩🇴', name: 'República Dominicana',
        shipping: 480,    adCost: 500,    profitMin: 550,
        markups:  [980,   1530,   2030,   2780,   3780],   profitOk: 1100 },
  GT: { currency: 'Q',    flag: '🇬🇹', name: 'Guatemala',
        shipping: 63,     adCost: 65,     profitMin: 72,
        markups:  [128,   200,    270,    370,    500],     profitOk: 144  },
  EC: { currency: '$',    flag: '🇪🇨', name: 'Ecuador',
        shipping: 8,      adCost: 9,      profitMin: 9.5,
        markups:  [17,    26.5,   36,     49,     66],      profitOk: 19   },
  CR: { currency: '₡',    flag: '🇨🇷', name: 'Costa Rica',
        shipping: 4200,   adCost: 4400,   profitMin: 4800,
        markups:  [8600,  13400,  17800,  24300,  33000],   profitOk: 9600 },
  CO: { currency: 'COP$', flag: '🇨🇴', name: 'Colombia',
        shipping: 33000,  adCost: 35000,  profitMin: 38000,
        markups:  [68000, 106000, 141000, 193000, 262000],  profitOk: 76000 },
  CL: { currency: 'CLP$', flag: '🇨🇱', name: 'Chile',
        shipping: 7800,   adCost: 8100,   profitMin: 8900,
        markups:  [15900, 24800,  33000,  45000,  61000],   profitOk: 17800 },
};

const COUNTRIES = Object.entries(COUNTRY_CONFIG).map(([code, c]) => ({ code, flag: c.flag, name: c.name, currency: c.currency }));

function markupOptions(totalCost: number, cfg: typeof COUNTRY_CONFIG[string]) {
  const fixed = cfg.shipping + cfg.adCost;
  const labels = ['Precio mínimo', 'Precio bajo', 'Precio sugerido', 'Margen alto', 'Precio premium'];
  const risks  = ['high', 'medium', 'low', 'low', 'low'];
  const tags   = [null, null, 'recomendado', null, null];
  return cfg.markups.map((markup, i) => ({
    label: labels[i], markup, risk: risks[i], tag: tags[i],
    price: totalCost + markup, profit: markup - fixed,
  }));
}

export default function CalculatorPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [country, setCountry] = useState<string | null>(null);
  const [costs, setCosts] = useState<string[]>(['']);

  useEffect(() => {
    if (!isAuthenticated()) router.replace('/login');
    else setAuthed(true);
  }, [router]);

  if (!authed) return null;

  const parsedCosts = costs.map(c => parseFloat(c.replace(/,/g, '')) || 0);
  const totalCost = parsedCosts.reduce((a, b) => a + b, 0);
  const hasResult = totalCost > 0;
  const isCombo = costs.length > 1;

  const cfg = COUNTRY_CONFIG[country ?? 'RD'];
  const fixed = cfg.shipping + cfg.adCost;
  const options = markupOptions(totalCost, cfg);
  const glass = { background: 'rgba(255,255,255,0.025)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.07)' };
  const fmt = (n: number) => cfg.currency + n.toLocaleString();

  return (
    <div className="min-h-screen bg-[#020209] flex">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 max-w-3xl w-full mx-auto px-6 py-10">

          {!country ? (
            <div className="space-y-8">
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">Calculadora de Rentabilidad</h1>
                <p className="text-gray-600 mt-1 text-sm">Elige tu mercado para continuar</p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {COUNTRIES.map(c => (
                  <button key={c.code} onClick={() => setCountry(c.code)}
                    className="relative flex flex-col items-center gap-3 p-5 rounded-2xl transition-all duration-300"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
                    onMouseEnter={e => { e.currentTarget.style.border = '1px solid rgba(139,92,246,0.4)'; e.currentTarget.style.boxShadow = '0 0 30px rgba(139,92,246,0.1)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                    onMouseLeave={e => { e.currentTarget.style.border = '1px solid rgba(255,255,255,0.07)'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'translateY(0)'; }}>
                    <span className="text-3xl">{c.flag}</span>
                    <span className="text-xs font-semibold text-gray-300 text-center leading-snug">{c.name}</span>
                    <span className="text-[10px] text-gray-600 font-mono">{c.currency}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <button onClick={() => { setCountry(null); setCosts(['']); }}
                  className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-300 transition-colors">
                  <ChevronLeft size={16} /> Países
                </button>
                <span className="text-gray-800">/</span>
                <span className="text-sm font-semibold text-gray-500">
                  {cfg.flag} {cfg.name}
                </span>
              </div>

              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">Calculadora de Rentabilidad</h1>
                <p className="text-gray-600 mt-1 text-sm">
                  {isCombo ? `Combo de ${costs.length} productos · ${cfg.name}` : `Producto individual · ${cfg.name}`}
                </p>
              </div>

              {/* Input card */}
              <div className="rounded-2xl p-6 space-y-4" style={glass}>
                <div className="space-y-3">
                  {costs.map((val, i) => (
                    <div key={i}>
                      <p className="text-sm font-semibold text-gray-300 mb-1.5">
                        {isCombo ? `Producto ${i + 1}` : 'Precio del producto'}{' '}
                        <span className="text-gray-600 font-normal">(costo en Effi)</span>
                      </p>
                      <div className="relative flex items-center gap-2">
                        <div className="relative flex-1">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600 text-sm font-semibold pointer-events-none">{cfg.currency}</span>
                          <input
                            type="number"
                            min={0}
                            placeholder="0"
                            value={val}
                            onChange={e => setCosts(prev => prev.map((c, idx) => idx === i ? e.target.value : c))}
                            className="w-full pl-11 pr-4 py-3 rounded-xl text-white text-lg font-bold outline-none transition-all duration-200 placeholder-gray-700"
                            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
                            onFocus={e => { e.target.style.border = '1px solid rgba(139,92,246,0.5)'; e.target.style.boxShadow = '0 0 20px rgba(139,92,246,0.08)'; }}
                            onBlur={e => { e.target.style.border = '1px solid rgba(255,255,255,0.07)'; e.target.style.boxShadow = 'none'; }}
                          />
                        </div>
                        {costs.length > 1 && (
                          <button onClick={() => setCosts(prev => prev.filter((_, idx) => idx !== i))}
                            className="p-2.5 rounded-xl text-gray-700 hover:text-red-400 hover:bg-red-500/10 transition-all"
                            style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <button onClick={() => setCosts(prev => [...prev, ''])}
                  className="flex items-center gap-2 text-sm font-semibold transition-colors duration-200 px-1"
                  style={{ color: '#a78bfa' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#c4b5fd')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#a78bfa')}>
                  <Plus size={15} /> Agregar producto al combo
                </button>

                {isCombo && totalCost > 0 && (
                  <div className="rounded-xl px-4 py-3 flex items-center justify-between"
                    style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)' }}>
                    <span className="text-sm font-semibold text-violet-300">Costo total del combo</span>
                    <span className="text-lg font-bold bg-clip-text text-transparent"
                      style={{ backgroundImage: 'linear-gradient(135deg, #c4b5fd, #8b5cf6)' }}>
                      {fmt(totalCost)}
                    </span>
                  </div>
                )}

                <div className="rounded-xl p-4 space-y-2" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest mb-3">Costos fijos estimados</p>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Envío</span>
                    <span className="text-gray-400 font-medium">{fmt(cfg.shipping)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Publicidad</span>
                    <span className="text-gray-400 font-medium">{fmt(cfg.adCost)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Ganancia mínima</span>
                    <span className="text-gray-400 font-medium">{fmt(cfg.profitMin)}</span>
                  </div>
                  <div className="pt-2 flex justify-between text-sm font-semibold" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                    <span className="text-gray-500">Total fijo</span>
                    <span className="text-gray-300">{fmt(fixed)}</span>
                  </div>
                </div>
              </div>

              {/* Results */}
              {hasResult && (
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-gray-400">
                    Opciones de precio{isCombo ? ' del combo' : ''}
                  </p>
                  {options.map((opt, i) => {
                    const isRec = opt.tag === 'recomendado';
                    return (
                      <div key={i} className="rounded-2xl p-5 transition-all duration-300"
                        style={isRec ? {
                          background: 'linear-gradient(135deg, rgba(124,58,237,0.12), rgba(168,85,247,0.06))',
                          border: '1px solid rgba(139,92,246,0.35)',
                          boxShadow: '0 0 30px rgba(139,92,246,0.08)',
                        } : {
                          background: 'rgba(255,255,255,0.025)',
                          border: '1px solid rgba(255,255,255,0.06)',
                        }}>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <p className={cn("text-sm font-semibold", isRec ? "text-violet-300" : "text-gray-200")}>{opt.label}</p>
                              {isRec && (
                                <span className="flex items-center gap-1 text-white text-[10px] font-bold px-2 py-0.5 rounded-full"
                                  style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}>
                                  <Star size={9} fill="white" /> Recomendado
                                </span>
                              )}
                              {opt.risk === 'high' && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                                  style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.15)' }}>
                                  Riesgo alto
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-600 mt-2">
                              <span>Costo: <span className="text-gray-400 font-medium">{fmt(totalCost)}</span></span>
                              <span>Fijos: <span className="text-gray-400 font-medium">{fmt(fixed)}</span></span>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className={cn("text-2xl font-bold", isRec ? "bg-clip-text text-transparent" : "text-white")}
                              style={isRec ? { backgroundImage: 'linear-gradient(135deg, #c4b5fd, #8b5cf6)' } : {}}>
                              {fmt(opt.price)}
                            </p>
                            <p className="text-xs font-semibold mt-0.5"
                              style={{ color: opt.profit >= cfg.profitOk ? '#34d399' : opt.profit >= cfg.profitMin ? '#fbbf24' : '#f87171' }}>
                              {fmt(opt.profit)} ganancia
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  <div className="rounded-xl px-4 py-3 text-xs space-y-1"
                    style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}>
                    <p className="font-semibold" style={{ color: '#fbbf24' }}>Sobre los costos de envío</p>
                    <p style={{ color: 'rgba(245,158,11,0.6)' }}>Envío {fmt(cfg.shipping)} · Publicidad {fmt(cfg.adCost)} · Ganancia mínima {fmt(cfg.profitMin)}</p>
                  </div>
                </div>
              )}

              {!hasResult && (
                <div className="text-center py-20">
                  <p className="text-6xl mb-3 opacity-10">🧮</p>
                  <p className="text-sm text-gray-700">Ingresa el costo del producto para ver las opciones</p>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
