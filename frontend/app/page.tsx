'use client';

import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { fetchDashboard, fetchProducts } from "@/lib/api";
import { isAuthenticated, getUser, clearAuth } from "@/lib/auth";
import { StatCard } from "@/components/stat-card";
import { ProductRow } from "@/components/product-row";
import { ScraperStatus } from "@/components/scraper-status";
import { TopMovers } from "@/components/top-movers";
import { CategoryBreakdown } from "@/components/category-breakdown";
import { Skeleton } from "@/components/ui/skeleton";
import { useDebounce } from "@/lib/use-debounce";
import { ShoppingBag, TrendingUp, Package, Search, Zap, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

const SORTS = [
  { key: 'today', label: 'Más vendidos hoy' },
  { key: 'total', label: 'Histórico' },
  { key: 'growth', label: 'Crecimiento' },
] as const;

export default function Dashboard() {
  const router = useRouter();
  const [sort, setSort] = useState<'today' | 'total' | 'growth'>('today');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [authed, setAuthed] = useState(false);
  const debouncedSearch = useDebounce(search, 400);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace('/login');
    } else {
      setAuthed(true);
    }
  }, [router]);

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: fetchDashboard,
    refetchInterval: 60_000,
  });

  const { data: products, isLoading: productsLoading, isFetching } = useQuery({
    queryKey: ['products', sort, debouncedSearch, category],
    queryFn: () => fetchProducts({ limit: 80, sort, search: debouncedSearch || undefined, category: category || undefined }),
    refetchInterval: 60_000,
  });

  const activeSort = SORTS.find(s => s.key === sort)!;
  const hasFilter = !!(debouncedSearch || category);
  const user = getUser();

  if (!authed) return null;

  function handleLogout() {
    clearAuth();
    router.replace('/login');
  }

  return (
    <div className="min-h-screen bg-[#07071A]">
      {/* Sticky header */}
      <header className="border-b border-violet-900/30 px-4 py-3.5 sticky top-0 bg-[#07071A]/90 backdrop-blur-sm z-10">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-violet-900/50">
              <Zap size={14} className="text-white" />
            </div>
            <span className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-violet-300 to-fuchsia-300">
              WinnerDrop
            </span>
            <span className="text-indigo-800 hidden sm:inline">·</span>
            <span className="text-indigo-600 text-sm hidden sm:inline">Effi RD</span>
          </div>
          <div className="flex items-center gap-3">
            <ScraperStatus />
            {user && (
              <div className="flex items-center gap-2 pl-3 border-l border-violet-900/40">
                <span className="text-xs text-indigo-500 hidden sm:inline">{user.email}</span>
                <button
                  onClick={handleLogout}
                  title="Cerrar sesión"
                  className="p-1.5 rounded-lg text-indigo-600 hover:text-violet-400 hover:bg-violet-900/20 transition-colors"
                >
                  <LogOut size={14} />
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-10">

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {statsLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-2xl bg-indigo-950/40" />
            ))
          ) : stats ? (
            <>
              <StatCard
                label="Ventas hoy"
                value={stats.totalSalesToday.toLocaleString()}
                trend={stats.growthPercent}
                icon={<ShoppingBag size={16} />}
                highlight={true}
                color="fuchsia"
              />
              <StatCard
                label="Ventas ayer"
                value={stats.totalSalesYesterday.toLocaleString()}
                icon={<TrendingUp size={16} />}
              />
              <StatCard
                label="Crecimiento"
                value={`${stats.growthPercent > 0 ? '+' : ''}${stats.growthPercent}%`}
                sub="vs ayer"
                highlight={stats.growthPercent > 0}
                color="emerald"
              />
              <StatCard
                label="Productos activos"
                value={stats.activeProducts.toLocaleString()}
                icon={<Package size={16} />}
                highlight={true}
                color="amber"
              />
            </>
          ) : null}
        </div>

        {/* Two-column: Top Movers + Categories */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1">
            <TopMovers />
          </div>
          <div className="md:col-span-2">
            <CategoryBreakdown selected={category} onSelect={setCategory} />
          </div>
        </div>

        {/* Search + Sort */}
        <div className="space-y-3">
          <div className="relative">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-violet-600 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar producto, categoría, proveedor..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-9 py-2.5 bg-indigo-950/40 border border-indigo-900/60 rounded-xl text-sm text-white placeholder-indigo-700 focus:outline-none focus:border-violet-600/70 transition-colors"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-violet-600 hover:text-violet-400 text-xl leading-none"
              >×</button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex gap-1 bg-indigo-950/40 border border-indigo-900/50 rounded-xl p-1">
              {SORTS.map(s => (
                <button
                  key={s.key}
                  onClick={() => setSort(s.key)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap",
                    sort === s.key
                      ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-900/50"
                      : "text-indigo-500 hover:text-indigo-300"
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {hasFilter && (
              <button
                onClick={() => { setSearch(''); setCategory(''); }}
                className="px-3 py-1.5 rounded-xl text-xs text-indigo-500 hover:text-violet-300 border border-indigo-900/50 hover:border-violet-700/50 transition-colors"
              >
                Limpiar ×
              </button>
            )}

            {(isFetching && !productsLoading) && (
              <span className="text-xs text-violet-700 animate-pulse ml-auto">actualizando...</span>
            )}
          </div>
        </div>

        {/* Results header */}
        <div className="-mt-4">
          <p className="text-xs text-indigo-600">
            {debouncedSearch
              ? `Resultados para "${debouncedSearch}"`
              : category
                ? `${activeSort.label} en ${category}`
                : activeSort.label
            }
            {products && !productsLoading && (
              <span className="ml-1">· {products.length} productos</span>
            )}
          </p>
        </div>

        {/* Product list */}
        <div className="space-y-1.5 -mt-6">
          {productsLoading ? (
            Array.from({ length: 12 }).map((_, i) => (
              <Skeleton key={i} className="h-[60px] rounded-xl bg-indigo-950/30" />
            ))
          ) : products && products.length > 0 ? (
            products.map((p, i) => <ProductRow key={p.id} product={p} rank={i + 1} />)
          ) : (
            <div className="text-center py-24 space-y-3">
              <p className="text-5xl">🔍</p>
              <p className="text-indigo-600 text-sm">
                {hasFilter ? 'Sin resultados para estos filtros' : 'El scraper está cargando productos...'}
              </p>
              {hasFilter && (
                <button
                  onClick={() => { setSearch(''); setCategory(''); }}
                  className="text-xs text-violet-500 hover:text-violet-400 underline underline-offset-2"
                >
                  Limpiar filtros
                </button>
              )}
            </div>
          )}
        </div>

      </main>
    </div>
  );
}
