'use client';

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchProduct, fetchProductHistory } from "@/lib/api";
import { isAuthenticated } from "@/lib/auth";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Package, TrendingUp, DollarSign, BarChart2 } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { use } from "react";

function formatLabel(dateStr: string, index: number, total: number) {
  const i = total - 1 - index;
  if (i === 0) return 'Hoy';
  if (i === 1) return 'Ayer';
  const d = new Date(dateStr + 'T12:00:00');
  return `${d.getDate()} ${d.toLocaleString('es', { month: 'short' })}`;
}

export default function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [authed, setAuthed] = useState(false);

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

            {/* Profit */}
            {profit !== null && margin !== null && (
              <div className="bg-white border border-gray-200 rounded-2xl p-5 flex flex-wrap gap-6 shadow-sm">
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wider">Ganancia por venta</p>
                  <p className="text-2xl font-bold text-emerald-600 mt-1">RD${profit.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wider">Margen</p>
                  <p className={cn("text-2xl font-bold mt-1", margin >= 40 ? "text-emerald-600" : margin >= 20 ? "text-amber-500" : "text-red-500")}>
                    {margin}%
                  </p>
                </div>
                {product.salesToday > 0 && (
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wider">Ganancia estimada hoy</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">
                      RD${(profit * product.salesToday).toLocaleString()}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Horizontal bar chart */}
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-sm font-semibold text-gray-900">Ventas diarias — últimos 30 días</h2>
                <div className="flex gap-4 text-xs text-gray-400">
                  {totalPeriod > 0 && <span>Total: <span className="font-semibold text-gray-600">{totalPeriod}</span></span>}
                  {peakDay && <span>Pico: <span className="font-semibold text-gray-600">{peakDay.sales}</span></span>}
                </div>
              </div>

              {hLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-6 rounded-lg" />)}
                </div>
              ) : history && history.length > 0 ? (
                <div className="space-y-1.5">
                  {history.map((d, i) => {
                    const isToday = i === history.length - 1;
                    const isYesterday = i === history.length - 2;
                    const pct = maxSales > 0 ? (d.sales / maxSales) * 100 : 0;
                    const lbl = formatLabel(d.date, i, history.length);
                    return (
                      <div key={d.date} className="flex items-center gap-3 group">
                        <span className={cn(
                          "text-xs w-10 text-right shrink-0 font-medium",
                          isToday ? "text-indigo-600" : "text-gray-400"
                        )}>
                          {lbl}
                        </span>
                        <div className="flex-1 h-6 bg-gray-100 rounded-lg overflow-hidden">
                          {d.sales > 0 && (
                            <div
                              className={cn(
                                "h-full rounded-lg transition-all",
                                isToday     ? "bg-indigo-500" :
                                isYesterday ? "bg-indigo-400" :
                                              "bg-indigo-200"
                              )}
                              style={{ width: `${Math.max(pct, 4)}%` }}
                            />
                          )}
                        </div>
                        <span className={cn(
                          "text-xs w-8 shrink-0 font-semibold",
                          d.sales === 0 ? "text-gray-300" :
                          isToday ? "text-indigo-600" : "text-gray-500"
                        )}>
                          {d.sales > 0 ? d.sales : '—'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
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
