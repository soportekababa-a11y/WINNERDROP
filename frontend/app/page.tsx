'use client';

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { fetchDashboard, fetchProductsGrid } from "@/lib/api";
import { isAuthenticated, getUser, clearAuth } from "@/lib/auth";
import { StatCard } from "@/components/stat-card";
import { ProductCard } from "@/components/product-card";
import { ScraperStatus } from "@/components/scraper-status";
import { TopMovers } from "@/components/top-movers";
import { CategoryBreakdown } from "@/components/category-breakdown";
import { Skeleton } from "@/components/ui/skeleton";
import { useDebounce } from "@/lib/use-debounce";
import { ShoppingBag, TrendingUp, Package, Search, Zap, LogOut, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const SORTS = [
  { key: 'today', label: 'Más vendidos hoy' },
  { key: 'total', label: 'Histórico' },
  { key: 'growth', label: 'Crecimiento' },
] as const;

const DAY_OPTIONS = [7, 14, 21, 30];
const PAGE_SIZE = 40;

export default function Dashboard() {
  const router = useRouter();
  const [sort, setSort] = useState<'today' | 'total' | 'growth'>('today');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [days, setDays] = useState(14);
  const [authed, setAuthed] = useState(false);
  const debouncedSearch = useDebounce(search, 400);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isAuthenticated()) router.replace('/login');
    else setAuthed(true);
  }, [router]);

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: fetchDashboard,
    refetchInterval: 60_000,
  });

  const {
    data,
    isLoading: productsLoading,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
  } = useInfiniteQuery({
    queryKey: ['products-grid', sort, debouncedSearch, category, days],
    queryFn: ({ pageParam = 0 }) =>
      fetchProductsGrid({
        limit: PAGE_SIZE,
        sort,
        days,
        search: debouncedSearch || undefined,
        category: category || undefined,
        offset: pageParam as number,
      }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length < PAGE_SIZE) return undefined;
      return allPages.flat().length;
    },
    refetchInterval: 120_000,
  });

  const products = data?.pages.flat() ?? [];
  const hasFilter = !!(debouncedSearch || category);
  const user = getUser();

  // Infinite scroll — observe sentinel div
  const onIntersect = useCallback((entries: IntersectionObserverEntry[]) => {
    if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(onIntersect, { threshold: 0.1 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [onIntersect]);

  if (!authed) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3.5 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-sm">
              <Zap size={14} className="text-white" />
            </div>
            <span className="font-bold text-gray-900">WinnerDrop</span>
            <span className="text-gray-300 hidden sm:inline">·</span>
            <span className="text-gray-400 text-sm hidden sm:inline">Effi RD</span>
          </div>
          <div className="flex items-center gap-4">
            <ScraperStatus />
            {user && (
              <div className="flex items-center gap-2 pl-4 border-l border-gray-200">
                <span className="text-xs text-gray-500 hidden sm:inline">{user.email}</span>
                <button onClick={() => { clearAuth(); router.replace('/login'); }} title="Cerrar sesión"
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
                  <LogOut size={14} />
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {statsLoading ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)
          ) : stats ? (
            <>
              <StatCard label="Ventas hoy" value={stats.totalSalesToday.toLocaleString()} trend={stats.growthPercent} icon={<ShoppingBag size={16} />} highlight color="fuchsia" />
              <StatCard label="Ventas ayer" value={stats.totalSalesYesterday.toLocaleString()} icon={<TrendingUp size={16} />} color="violet" />
              <StatCard label="Crecimiento" value={`${stats.growthPercent > 0 ? '+' : ''}${stats.growthPercent}%`} sub="vs ayer" highlight={stats.growthPercent > 0} color="emerald" />
              <StatCard label="Productos activos" value={stats.activeProducts.toLocaleString()} icon={<Package size={16} />} highlight color="amber" />
            </>
          ) : null}
        </div>

        {/* Top movers + Categories */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1"><TopMovers /></div>
          <div className="md:col-span-2 flex flex-col justify-center">
            <CategoryBreakdown selected={category} onSelect={setCategory} />
          </div>
        </div>

        {/* Filters */}
        <div className="space-y-3">
          <div className="relative">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input type="text" placeholder="Buscar producto, categoría, proveedor..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-9 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all shadow-sm" />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1 shadow-sm">
              {SORTS.map(s => (
                <button key={s.key} onClick={() => setSort(s.key)}
                  className={cn("px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap",
                    sort === s.key ? "bg-indigo-600 text-white shadow-sm" : "text-gray-500 hover:text-gray-800")}>
                  {s.label}
                </button>
              ))}
            </div>

            <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1 shadow-sm">
              {DAY_OPTIONS.map(d => (
                <button key={d} onClick={() => setDays(d)}
                  className={cn("px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all",
                    days === d ? "bg-gray-900 text-white shadow-sm" : "text-gray-500 hover:text-gray-800")}>
                  {d}d
                </button>
              ))}
            </div>

            {hasFilter && (
              <button onClick={() => { setSearch(''); setCategory(''); }}
                className="px-3 py-1.5 rounded-xl text-xs text-gray-500 hover:text-gray-800 border border-gray-200 bg-white shadow-sm">
                Limpiar ×
              </button>
            )}
          </div>

          <p className="text-xs text-gray-400">
            {!productsLoading && `${products.length} productos cargados · últimos ${days} días`}
          </p>
        </div>

        {/* Product grid */}
        {productsLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className="h-72 rounded-2xl" />)}
          </div>
        ) : products.length > 0 ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {products.map((p, i) => <ProductCard key={p.id} product={p} rank={i + 1} />)}
            </div>

            {/* Sentinel — triggers next page load */}
            <div ref={sentinelRef} className="flex justify-center py-6">
              {isFetchingNextPage && (
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Loader2 size={16} className="animate-spin" />
                  Cargando más productos...
                </div>
              )}
              {!hasNextPage && products.length > 0 && (
                <p className="text-xs text-gray-300">— {products.length} productos en total —</p>
              )}
            </div>
          </>
        ) : (
          <div className="text-center py-24 space-y-3">
            <p className="text-5xl">🔍</p>
            <p className="text-gray-400 text-sm">
              {hasFilter ? 'Sin resultados para estos filtros' : 'El scraper está cargando productos...'}
            </p>
          </div>
        )}

      </main>
    </div>
  );
}
