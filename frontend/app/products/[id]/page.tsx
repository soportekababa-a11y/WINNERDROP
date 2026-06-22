'use client';

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchProduct, fetchProductHistory } from "@/lib/api";
import { isAuthenticated } from "@/lib/auth";
import { ArrowLeft, Package, TrendingUp, BarChart2 } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { use } from "react";
import { CompetitorSpyPanel } from "@/components/competitor-spy/CompetitorSpyPanel";

function shortLabel(dateStr: string, index: number, total: number) {
  const i = total - 1 - index;
  if (i === 0) return 'Hoy';
  if (i === 1) return 'Ayer';
  const d = new Date(dateStr + 'T12:00:00');
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

const DAY_OPTIONS = [7, 30, 60] as const;

function SkeletonBlock({ h = 'h-10', w = 'w-full' }: { h?: string; w?: string }) {
  return <div className={cn("rounded-xl animate-shimmer", h, w)} style={{ border: '1px solid rgba(255,255,255,0.04)' }} />;
}

export default function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [chartDays, setChartDays] = useState<7 | 30 | 60>(7);

  useEffect(() => {
    if (!isAuthenticated()) router.replace('/login');
    else setAuthed(true);
  }, [router]);

  const { data: product, isLoading: pLoading } = useQuery({
    queryKey: ['product', id],
    queryFn: () => fetchProduct(id),
    refetchInterval: 30_000,
    enabled: authed,
  });

  const { data: history, isLoading: hLoading } = useQuery({
    queryKey: ['product-history', id, chartDays],
    queryFn: () => fetchProductHistory(id, chartDays),
    enabled: authed,
  });

  const growth = product?.salesYesterday
    ? Math.round(((product.salesToday - product.salesYesterday) / product.salesYesterday) * 100)
    : null;

  const peakDay = history?.reduce((best, d) => d.sales > (best?.sales ?? 0) ? d : best, history[0]);
  const totalPeriod = history?.reduce((s, d) => s + d.sales, 0) ?? 0;

  const glass = { background: 'rgba(40,0,80,0.08)', backdropFilter: 'blur(20px)', border: '1px solid rgba(150,0,220,0.12)' };

  return (
    <div className="min-h-screen" style={{ background: 'transparent' }}>
      <header className="sticky top-0 z-10 px-4 py-3.5" style={{ background: 'rgba(4,0,14,0.85)', backdropFilter: 'blur(24px)', borderBottom: '1px solid rgba(150,0,220,0.08)' }}>
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <Link href="/dashboard" className="flex items-center gap-1.5 transition-colors text-sm"
            style={{ color: 'rgba(180,130,220,0.5)' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#d946ef')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(180,130,220,0.5)')}>
            <ArrowLeft size={14} />
            Dashboard
          </Link>
          <span className="text-gray-800">/</span>
          {product && <span className="text-gray-500 text-sm truncate max-w-xs">{product.name}</span>}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {pLoading ? (
          <div className="space-y-4">
            <SkeletonBlock h="h-8" w="w-72" />
            <SkeletonBlock h="h-40" />
          </div>
        ) : product ? (
          <>
            {/* Hero */}
            <div className="flex gap-5 items-start">
              <div className="w-20 h-20 md:w-28 md:h-28 rounded-2xl flex-shrink-0 overflow-hidden relative scan-line-overlay"
                style={{ border: '1px solid rgba(217,70,239,0.25)', background: 'rgba(40,0,80,0.3)', boxShadow: '0 0 30px rgba(192,38,211,0.1)' }}>
                {product.imageUrl ? (
                  <Image src={product.imageUrl} alt={product.name} fill className="object-cover" unoptimized />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-3xl opacity-10">📦</div>
                )}
              </div>
              <div className="flex-1 min-w-0 pt-1">
                <h1 className="text-xl md:text-2xl font-bold text-white leading-snug">{product.name}</h1>
                <div className="flex flex-wrap gap-2 mt-2">
                  {product.category && (
                    <span className="px-2.5 py-0.5 rounded-lg text-xs font-medium" style={{ background: 'rgba(217,70,239,0.1)', color: '#e879f9', border: '1px solid rgba(217,70,239,0.2)' }}>
                      {product.category}
                    </span>
                  )}
                  {product.subcategory && (
                    <span className="px-2.5 py-0.5 rounded-lg text-xs" style={{ background: 'rgba(34,211,238,0.06)', color: '#67e8f9', border: '1px solid rgba(34,211,238,0.15)' }}>
                      {product.subcategory}
                    </span>
                  )}
                  {product.provider && (
                    <span className="px-2.5 py-0.5 rounded-lg text-xs" style={{ background: 'rgba(40,0,80,0.1)', color: 'rgba(180,130,220,0.6)', border: '1px solid rgba(150,0,220,0.12)' }}>
                      🏭 {product.provider}
                    </span>
                  )}
                </div>
                {growth !== null && (
                  <div className={cn("inline-flex items-center gap-1 mt-3 px-2.5 py-1 rounded-lg text-sm font-semibold")}
                    style={growth >= 20
                      ? { background: 'rgba(16,185,129,0.1)', color: '#34d399', border: '1px solid rgba(16,185,129,0.15)' }
                      : growth >= 0
                      ? { background: 'rgba(255,255,255,0.04)', color: '#6b7280', border: '1px solid rgba(255,255,255,0.06)' }
                      : { background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.15)' }
                    }>
                    {growth >= 0 ? '▲' : '▼'} {Math.abs(growth)}% vs ayer
                  </div>
                )}
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-2 gap-3">
              {[
                { icon: <BarChart2 size={16} />, label: "Ventas hoy", value: product.salesToday > 0 ? product.salesToday.toLocaleString() : '—', sub: product.salesYesterday > 0 ? `${product.salesYesterday} ayer` : undefined, hi: product.salesToday > 0 },
                { icon: <Package size={16} />, label: "Stock", value: product.stock.toLocaleString(), sub: product.stock < 10 && product.stock > 0 ? '⚠ Stock bajo' : undefined, warn: product.stock < 10 && product.stock > 0 },
              ].map(s => (
                <div key={s.label} className="rounded-2xl p-4 space-y-2 transition-all duration-300 relative overflow-hidden"
                  style={{
                    background: 'rgba(40,0,80,0.08)',
                    backdropFilter: 'blur(16px)',
                    border: s.hi ? '1px solid rgba(34,211,238,0.25)' : s.warn ? '1px solid rgba(239,68,68,0.2)' : '1px solid rgba(150,0,220,0.12)',
                    boxShadow: s.hi ? '0 0 20px rgba(34,211,238,0.08)' : 'none',
                  }}>
                  <div className="absolute top-0 left-0 right-0 h-[1px]"
                    style={{ background: `linear-gradient(90deg, transparent, ${s.hi ? 'rgba(34,211,238,0.4)' : s.warn ? 'rgba(239,68,68,0.3)' : 'rgba(217,70,239,0.3)'}, transparent)` }} />
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] uppercase tracking-wider" style={{ color: 'rgba(180,130,220,0.4)' }}>{s.label}</p>
                    <span style={{ color: s.hi ? '#22d3ee' : s.warn ? '#f87171' : 'rgba(180,130,220,0.4)' }}>{s.icon}</span>
                  </div>
                  <p className="text-2xl font-bold gradient-text-data"
                    style={s.warn ? { backgroundImage: 'none', WebkitTextFillColor: '#f87171' } : {}}>
                    {s.value}
                  </p>
                  {s.sub && <p className="text-xs" style={{ color: s.warn ? '#f87171' : 'rgba(150,220,240,0.4)' }}>{s.sub}</p>}
                </div>
              ))}
            </div>

            {/* Chart */}
            <div className="rounded-2xl p-6" style={glass}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-white">Ventas diarias</h2>
                <div className="flex items-center gap-3">
                  {totalPeriod > 0 && (
                    <span className="text-xs text-gray-600">
                      Total: <span className="font-semibold text-gray-400">{totalPeriod}</span>
                      {peakDay && <> · Pico: <span className="font-semibold text-gray-400">{peakDay.sales}</span></>}
                    </span>
                  )}
                  <div className="flex gap-1 p-0.5 rounded-lg" style={{ background: 'rgba(40,0,80,0.1)', border: '1px solid rgba(150,0,220,0.12)' }}>
                    {DAY_OPTIONS.map(d => (
                      <button key={d} onClick={() => setChartDays(d)}
                        className="px-2.5 py-1 rounded-md text-xs font-semibold transition-all duration-200"
                        style={chartDays === d
                          ? { background: 'linear-gradient(135deg, #0891b2, #22d3ee)', color: 'white', boxShadow: '0 0 12px rgba(34,211,238,0.4)' }
                          : { color: 'rgba(180,130,220,0.4)' }}>
                        {d}d
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {hLoading ? (
                <div className="h-56 rounded-xl animate-shimmer" style={{ background: 'rgba(255,255,255,0.02)' }} />
              ) : history && history.length > 0 ? (() => {
                const chartData = history.map((d, i) => ({ ...d, label: shortLabel(d.date, i, history.length) }));
                const tickInterval = chartDays <= 7 ? 0 : chartDays <= 30 ? 4 : 9;
                const renderTick = (props: any) => {
                  const { x, y, payload } = props;
                  const entry = chartData.find(d => d.label === payload.value);
                  const sales = entry?.sales ?? 0;
                  return (
                    <g transform={`translate(${x},${y})`}>
                      <text x={0} y={-18} textAnchor="middle" fill="#374151" fontSize={10}>{payload.value}</text>
                      <text x={0} y={-5} textAnchor="middle" fill={sales > 0 ? '#22d3ee' : '#1f2937'} fontSize={9} fontWeight={sales > 0 ? 700 : 400}>{sales}</text>
                    </g>
                  );
                };
                return (
                  <ResponsiveContainer width="100%" height={260}>
                    <AreaChart data={chartData} margin={{ top: 36, right: 8, left: -28, bottom: 0 }}>
                      <defs>
                        <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.55} />
                          <stop offset="70%" stopColor="#0891b2" stopOpacity={0.15} />
                          <stop offset="100%" stopColor="#06b6d4" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                      <XAxis dataKey="label" orientation="top" tick={renderTick} tickLine={false} axisLine={false} interval={tickInterval} height={36} />
                      <YAxis tick={{ fill: '#374151', fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} domain={[0, (dataMax: number) => Math.max(Math.ceil(dataMax * 1.35), 10)]} />
                      <Tooltip
                        contentStyle={{ background: 'rgba(4,0,20,0.95)', border: '1px solid rgba(34,211,238,0.25)', borderRadius: 12, fontSize: 12, boxShadow: '0 0 30px rgba(0,0,0,0.6)' }}
                        labelStyle={{ color: 'rgba(180,130,220,0.6)', marginBottom: 4, fontWeight: 600 }}
                        itemStyle={{ color: '#22d3ee' }}
                        formatter={(v) => [Number(v ?? 0).toLocaleString(), 'Ventas']}
                      />
                      <Area type="monotone" dataKey="sales" stroke="#22d3ee" strokeWidth={2.5} fill="url(#salesGrad)" dot={false} activeDot={{ r: 5, fill: '#67e8f9', stroke: 'rgba(4,0,14,0.9)', strokeWidth: 2, filter: 'drop-shadow(0 0 6px #22d3ee)' }} />
                    </AreaChart>
                  </ResponsiveContainer>
                );
              })() : (
                <p className="text-gray-700 text-sm text-center py-10">Sin historial aún</p>
              )}
            </div>

            {/* Competitor Spy */}
            <CompetitorSpyPanel productId={id} productName={product?.name ?? ''} />
          </>
        ) : (
          <div className="text-center py-24">
            <p className="text-gray-600">Producto no encontrado</p>
          </div>
        )}
      </main>
    </div>
  );
}
