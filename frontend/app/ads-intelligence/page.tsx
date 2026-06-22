'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { isAuthenticated, getToken } from '@/lib/auth';
import { Sidebar } from '@/components/sidebar';
import { cn } from '@/lib/utils';
import { Search, RefreshCw, ImageIcon, ExternalLink, Clock, TrendingUp, Zap, RotateCcw } from 'lucide-react';

const COUNTRIES = [
  { code: 'DO', label: '🇩🇴 Rep. Dominicana' },
  { code: 'GT', label: '🇬🇹 Guatemala' },
  { code: 'EC', label: '🇪🇨 Ecuador' },
  { code: 'CR', label: '🇨🇷 Costa Rica' },
  { code: 'CO', label: '🇨🇴 Colombia' },
  { code: 'CL', label: '🇨🇱 Chile' },
  { code: 'MX', label: '🇲🇽 México' },
  { code: 'US', label: '🇺🇸 Estados Unidos' },
  { code: 'AR', label: '🇦🇷 Argentina' },
  { code: 'PE', label: '🇵🇪 Perú' },
];

const ANGLE_COLORS: Record<string, { bg: string; color: string }> = {
  'Problema→Solución': { bg: 'rgba(239,68,68,0.1)',   color: '#f87171' },
  'Curiosidad':        { bg: 'rgba(251,191,36,0.1)',   color: '#fbbf24' },
  'Demostración':      { bg: 'rgba(96,165,250,0.1)',   color: '#60a5fa' },
  'Transformación':    { bg: 'rgba(168,85,247,0.12)',  color: '#c084fc' },
  'Prueba Social':     { bg: 'rgba(52,211,153,0.1)',   color: '#34d399' },
  'Oferta Directa':    { bg: 'rgba(251,146,60,0.1)',   color: '#fb923c' },
};

const PLATFORM_ICONS: Record<string, string> = {
  facebook: '📘', instagram: '📸', audience_network: '🌐', messenger: '💬',
};

interface AdResult {
  id: string; copy: string; title: string; caption: string;
  pageName: string; pageId: string; startDate: string; daysActive: number;
  snapshotUrl: string; platforms: string[]; angle: string; insights: string[];
}
interface IntelligenceResult {
  queries: string[]; productCategory: string; mainKeywords: string[];
  ads: AdResult[]; overallInsights: string[]; dominantAngle: string;
  totalFound: number; cachedAt?: string;
}

const glass = { background: 'rgba(40,0,80,0.08)', backdropFilter: 'blur(16px)', border: '1px solid rgba(150,0,220,0.12)' };

export default function AdsIntelligencePage() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [productName, setProductName] = useState('');
  const [country, setCountry] = useState('DO');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePrev, setImagePrev] = useState<string | null>(null);
  const [result, setResult] = useState<IntelligenceResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isAuthenticated()) router.replace('/login');
    else setAuthed(true);
  }, [router]);

  const handleImage = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = e => setImagePrev(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleImage(f);
  }, []);

  const handleAnalyze = async (forceRefresh = false) => {
    if (!productName.trim()) return;
    setError(null); setLoading(true);
    try {
      const form = new FormData();
      form.append('productName', productName.trim());
      form.append('country', country);
      if (imageFile) form.append('image', imageFile);
      if (forceRefresh) form.append('forceRefresh', 'true');

      const res = await fetch('/api/proxy/ads-intelligence/analyze', {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
        body: form,
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({ message: `Error ${res.status}` }));
        throw new Error(e.message ?? `Error ${res.status}`);
      }
      setResult(await res.json());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  if (!authed) return null;

  const countryLabel = COUNTRIES.find(c => c.code === country)?.label ?? country;
  const angleColors = ANGLE_COLORS[result?.dominantAngle ?? ''] ?? { bg: 'rgba(139,92,246,0.1)', color: '#a78bfa' };

  return (
    <div className="min-h-screen flex">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 max-w-4xl w-full mx-auto px-6 py-10 space-y-7">

          {/* Header */}
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="text-3xl">📡</span>
              <h1 className="text-2xl font-bold text-white tracking-tight">Ads Intelligence</h1>
            </div>
            <p className="text-gray-600 text-sm ml-12">Analiza qué anuncios están vendiendo tu producto en Meta Ads ahora mismo</p>
          </div>

          {/* Input card */}
          <div className="rounded-2xl p-6 space-y-5" style={glass}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Product name */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Producto</label>
                <input
                  type="text"
                  placeholder="ej. Masajeador cervical eléctrico"
                  value={productName}
                  disabled={loading}
                  onChange={e => setProductName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAnalyze()}
                  className="w-full px-4 py-3 rounded-xl text-white text-sm outline-none transition-all placeholder-gray-700 disabled:opacity-50"
                  style={{ background: 'rgba(40,0,70,0.4)', border: '1px solid rgba(150,0,220,0.2)' }}
                  onFocus={e => { e.target.style.border = '1px solid rgba(217,70,239,0.5)'; e.target.style.boxShadow = '0 0 16px rgba(217,70,239,0.1)'; }}
                  onBlur={e => { e.target.style.border = '1px solid rgba(150,0,220,0.2)'; e.target.style.boxShadow = 'none'; }}
                />
              </div>

              {/* Country */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">País</label>
                <select
                  value={country}
                  disabled={loading}
                  onChange={e => setCountry(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-white text-sm outline-none disabled:opacity-50 appearance-none"
                  style={{ background: 'rgba(40,0,70,0.3)', border: '1px solid rgba(150,0,220,0.2)' }}
                >
                  {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
                </select>
              </div>

              {/* Image upload */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Imagen del producto (opcional)</label>
                <div
                  onDragOver={e => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={onDrop}
                  onClick={() => fileRef.current?.click()}
                  className="cursor-pointer rounded-xl transition-all flex items-center gap-3 px-4 py-3"
                  style={{
                    border: `1px dashed ${dragging ? 'rgba(217,70,239,0.6)' : imagePrev ? 'rgba(52,211,153,0.4)' : 'rgba(150,0,220,0.2)'}`,
                    background: dragging ? 'rgba(217,70,239,0.06)' : 'rgba(40,0,70,0.15)',
                  }}
                >
                  {imagePrev ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={imagePrev} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0" />
                      <span className="text-xs text-emerald-400 truncate">{imageFile?.name}</span>
                    </>
                  ) : (
                    <>
                      <ImageIcon size={16} className="text-gray-700 flex-shrink-0" />
                      <span className="text-xs text-gray-600">Subir imagen</span>
                    </>
                  )}
                </div>
                <input ref={fileRef} type="file" accept="image/*" className="hidden"
                  onChange={e => e.target.files?.[0] && handleImage(e.target.files[0])} />
              </div>
            </div>

            {error && (
              <div className="rounded-xl px-4 py-3 text-xs" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => handleAnalyze(false)}
                disabled={loading || !productName.trim()}
                className="flex-1 py-3 rounded-xl font-bold text-white text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: 'linear-gradient(135deg, #c026d3, #9333ea)', boxShadow: '0 0 30px rgba(192,38,211,0.35)' }}
              >
                {loading ? <><RefreshCw size={15} className="animate-spin" /> Analizando...</> : <><Search size={15} /> Analizar competencia</>}
              </button>
              {result && (
                <button
                  onClick={() => handleAnalyze(true)}
                  disabled={loading}
                  title="Forzar nueva búsqueda (ignorar caché)"
                  className="px-4 py-3 rounded-xl transition-colors disabled:opacity-40"
                  style={{ border: '1px solid rgba(150,0,220,0.15)', color: 'rgba(180,130,220,0.5)' }}
                >
                  <RotateCcw size={15} />
                </button>
              )}
            </div>
          </div>

          {/* Results */}
          {result && !loading && (
            <div className="space-y-6">

              {/* Summary row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Anuncios activos', value: result.totalFound, icon: '📢' },
                  { label: 'Categoría', value: result.productCategory, icon: '📦' },
                  { label: 'Ángulo dominante', value: result.dominantAngle, icon: '🎯' },
                  { label: 'País analizado', value: countryLabel, icon: '🌍' },
                ].map((s, i) => (
                  <div key={i} className="rounded-xl p-4 relative overflow-hidden" style={{ background: 'rgba(40,0,80,0.08)', border: '1px solid rgba(150,0,220,0.12)' }}>
                    <div className="absolute top-0 left-0 right-0 h-[1px]" style={{ background: 'linear-gradient(90deg, transparent, rgba(217,70,239,0.3), transparent)' }} />
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm">{s.icon}</span>
                      <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">{s.label}</p>
                    </div>
                    <p className="text-sm font-bold text-white truncate">{s.value}</p>
                  </div>
                ))}
              </div>

              {/* Keywords */}
              {result.mainKeywords.length > 0 && (
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="text-xs text-gray-700">Keywords:</span>
                  {result.mainKeywords.map((kw, i) => (
                    <span key={i} className="text-xs px-2.5 py-1 rounded-full"
                      style={{ background: 'rgba(217,70,239,0.08)', border: '1px solid rgba(217,70,239,0.2)', color: '#e879f9' }}>
                      {kw}
                    </span>
                  ))}
                </div>
              )}

              {/* Overall insights */}
              {result.overallInsights.length > 0 && (
                <div className="rounded-2xl p-5" style={{ background: 'rgba(251,191,36,0.05)', border: '1px solid rgba(251,191,36,0.12)' }}>
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp size={14} style={{ color: '#fbbf24' }} />
                    <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#fbbf24' }}>Insights del mercado</p>
                  </div>
                  <ul className="space-y-1.5">
                    {result.overallInsights.map((ins, i) => (
                      <li key={i} className="text-sm flex items-start gap-2" style={{ color: 'rgba(251,191,36,0.8)' }}>
                        <span className="mt-1 flex-shrink-0">•</span> {ins}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* No ads state */}
              {result.ads.length === 0 && (
                <div className="text-center py-16">
                  <p className="text-4xl mb-3 opacity-20">📭</p>
                  <p className="text-sm text-gray-600">No se encontraron anuncios activos para este producto en {countryLabel}</p>
                  <p className="text-xs text-gray-700 mt-1">Prueba con otro país o ajusta el nombre del producto</p>
                </div>
              )}

              {/* Ad cards */}
              {result.ads.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-gray-600 uppercase tracking-widest mb-3">
                    {result.ads.length} Anuncio{result.ads.length !== 1 ? 's' : ''} activo{result.ads.length !== 1 ? 's' : ''}
                  </p>
                  <div className="space-y-3">
                    {result.ads.map((ad, i) => {
                      const ac = ANGLE_COLORS[ad.angle] ?? { bg: 'rgba(156,163,175,0.1)', color: '#9ca3af' };
                      const isTop = i < 3;
                      return (
                        <div key={ad.id} className="rounded-2xl p-5 space-y-3 relative overflow-hidden"
                          style={isTop ? {
                            background: 'linear-gradient(135deg, rgba(192,38,211,0.08), rgba(147,51,234,0.04))',
                            border: '1px solid rgba(217,70,239,0.2)',
                          } : glass}>
                          {isTop && <div className="absolute top-0 left-0 right-0 h-[1px]" style={{ background: 'linear-gradient(90deg, transparent, rgba(217,70,239,0.5), transparent)' }} />}

                          {/* Top row */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-2 flex-wrap">
                              {isTop && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                                  style={{ background: 'rgba(251,191,36,0.1)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.2)' }}>
                                  🔥 Top {i + 1}
                                </span>
                              )}
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                                style={{ background: ac.bg, color: ac.color, border: `1px solid ${ac.color}22` }}>
                                {ad.angle}
                              </span>
                              <span className="flex items-center gap-1 text-[10px] text-gray-600">
                                <Clock size={9} />
                                {ad.daysActive}d activo
                              </span>
                            </div>
                            {ad.snapshotUrl && (
                              <a href={ad.snapshotUrl} target="_blank" rel="noopener noreferrer"
                                className="flex-shrink-0 flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all hover:opacity-80"
                                style={{ background: 'rgba(217,70,239,0.06)', border: '1px solid rgba(217,70,239,0.2)', color: '#e879f9' }}>
                                <ExternalLink size={11} /> Ver anuncio
                              </a>
                            )}
                          </div>

                          {/* Page name */}
                          <p className="text-xs font-bold text-gray-400">
                            🏪 {ad.pageName}
                            {ad.caption && <span className="text-gray-700 font-normal ml-2">· {ad.caption}</span>}
                          </p>

                          {/* Ad copy */}
                          {ad.copy && (
                            <div className="rounded-xl px-4 py-3" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.04)' }}>
                              <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-line">{ad.copy}</p>
                              {ad.title && <p className="text-xs font-bold text-gray-500 mt-2">{ad.title}</p>}
                            </div>
                          )}

                          {/* Platforms + insights */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex flex-wrap gap-1">
                              {ad.platforms.map(p => (
                                <span key={p} className="text-[10px] px-2 py-0.5 rounded-full"
                                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: '#6b7280' }}>
                                  {PLATFORM_ICONS[p] ?? '📱'} {p}
                                </span>
                              ))}
                            </div>
                            {ad.insights.length > 0 && (
                              <div className="text-right">
                                {ad.insights.map((ins, j) => (
                                  <p key={j} className="text-[10px] text-gray-600 leading-snug">{ins}</p>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Cache notice */}
              {result.cachedAt && (
                <p className="text-center text-xs text-gray-700">
                  Datos del {new Date(result.cachedAt).toLocaleString('es', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  {' · '}
                  <button onClick={() => handleAnalyze(true)} className="underline hover:text-gray-500 transition-colors">
                    Actualizar
                  </button>
                </p>
              )}
            </div>
          )}

        </main>
      </div>
    </div>
  );
}
