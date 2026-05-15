'use client';

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchProduct, fetchProductHistory } from "@/lib/api";
import { isAuthenticated } from "@/lib/auth";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Package, TrendingUp, DollarSign, BarChart2 } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { use } from "react";

export default function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace('/login');
    } else {
      setAuthed(true);
    }
  }, [router]);

  const { data: product, isLoading: pLoading } = useQuery({
    queryKey: ['product', id],
    queryFn: () => fetchProduct(id),
    refetchInterval: 30_000,
    enabled: authed,
  });

  const { data: history, isLoading: hLoading } = useQuery({
    queryKey: ['product-history', id],
    queryFn: () => fetchProductHistory(id, 30),
    enabled: authed,
  });

  const growth = product?.salesYesterday
    ? Math.round(((product.salesToday - product.salesYesterday) / product.salesYesterday) * 100)
    : null;

  const margin = product && product.price > 0 && product.cost > 0
    ? Math.round(((product.price - product.cost) / product.price) * 100)
    : null;

  const profit = product && product.price > 0 && product.cost > 0
    ? product.price - product.cost
    : null;

  const peakDay = history?.reduce((best, d) => d.sales > (best?.sales ?? 0) ? d : best, history[0]);

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Top nav */}
      <header className="border-b border-zinc-900 px-4 py-4 sticky top-0 bg-zinc-950/90 backdrop-blur-sm z-10">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <Link href="/" className="flex items-center gap-1.5 text-zinc-500 hover:text-white transition-colors text-sm">
            <ArrowLeft size={14} />
            <span>Dashboard</span>
          </Link>
          <span className="text-zinc-800">/</span>
          {product && <span className="text-zinc-400 text-sm truncate max-w-xs">{product.name}</span>}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {pLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-72 bg-zinc-900 rounded-lg" />
            <Skeleton className="h-40 bg-zinc-900 rounded-2xl" />
          </div>
        ) : product ? (
          <>
            {/* Product hero */}
            <div className="flex gap-5 items-start">
              <div className="w-20 h-20 md:w-28 md:h-28 rounded-2xl bg-zinc-900 border border-zinc-800 flex-shrink-0 overflow-hidden relative">
                {product.imageUrl ? (
                  <Image src={product.imageUrl} alt={product.name} fill className="object-cover" unoptimized />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-3xl">📦</div>
                )}
              </div>
              <div className="flex-1 min-w-0 pt-1">
                <h1 className="text-xl md:text-2xl font-bold text-white leading-snug">{product.name}</h1>
                <div className="flex flex-wrap gap-2 mt-2">
                  {product.category && (
                    <span className="px-2 py-0.5 rounded-lg bg-zinc-800 text-zinc-400 text-xs">{product.category}</span>
                  )}
                  {product.subcategory && (
                    <span className="px-2 py-0.5 rounded-lg bg-zinc-800 text-zinc-500 text-xs">{product.subcategory}</span>
                  )}
                  {product.provider && (
                    <span className="px-2 py-0.5 rounded-lg bg-zinc-800 text-zinc-500 text-xs">🏭 {product.provider}</span>
                  )}
                </div>
                {growth !== null && (
                  <div className={cn(
                    "inline-flex items-center gap-1 mt-3 px-2.5 py-1 rounded-lg text-sm font-medium",
                    growth >= 20 ? "bg-emerald-950 text-emerald-400" :
                    growth >= 0  ? "bg-zinc-800 text-zinc-300" :
                                   "bg-red-950 text-red-400"
                  )}>
                    {growth >= 0 ? '▲' : '▼'} {Math.abs(growth)}% vs ayer
                  </div>
                )}
              </div>
            </div>

            {/* Stats grid */}
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
                  sub: peakDay ? `Pico: ${peakDay.sales} (${peakDay.date})` : undefined,
                },
                {
                  icon: <DollarSign size={16} />,
                  label: "Precio sugerido",
                  value: `RD$${product.price.toLocaleString()}`,
                  sub: product.cost > 0 ? `Costo: RD$${product.cost.toLocaleString()}` : undefined,
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
                    "rounded-2xl border p-4 space-y-2",
                    s.hi ? "bg-emerald-950/30 border-emerald-900/50" :
                    s.warn ? "bg-red-950/20 border-red-900/40" :
                    "bg-zinc-900 border-zinc-800"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-zinc-500 uppercase tracking-wider">{s.label}</p>
                    <span className={cn("opacity-40", s.hi ? "text-emerald-400" : s.warn ? "text-red-400" : "text-zinc-500")}>{s.icon}</span>
                  </div>
                  <p className="text-2xl font-bold text-white">{s.value}</p>
                  {s.sub && <p className={cn("text-xs", s.warn ? "text-red-400" : "text-zinc-600")}>{s.sub}</p>}
                </div>
              ))}
            </div>

            {/* Profit calc */}
            {profit !== null && margin !== null && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-wrap gap-6">
                <div>
                  <p className="text-xs text-zinc-500 uppercase tracking-wider">Ganancia por venta</p>
                  <p className="text-2xl font-bold text-emerald-400 mt-1">RD${profit.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500 uppercase tracking-wider">Margen de ganancia</p>
                  <p className={cn("text-2xl font-bold mt-1", margin >= 40 ? "text-emerald-400" : margin >= 20 ? "text-yellow-400" : "text-red-400")}>
                    {margin}%
                  </p>
                </div>
                {product.salesToday > 0 && (
                  <div>
                    <p className="text-xs text-zinc-500 uppercase tracking-wider">Ganancia estimada hoy</p>
                    <p className="text-2xl font-bold text-white mt-1">
                      RD${(profit * product.salesToday).toLocaleString()}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Chart */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-sm font-medium text-white">Ventas diarias — últimos 30 días</h2>
                {peakDay && (
                  <span className="text-xs text-zinc-600">Pico: <span className="text-zinc-400">{peakDay.sales} el {peakDay.date}</span></span>
                )}
              </div>
              {hLoading ? (
                <Skeleton className="h-52 bg-zinc-800 rounded-xl" />
              ) : history && history.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={history} margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: '#52525b', fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis tick={{ fill: '#52525b', fontSize: 10 }} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 10, fontSize: 12 }}
                      labelStyle={{ color: '#a1a1aa', marginBottom: 4 }}
                      itemStyle={{ color: '#10b981' }}
                      formatter={(v) => [Number(v ?? 0).toLocaleString(), 'Ventas']}
                    />
                    <Area
                      type="monotone"
                      dataKey="sales"
                      stroke="#10b981"
                      strokeWidth={2}
                      fill="url(#grad)"
                      dot={false}
                      activeDot={{ r: 4, fill: '#10b981', strokeWidth: 0 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-52 flex items-center justify-center">
                  <p className="text-zinc-600 text-sm">Sin historial suficiente aún — vuelve después del primer ciclo completo</p>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="text-center py-24">
            <p className="text-zinc-600">Producto no encontrado</p>
          </div>
        )}
      </main>
    </div>
  );
}
