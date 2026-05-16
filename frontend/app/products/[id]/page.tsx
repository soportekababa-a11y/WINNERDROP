'use client';

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchProduct, fetchProductHistory } from "@/lib/api";
import { isAuthenticated } from "@/lib/auth";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Package, TrendingUp, BarChart2 } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { use } from "react";

function shortLabel(dateStr: string, index: number, total: number) {
  const i = total - 1 - index;
  if (i === 0) return 'Hoy';
  if (i === 1) return 'Ayer';
  const d = new Date(dateStr + 'T12:00:00');
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

const DAY_OPTIONS = [7, 30, 60] as const;

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

  const maxSales = history ? Math.max(...history.map(d => d.sales), 1) : 1;
  const peakDay = history?.reduce((best, d) => d.sales > (best?.sales ?? 0) ? d : best, history[0]);
  const totalPeriod = history?.reduce((s, d) => s + d.sales, 0) ?? 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-3.5 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <Link href="/" className="flex items-center gap-1.5 text-gray-400 hover:text-gray-700 transition-colors text-sm">
            <ArrowLeft size={14} />
            <span>Dashboard</span>
          </Link>
          <span className="text-gray-200">/</span>
          {product && <span className="text-gray-500 text-sm truncate max-w-xs">{product.name}</span>}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {pLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-72 rounded-lg" />
            <Skeleton className="h-40 rounded-2xl" />
          </div>
        ) : product ? (
          <>
            {/* Hero */}
            <div className="flex gap-5 items-start">
              <div className="w-20 h-20 md:w-28 md:h-28 rounded-2xl bg-gray-100 border border-gray-200 flex-shrink-0 overflow-hidden relative shadow-sm">
                {product.imageUrl ? (
                  <Image src={product.imageUrl} alt={product.name} fill className="object-cover" unoptimized />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-3xl">📦</div>
                )}
              </div>
              <div className="flex-1 min-w-0 pt-1">
                <h1 className="text-xl md:text-2xl font-bold text-gray-900 leading-snug">{product.name}</h1>
                <div className="flex flex-wrap gap-2 mt-2">
                  {product.category && (
                    <span className="px-2 py-0.5 rounded-lg bg-gray-100 text-gray-500 text-xs">{product.category}</span>
                  )}
                  {product.subcategory && (
                    <span className="px-2 py-0.5 rounded-lg bg-gray-100 text-gray-400 text-xs">{product.subcategory}</span>
                  )}
                  {product.provider && (
                    <span className="px-2 py-0.5 rounded-lg bg-gray-100 text-gray-400 text-xs">🏭 {product.provider}</span>
                  )}
                </div>
                {growth !== null && (
                  <div className={cn(
                    "inline-flex items-center gap-1 mt-3 px-2.5 py-1 rounded-lg text-sm font-semibold",
                    growth >= 20 ? "bg-emerald-100 text-emerald-700" :
                    growth >= 0  ? "bg-gray-100 text-gray-600" :
                                   "bg-red-50 text-red-500"
                  )}>
                    {growth >= 0 ? '▲' : '▼'} {Math.abs(growth)}% vs ayer
                  </div>
                )}
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                {
                  icon: <BarChart2 size={16} />,
                  label: "Ventas hoy",
                  value: product.salesToday > 0 ? product.salesToday.toLocaleString() : '—',
                  sub: product.salesYesterday > 0 ? `${product.salesYesterday} ayer` : undefined,
                  hi: product.salesToday > 0,
                },
                {
                  icon: <TrendingUp size={16} />,
                  label: "Total acumulado",
                  value: product.totalSalesAccum.toLocaleString(),
                  sub: peakDay ? `Pico: ${peakDay.sales} el ${peakDay.date}` : undefined,
                },
                {
                  icon: <Package size={16} />,
                  label: "Stock disponible",
                  value: product.stock.toLocaleString(),
                  sub: product.stock < 10 && product.stock > 0 ? '⚠ Stock bajo' : undefined,
                  warn: product.stock < 10 && product.stock > 0,
                },
              ].map(s => (
                <div
                  key={s.label}
                  className={cn(
                    "rounded-2xl border p-4 space-y-2 bg-white shadow-sm",
                    s.hi ? "border-emerald-200" :
                    s.warn ? "border-red-200" :
                    "border-gray-200"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-400 uppercase tracking-wider">{s.label}</p>
                    <span className={cn("opacity-50", s.hi ? "text-emerald-500" : s.warn ? "text-red-400" : "text-gray-400")}>{s.icon}</span>
                  </div>
                  <p className={cn("text-2xl font-bold", s.hi ? "text-emerald-600" : s.warn ? "text-red-500" : "text-gray-900")}>{s.value}</p>
                  {s.sub && <p className={cn("text-xs", s.warn ? "text-red-400" : "text-gray-400")}>{s.sub}</p>}
                </div>
              ))}
            </div>

            {/* Wave area chart */}
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-gray-900">Ventas diarias</h2>
                <div className="flex items-center gap-3">
                  {totalPeriod > 0 && (
                    <span className="text-xs text-gray-400">
                      Total: <span className="font-semibold text-gray-600">{totalPeriod}</span>
                      {peakDay && <> · Pico: <span className="font-semibold text-gray-600">{peakDay.sales}</span></>}
                    </span>
                  )}
                  <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
                    {DAY_OPTIONS.map(d => (
                      <button
                        key={d}
                        onClick={() => setChartDays(d)}
                        className={cn(
                          "px-2.5 py-1 rounded-md text-xs font-semibold transition-all",
                          chartDays === d ? "bg-white text-indigo-600 shadow-sm" : "text-gray-400 hover:text-gray-700"
                        )}
                      >
                        {d}d
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {hLoading ? (
                <Skeleton className="h-56 rounded-xl" />
              ) : history && history.length > 0 ? (() => {
                const chartData = history.map((d, i) => ({ ...d, label: shortLabel(d.date, i, history.length) }));
                const yMax = Math.max(...chartData.map(d => d.sales), 1);
                const tickInterval = chartDays <= 7 ? 0 : chartDays <= 30 ? 4 : 9;

                const renderTick = (props: any) => {
                  const { x, y, payload } = props;
                  const entry = chartData.find(d => d.label === payload.value);
                  const sales = entry?.sales ?? 0;
                  return (
                    <g transform={`translate(${x},${y})`}>
                      <text x={0} y={-18} textAnchor="middle" fill="#9ca3af" fontSize={10}>{payload.value}</text>
                      <text x={0} y={-5} textAnchor="middle" fill={sales > 0 ? '#6366f1' : '#d1d5db'} fontSize={9} fontWeight={sales > 0 ? 700 : 400}>{sales}</text>
                    </g>
                  );
                };

                return (
                  <ResponsiveContainer width="100%" height={260}>
                    <AreaChart data={chartData} margin={{ top: 36, right: 8, left: -28, bottom: 0 }}>
                      <defs>
                        <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#6366f1" stopOpacity={0.25} />
                          <stop offset="100%" stopColor="#6366f1" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                      <XAxis
                        dataKey="label"
                        orientation="top"
                        tick={renderTick}
                        tickLine={false}
                        axisLine={false}
                        interval={tickInterval}
                        height={36}
                      />
                      <YAxis
                        tick={{ fill: '#9ca3af', fontSize: 10 }}
                        tickLine={false}
                        axisLine={false}
                        allowDecimals={false}
                        domain={[0, (dataMax: number) => Math.max(Math.ceil(dataMax * 1.35), 10)]}
                      />
                      <Tooltip
                        contentStyle={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                        labelStyle={{ color: '#6b7280', marginBottom: 4, fontWeight: 600 }}
                        itemStyle={{ color: '#6366f1' }}
                        formatter={(v) => [Number(v ?? 0).toLocaleString(), 'Ventas']}
                      />
                      <Area
                        type="monotone"
                        dataKey="sales"
                        stroke="#6366f1"
                        strokeWidth={2.5}
                        fill="url(#salesGrad)"
                        dot={false}
                        activeDot={{ r: 5, fill: '#6366f1', stroke: '#fff', strokeWidth: 2 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                );
              })() : (
                <p className="text-gray-400 text-sm text-center py-10">Sin historial aún — vuelve después del primer ciclo</p>
              )}
            </div>
          </>
        ) : (
          <div className="text-center py-24">
            <p className="text-gray-400">Producto no encontrado</p>
          </div>
        )}
      </main>
    </div>
  );
}
