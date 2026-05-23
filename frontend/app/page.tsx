'use client';

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { fetchDashboard, fetchProductsGrid, fetchCategories, fetchProviders } from "@/lib/api";
import { isAuthenticated } from "@/lib/auth";
import { StatCard } from "@/components/stat-card";
import { ProductCard } from "@/components/product-card";
import { ShoppingBag, TrendingUp, Loader2, ChevronDown, Sparkles, Search, X } from "lucide-react";
import { Sidebar } from "@/components/sidebar";

const PAGE_SIZE = 40;
type ProductoFilter = 'todos' | 'hoy' | 'winners';
type CountryFilter = '' | 'RD' | 'GT' | 'EC';
const COUNTRIES: { value: CountryFilter; label: string }[] = [
  { value: '',   label: 'Elegir país' },
  { value: 'RD', label: '🇩🇴 Rep. Dominicana' },
  { value: 'GT', label: '🇬🇹 Guatemala' },
  { value: 'EC', label: '🇪🇨 Ecuador' },
];

const PRODUCTO_OPTIONS: { value: ProductoFilter; label: string }[] = [
  { value: 'todos',   label: 'Todos' },
  { value: 'hoy',     label: 'Más vendidos hoy' },
  { value: 'winners', label: 'Winners' },
];

function filterToParams(f: ProductoFilter): { hot: boolean; sort: 'today' | 'total' | 'growth' | 'winners'; limit: number } {
  if (f === 'hoy')     return { hot: false, sort: 'today',   limit: 5 };
  if (f === 'winners') return { hot: false, sort: 'winners', limit: PAGE_SIZE };
  return                      { hot: false, sort: 'today',   limit: PAGE_SIZE };
}

function SkeletonCard() {
  return (
    <div className="rounded-2xl overflow-hidden animate-pulse" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
      <div className="aspect-[4/3]" style={{ background: 'rgba(255,255,255,0.03)' }} />
      <div className="p-4 space-y-3">
        <div className="h-3 rounded-lg w-3/4" style={{ background: 'rgba(255,255,255,0.05)' }} />
        <div className="h-3 rounded-lg w-1/2" style={{ background: 'rgba(255,255,255,0.03)' }} />
        <div className="h-7 rounded-lg w-1/3" style={{ background: 'rgba(139,92,246,0.1)' }} />
        <div className="h-8 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)' }} />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const [productoFilter, setProductoFilter] = useState<ProductoFilter>('todos');
  const [provider, setProvider] = useState('');
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [authed, setAuthed] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [country, setCountry] = useState<CountryFilter>(() => {
    if (typeof window === 'undefined') return '';
    return (sessionStorage.getItem('ms_country') as CountryFilter) || '';
  });

  const updateCountry = (v: CountryFilter) => {
    setCountry(v);
    setCategory('');
    setProvider('');
    if (typeof window !== 'undefined') {
      if (v) sessionStorage.setItem('ms_country', v);
      else sessionStorage.removeItem('ms_country');
    }
  };

  useEffect(() => {
    if (!isAuthenticated()) router.replace('/login');
    else setAuthed(true);
  }, [router]);

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard', country],
    queryFn: () => fetchDashboard(country || undefined),
    refetchInterval: 60_000,
  });

  const { data: categories } = useQuery({
    queryKey: ['categories', country],
    queryFn: () => fetchCategories(country || undefined),
    staleTime: 5 * 60_000,
  });

  const { data: providers } = useQuery({
    queryKey: ['providers', country],
    queryFn: () => fetchProviders(country || undefined),
    staleTime: 5 * 60_000,
  });

  const { hot, sort, limit } = filterToParams(productoFilter);

  const { data, isLoading: productsLoading, isFetchingNextPage, fetchNextPage, hasNextPage } = useInfiniteQuery({
    queryKey: ['products-grid', productoFilter, sort, category, provider, search, country],
    queryFn: ({ pageParam = 0 }) =>
      fetchProductsGrid({ limit, sort, days: 14, category: category || undefined, provider: provider || undefined, search: search || undefined, country: country || undefined, offset: pageParam as number, hot }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => lastPage.length < PAGE_SIZE ? undefined : allPages.flat().length,
    refetchInterval: 120_000,
  });

  const products = data?.pages.flat() ?? [];
  const hasFilter = !!(category || provider || search);

  const onIntersect = useCallback((entries: IntersectionObserverEntry[]) => {
    if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(onIntersect, { threshold: 0.1 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [onIntersect]);

  if (!authed) return null;

  const glassPanel = { background: 'rgba(255,255,255,0.025)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.06)' };
  const selectStyle = { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: '#e2e8f0' };

  return (
    <div className="min-h-screen bg-[#020209] flex">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-8 space-y-8">

          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                <Sparkles size={20} className="text-violet-400" />
                Productos Ganadores
              </h1>
              <p className="text-sm text-gray-600 mt-0.5">{country ? (COUNTRIES.find(c => c.value === country)?.label ?? country) : 'Selecciona un país'} · actualización en tiempo real</p>
            </div>
          </div>

          {/* Filtros — siempre visibles */}
          <div className="rounded-2xl p-4 space-y-4" style={glassPanel}>
            {/* Row 1: Platform + Country */}
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Plataforma', value: 'effi', onChange: () => {}, disabled: true, options: [{ value: 'effi', label: 'Effi' }] },
                { label: 'País', value: country, onChange: (v: string) => updateCountry(v as CountryFilter), options: COUNTRIES.map(c => ({ value: c.value, label: c.label })) },
              ].map(({ label, value, onChange, options, disabled }) => (
                <div key={label} className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">{label}</label>
                  <div className="relative">
                    <select
                      value={value}
                      onChange={e => onChange(e.target.value)}
                      disabled={disabled}
                      className="w-full appearance-none rounded-xl px-3 py-2.5 pr-8 text-sm font-medium focus:outline-none cursor-pointer transition-all duration-200 disabled:opacity-40 disabled:cursor-default"
                      style={selectStyle}
                    >
                      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 pointer-events-none" />
                  </div>
                </div>
              ))}
            </div>

            {/* Row 2: solo visible cuando hay país seleccionado */}
            {country && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { label: 'Productos', value: productoFilter, onChange: (v: string) => setProductoFilter(v as ProductoFilter), options: PRODUCTO_OPTIONS.map(o => ({ value: o.value, label: o.label })) },
                  { label: 'Proveedor', value: provider, onChange: setProvider, options: [{ value: '', label: 'Todos los proveedores' }, ...(providers ?? []).map(p => ({ value: p, label: p }))] },
                  { label: 'Categoría', value: category, onChange: setCategory, options: [{ value: '', label: 'Todas las categorías' }, ...(categories ?? []).map(c => ({ value: c, label: c }))] },
                ].map(({ label, value, onChange, options }) => (
                  <div key={label} className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">{label}</label>
                    <div className="relative">
                      <select
                        value={value}
                        onChange={e => onChange(e.target.value)}
                        className="w-full appearance-none rounded-xl px-3 py-2.5 pr-8 text-sm font-medium focus:outline-none cursor-pointer transition-all duration-200"
                        style={selectStyle}
                      >
                        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                      <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 pointer-events-none" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {hasFilter && (
              <div className="flex justify-end">
                <button onClick={() => { setCategory(''); setProvider(''); setSearch(''); setSearchInput(''); }}
                  className="text-xs font-semibold transition-colors duration-200"
                  style={{ color: '#a78bfa' }}
                  onMouseEnter={e => (e.target as HTMLElement).style.color = '#c4b5fd'}
                  onMouseLeave={e => (e.target as HTMLElement).style.color = '#a78bfa'}>
                  Limpiar filtros ×
                </button>
              </div>
            )}
          </div>

          {/* Stats + buscador + grid — solo con país seleccionado */}
          {!country ? (
            <div className="text-center py-24 space-y-3">
              <p className="text-5xl opacity-20">🌎</p>
              <p className="text-gray-500 text-sm">Selecciona un país para ver los productos</p>
            </div>
          ) : (
            <>
              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {statsLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="rounded-2xl p-5 h-32 animate-shimmer" style={{ border: '1px solid rgba(255,255,255,0.05)' }} />
                  ))
                ) : stats ? (
                  <>
                    <StatCard label="Ventas hoy" value={stats.totalSalesToday.toLocaleString()} trend={stats.growthPercent} icon={<ShoppingBag size={16} />} highlight color="fuchsia" />
                    <StatCard label="Ventas ayer" value={stats.totalSalesYesterday.toLocaleString()} icon={<TrendingUp size={16} />} color="violet" />
                    <StatCard label="Crecimiento" value={`${stats.growthPercent > 0 ? '+' : ''}${stats.growthPercent}%`} sub="vs ayer" highlight={stats.growthPercent > 0} color="emerald" />
                  </>
                ) : null}
              </div>

              {/* Buscador */}
              <div className="relative">
                <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Buscar producto..."
                  value={searchInput}
                  onChange={e => {
                    const v = e.target.value;
                    setSearchInput(v);
                    if (searchTimer.current) clearTimeout(searchTimer.current);
                    searchTimer.current = setTimeout(() => setSearch(v), 400);
                  }}
                  className="w-full pl-10 pr-10 py-3 rounded-2xl text-sm text-white placeholder-gray-600 transition-all duration-200 outline-none"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', backdropFilter: 'blur(16px)' }}
                  onFocus={e => { e.target.style.border = '1px solid rgba(139,92,246,0.45)'; e.target.style.boxShadow = '0 0 24px rgba(139,92,246,0.1)'; }}
                  onBlur={e => { e.target.style.border = '1px solid rgba(255,255,255,0.07)'; e.target.style.boxShadow = 'none'; }}
                />
                {searchInput && (
                  <button
                    onClick={() => { setSearchInput(''); setSearch(''); }}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-300 transition-colors"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Product grid */}
              {productsLoading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {Array.from({ length: 12 }).map((_, i) => <SkeletonCard key={i} />)}
                </div>
              ) : products.length > 0 ? (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                    {products.map((p, i) => <ProductCard key={p.id} product={p} rank={i + 1} />)}
                  </div>
                  <div ref={sentinelRef} className="flex justify-center py-6">
                    {isFetchingNextPage && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Loader2 size={16} className="animate-spin text-violet-500" />
                        Cargando más...
                      </div>
                    )}
                    {!hasNextPage && products.length > 0 && (
                      <p className="text-xs text-gray-700 font-medium">— {products.length} productos —</p>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-center py-28 space-y-3">
                  <p className="text-6xl mb-2 opacity-20">
                    {productoFilter === 'hoy' ? '🔥' : productoFilter === 'winners' ? '🏆' : '📦'}
                  </p>
                  <p className="text-gray-600 text-sm">
                    {productoFilter === 'hoy' ? 'Sin ventas registradas hoy aún'
                      : productoFilter === 'winners' ? 'Aún no hay winners — se necesitan 2+ días de datos'
                      : hasFilter ? 'Sin resultados para estos filtros'
                      : 'Cargando productos...'}
                  </p>
                </div>
              )}
            </>
          )}

        </main>
      </div>
    </div>
  );
}
