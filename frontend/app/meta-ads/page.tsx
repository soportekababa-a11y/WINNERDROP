'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Globe, Plus, X, Play, ChevronRight, Zap, TrendingUp, MessageSquare, Eye, ShoppingCart, Loader2, CheckCircle, AlertCircle, Trash2, ArrowLeft, Sparkles, Users, Type } from 'lucide-react';
import { getToken, isAuthenticated } from '@/lib/auth';
import { Sidebar } from '@/components/sidebar';

async function apiFetch(path: string, options?: RequestInit) {
  const token = getToken();
  const res = await fetch(`/api/proxy${path}`, {
    ...options,
    headers: {
      ...(!(options?.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw err;
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

const CAMPAIGN_TYPES = [
  { id: 'VENTAS', icon: ShoppingCart, label: 'Ventas', desc: 'Lleva clientes directamente a comprar en tu tienda o landing page. Optimizado para conversiones y ROAS máximo.', color: 'emerald', badge: '🔥 Más usado' },
  { id: 'TRAFICO', icon: TrendingUp, label: 'Tráfico', desc: 'Envía personas a tu sitio web o landing page. Ideal para que conozcan el producto antes de comprar.', color: 'blue', badge: null },
  { id: 'LEADS', icon: Zap, label: 'Leads', desc: 'Consigue datos de contacto de personas interesadas. Perfecto para servicios o ventas consultivas.', color: 'yellow', badge: null },
  { id: 'MENSAJES', icon: MessageSquare, label: 'Mensajes', desc: 'Que los clientes te escriban por WhatsApp o Messenger. Funciona muy bien en RD y LATAM.', color: 'green', badge: '💬 LATAM' },
  { id: 'RECONOCIMIENTO', icon: Eye, label: 'Reconocimiento', desc: 'Que más gente conozca tu marca. Para construir audiencia antes de vender.', color: 'purple', badge: null },
];

const COUNTRIES = [
  { code: 'RD', label: '🇩🇴 Rep. Dominicana', currency: 'RD$', flag: '🇩🇴' },
  { code: 'GT', label: '🇬🇹 Guatemala', currency: 'Q', flag: '🇬🇹' },
  { code: 'EC', label: '🇪🇨 Ecuador', currency: '$', flag: '🇪🇨' },
  { code: 'CR', label: '🇨🇷 Costa Rica', currency: '₡', flag: '🇨🇷' },
  { code: 'CO', label: '🇨🇴 Colombia', currency: 'COP', flag: '🇨🇴' },
  { code: 'MX', label: '🇲🇽 México', currency: '$MX', flag: '🇲🇽' },
  { code: 'US', label: '🇺🇸 Estados Unidos', currency: '$', flag: '🇺🇸' },
  { code: 'ES', label: '🇪🇸 España', currency: '€', flag: '🇪🇸' },
  { code: 'PE', label: '🇵🇪 Perú', currency: 'S/', flag: '🇵🇪' },
  { code: 'CL', label: '🇨🇱 Chile', currency: '$CLP', flag: '🇨🇱' },
  { code: 'AR', label: '🇦🇷 Argentina', currency: '$ARS', flag: '🇦🇷' },
];

interface AdFile { file: File; preview: string; type: 'image' | 'video' }

type Step =
  | 'connect' | 'setup' | 'home'
  | 'type' | 'product' | 'researching' | 'budget' | 'pixel' | 'pixel-events'
  | 'schedule' | 'adsets-structure' | 'suggesting-audience' | 'audience-review'
  | 'exclude-cities' | 'pages' | 'upload' | 'generating-copy' | 'copy-select'
  | 'creating' | 'done'
  | 'campaigns' | 'metrics-select' | 'metrics-analysis'
  | 'scale-select' | 'scale-intent' | 'scale-options' | 'scale-executing' | 'scale-done';

const glass = { background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' };
const selectStyle = { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: '#e2e8f0' };
const inputClass = 'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-violet-500/50';

export default function MetaAdsPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<Step>('connect');
  const [error, setError] = useState('');

  // Setup
  const [adAccounts, setAdAccounts] = useState<any[]>([]);
  const [pages, setPages] = useState<any[]>([]);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [selectedAccountName, setSelectedAccountName] = useState('');
  const [selectedPage, setSelectedPage] = useState('');
  const [selectedPageName, setSelectedPageName] = useState('');

  // Campaign creation flow
  const [campaignType, setCampaignType] = useState('');
  const [productName, setProductName] = useState('');
  const [landingPage, setLandingPage] = useState('');
  const [priceBefore, setPriceBefore] = useState('');
  const [priceAfter, setPriceAfter] = useState('');
  const [country, setCountry] = useState('RD');
  const [productResearch, setProductResearch] = useState('');
  const [productAngle, setProductAngle] = useState('');
  const [dailyBudget, setDailyBudget] = useState('');
  const [budgetType, setBudgetType] = useState<'CBO' | 'ABO'>('ABO');
  const [pixels, setPixels] = useState<any[]>([]);
  const [selectedPixelId, setSelectedPixelId] = useState('');
  const [pixelEvents, setPixelEvents] = useState<string[]>([]);
  const [selectedEvent, setSelectedEvent] = useState('Purchase');
  const [skipPixel, setSkipPixel] = useState(false);
  const [startTime, setStartTime] = useState('now');
  const [customDate, setCustomDate] = useState('');
  const [adSetsCount, setAdSetsCount] = useState(1);
  const [audienceSuggestions, setAudienceSuggestions] = useState<any[]>([]);
  const [excludeCities, setExcludeCities] = useState<string[]>([]);
  const [cityInput, setCityInput] = useState('');
  const [instagramAccounts, setInstagramAccounts] = useState<any[]>([]);
  const [selectedInstagram, setSelectedInstagram] = useState('');
  const [adFiles, setAdFiles] = useState<AdFile[]>([]);
  const [generatedCopys, setGeneratedCopys] = useState<any[]>([]);
  const [selectedCopyOptions, setSelectedCopyOptions] = useState<Record<number, 0 | 1>>({});
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [playingVideo, setPlayingVideo] = useState<number | null>(null);
  const videoRefs = useRef<Record<number, HTMLVideoElement | null>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Existing flows
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<any>(null);
  const [campaignMetrics, setCampaignMetrics] = useState<any>(null);
  const [metricsAnalysis, setMetricsAnalysis] = useState('');
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [scaleOptions, setScaleOptions] = useState<any[]>([]);
  const [selectedScale, setSelectedScale] = useState<any>(null);
  const [scaleResult, setScaleResult] = useState<any>(null);

  useEffect(() => {
    if (!isAuthenticated()) { router.replace('/login'); return; }
    setAuthed(true);
    loadStatus();
    const params = new URLSearchParams(window.location.search);
    if (params.get('connected') === '1') window.history.replaceState({}, '', '/meta-ads');
    if (params.get('error')) { setError('Error conectando Facebook. Intenta de nuevo.'); window.history.replaceState({}, '', '/meta-ads'); }
  }, []);

  async function loadStatus() {
    setLoading(true);
    try {
      const s = await apiFetch('/meta-ads/status');
      setStatus(s);
      if (s.connected) setStep(s.adAccountId && s.pageId ? 'home' : 'setup');
      if (s.connected && !s.adAccountId) loadAccounts();
    } catch { setStep('connect'); }
    finally { setLoading(false); }
  }

  async function loadAccounts() {
    try {
      setAdAccounts(await apiFetch('/meta-ads/accounts'));
      setPages(await apiFetch('/meta-ads/pages'));
    } catch (e: any) { setError(e.message); }
  }

  async function loadCampaigns() {
    setLoadingCampaigns(true);
    try { setCampaigns(await apiFetch('/meta-ads/campaigns')); } catch {}
    finally { setLoadingCampaigns(false); }
  }

  function resetFlow() {
    setProductName(''); setLandingPage(''); setPriceBefore(''); setPriceAfter('');
    setProductResearch(''); setProductAngle(''); setDailyBudget(''); setBudgetType('ABO');
    setSelectedPixelId(''); setSkipPixel(false); setStartTime('now'); setCustomDate('');
    setAdSetsCount(1); setAudienceSuggestions([]); setExcludeCities([]); setCityInput('');
    setSelectedInstagram(''); setAdFiles([]); setGeneratedCopys([]); setSelectedCopyOptions({});
    setResult(null); setError('');
  }

  // Step: research product
  async function doResearch() {
    setStep('researching');
    setError('');
    try {
      const res = await apiFetch('/meta-ads/research-product', {
        method: 'POST',
        body: JSON.stringify({ productName, landingPage, priceBefore, priceAfter, country }),
      });
      setProductResearch(res.research ?? '');
      setProductAngle(res.angle ?? '');
      setStep('budget');
    } catch { setStep('budget'); }
  }

  // Step: load pixels
  async function loadPixels() {
    setStep('pixel');
    try {
      const pxs = await apiFetch('/meta-ads/pixels');
      setPixels(pxs);
      if (pxs.length === 0) setSkipPixel(true);
    } catch { setSkipPixel(true); }
  }

  // Step: load pixel events
  async function loadPixelEvents(pixelId: string) {
    setSelectedPixelId(pixelId);
    setStep('pixel-events');
    try {
      const evts = await apiFetch(`/meta-ads/pixels/${pixelId}/events`);
      setPixelEvents(Array.isArray(evts) ? evts : []);
    } catch { setPixelEvents(['Purchase', 'AddToCart', 'ViewContent', 'Lead']); }
  }

  // Step: suggest audience
  async function suggestAudience() {
    setStep('suggesting-audience');
    setError('');
    try {
      const res = await apiFetch('/meta-ads/suggest-audience', {
        method: 'POST',
        body: JSON.stringify({ productName, country, budgetType, adSetsCount, productResearch, campaignType }),
      });
      setAudienceSuggestions(res.adSets ?? []);
      setStep('audience-review');
    } catch { setAudienceSuggestions([{ name: 'Audiencia Amplia', isBroad: true, interests: [], rationale: 'Broad targeting' }]); setStep('audience-review'); }
  }

  // Step: load IG accounts
  async function loadInstagram() {
    try {
      const igs = await apiFetch('/meta-ads/instagram');
      setInstagramAccounts(igs);
    } catch {}
  }

  // Step: generate copy
  async function generateCopy() {
    if (adFiles.length === 0) { setError('Sube al menos un anuncio'); return; }
    setStep('generating-copy');
    setError('');
    try {
      const res = await apiFetch('/meta-ads/generate-copy', {
        method: 'POST',
        body: JSON.stringify({ productName, country, landingPage, priceBefore, priceAfter, campaignType, adCount: adFiles.length, productResearch, angle: productAngle }),
      });
      setGeneratedCopys(res.ads ?? []);
      const defaults: Record<number, 0 | 1> = {};
      (res.ads ?? []).forEach((_: any, i: number) => { defaults[i] = 0; });
      setSelectedCopyOptions(defaults);
      setStep('copy-select');
    } catch { setError('Error generando copies. Intenta de nuevo.'); setStep('upload'); }
  }

  // Final: create campaign
  async function createCampaign() {
    setCreating(true);
    setError('');
    setStep('creating');
    try {
      const selectedCopysArray = adFiles.map((_, i) => {
        const adCopys = generatedCopys[i];
        const optIdx = selectedCopyOptions[i] ?? 0;
        return adCopys ? (optIdx === 0 ? adCopys.option1 : adCopys.option2) : { primaryText: productName, headline: productName, description: '', callToAction: 'SHOP_NOW' };
      });

      const form = new FormData();
      form.append('campaignType', campaignType);
      form.append('productName', productName);
      form.append('landingPage', landingPage);
      form.append('country', country);
      form.append('dailyBudget', dailyBudget);
      form.append('budgetType', budgetType);
      if (selectedPixelId) form.append('pixelId', selectedPixelId);
      if (selectedEvent) form.append('conversionEvent', selectedEvent);
      form.append('startTime', startTime === 'custom' ? customDate : 'now');
      form.append('excludeCities', JSON.stringify(excludeCities));
      if (selectedInstagram) form.append('instagramAccountId', selectedInstagram);
      form.append('audienceAdSets', JSON.stringify(audienceSuggestions));
      form.append('copys', JSON.stringify(selectedCopysArray));
      adFiles.forEach(a => form.append('files', a.file));

      const res = await apiFetch('/meta-ads/campaigns', { method: 'POST', body: form });
      setResult(res);
      if (res?.credits !== undefined) setStatus((prev: any) => ({ ...prev, credits: res.credits }));
      setStep('done');
    } catch (e: any) {
      setError(e.message || 'Error creando campaña');
      setStep('copy-select');
    } finally { setCreating(false); }
  }

  function handleFileAdd(files: FileList | null) {
    if (!files) return;
    Array.from(files).slice(0, 10 - adFiles.length).forEach(file => {
      setAdFiles(prev => [...prev, { file, preview: URL.createObjectURL(file), type: file.type.startsWith('video/') ? 'video' : 'image' }]);
    });
  }

  function removeAd(idx: number) {
    setAdFiles(prev => { URL.revokeObjectURL(prev[idx].preview); return prev.filter((_, i) => i !== idx); });
  }

  const countryObj = COUNTRIES.find(c => c.code === country);

  if (!authed) return null;

  // ── Step renderer ──

  const stepTitle: Partial<Record<Step, string>> = {
    type: '¿Qué objetivo tiene tu campaña?',
    product: 'Información del producto',
    budget: 'Presupuesto y estructura',
    pixel: 'Selecciona tu Pixel',
    'pixel-events': 'Evento de conversión',
    schedule: '¿Cuándo inicia la campaña?',
    'adsets-structure': 'Estructura de conjuntos',
    'audience-review': 'Audiencia recomendada',
    'exclude-cities': 'Excluir ciudades',
    pages: 'Página e Instagram',
    upload: 'Sube tus creativos',
    'copy-select': 'Elige el copy de cada anuncio',
    creating: 'Creando campaña...',
    done: '¡Campaña creada!',
  };

  const creationSteps: Step[] = ['type', 'product', 'budget', 'pixel', 'schedule', 'adsets-structure', 'audience-review', 'exclude-cities', 'pages', 'upload', 'copy-select'];
  const currentStepIndex = creationSteps.indexOf(step);
  const isCreationFlow = currentStepIndex >= 0 || ['researching', 'suggesting-audience', 'generating-copy', 'pixel-events', 'creating', 'done'].includes(step);

  return (
    <div className="min-h-screen bg-[#020209] flex">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <div className="max-w-3xl w-full mx-auto px-6 py-8 space-y-6">

          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl" style={{ background: 'rgba(24,119,242,0.15)', border: '1px solid rgba(24,119,242,0.3)' }}>
                <Globe size={22} className="text-blue-400" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-white">Meta Ads IA</h1>
                <p className="text-xs text-gray-500">Campañas profesionales en minutos</p>
              </div>
            </div>
            {status && (
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500">Créditos: <span className="text-violet-400 font-semibold">{status.credits}</span></span>
                {status.connected && (
                  <button onClick={() => apiFetch('/meta-ads/disconnect', { method: 'DELETE' }).then(loadStatus)} className="text-xs text-gray-600 hover:text-red-400 transition-colors">Desconectar</button>
                )}
              </div>
            )}
          </div>

          {/* Progress bar for creation flow */}
          {isCreationFlow && !['creating', 'done', 'researching', 'suggesting-audience', 'generating-copy'].includes(step) && (
            <div className="flex gap-1.5">
              {creationSteps.map((s, i) => (
                <div key={s} className="flex-1 h-1 rounded-full transition-all" style={{ background: i <= currentStepIndex ? 'rgba(139,92,246,0.7)' : 'rgba(255,255,255,0.06)' }} />
              ))}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl text-sm text-red-400" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <AlertCircle size={14} /> {error}
              <button onClick={() => setError('')} className="ml-auto"><X size={14} /></button>
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-20"><div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" /></div>
          ) : (
            <>

              {/* ── CONNECT ── */}
              {step === 'connect' && (
                <div className="rounded-2xl p-8 text-center space-y-5" style={glass}>
                  <Globe size={48} className="text-blue-400 mx-auto" />
                  <div><h2 className="text-lg font-semibold text-white">Conecta tu cuenta de Facebook</h2><p className="text-sm text-gray-500 mt-1">Necesario para crear campañas en tu cuenta publicitaria</p></div>
                  <button onClick={() => apiFetch('/meta-ads/auth-url').then(r => { window.location.href = r.url; })} className="mx-auto flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium text-white" style={{ background: 'linear-gradient(135deg, #1877f2, #0c5fc7)' }}>
                    <Globe size={16} /> Conectar con Facebook
                  </button>
                </div>
              )}

              {/* ── SETUP ── */}
              {step === 'setup' && (
                <div className="rounded-2xl p-6 space-y-5" style={glass}>
                  <div className="flex items-center gap-2"><CheckCircle size={16} className="text-emerald-400" /><p className="text-sm text-emerald-400 font-medium">Facebook conectado</p></div>
                  <h2 className="text-base font-semibold text-white">Configura tu cuenta</h2>
                  <div className="space-y-1.5"><label className="text-xs text-gray-500">Cuenta publicitaria</label>
                    <select className={inputClass} value={selectedAccount} onChange={e => { const a = adAccounts.find(x => x.id === e.target.value); setSelectedAccount(e.target.value); setSelectedAccountName(a?.name ?? ''); }}>
                      <option value="">Seleccionar cuenta...</option>
                      {adAccounts.map(a => <option key={a.id} value={a.id}>{a.name} ({a.id})</option>)}
                    </select></div>
                  <div className="space-y-1.5"><label className="text-xs text-gray-500">Página de Facebook</label>
                    <select className={inputClass} value={selectedPage} onChange={e => { const p = pages.find(x => x.id === e.target.value); setSelectedPage(e.target.value); setSelectedPageName(p?.name ?? ''); }}>
                      <option value="">Seleccionar página...</option>
                      {pages.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select></div>
                  <button onClick={async () => { await apiFetch('/meta-ads/select-account', { method: 'POST', body: JSON.stringify({ adAccountId: selectedAccount, adAccountName: selectedAccountName }) }); await apiFetch('/meta-ads/select-page', { method: 'POST', body: JSON.stringify({ pageId: selectedPage, pageName: selectedPageName }) }); setStep('home'); }} disabled={!selectedAccount || !selectedPage}
                    className="w-full py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-50" style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)' }}>
                    Continuar →
                  </button>
                </div>
              )}

              {/* ── HOME ── */}
              {step === 'home' && (
                <div className="space-y-5">
                  <div><p className="text-xs text-gray-500">{status?.adAccountName}</p><h2 className="text-lg font-semibold text-white mt-0.5">¿Qué quieres hacer?</h2></div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[
                      { icon: '🚀', label: 'Crear campaña', desc: 'Flujo paso a paso — la IA genera copy, audiencia y estructura profesional.', color: 'violet', action: () => { resetFlow(); setStep('type'); } },
                      { icon: '📊', label: 'Revisar métricas', desc: 'La IA analiza tus campañas y te dice qué mejorar.', color: 'blue', action: () => { loadCampaigns(); setStep('metrics-select'); } },
                      { icon: '📈', label: 'Escalar campaña', desc: 'La IA sugiere cómo escalar y ejecuta el cambio.', color: 'yellow', action: () => { loadCampaigns(); setStep('scale-select'); }, badge: '🔥 IA' },
                      { icon: '📋', label: 'Mis campañas', desc: 'Lista de campañas creadas desde MOMENTUM.', color: 'emerald', action: () => { loadCampaigns(); setStep('campaigns'); } },
                      { icon: '🔄', label: 'Cambiar cuenta', desc: 'Conectar otra cuenta publicitaria.', color: 'gray', action: () => { loadAccounts(); setStep('setup'); } },
                    ].map(item => {
                      const bg: Record<string, string> = { violet: 'rgba(139,92,246,0.1)', blue: 'rgba(59,130,246,0.1)', emerald: 'rgba(16,185,129,0.1)', yellow: 'rgba(234,179,8,0.1)', gray: 'rgba(255,255,255,0.03)' };
                      const border: Record<string, string> = { violet: 'rgba(139,92,246,0.25)', blue: 'rgba(59,130,246,0.25)', emerald: 'rgba(16,185,129,0.25)', yellow: 'rgba(234,179,8,0.25)', gray: 'rgba(255,255,255,0.06)' };
                      return (
                        <button key={item.label} onClick={item.action} className="text-left p-5 rounded-2xl space-y-2 transition-all hover:scale-[1.02]" style={{ background: bg[item.color], border: `1px solid ${border[item.color]}` }}>
                          <div className="flex items-center justify-between"><span className="text-2xl">{item.icon}</span>{(item as any).badge && <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24' }}>{(item as any).badge}</span>}</div>
                          <p className="text-sm font-semibold text-white">{item.label}</p>
                          <p className="text-xs text-gray-500">{item.desc}</p>
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-600 pt-1">
                    <span>Créditos disponibles: <span className="text-violet-400 font-semibold">{status?.credits ?? 0}</span></span>
                    {(status?.credits ?? 0) === 0 && <a href="https://wa.me/18299607483?text=Quiero recargar créditos Meta Ads" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline">+ Recargar créditos</a>}
                  </div>
                </div>
              )}

              {/* ── STEP: TYPE ── */}
              {step === 'type' && (
                <div className="space-y-4">
                  <button onClick={() => setStep('home')} className="flex items-center gap-1 text-xs text-gray-500 hover:text-white"><ArrowLeft size={12} /> Inicio</button>
                  <h2 className="text-base font-semibold text-white">¿Qué objetivo tiene tu campaña?</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {CAMPAIGN_TYPES.map(ct => {
                      const Icon = ct.icon;
                      const clrs: Record<string, string> = { emerald: '#34d399', blue: '#60a5fa', yellow: '#fbbf24', green: '#4ade80', purple: '#a78bfa' };
                      const bgs: Record<string, string> = { emerald: 'rgba(16,185,129,0.08)', blue: 'rgba(59,130,246,0.08)', yellow: 'rgba(234,179,8,0.08)', green: 'rgba(34,197,94,0.08)', purple: 'rgba(139,92,246,0.08)' };
                      const borders: Record<string, string> = { emerald: 'rgba(16,185,129,0.25)', blue: 'rgba(59,130,246,0.25)', yellow: 'rgba(234,179,8,0.25)', green: 'rgba(34,197,94,0.25)', purple: 'rgba(139,92,246,0.25)' };
                      return (
                        <button key={ct.id} onClick={() => { setCampaignType(ct.id); setStep('product'); }}
                          className="text-left p-4 rounded-2xl space-y-2 transition-all hover:scale-[1.02]"
                          style={{ background: bgs[ct.color], border: `1px solid ${borders[ct.color]}` }}>
                          <div className="flex items-center justify-between">
                            <Icon size={20} style={{ color: clrs[ct.color] }} />
                            {ct.badge && <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(255,255,255,0.08)', color: '#9ca3af' }}>{ct.badge}</span>}
                          </div>
                          <p className="text-sm font-semibold text-white">{ct.label}</p>
                          <p className="text-xs text-gray-400 leading-relaxed">{ct.desc}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── STEP: PRODUCT ── */}
              {step === 'product' && (
                <div className="rounded-2xl p-6 space-y-5" style={glass}>
                  <div className="flex items-center gap-2"><button onClick={() => setStep('type')} className="text-xs text-gray-500 hover:text-white flex items-center gap-1"><ArrowLeft size={12} /> Atrás</button></div>
                  <div><h2 className="text-base font-semibold text-white">Información del producto</h2><p className="text-xs text-gray-500 mt-0.5">La IA investigará tu producto automáticamente</p></div>

                  <div className="space-y-1.5"><label className="text-xs text-gray-500">País donde publicarás</label>
                    <select className={inputClass} value={country} onChange={e => setCountry(e.target.value)} style={selectStyle}>
                      {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
                    </select></div>

                  <div className="space-y-1.5"><label className="text-xs text-gray-500">Nombre del producto</label>
                    <input className={inputClass} placeholder="ej. Faja Reductora Premium" value={productName} onChange={e => setProductName(e.target.value)} /></div>

                  <div className="space-y-1.5"><label className="text-xs text-gray-500">URL de tu landing page</label>
                    <input className={inputClass} placeholder="https://..." value={landingPage} onChange={e => setLandingPage(e.target.value)} /></div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs text-gray-500">Precio antes <span className="text-gray-700">(opcional)</span></label>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-600">{countryObj?.currency}</span>
                        <input className={inputClass} placeholder="1,500" value={priceBefore} onChange={e => setPriceBefore(e.target.value)} />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs text-gray-500">Precio actual</label>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-600">{countryObj?.currency}</span>
                        <input className={inputClass} placeholder="999" value={priceAfter} onChange={e => setPriceAfter(e.target.value)} />
                      </div>
                    </div>
                  </div>

                  <button onClick={doResearch} disabled={!productName || !landingPage || !priceAfter}
                    className="w-full py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 flex items-center justify-center gap-2"
                    style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)' }}>
                    <Sparkles size={14} /> Continuar — IA investiga el producto
                  </button>
                </div>
              )}

              {/* ── RESEARCHING ── */}
              {step === 'researching' && (
                <div className="flex flex-col items-center py-20 gap-4">
                  <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.3)' }}>
                    <Sparkles size={24} className="text-violet-400 animate-pulse" />
                  </div>
                  <p className="text-white font-semibold">Investigando tu producto...</p>
                  <p className="text-xs text-gray-500">La IA analiza el producto para generar mejor copy y audiencia</p>
                </div>
              )}

              {/* ── STEP: BUDGET ── */}
              {step === 'budget' && (
                <div className="rounded-2xl p-6 space-y-5" style={glass}>
                  <button onClick={() => setStep('product')} className="flex items-center gap-1 text-xs text-gray-500 hover:text-white"><ArrowLeft size={12} /> Atrás</button>

                  {productResearch && (
                    <div className="rounded-xl p-3 text-xs" style={{ background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.2)' }}>
                      <p className="text-violet-300 font-medium mb-1">🔍 Investigación del producto</p>
                      <p className="text-gray-400">{productResearch}</p>
                      {productAngle && <p className="text-violet-300 mt-1">Ángulo: <span className="text-gray-300">{productAngle}</span></p>}
                    </div>
                  )}

                  <div><h2 className="text-base font-semibold text-white">Presupuesto diario</h2></div>
                  <div className="space-y-1.5"><label className="text-xs text-gray-500">¿Cuánto quieres invertir por día? (USD)</label>
                    <input type="number" className={inputClass} placeholder="ej. 15" value={dailyBudget} onChange={e => setDailyBudget(e.target.value)} min="1" /></div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-300">¿Dónde colocar el presupuesto?</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {[
                        { val: 'ABO', label: '🎯 En cada conjunto', badge: 'Para testear', desc: 'Tú controlas cuánto gasta cada conjunto. Ideal para probar audiencias y ver cuál convierte mejor.' },
                        { val: 'CBO', label: '🤖 En la campaña', badge: 'Meta optimiza', desc: 'Meta distribuye el presupuesto automáticamente al conjunto que más convierte. Mejor para escalar.' },
                      ].map(o => (
                        <button key={o.val} onClick={() => setBudgetType(o.val as any)}
                          className="text-left p-4 rounded-xl space-y-1.5 transition-all"
                          style={budgetType === o.val ? { background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.5)' } : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold text-white">{o.label}</p>
                            <span className="text-[9px] px-1.5 py-0.5 rounded-md" style={{ background: 'rgba(139,92,246,0.15)', color: '#a78bfa' }}>{o.badge}</span>
                          </div>
                          <p className="text-xs text-gray-500">{o.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  <button onClick={loadPixels} disabled={!dailyBudget}
                    className="w-full py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                    style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)' }}>
                    Continuar →
                  </button>
                </div>
              )}

              {/* ── STEP: PIXEL ── */}
              {step === 'pixel' && (
                <div className="space-y-4">
                  <button onClick={() => setStep('budget')} className="flex items-center gap-1 text-xs text-gray-500 hover:text-white"><ArrowLeft size={12} /> Atrás</button>
                  <div><h2 className="text-base font-semibold text-white">¿Qué pixel quieres usar?</h2><p className="text-xs text-gray-500 mt-0.5">El pixel rastrea conversiones en tu sitio web</p></div>

                  {pixels.length === 0 ? (
                    <div className="rounded-2xl p-6 text-center space-y-3" style={glass}>
                      <p className="text-gray-500 text-sm">No se encontraron pixels en esta cuenta.</p>
                      <button onClick={() => { setSkipPixel(true); setStep('schedule'); }} className="text-xs text-violet-400 hover:underline">Continuar sin pixel (usará tráfico) →</button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {pixels.map(px => (
                        <button key={px.id} onClick={() => loadPixelEvents(px.id)}
                          className="w-full text-left p-4 rounded-xl flex items-center justify-between transition-all hover:border-violet-500/40"
                          style={glass}>
                          <div>
                            <p className="text-sm font-medium text-white">{px.name}</p>
                            <p className="text-xs text-gray-600 mt-0.5">ID: {px.id}</p>
                            {px.last_fired_time && <p className="text-[10px] text-gray-700">Último disparo: {new Date(px.last_fired_time * 1000).toLocaleDateString()}</p>}
                          </div>
                          <ChevronRight size={16} className="text-gray-600" />
                        </button>
                      ))}
                      <button onClick={() => { setSkipPixel(true); setStep('schedule'); }} className="w-full text-center text-xs text-gray-600 hover:text-gray-400 py-2">
                        Continuar sin pixel →
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* ── STEP: PIXEL EVENTS ── */}
              {step === 'pixel-events' && (
                <div className="space-y-4">
                  <button onClick={() => setStep('pixel')} className="flex items-center gap-1 text-xs text-gray-500 hover:text-white"><ArrowLeft size={12} /> Pixels</button>
                  <div><h2 className="text-base font-semibold text-white">¿Qué evento quieres optimizar?</h2><p className="text-xs text-gray-500 mt-0.5">Meta usará este evento para encontrar clientes similares a quienes compran</p></div>
                  <div className="grid grid-cols-2 gap-2">
                    {pixelEvents.map(evt => (
                      <button key={evt} onClick={() => { setSelectedEvent(evt); setStep('schedule'); }}
                        className="p-3 rounded-xl text-left transition-all"
                        style={selectedEvent === evt ? { background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.5)' } : glass}>
                        <p className="text-sm font-medium text-white">{evt}</p>
                        {evt === 'Purchase' && <p className="text-xs text-gray-600">Recomendado para ventas</p>}
                        {evt === 'Lead' && <p className="text-xs text-gray-600">Para captura de datos</p>}
                        {evt === 'AddToCart' && <p className="text-xs text-gray-600">Agregar al carrito</p>}
                        {evt === 'ViewContent' && <p className="text-xs text-gray-600">Ver contenido</p>}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ── STEP: SCHEDULE ── */}
              {step === 'schedule' && (
                <div className="rounded-2xl p-6 space-y-5" style={glass}>
                  <button onClick={() => setStep(skipPixel ? 'pixel' : 'pixel-events')} className="flex items-center gap-1 text-xs text-gray-500 hover:text-white"><ArrowLeft size={12} /> Atrás</button>
                  <div><h2 className="text-base font-semibold text-white">¿Cuándo inicia la campaña?</h2></div>
                  <div className="flex gap-3">
                    {[{ val: 'now', label: '⚡ Ahora mismo' }, { val: 'custom', label: '📅 Fecha específica' }].map(o => (
                      <button key={o.val} onClick={() => setStartTime(o.val)}
                        className="flex-1 py-2.5 rounded-xl text-xs font-medium transition-all"
                        style={startTime === o.val ? { background: 'rgba(139,92,246,0.2)', border: '1px solid rgba(139,92,246,0.5)', color: '#c4b5fd' } : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#6b7280' }}>
                        {o.label}
                      </button>
                    ))}
                  </div>
                  {startTime === 'custom' && (
                    <input type="datetime-local" className={inputClass} value={customDate} onChange={e => setCustomDate(e.target.value)} />
                  )}
                  <button onClick={() => setStep('adsets-structure')} className="w-full py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)' }}>
                    Continuar →
                  </button>
                </div>
              )}

              {/* ── STEP: AD SETS STRUCTURE ── */}
              {step === 'adsets-structure' && (
                <div className="rounded-2xl p-6 space-y-5" style={glass}>
                  <button onClick={() => setStep('schedule')} className="flex items-center gap-1 text-xs text-gray-500 hover:text-white"><ArrowLeft size={12} /> Atrás</button>
                  <div><h2 className="text-base font-semibold text-white">¿Cuántos conjuntos de anuncios?</h2>
                    <p className="text-xs text-gray-500 mt-0.5">Cada conjunto tiene su propia audiencia. La IA definirá la audiencia de cada uno.</p></div>

                  <div className="rounded-xl p-3 text-xs" style={{ background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.15)' }}>
                    <p className="text-violet-300 font-medium mb-1">💡 Recomendación para {budgetType}</p>
                    {budgetType === 'ABO' && parseFloat(dailyBudget) < 20 && <p className="text-gray-400">Con presupuesto bajo: <strong className="text-white">1 conjunto</strong> para concentrar el budget y salir rápido del learning phase.</p>}
                    {budgetType === 'ABO' && parseFloat(dailyBudget) >= 20 && <p className="text-gray-400">Testeo ABO: <strong className="text-white">2-3 conjuntos</strong> con audiencias diferentes para ver cuál convierte mejor.</p>}
                    {budgetType === 'CBO' && <p className="text-gray-400">Con CBO: <strong className="text-white">2-4 conjuntos</strong> — Meta distribuirá el budget automáticamente al que más convierta.</p>}
                  </div>

                  <div className="grid grid-cols-4 gap-2">
                    {[1, 2, 3, 4].map(n => (
                      <button key={n} onClick={() => setAdSetsCount(n)}
                        className="py-4 rounded-xl text-center transition-all"
                        style={adSetsCount === n ? { background: 'rgba(139,92,246,0.2)', border: '1px solid rgba(139,92,246,0.5)' } : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <p className="text-xl font-bold text-white">{n}</p>
                        <p className="text-[10px] text-gray-600 mt-0.5">conjunto{n > 1 ? 's' : ''}</p>
                      </button>
                    ))}
                  </div>

                  <button onClick={suggestAudience} className="w-full py-2.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2" style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)' }}>
                    <Users size={14} /> IA sugiere la audiencia →
                  </button>
                </div>
              )}

              {/* ── SUGGESTING AUDIENCE ── */}
              {step === 'suggesting-audience' && (
                <div className="flex flex-col items-center py-20 gap-4">
                  <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.3)' }}>
                    <Users size={24} className="text-violet-400 animate-pulse" />
                  </div>
                  <p className="text-white font-semibold">Construyendo audiencias...</p>
                  <p className="text-xs text-gray-500">La IA selecciona los mejores intereses para tu producto en {countryObj?.flag}</p>
                </div>
              )}

              {/* ── STEP: AUDIENCE REVIEW ── */}
              {step === 'audience-review' && (
                <div className="space-y-4">
                  <button onClick={() => setStep('adsets-structure')} className="flex items-center gap-1 text-xs text-gray-500 hover:text-white"><ArrowLeft size={12} /> Atrás</button>
                  <div><h2 className="text-base font-semibold text-white">Audiencia recomendada por IA</h2><p className="text-xs text-gray-500 mt-0.5">Puedes revisar antes de continuar</p></div>
                  <div className="space-y-3">
                    {audienceSuggestions.map((adSet, i) => (
                      <div key={i} className="rounded-xl p-4 space-y-2" style={glass}>
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-white">{adSet.name}</p>
                          <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: adSet.isBroad ? 'rgba(16,185,129,0.15)' : 'rgba(139,92,246,0.15)', color: adSet.isBroad ? '#34d399' : '#a78bfa' }}>
                            {adSet.isBroad ? '🌐 Broad' : '🎯 Intereses'}
                          </span>
                        </div>
                        {!adSet.isBroad && adSet.interests?.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {adSet.interests.map((int: any) => (
                              <span key={int.id} className="text-[10px] px-2 py-0.5 rounded-lg" style={{ background: 'rgba(139,92,246,0.1)', color: '#c4b5fd' }}>{int.name}</span>
                            ))}
                          </div>
                        )}
                        {adSet.rationale && <p className="text-xs text-gray-600">{adSet.rationale}</p>}
                      </div>
                    ))}
                  </div>
                  <button onClick={() => setStep('exclude-cities')} className="w-full py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)' }}>
                    Continuar →
                  </button>
                </div>
              )}

              {/* ── STEP: EXCLUDE CITIES ── */}
              {step === 'exclude-cities' && (
                <div className="rounded-2xl p-6 space-y-5" style={glass}>
                  <button onClick={() => setStep('audience-review')} className="flex items-center gap-1 text-xs text-gray-500 hover:text-white"><ArrowLeft size={12} /> Atrás</button>
                  <div><h2 className="text-base font-semibold text-white">¿Excluir ciudades?</h2><p className="text-xs text-gray-500 mt-0.5">Opcional — por ejemplo si no haces envíos a ciertas zonas</p></div>
                  <div className="flex gap-2">
                    <input className={`${inputClass} flex-1`} placeholder="ej. Santiago, Moca..." value={cityInput} onChange={e => setCityInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && cityInput.trim()) { setExcludeCities(prev => [...prev, cityInput.trim()]); setCityInput(''); } }} />
                    <button onClick={() => { if (cityInput.trim()) { setExcludeCities(prev => [...prev, cityInput.trim()]); setCityInput(''); } }} className="px-3 py-2 rounded-xl text-xs border border-white/10 text-gray-400 hover:text-white"><Plus size={14} /></button>
                  </div>
                  {excludeCities.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {excludeCities.map(c => (
                        <span key={c} className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-gray-300" style={{ background: 'rgba(255,255,255,0.06)' }}>
                          {c} <button onClick={() => setExcludeCities(prev => prev.filter(x => x !== c))}><X size={10} /></button>
                        </span>
                      ))}
                    </div>
                  )}
                  <button onClick={() => { loadInstagram(); setStep('pages'); }} className="w-full py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)' }}>
                    {excludeCities.length === 0 ? 'No excluir ciudades →' : 'Continuar →'}
                  </button>
                </div>
              )}

              {/* ── STEP: PAGES ── */}
              {step === 'pages' && (
                <div className="rounded-2xl p-6 space-y-5" style={glass}>
                  <button onClick={() => setStep('exclude-cities')} className="flex items-center gap-1 text-xs text-gray-500 hover:text-white"><ArrowLeft size={12} /> Atrás</button>
                  <div><h2 className="text-base font-semibold text-white">Página e Instagram</h2></div>
                  <div className="p-3 rounded-xl flex items-center gap-3" style={{ background: 'rgba(24,119,242,0.08)', border: '1px solid rgba(24,119,242,0.2)' }}>
                    <Globe size={16} className="text-blue-400 shrink-0" />
                    <div><p className="text-sm font-medium text-white">{status?.pageName ?? 'Página vinculada'}</p><p className="text-xs text-gray-500">Página de Facebook activa</p></div>
                  </div>
                  {instagramAccounts.length > 0 && (
                    <div className="space-y-2">
                      <label className="text-xs text-gray-500">Cuenta de Instagram (opcional)</label>
                      <div className="space-y-2">
                        <button onClick={() => setSelectedInstagram('')}
                          className="w-full text-left p-3 rounded-xl flex items-center justify-between transition-all"
                          style={!selectedInstagram ? { background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.4)' } : glass}>
                          <p className="text-sm text-gray-400">Solo Facebook (sin Instagram)</p>
                          {!selectedInstagram && <CheckCircle size={14} className="text-violet-400" />}
                        </button>
                        {instagramAccounts.map(ig => (
                          <button key={ig.id} onClick={() => setSelectedInstagram(ig.id)}
                            className="w-full text-left p-3 rounded-xl flex items-center justify-between transition-all"
                            style={selectedInstagram === ig.id ? { background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.4)' } : glass}>
                            <div className="flex items-center gap-2"><span className="text-pink-400 text-sm">IG</span><p className="text-sm text-white">{ig.name}</p></div>
                            {selectedInstagram === ig.id && <CheckCircle size={14} className="text-violet-400" />}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <button onClick={() => setStep('upload')} className="w-full py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)' }}>
                    Continuar →
                  </button>
                </div>
              )}

              {/* ── STEP: UPLOAD ── */}
              {step === 'upload' && (
                <div className="space-y-5">
                  <button onClick={() => setStep('pages')} className="flex items-center gap-1 text-xs text-gray-500 hover:text-white"><ArrowLeft size={12} /> Atrás</button>
                  <div><h2 className="text-base font-semibold text-white">Sube tus creativos</h2>
                    <p className="text-xs text-gray-500 mt-0.5">La IA generará copy profesional para cada anuncio</p></div>

                  <div className="rounded-xl p-3 text-xs space-y-1" style={{ background: 'rgba(234,179,8,0.06)', border: '1px solid rgba(234,179,8,0.2)' }}>
                    <p className="text-yellow-300 font-medium">📐 Formatos recomendados por Meta</p>
                    <p className="text-gray-400">• <strong className="text-white">Imagen:</strong> 1080×1080 (cuadrada) o 1080×1920 (vertical para Reels/Stories)</p>
                    <p className="text-gray-400">• <strong className="text-white">Video:</strong> MP4, mínimo 1080p, vertical 9:16 convierte mejor en Reels</p>
                    <p className="text-gray-400">• <strong className="text-white">Duración video:</strong> 15-30s para Reels, hasta 60s para Feed</p>
                  </div>

                  <div className="flex flex-wrap gap-4">
                    {adFiles.map((ad, idx) => (
                      <div key={idx} className="relative flex flex-col items-center">
                        <div className="relative rounded-[2rem] overflow-hidden" style={{ width: 130, height: 220, background: '#0a0a14', border: '3px solid rgba(255,255,255,0.15)' }}>
                          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-12 h-3 rounded-full z-10" style={{ background: '#020209' }} />
                          <div className="w-full h-full flex items-center justify-center overflow-hidden">
                            {ad.type === 'image' ? (
                              <img src={ad.preview} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="relative w-full h-full cursor-pointer" onClick={() => { const el = videoRefs.current[idx]; if (!el) return; el.paused ? (el.play(), setPlayingVideo(idx)) : (el.pause(), setPlayingVideo(null)); }}>
                                <video src={ad.preview} className="w-full h-full object-cover" loop playsInline muted ref={el => { videoRefs.current[idx] = el; }} />
                                {playingVideo !== idx && <div className="absolute inset-0 flex items-center justify-center"><div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}><Play size={12} className="text-white ml-0.5" /></div></div>}
                              </div>
                            )}
                          </div>
                          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-[9px] text-white" style={{ background: 'rgba(0,0,0,0.6)' }}>
                            {ad.type === 'video' ? '📹' : '🖼️'} {idx + 1}
                          </div>
                        </div>
                        <button onClick={() => removeAd(idx)} className="mt-1 p-1 rounded-lg text-gray-600 hover:text-red-400 transition-all"><Trash2 size={10} /></button>
                      </div>
                    ))}
                    {adFiles.length < 10 && (
                      <div onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center cursor-pointer">
                        <div className="flex items-center justify-center rounded-[2rem] transition-all hover:border-violet-500/50" style={{ width: 130, height: 220, background: 'rgba(255,255,255,0.02)', border: '2px dashed rgba(255,255,255,0.1)' }}>
                          <div className="flex flex-col items-center gap-1 text-gray-600"><Plus size={20} /><span className="text-[10px]">Agregar</span></div>
                        </div>
                      </div>
                    )}
                  </div>

                  <input ref={fileInputRef} type="file" multiple accept="image/*,video/*" className="hidden" onChange={e => handleFileAdd(e.target.files)} />

                  <button onClick={generateCopy} disabled={adFiles.length === 0}
                    className="w-full py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 flex items-center justify-center gap-2"
                    style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)' }}>
                    <Type size={14} /> IA genera el copy ({adFiles.length} anuncio{adFiles.length !== 1 ? 's' : ''}) →
                  </button>
                </div>
              )}

              {/* ── GENERATING COPY ── */}
              {step === 'generating-copy' && (
                <div className="flex flex-col items-center py-20 gap-4">
                  <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.3)' }}>
                    <Type size={24} className="text-violet-400 animate-pulse" />
                  </div>
                  <p className="text-white font-semibold">Generando copies...</p>
                  <p className="text-xs text-gray-500">La IA crea 2 opciones por anuncio con jerga de {countryObj?.label}</p>
                </div>
              )}

              {/* ── STEP: COPY SELECT ── */}
              {step === 'copy-select' && (
                <div className="space-y-5">
                  <button onClick={() => setStep('upload')} className="flex items-center gap-1 text-xs text-gray-500 hover:text-white"><ArrowLeft size={12} /> Atrás</button>
                  <div><h2 className="text-base font-semibold text-white">Elige el copy de cada anuncio</h2><p className="text-xs text-gray-500 mt-0.5">2 opciones por anuncio — ángulos diferentes</p></div>

                  {generatedCopys.map((adCopys, i) => (
                    <div key={i} className="rounded-2xl p-5 space-y-3" style={glass}>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl overflow-hidden shrink-0">
                          {adFiles[i]?.type === 'image' ? <img src={adFiles[i]?.preview} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-gray-600 text-xs">📹</div>}
                        </div>
                        <p className="text-xs font-semibold text-gray-300">Anuncio {i + 1}</p>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {([adCopys.option1, adCopys.option2] as any[]).map((opt, optIdx) => (
                          <button key={optIdx} onClick={() => setSelectedCopyOptions(prev => ({ ...prev, [i]: optIdx as 0 | 1 }))}
                            className="text-left p-3 rounded-xl space-y-1.5 transition-all"
                            style={selectedCopyOptions[i] === optIdx ? { background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.5)' } : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-semibold text-gray-500">OPCIÓN {optIdx + 1}</span>
                              {selectedCopyOptions[i] === optIdx && <CheckCircle size={12} className="text-violet-400" />}
                            </div>
                            <p className="text-xs font-bold text-white">{opt?.headline}</p>
                            <p className="text-xs text-gray-400 leading-relaxed">{opt?.primaryText}</p>
                            {opt?.description && <p className="text-[10px] text-gray-600">{opt.description}</p>}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}

                  {status?.credits === 0 && (
                    <div className="rounded-xl p-4" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
                      <p className="text-sm text-red-400">Sin créditos — <a href="https://wa.me/18299607483" target="_blank" rel="noopener noreferrer" className="underline">recarga aquí</a></p>
                    </div>
                  )}

                  <button onClick={createCampaign} disabled={creating || status?.credits === 0}
                    className="w-full py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-50 flex items-center justify-center gap-2"
                    style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)' }}>
                    {creating ? <><Loader2 size={16} className="animate-spin" /> Creando...</> : <><Zap size={16} /> Crear campaña — 1 crédito</>}
                  </button>
                </div>
              )}

              {/* ── CREATING ── */}
              {step === 'creating' && (
                <div className="flex flex-col items-center py-20 gap-5">
                  <div className="w-16 h-16 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                  <div className="text-center space-y-2">
                    <p className="text-white font-semibold">Creando tu campaña en Meta...</p>
                    <p className="text-xs text-gray-500">Subiendo creativos · Creando conjuntos · Configurando anuncios</p>
                  </div>
                </div>
              )}

              {/* ── DONE ── */}
              {step === 'done' && result && (
                <div className="rounded-2xl p-8 text-center space-y-5" style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)' }}>
                  <CheckCircle size={48} className="text-emerald-400 mx-auto" />
                  <div>
                    <h2 className="text-lg font-semibold text-white">¡Campaña creada!</h2>
                    <p className="text-sm text-gray-400 mt-1">Tu campaña está en Meta en estado <span className="text-yellow-400">PAUSADA</span>. Actívala cuando estés listo.</p>
                  </div>
                  <div className="text-left rounded-xl p-4 space-y-2 text-xs" style={{ background: 'rgba(255,255,255,0.03)' }}>
                    <p className="text-gray-400">Campaign ID: <span className="text-white font-mono">{result.campaign?.campaignId}</span></p>
                    <p className="text-gray-400">Conjuntos creados: <span className="text-emerald-400">{result.campaign?.adSetIds?.length ?? 0}</span></p>
                    <p className="text-gray-400">Anuncios creados: <span className="text-emerald-400">{result.campaign?.adIds?.length ?? 0}</span></p>
                  </div>
                  <div className="rounded-xl p-3 text-xs text-gray-500" style={{ background: 'rgba(255,255,255,0.02)' }}>
                    <p className="text-yellow-400 font-medium">⏱ Espera 72h antes de evaluar</p>
                    <p className="mt-1">Meta necesita tiempo para salir del learning phase. No hagas cambios en ese periodo.</p>
                  </div>
                  <button onClick={() => { setStep('home'); resetFlow(); }} className="px-6 py-2.5 rounded-xl text-sm font-medium text-white" style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)' }}>
                    Volver al inicio
                  </button>
                </div>
              )}

              {/* ── EXISTING FLOWS: CAMPAIGNS, METRICS, SCALE ── */}

              {step === 'campaigns' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3"><button onClick={() => setStep('home')} className="text-xs text-gray-500 hover:text-white">← Inicio</button><h2 className="text-base font-semibold text-white">Mis campañas</h2></div>
                  {loadingCampaigns ? <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" /></div>
                    : campaigns.length === 0 ? <div className="rounded-2xl p-8 text-center" style={glass}><p className="text-gray-500 text-sm">Sin campañas aún.</p><button onClick={() => setStep('type')} className="mt-3 text-xs text-violet-400 hover:underline">Crear primera campaña →</button></div>
                      : <div className="space-y-2">{campaigns.map((c: any) => (
                          <div key={c.id} className="rounded-xl px-4 py-3 flex items-center gap-4" style={glass}>
                            <div className="flex-1 min-w-0"><p className="text-sm font-medium text-white truncate">{c.name}</p><p className="text-xs text-gray-500">{c.objective} · {c.country} · ${c.dailyBudget}/día</p></div>
                            <span className="text-[10px] px-2 py-0.5 rounded-lg font-medium" style={{ background: 'rgba(251,191,36,0.1)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.2)' }}>{c.status}</span>
                          </div>
                        ))}</div>}
                </div>
              )}

              {step === 'metrics-select' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3"><button onClick={() => setStep('home')} className="text-xs text-gray-500 hover:text-white">← Inicio</button><h2 className="text-base font-semibold text-white">¿Qué campaña revisar?</h2></div>
                  {loadingCampaigns ? <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" /></div>
                    : <div className="space-y-2">{campaigns.map((c: any) => (
                        <button key={c.id} onClick={async () => { setSelectedCampaign(c); setLoadingAnalysis(true); setMetricsAnalysis(''); setCampaignMetrics(null); setStep('metrics-analysis'); try { const r = await apiFetch('/meta-ads/analyze-metrics', { method: 'POST', body: JSON.stringify({ fbCampaignId: c.fbCampaignId, campaignId: c.id }) }); setCampaignMetrics(r.metrics); setMetricsAnalysis(r.analysis); } catch (e: any) { setMetricsAnalysis(e.message); } finally { setLoadingAnalysis(false); } }}
                          className="w-full text-left rounded-xl px-4 py-4 flex items-center justify-between transition-all" style={glass}>
                          <div><p className="text-sm font-medium text-white">{c.name}</p><p className="text-xs text-gray-500">{c.objective} · {c.country}</p></div>
                          <ChevronRight size={16} className="text-gray-600" />
                        </button>
                      ))}</div>}
                </div>
              )}

              {step === 'metrics-analysis' && (
                <div className="space-y-4">
                  <button onClick={() => setStep('metrics-select')} className="text-xs text-gray-500 hover:text-white">← Campañas</button>
                  <h2 className="text-base font-semibold text-white">{selectedCampaign?.name}</h2>
                  {campaignMetrics && (
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                      {[
                        { label: 'Gasto', val: `$${parseFloat(campaignMetrics.spend || 0).toFixed(2)}` },
                        { label: 'ROAS', val: campaignMetrics.roas ? `${parseFloat(campaignMetrics.roas).toFixed(2)}x` : '—', color: parseFloat(campaignMetrics.roas) >= 2.5 ? '#34d399' : '#f87171' },
                        { label: 'CTR', val: campaignMetrics.ctr ? `${parseFloat(campaignMetrics.ctr).toFixed(2)}%` : '—' },
                        { label: 'CPC', val: campaignMetrics.cpc ? `$${parseFloat(campaignMetrics.cpc).toFixed(2)}` : '—' },
                        { label: 'Alcance', val: campaignMetrics.reach ? parseInt(campaignMetrics.reach).toLocaleString() : '—' },
                        { label: 'Conv.', val: campaignMetrics.conversions || '—' },
                      ].map(stat => (
                        <div key={stat.label} className="rounded-xl p-3 text-center" style={glass}>
                          <p className="text-[10px] text-gray-500">{stat.label}</p>
                          <p className="text-sm font-bold mt-0.5" style={{ color: (stat as any).color || 'white' }}>{stat.val}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {loadingAnalysis ? <div className="rounded-2xl p-8 flex flex-col items-center gap-3" style={glass}><div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" /><p className="text-xs text-gray-500">Analizando...</p></div>
                    : metricsAnalysis ? <div className="rounded-2xl p-5" style={{ background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.2)' }}><p className="text-xs font-semibold text-violet-300 mb-2">🤖 Análisis IA</p><div className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">{metricsAnalysis}</div></div> : null}
                </div>
              )}

              {step === 'scale-select' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3"><button onClick={() => setStep('home')} className="text-xs text-gray-500 hover:text-white">← Inicio</button><h2 className="text-base font-semibold text-white">¿Qué campaña escalar?</h2></div>
                  {loadingCampaigns ? <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" /></div>
                    : <div className="space-y-2">{campaigns.map((c: any) => (
                        <button key={c.id} onClick={() => { setSelectedCampaign(c); setStep('scale-intent'); }} className="w-full text-left rounded-xl px-4 py-4 flex items-center justify-between" style={glass}>
                          <div><p className="text-sm font-medium text-white">{c.name}</p><p className="text-xs text-gray-500">{c.objective} · {c.country}</p></div>
                          <ChevronRight size={16} className="text-gray-600" />
                        </button>
                      ))}</div>}
                </div>
              )}

              {step === 'scale-intent' && (
                <div className="space-y-5">
                  <button onClick={() => setStep('scale-select')} className="text-xs text-gray-500 hover:text-white">← Campañas</button>
                  <h2 className="text-lg font-semibold text-white">¿Qué quieres hacer?</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[
                      { icon: '🚀', label: 'Escalar', desc: 'Tienes resultados y quieres aumentar el volumen sin romper lo que funciona.', color: 'yellow', action: async () => { setLoadingAnalysis(true); setScaleOptions([]); setStep('scale-options'); try { const r = await apiFetch('/meta-ads/scale-options', { method: 'POST', body: JSON.stringify({ fbCampaignId: selectedCampaign?.fbCampaignId, fbAdSetId: selectedCampaign?.fbAdSetId, campaignId: selectedCampaign?.id }) }); setScaleOptions(r.options ?? []); } catch (e: any) { setError(e.message); } finally { setLoadingAnalysis(false); } } },
                      { icon: '🧪', label: 'Testear nuevo', desc: 'Probar un nuevo creativo, ángulo o audiencia sin tocar lo que ya funciona.', color: 'violet', action: () => { setStep('type'); } },
                    ].map(item => (
                      <button key={item.label} onClick={item.action} className="text-left p-5 rounded-2xl space-y-2 transition-all hover:scale-[1.02]"
                        style={{ background: item.color === 'yellow' ? 'rgba(234,179,8,0.08)' : 'rgba(139,92,246,0.08)', border: `1px solid ${item.color === 'yellow' ? 'rgba(234,179,8,0.25)' : 'rgba(139,92,246,0.25)'}` }}>
                        <span className="text-3xl">{item.icon}</span>
                        <p className="text-base font-bold text-white">{item.label}</p>
                        <p className="text-xs text-gray-400">{item.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {step === 'scale-options' && (
                <div className="space-y-4">
                  <button onClick={() => setStep('scale-select')} className="text-xs text-gray-500 hover:text-white">← Campañas</button>
                  <h2 className="text-base font-semibold text-white">¿Cómo escalar?</h2>
                  {loadingAnalysis ? <div className="flex flex-col items-center py-12 gap-3"><div className="w-6 h-6 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" /><p className="text-xs text-gray-500">Preparando opciones...</p></div>
                    : <div className="space-y-3">{scaleOptions.map((opt: any, i: number) => (
                        <div key={i} className="rounded-2xl p-5 space-y-3" style={glass}>
                          <div><div className="flex items-center gap-2"><p className="text-sm font-semibold text-white">{opt.label}</p>{opt.recommended && <span className="text-[9px] px-1.5 py-0.5 rounded-md" style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24' }}>⭐ Recomendado</span>}</div>
                            <p className="text-xs text-gray-400 mt-1">{opt.description}</p></div>
                          <button onClick={async () => { setSelectedScale(opt); setStep('scale-executing'); try { const r = await apiFetch('/meta-ads/scale-execute', { method: 'POST', body: JSON.stringify({ fbCampaignId: selectedCampaign?.fbCampaignId, fbAdSetId: selectedCampaign?.fbAdSetId, campaignId: selectedCampaign?.id, scaleType: opt.type, params: opt.params }) }); setScaleResult(r); setStep('scale-done'); } catch (e: any) { setError(e.message || 'Error'); setStep('scale-options'); } }}
                            className="w-full py-2 rounded-xl text-xs font-semibold text-white" style={{ background: opt.recommended ? 'linear-gradient(135deg, #d97706, #b45309)' : 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
                            Aplicar →
                          </button>
                        </div>
                      ))}</div>}
                </div>
              )}

              {step === 'scale-executing' && <div className="flex flex-col items-center py-20 gap-4"><div className="w-12 h-12 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" /><p className="text-white font-semibold">Ejecutando: {selectedScale?.label}</p></div>}

              {step === 'scale-done' && scaleResult && (
                <div className="rounded-2xl p-8 text-center space-y-4" style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)' }}>
                  <CheckCircle size={44} className="text-emerald-400 mx-auto" />
                  <p className="text-lg font-semibold text-white">¡Escalado aplicado!</p>
                  {scaleResult.details && <div className="text-left rounded-xl p-4 text-xs text-gray-400 whitespace-pre-wrap" style={{ background: 'rgba(255,255,255,0.03)' }}>{scaleResult.details}</div>}
                  <button onClick={() => setStep('home')} className="px-6 py-2.5 rounded-xl text-sm font-medium text-white" style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)' }}>Volver al inicio</button>
                </div>
              )}

            </>
          )}
        </div>
      </div>
    </div>
  );
}
