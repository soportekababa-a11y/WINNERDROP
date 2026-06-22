'use client';

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { Sidebar } from "@/components/sidebar";
import { cn } from "@/lib/utils";
import { ChevronLeft, Star, Plus, Trash2, Calculator } from "lucide-react";

const COUNTRY_CONFIG: Record<string, {
  currency: string; flag: string; name: string;
  shipping: number; adCost: number; profitMin: number;
  markups: number[]; profitOk: number;
}> = {
  RD: { currency: 'RD$',  flag: '🇩🇴', name: 'República Dominicana',
        shipping: 480,   adCost: 500,   profitMin: 550,
        markups:  [1160, 1368, 1530, 1660, 1755], profitOk: 680  },
  GT: { currency: 'Q',   flag: '🇬🇹', name: 'Guatemala',
        shipping: 63,    adCost: 65,    profitMin: 72,
        markups:  [152,  179,  200,  217,  229],  profitOk: 89   },
  EC: { currency: '$',   flag: '🇪🇨', name: 'Ecuador',
        shipping: 8,     adCost: 9,     profitMin: 9.5,
        markups:  [20,   24,   26.5, 29,   30.5], profitOk: 12   },
  CR: { currency: '₡',   flag: '🇨🇷', name: 'Costa Rica',
        shipping: 4200,  adCost: 4400,  profitMin: 4800,
        markups:  [10200,12000,13400,14600,15400], profitOk: 6000 },
  CO: { currency: 'COP$',flag: '🇨🇴', name: 'Colombia',
        shipping: 33000, adCost: 35000, profitMin: 38000,
        markups:  [80500,95000,106000,115000,122000], profitOk: 47000 },
  CL: { currency: 'CLP$',flag: '🇨🇱', name: 'Chile',
        shipping: 7800,  adCost: 8100,  profitMin: 8900,
        markups:  [18800,22200,24800,27000,28500], profitOk: 11000 },
};

const COUNTRIES = Object.entries(COUNTRY_CONFIG).map(([code, c]) => ({ code, flag: c.flag, name: c.name, currency: c.currency }));

function attractivePrice(raw: number): number {
  const unit = raw < 100 ? 5 : raw < 1000 ? 50 : raw < 10000 ? 100 : raw < 100000 ? 500 : 5000;
  const r = Math.ceil(raw / unit) * unit;
  return r % (unit * 2) === 0 ? r - 1 : r;
}

function markupOptions(totalCost: number, cfg: typeof COUNTRY_CONFIG[string]) {
  const fixed = cfg.shipping + cfg.adCost;
  const labels = ['Precio mínimo', 'Precio bajo', 'Precio sugerido', 'Margen alto', 'Precio premium'];
  const risks  = ['medium', 'medium', 'low', 'low', 'low'];
  const tags   = [null, null, 'recomendado', null, null];
  return cfg.markups.map((markup, i) => {
    const price = attractivePrice(totalCost + markup);
    return { label: labels[i], markup, risk: risks[i], tag: tags[i], price, profit: price - totalCost - fixed };
  });
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
  const glass = { background: 'rgba(40,0,80,0.08)', backdropFilter: 'blur(20px)', border: '1px solid rgba(150,0,220,0.12)' };
  const fmt = (n: number) => cfg.currency + n.toLocaleString();

  const inputStyle = {
    background: 'rgba(40,0,70,0.3)',
    border: '1px solid rgba(150,0,220,0.18)',
    color: 'white',
  };

  return (
    <div className="min-h-screen flex" style={{ background: 'transparent' }}>
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 max-w-3xl w-full mx-auto px-6 py-10">

          {!country ? (
            <div className="space-y-8">
              <div>
                <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2.5 mb-1">
                  <Calculator size={22} style={{ color: '#d946ef', filter: 'drop-shadow(0 0 8px rgba(217,70,239,0.7))' }} />
                  <span className="gradient-text">Momentum Profit</span>
                </h1>
                <p className="text-sm" style={{ color: 'rgba(180,130,220,0.5)' }}>Elige tu mercado para calcular rentabilidad</p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {COUNTRIES.map(c => (
                  <button key={c.code} onClick={() => setCountry(c.code)}
                    className="relative flex flex-col items-center gap-3 p-5 rounded-2xl transition-all duration-300 group overflow-hidden"
                    style={{ background: 'rgba(40,0,80,0.08)', border: '1px solid rgba(150,0,220,0.12)' }}
                    onMouseEnter={e => {
                      e.currentTarget.style.border = '1px solid rgba(217,70,239,0.4)';
                      e.currentTarget.style.boxShadow = '0 0 30px rgba(217,70,239,0.12)';
                      e.currentTarget.style.transform = 'translateY(-3px)';
                      e.currentTarget.style.background = 'rgba(60,0,110,0.15)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.border = '1px solid rgba(150,0,220,0.12)';
                      e.currentTarget.style.boxShadow = 'none';
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.background = 'rgba(40,0,80,0.08)';
                    }}>
                    <div className="absolute top-0 left-0 right-0 h-[1px] opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ background: 'linear-gradient(90deg, transparent, rgba(217,70,239,0.5), transparent)' }} />
                    <span className="text-3xl">{c.flag}</span>
                    <span className="text-xs font-semibold text-gray-300 text-center leading-snug">{c.name}</span>
                    <span className="text-[10px] font-mono" style={{ color: '#22d3ee' }}>{c.currency}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <button onClick={() => { setCountry(null); setCosts(['']); }}
                  className="flex items-center gap-1 text-sm transition-colors"
                  style={{ color: 'rgba(180,130,220,0.5)' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#d946ef')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'rgba(180,130,220,0.5)')}>
                  <ChevronLeft size={16} /> Países
                </button>
                <span style={{ color: 'rgba(150,0,220,0.3)' }}>/</span>
                <span className="text-sm font-semibold" style={{ color: 'rgba(217,70,239,0.7)' }}>
                  {cfg.flag} {cfg.name}
                </span>
              </div>

              <div>
                <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2.5 mb-1">
                  <Calculator size={20} style={{ color: '#d946ef', filter: 'drop-shadow(0 0 8px rgba(217,70,239,0.7))' }} />
                  <span className="gradient-text">Calculadora de Rentabilidad</span>
                </h1>
                <p className="text-sm" style={{ color: 'rgba(180,130,220,0.5)' }}>
                  {isCombo ? `Combo de ${costs.length} productos · ${cfg.name}` : `Producto individual · ${cfg.name}`}
                </p>
              </div>

              {/* Input card */}
              <div className="rounded-2xl p-6 space-y-4 relative overflow-hidden" style={glass}>
                <div className="absolute top-0 left-0 right-0 h-[1px]"
                  style={{ background: 'linear-gradient(90deg, transparent, rgba(217,70,239,0.4), transparent)' }} />

                <div className="space-y-3">
                  {costs.map((val, i) => (
                    <div key={i}>
                      <p className="text-sm font-semibold text-gray-300 mb-1.5">
                        {isCombo ? `Producto ${i + 1}` : 'Precio del producto'}{' '}
                        <span style={{ color: 'rgba(180,130,220,0.4)' }} className="font-normal text-xs">(costo en Effi)</span>
                      </p>
                      <div className="relative flex items-center gap-2">
                        <div className="relative flex-1">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold pointer-events-none" style={{ color: '#22d3ee' }}>{cfg.currency}</span>
                          <input
                            type="number" min={0} placeholder="0" value={val}
                            onChange={e => setCosts(prev => prev.map((c, idx) => idx === i ? e.target.value : c))}
                            className="w-full pl-12 pr-4 py-3 rounded-xl text-lg font-bold outline-none transition-all duration-200 placeholder-gray-700"
                            style={{ ...inputStyle, color: '#22d3ee' }}
                            onFocus={e => { e.target.style.border = '1px solid rgba(34,211,238,0.5)'; e.target.style.boxShadow = '0 0 20px rgba(34,211,238,0.1)'; }}
                            onBlur={e => { e.target.style.border = '1px solid rgba(150,0,220,0.18)'; e.target.style.boxShadow = 'none'; }}
                          />
                        </div>
                        {costs.length > 1 && (
                          <button onClick={() => setCosts(prev => prev.filter((_, idx) => idx !== i))}
                            className="p-2.5 rounded-xl text-gray-700 hover:text-red-400 hover:bg-red-500/10 transition-all"
                            style={{ border: '1px solid rgba(150,0,220,0.1)' }}>
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <button onClick={() => setCosts(prev => [...prev, ''])}
                  className="flex items-center gap-2 text-sm font-semibold transition-colors duration-200 px-1"
                  style={{ color: '#d946ef' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#f0abfc')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#d946ef')}>
                  <Plus size={15} /> Agregar producto al combo
                </button>

                {isCombo && totalCost > 0 && (
                  <div className="rounded-xl px-4 py-3 flex items-center justify-between"
                    style={{ background: 'rgba(34,211,238,0.06)', border: '1px solid rgba(34,211,238,0.2)' }}>
                    <span className="text-sm font-semibold" style={{ color: 'rgba(34,211,238,0.7)' }}>Costo total del combo</span>
                    <span className="text-lg font-bold gradient-text-data">{fmt(totalCost)}</span>
                  </div>
                )}

                <div className="rounded-xl p-4 space-y-2" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(150,0,220,0.08)' }}>
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: 'rgba(180,130,220,0.4)' }}>Costos fijos estimados</p>
                  {[
                    { label: 'Envío', val: cfg.shipping },
                    { label: 'Publicidad', val: cfg.adCost },
                    { label: 'Ganancia mínima', val: cfg.profitMin },
                  ].map(row => (
                    <div key={row.label} className="flex justify-between text-sm">
                      <span style={{ color: 'rgba(180,130,220,0.4)' }}>{row.label}</span>
                      <span className="font-medium" style={{ color: 'rgba(34,211,238,0.6)' }}>{fmt(row.val)}</span>
                    </div>
                  ))}
                  <div className="pt-2 flex justify-between text-sm font-semibold" style={{ borderTop: '1px solid rgba(150,0,220,0.08)' }}>
                    <span style={{ color: 'rgba(180,130,220,0.5)' }}>Total fijo</span>
                    <span className="gradient-text-data">{fmt(fixed)}</span>
                  </div>
                </div>
              </div>

              {/* Results */}
              {hasResult && (
                <div className="space-y-3">
                  <p className="text-sm font-semibold" style={{ color: 'rgba(180,130,220,0.6)' }}>
                    Opciones de precio{isCombo ? ' del combo' : ''}
                  </p>
                  {options.map((opt, i) => {
                    const isRec = opt.tag === 'recomendado';
                    const profitColor = opt.profit >= cfg.profitOk ? '#4ade80' : opt.profit >= cfg.profitMin ? '#fbbf24' : '#f87171';
                    return (
                      <div key={i} className="rounded-2xl p-5 transition-all duration-300 relative overflow-hidden group cursor-default"
                        style={isRec ? {
                          background: 'linear-gradient(135deg, rgba(192,38,211,0.12), rgba(124,58,237,0.06))',
                          border: '1px solid rgba(217,70,239,0.35)',
                          boxShadow: '0 0 30px rgba(217,70,239,0.1)',
                        } : {
                          background: 'rgba(40,0,80,0.07)',
                          border: '1px solid rgba(150,0,220,0.12)',
                        }}
                        onMouseEnter={e => {
                          if (!isRec) { e.currentTarget.style.border = '1px solid rgba(150,0,220,0.25)'; e.currentTarget.style.transform = 'translateY(-2px)'; }
                        }}
                        onMouseLeave={e => {
                          if (!isRec) { e.currentTarget.style.border = '1px solid rgba(150,0,220,0.12)'; e.currentTarget.style.transform = 'translateY(0)'; }
                        }}>
                        {isRec && (
                          <div className="absolute top-0 left-0 right-0 h-[1px]"
                            style={{ background: 'linear-gradient(90deg, transparent, rgba(217,70,239,0.7), transparent)' }} />
                        )}
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <p className={cn("text-sm font-semibold", isRec ? "text-fuchsia-300" : "text-gray-300")}>{opt.label}</p>
                              {isRec && (
                                <span className="flex items-center gap-1 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full"
                                  style={{ background: 'linear-gradient(135deg, #c026d3, #7c3aed)', boxShadow: '0 0 12px rgba(192,38,211,0.4)' }}>
                                  <Star size={9} fill="white" /> Recomendado
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs">
                              <span style={{ color: 'rgba(180,130,220,0.4)' }}>Costo: <span style={{ color: 'rgba(34,211,238,0.6)' }}>{fmt(totalCost)}</span></span>
                              <span style={{ color: 'rgba(180,130,220,0.4)' }}>Fijos: <span style={{ color: 'rgba(34,211,238,0.6)' }}>{fmt(fixed)}</span></span>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-2xl font-bold gradient-text-data">{fmt(opt.price)}</p>
                            <p className="text-xs font-bold mt-0.5" style={{ color: profitColor }}>
                              {fmt(opt.profit)} ganancia
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  <div className="rounded-xl px-4 py-3 text-xs space-y-1"
                    style={{ background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.12)' }}>
                    <p className="font-semibold" style={{ color: '#fbbf24' }}>Costos fijos incluidos</p>
                    <p style={{ color: 'rgba(245,158,11,0.5)' }}>Envío {fmt(cfg.shipping)} · Publicidad {fmt(cfg.adCost)} · Ganancia mínima {fmt(cfg.profitMin)}</p>
                  </div>
                </div>
              )}

              {!hasResult && (
                <div className="text-center py-20">
                  <p className="text-6xl mb-3 opacity-10">🧮</p>
                  <p className="text-sm" style={{ color: 'rgba(180,130,220,0.4)' }}>Ingresa el costo del producto para ver las opciones</p>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
