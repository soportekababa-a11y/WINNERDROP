'use client';

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { fetchDashboard, fetchProductsGrid, fetchCategories, fetchProviders } from "@/lib/api";
import { isAuthenticated } from "@/lib/auth";
import { StatCard } from "@/components/stat-card";
import { ProductCard } from "@/components/product-card";
import { Skeleton } from "@/components/ui/skeleton";
import { useDebounce } from "@/lib/use-debounce";
import { ShoppingBag, TrendingUp, Search, Loader2, ChevronDown } from "lucide-react";
import { Sidebar } from "@/components/sidebar";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 40;

type ProductoFilter = 'todos' | 'hoy' | 'winners';

const PRODUCTO_OPTIONS: { value: ProductoFilter; label: string }[] = [
  { value: 'todos',   label: 'Todos' },
  { value: 'hoy',     label: 'Más vendidos hoy' },
  { value: 'winners', label: 'Winners' },
];

function filterToParams(f: ProductoFilter): { hot: boolean; sort: 'today' | 'total' | 'growth' } {
  if (f === 'hoy')     return { hot: true,  sort: 'today' };
  if (f === 'winners') return { hot: false, sort: 'total' };
  return                      { hot: false, sort: 'today' };
}

export default function Dashboard() {
  const router = useRouter();
  const [productoFilter, setProductoFilter] = useState<ProductoFilter>('todos');
  const [provider, setProvider] = useState('');
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
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

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: fetchCategories,
    staleTime: 5 * 60_000,
  });

  const { data: providers } = useQuery({
    queryKey: ['providers'],
    queryFn: fetchProviders,
    staleTime: 5 * 60_000,
  });

  const { hot, sort } = filterToParams(productoFilter);

  const {
    data,
    isLoading: productsLoading,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
  } = useInfiniteQuery({
    queryKey: ['products-grid', productoFilter, sort, debouncedSearch, category, provider],
    queryFn: ({ pageParam = 0 }) =>
      fetchProductsGrid({
        limit: PAGE_SIZE,
        sort,
        days: 14,
        search: debouncedSearch || undefined,
        category: category || undefined,
        provider: provider || undefined,
        offset: pageParam as number,
        hot,
      }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length < PAGE_SIZE) return undefined;
      return allPages.flat().length;
    },
    refetchInterval: 120_000,
  });

  const products = data?.pages.flat() ?? [];
  const hasFilter = !!(debouncedSearch || category || provider);

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
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
      <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-8 space-y-8">

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {statsLoading ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)
          ) : stats ? (
            <>
              <StatCard label="Ventas hoy" value={stats.totalSalesToday.toLocaleString()} trend={stats.growthPercent} icon={<ShoppingBag size={16} />} highlight color="fuchsia" />
              <StatCard label="Ventas ayer" value={stats.totalSalesYesterday.toLocaleString()} icon={<TrendingUp size={16} />} color="violet" />
              <StatCard label="Crecimiento" value={`${stats.growthPercent > 0 ? '+' : ''}${stats.growthPercent}%`} sub="vs ayer" highlight={stats.growthPercent > 0} color="emerald" />
            </>
          ) : null}
        </div>

        {/* Mini panel de filtros */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-4 space-y-4">
          {/* Dropdowns */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Productos */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Productos</label>
              <div className="relative">
                <select
                  value={productoFilter}
                  onChange={e => setProductoFilter(e.target.value as ProductoFilter)}
                  className="w-full appearance-none bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 pr-8 text-sm text-gray-800 font-medium focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 cursor-pointer transition-all"
                >
                  {PRODUCTO_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Proveedor */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Proveedor</label>
              <div className="relative">
                <select
                  value={provider}
                  onChange={e => setProvider(e.target.value)}
                  className="w-full appearance-none bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 pr-8 text-sm text-gray-800 font-medium focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 cursor-pointer transition-all"
                >
                  <option value="">Todos los proveedores</option>
                  {providers?.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Categoría */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Categoría</label>
              <div className="relative">
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  className="w-full appearance-none bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 pr-8 text-sm text-gray-800 font-medium focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 cursor-pointer transition-all"
                >
                  <option value="">Todas las categorías</option>
                  {categories?.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Búsqueda */}
          <div className="relative">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input type="text" placeholder="Buscar producto, categoría, proveedor..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-9 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all" />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            )}
          </div>

          {hasFilter && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-400">{products.length} productos cargados</p>
              <button onClick={() => { setSearch(''); setCategory(''); setProvider(''); }}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                Limpiar filtros ×
              </button>
            </div>
          )}
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
            <div ref={sentinelRef} className="flex justify-center py-6">
              {isFetchingNextPage && (
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Loader2 size={16} className="animate-spin" />
                  Cargando más...
                </div>
              )}
              {!hasNextPage && (
                <p className="text-xs text-gray-300">— {products.length} productos en total —</p>
              )}
            </div>
          </>
        ) : (
          <div className="text-center py-24 space-y-3">
            <p className="text-5xl">{productoFilter === 'hoy' ? '🔥' : '🔍'}</p>
            <p className="text-gray-400 text-sm">
              {productoFilter === 'hoy'
                ? 'No hay productos con suficientes ventas aún — el scraper sigue recopilando datos'
                : hasFilter ? 'Sin resultados para estos filtros' : 'El scraper está cargando productos...'
              }
            </p>
          </div>
        )}

      </main>
      </div>
    </div>
  );
}
