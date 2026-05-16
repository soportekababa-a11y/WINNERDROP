'use client';

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { Sidebar } from "@/components/sidebar";
import { cn } from "@/lib/utils";
import { ChevronLeft, Star } from "lucide-react";

const COUNTRIES = [
  { code: 'RD', flag: '🇩🇴', name: 'República Dominicana', active: true },
  { code: 'CO', flag: '🇨🇴', name: 'Colombia', active: false },
  { code: 'MX', flag: '🇲🇽', name: 'México', active: false },
  { code: 'US', flag: '🇺🇸', name: 'Estados Unidos', active: false },
];

const SHIPPING_MIN = 350;
const SHIPPING_MAX = 500;
const SHIPPING_AVG = 425;
const AD_COST = 500;
const FIXED = SHIPPING_AVG + AD_COST; // 925

const OPTIONS = [
  { label: 'Precio mínimo',   markup: 1100, profit: 1100 - FIXED, risk: 'high',   tag: null },
  { label: 'Precio bajo',     markup: 1300, profit: 1300 - FIXED, risk: 'medium', tag: null },
  { label: 'Precio sugerido', markup: 1450, profit: 1450 - FIXED, risk: 'low',    tag: 'recomendado' },
  { label: 'Margen alto',     markup: 1700, profit: 1700 - FIXED, risk: 'low',    tag: null },
  { label: 'Precio premium',  markup: 2100, profit: 2100 - FIXED, risk: 'low',    tag: null },
];

export default function CalculatorPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [country, setCountry] = useState<string | null>(null);
  const [cost, setCost] = useState('');

  useEffect(() => {
    if (!isAuthenticated()) router.replace('/login');
    else setAuthed(true);
  }, [router]);

  if (!authed) return null;

  const costNum = parseFloat(cost.replace(/,/g, '')) || 0;
  const hasResult = costNum > 0;

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 max-w-3xl w-full mx-auto px-6 py-10">

          {/* Country selector */}
          {!country ? (
            <div className="space-y-8">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Calculadora de Rentabilidad</h1>
                <p className="text-gray-400 mt-1 text-sm">Elige tu país para continuar</p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {COUNTRIES.map(c => (
                  <button
                    key={c.code}
                    onClick={() => c.active && setCountry(c.code)}
                    disabled={!c.active}
                    className={cn(
                      "relative flex flex-col items-center gap-2 p-5 rounded-2xl border transition-all",
                      c.active
                        ? "bg-white border-gray-200 hover:border-indigo-400 hover:shadow-md cursor-pointer"
                        : "bg-gray-50 border-gray-100 cursor-not-allowed opacity-50"
                    )}
                  >
                    <span className="text-3xl">{c.flag}</span>
                    <span className="text-xs font-semibold text-gray-700 text-center leading-snug">{c.name}</span>
                    {!c.active && (
                      <span className="text-[10px] text-gray-400">Próximamente</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Header */}
              <div className="flex items-center gap-3">
                <button onClick={() => { setCountry(null); setCost(''); }}
                  className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-700 transition-colors">
                  <ChevronLeft size={16} />
                  Países
                </button>
                <span className="text-gray-200">/</span>
                <span className="text-sm font-semibold text-gray-700">🇩🇴 República Dominicana</span>
              </div>

              <div>
                <h1 className="text-2xl font-bold text-gray-900">Calculadora de Rentabilidad</h1>
                <p className="text-gray-400 mt-1 text-sm">Dropshipping & E-commerce · República Dominicana</p>
              </div>

              {/* Input */}
              <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-4">
                <label className="block">
                  <p className="text-sm font-semibold text-gray-700 mb-1.5">Precio del producto <span className="text-gray-400 font-normal">(costo en Effi)</span></p>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-semibold">RD$</span>
                    <input
                      type="number"
                      min={0}
                      placeholder="0"
                      value={cost}
                      onChange={e => setCost(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl text-gray-900 text-lg font-bold focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
                    />
                  </div>
                </label>

                {/* Fixed costs breakdown */}
                <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Costos fijos estimados</p>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Envío (zona RD)</span>
                    <span className="text-gray-700 font-medium">RD${SHIPPING_MIN.toLocaleString()} – RD${SHIPPING_MAX.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Publicidad estimada</span>
                    <span className="text-gray-700 font-medium">RD${AD_COST.toLocaleString()}</span>
                  </div>
                  <div className="border-t border-gray-200 pt-2 flex justify-between text-sm font-semibold">
                    <span className="text-gray-600">Total costos fijos</span>
                    <span className="text-gray-900">~RD${FIXED.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Results */}
              {hasResult && (
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-gray-700">Opciones de precio de venta</p>

                  {OPTIONS.map((opt, i) => {
                    const price = costNum + opt.markup;
                    const isRec = opt.tag === 'recomendado';
                    return (
                      <div key={i} className={cn(
                        "bg-white border rounded-2xl p-5 transition-all",
                        isRec
                          ? "border-indigo-300 shadow-md ring-1 ring-indigo-200"
                          : "border-gray-200 shadow-sm"
                      )}>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <p className={cn("text-sm font-semibold", isRec ? "text-indigo-700" : "text-gray-700")}>{opt.label}</p>
                              {isRec && (
                                <span className="flex items-center gap-1 bg-indigo-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                                  <Star size={9} fill="white" /> Recomendado
                                </span>
                              )}
                              {opt.risk === 'high' && (
                                <span className="bg-red-100 text-red-600 text-[10px] font-bold px-2 py-0.5 rounded-full">Riesgo alto</span>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-400 mt-2">
                              <span>Costo producto: <span className="text-gray-600 font-medium">RD${costNum.toLocaleString()}</span></span>
                              <span>Costos fijos: <span className="text-gray-600 font-medium">~RD${FIXED.toLocaleString()}</span></span>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className={cn("text-2xl font-bold", isRec ? "text-indigo-600" : "text-gray-900")}>
                              RD${price.toLocaleString()}
                            </p>
                            <p className={cn("text-xs font-semibold mt-0.5", opt.profit >= 500 ? "text-emerald-600" : opt.profit >= 300 ? "text-amber-500" : "text-red-500")}>
                              ~RD${opt.profit.toLocaleString()} de ganancia
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Footer note */}
                  <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-700 space-y-1">
                    <p className="font-semibold">Sobre los costos de envío</p>
                    <p>El envío en República Dominicana varía entre <strong>RD$350 y RD$500</strong> según la zona y proveedor de logística. Los cálculos usan RD$425 como promedio. Si tu costo de envío es menor, tu ganancia real será mayor.</p>
                  </div>
                </div>
              )}

              {/* Empty state */}
              {!hasResult && (
                <div className="text-center py-16 text-gray-300">
                  <p className="text-5xl mb-3">🧮</p>
                  <p className="text-sm">Ingresa el costo del producto para ver las opciones</p>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
