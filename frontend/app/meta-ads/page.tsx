'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Globe, Plus, X, Play, Square, ChevronRight, Zap, TrendingUp, MessageSquare, Eye, ShoppingCart, Loader2, CheckCircle, AlertCircle, Trash2 } from 'lucide-react';
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
  { id: 'VENTAS', icon: ShoppingCart, label: 'Ventas', desc: 'Lleva clientes directo a comprar en tu tienda o landing page', color: 'emerald' },
  { id: 'TRAFICO', icon: TrendingUp, label: 'Tráfico', desc: 'Envía personas a tu sitio web, blog o landing page', color: 'blue' },
  { id: 'LEADS', icon: Zap, label: 'Leads', desc: 'Consigue datos de contacto de personas interesadas', color: 'yellow' },
  { id: 'MENSAJES', icon: MessageSquare, label: 'Mensajes', desc: 'Que los clientes te escriban por WhatsApp o Messenger', color: 'green' },
  { id: 'RECONOCIMIENTO', icon: Eye, label: 'Reconocimiento', desc: 'Que más gente conozca tu marca o producto', color: 'purple' },
];

const COUNTRIES = [
  { code: 'RD', label: '🇩🇴 Rep. Dominicana' },
  { code: 'GT', label: '🇬🇹 Guatemala' },
  { code: 'EC', label: '🇪🇨 Ecuador' },
  { code: 'CR', label: '🇨🇷 Costa Rica' },
  { code: 'CO', label: '🇨🇴 Colombia' },
  { code: 'MX', label: '🇲🇽 México' },
  { code: 'US', label: '🇺🇸 Estados Unidos' },
  { code: 'ES', label: '🇪🇸 España' },
  { code: 'PE', label: '🇵🇪 Perú' },
  { code: 'CL', label: '🇨🇱 Chile' },
  { code: 'AR', label: '🇦🇷 Argentina' },
];

interface AdFile { file: File; preview: string; type: 'image' | 'video' }

type Step = 'connect' | 'setup' | 'home' | 'type' | 'form' | 'strategy' | 'ads' | 'creating' | 'done' | 'metrics-select' | 'metrics-analysis' | 'campaigns' | 'scale-select' | 'scale-options' | 'scale-executing' | 'scale-done';

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

  // Campaign form
  const [campaignType, setCampaignType] = useState('');
  const [productName, setProductName] = useState('');
  const [landingPage, setLandingPage] = useState('');
  const [country, setCountry] = useState('RD');
  const [dailyBudget, setDailyBudget] = useState('');
  const [startTime, setStartTime] = useState('now');
  const [customDate, setCustomDate] = useState('');
  const [excludeCities, setExcludeCities] = useState<string[]>([]);
  const [cityInput, setCityInput] = useState('');

  // Metrics & campaigns
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<any>(null);
  const [campaignMetrics, setCampaignMetrics] = useState<any>(null);
  const [metricsAnalysis, setMetricsAnalysis] = useState('');
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  // Scale
  const [scaleOptions, setScaleOptions] = useState<any[]>([]);
  const [selectedScale, setSelectedScale] = useState<any>(null);
  const [scaleResult, setScaleResult] = useState<any>(null);

  async function loadCampaigns() {
    setLoadingCampaigns(true);
    try { setCampaigns(await apiFetch('/meta-ads/campaigns')); } catch { /* ignore */ }
    finally { setLoadingCampaigns(false); }
  }

  async function analyzeMetrics(campaign: any) {
    setSelectedCampaign(campaign);
    setLoadingAnalysis(true);
    setMetricsAnalysis('');
    setCampaignMetrics(null);
    setStep('metrics-analysis');
    try {
      const res = await apiFetch(`/meta-ads/analyze-metrics`, {
        method: 'POST',
        body: JSON.stringify({ fbCampaignId: campaign.fbCampaignId, campaignId: campaign.id }),
      });
      setCampaignMetrics(res.metrics);
      setMetricsAnalysis(res.analysis);
    } catch (e: any) {
      setMetricsAnalysis(e.message || 'Error analizando métricas');
    } finally {
      setLoadingAnalysis(false);
    }
  }

  async function loadScaleOptions(campaign: any) {
    setSelectedCampaign(campaign);
    setLoadingAnalysis(true);
    setScaleOptions([]);
    setStep('scale-options');
    try {
      const res = await apiFetch(`/meta-ads/scale-options`, {
        method: 'POST',
        body: JSON.stringify({ fbCampaignId: campaign.fbCampaignId, fbAdSetId: campaign.fbAdSetId, campaignId: campaign.id }),
      });
      setScaleOptions(res.options ?? []);
    } catch (e: any) {
      setError(e.message || 'Error');
    } finally {
      setLoadingAnalysis(false);
    }
  }

  async function executeScale(option: any) {
    setSelectedScale(option);
    setStep('scale-executing');
    try {
      const res = await apiFetch('/meta-ads/scale-execute', {
        method: 'POST',
        body: JSON.stringify({
          fbCampaignId: selectedCampaign?.fbCampaignId,
          fbAdSetId: selectedCampaign?.fbAdSetId,
          campaignId: selectedCampaign?.id,
          scaleType: option.type,
          params: option.params,
        }),
      });
      setScaleResult(res);
      setStep('scale-done');
    } catch (e: any) {
      setError(e.message || 'Error ejecutando escalado');
      setStep('scale-options');
    }
  }

  // Strategy
  const [campaignMode, setCampaignMode] = useState(''); // testeo | escalar
  const [budgetType, setBudgetType] = useState(''); // ABO | CBO
  const [angleMode, setAngleMode] = useState(''); // ai | custom
  const [customAngle, setCustomAngle] = useState('');
  const [adSetsCount, setAdSetsCount] = useState('3');

  // Ads
  const [adFiles, setAdFiles] = useState<AdFile[]>([]);
  const [playingVideo, setPlayingVideo] = useState<number | null>(null);
  const [mutedVideos, setMutedVideos] = useState<Record<number, boolean>>({});
  const videoRefs = useRef<Record<number, HTMLVideoElement | null>>({});
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<any>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isAuthenticated()) { router.replace('/login'); return; }
    setAuthed(true);
    loadStatus();

    const params = new URLSearchParams(window.location.search);
    if (params.get('connected') === '1') {
      window.history.replaceState({}, '', '/meta-ads');
    }
    if (params.get('error')) {
      setError('Error conectando Facebook. Intenta de nuevo.');
      window.history.replaceState({}, '', '/meta-ads');
    }
  }, []);

  async function loadStatus() {
    setLoading(true);
    try {
      const s = await apiFetch('/meta-ads/status');
      setStatus(s);
      if (s.connected) {
        setStep(s.adAccountId && s.pageId ? 'home' : 'setup');
        if (!s.adAccountId) loadAccounts();
      } else {
        setStep('connect');
      }
    } catch { setStep('connect'); }
    finally { setLoading(false); }
  }

  async function loadAccounts() {
    try {
      const accounts = await apiFetch('/meta-ads/accounts');
      setAdAccounts(accounts);
      const pgs = await apiFetch('/meta-ads/pages');
      setPages(pgs);
    } catch (e: any) { setError(e.message); }
  }

  async function connectFacebook() {
    try {
      const { url } = await apiFetch('/meta-ads/auth-url');
      window.location.href = url;
    } catch (e: any) { setError(e.message); }
  }

  async function saveSetup() {
    if (!selectedAccount || !selectedPage) return;
    try {
      await apiFetch('/meta-ads/select-account', { method: 'POST', body: JSON.stringify({ adAccountId: selectedAccount, adAccountName: selectedAccountName }) });
      await apiFetch('/meta-ads/select-page', { method: 'POST', body: JSON.stringify({ pageId: selectedPage, pageName: selectedPageName }) });
      setStep('home');
    } catch (e: any) { setError(e.message); }
  }

  function addCity() {
    if (cityInput.trim() && !excludeCities.includes(cityInput.trim())) {
      setExcludeCities(prev => [...prev, cityInput.trim()]);
      setCityInput('');
    }
  }

  function handleFileAdd(files: FileList | null) {
    if (!files) return;
    const MAX = 10;
    Array.from(files).slice(0, MAX - adFiles.length).forEach(file => {
      const type = file.type.startsWith('video/') ? 'video' : 'image';
      const preview = URL.createObjectURL(file);
      setAdFiles(prev => [...prev, { file, preview, type }]);
    });
  }

  function removeAd(idx: number) {
    setAdFiles(prev => {
      URL.revokeObjectURL(prev[idx].preview);
      return prev.filter((_, i) => i !== idx);
    });
  }

  function toggleVideo(idx: number) {
    const el = videoRefs.current[idx];
    if (!el) return;
    if (el.paused) { el.play(); setPlayingVideo(idx); }
    else { el.pause(); setPlayingVideo(null); }
  }

  function toggleMute(idx: number) {
    const el = videoRefs.current[idx];
    if (!el) return;
    el.muted = !el.muted;
    setMutedVideos(prev => ({ ...prev, [idx]: el.muted }));
  }

  async function createCampaign() {
    if (adFiles.length === 0) { setError('Sube al menos un anuncio'); return; }
    setCreating(true);
    setError('');
    setStep('creating');
    try {
      const form = new FormData();
      form.append('campaignType', campaignType);
      form.append('productName', productName);
      form.append('landingPage', landingPage);
      form.append('country', country);
      form.append('excludeCities', JSON.stringify(excludeCities));
      form.append('dailyBudget', dailyBudget);
      form.append('startTime', startTime === 'custom' ? customDate : 'now');
      form.append('campaignMode', campaignMode);
      form.append('budgetType', budgetType);
      form.append('angleMode', angleMode);
      if (angleMode === 'custom') form.append('customAngle', customAngle);
      form.append('adSetsCount', adSetsCount);
      adFiles.forEach(a => form.append('files', a.file));

      const res = await apiFetch('/meta-ads/campaigns', { method: 'POST', body: form });
      setResult(res);
      setStep('done');
      await loadStatus();
    } catch (e: any) {
      setError(e.message || 'Error creando campaña');
      setStep('ads');
    } finally {
      setCreating(false);
    }
  }

  if (!authed) return null;

  return (
    <div className="min-h-screen bg-[#020209] flex">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <div className="max-w-4xl w-full mx-auto px-6 py-8 space-y-6">

          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl" style={{ background: 'rgba(24,119,242,0.15)', border: '1px solid rgba(24,119,242,0.3)' }}>
                <Globe size={22} className="text-blue-400" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-white">Meta Ads IA</h1>
                <p className="text-xs text-gray-500">Crea campañas profesionales en segundos</p>
              </div>
            </div>
            {status && (
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500">Créditos: <span className="text-violet-400 font-semibold">{status.credits}</span></span>
                {status.connected && (
                  <button onClick={() => { apiFetch('/meta-ads/disconnect', { method: 'DELETE' }).then(loadStatus); }}
                    className="text-xs text-gray-600 hover:text-red-400 transition-colors">Desconectar</button>
                )}
              </div>
            )}
          </div>

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
              {/* STEP: CONNECT */}
              {step === 'connect' && (
                <div className="rounded-2xl p-8 text-center space-y-5" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <Globe size={48} className="text-blue-400 mx-auto" />
                  <div>
                    <h2 className="text-lg font-semibold text-white">Conecta tu cuenta de Facebook</h2>
                    <p className="text-sm text-gray-500 mt-1">Necesario para crear campañas en tus cuentas publicitarias</p>
                  </div>
                  <button onClick={connectFacebook}
                    className="mx-auto flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium text-white"
                    style={{ background: 'linear-gradient(135deg, #1877f2, #0c5fc7)' }}>
                    <Globe size={16} /> Conectar con Facebook
                  </button>
                </div>
              )}

              {/* STEP: SETUP */}
              {step === 'setup' && (
                <div className="rounded-2xl p-6 space-y-5" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="flex items-center gap-2">
                    <CheckCircle size={16} className="text-emerald-400" />
                    <p className="text-sm text-emerald-400 font-medium">Facebook conectado</p>
                  </div>
                  <h2 className="text-base font-semibold text-white">Configura tu cuenta</h2>

                  <div className="space-y-1.5">
                    <label className="text-xs text-gray-500">Cuenta publicitaria</label>
                    <select className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500/50"
                      value={selectedAccount} onChange={e => {
                        const acc = adAccounts.find(a => a.id === e.target.value);
                        setSelectedAccount(e.target.value);
                        setSelectedAccountName(acc?.name ?? '');
                      }}>
                      <option value="">Seleccionar cuenta...</option>
                      {adAccounts.map(a => <option key={a.id} value={a.id}>{a.name} ({a.id})</option>)}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs text-gray-500">Página de Facebook</label>
                    <select className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500/50"
                      value={selectedPage} onChange={e => {
                        const pg = pages.find(p => p.id === e.target.value);
                        setSelectedPage(e.target.value);
                        setSelectedPageName(pg?.name ?? '');
                      }}>
                      <option value="">Seleccionar página...</option>
                      {pages.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>

                  <button onClick={saveSetup} disabled={!selectedAccount || !selectedPage}
                    className="w-full py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-50"
                    style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)' }}>
                    Continuar →
                  </button>
                </div>
              )}

              {/* STEP: HOME */}
              {step === 'home' && (
                <div className="space-y-5">
                  <div>
                    <p className="text-xs text-gray-500">{status?.adAccountName}</p>
                    <h2 className="text-lg font-semibold text-white mt-0.5">¿Qué quieres hacer?</h2>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[
                      {
                        icon: '🚀',
                        label: 'Crear campaña',
                        desc: 'Nueva campaña con IA — copy, segmentación y estructura profesional generada automáticamente.',
                        color: 'violet',
                        action: () => setStep('type'),
                        badge: null,
                      },
                      {
                        icon: '📊',
                        label: 'Revisar métricas',
                        desc: 'Selecciona una campaña. La IA analiza los datos y te dice exactamente qué mejorar.',
                        color: 'blue',
                        action: () => { loadCampaigns(); setStep('metrics-select'); },
                        badge: null,
                      },
                      {
                        icon: '📈',
                        label: 'Escalar campaña',
                        desc: 'Selecciona una campaña ganadora. La IA te dice cómo escalar y lo ejecuta automáticamente.',
                        color: 'yellow',
                        action: () => { loadCampaigns(); setStep('scale-select'); },
                        badge: '🔥 IA',
                      },
                      {
                        icon: '📋',
                        label: 'Mis campañas',
                        desc: 'Lista de todas las campañas creadas desde MOMENTUM con su estado.',
                        color: 'emerald',
                        action: () => { setStep('campaigns'); loadCampaigns(); },
                        badge: null,
                      },
                      {
                        icon: '🔄',
                        label: 'Cambiar cuenta',
                        desc: 'Conectar otra cuenta publicitaria o página de Facebook.',
                        color: 'gray',
                        action: () => { loadAccounts(); setStep('setup'); },
                        badge: null,
                      },
                    ].map((item) => {
                      const bg: Record<string, string> = {
                        violet: 'rgba(139,92,246,0.1)', blue: 'rgba(59,130,246,0.1)',
                        emerald: 'rgba(16,185,129,0.1)', yellow: 'rgba(234,179,8,0.1)',
                        pink: 'rgba(236,72,153,0.1)', gray: 'rgba(255,255,255,0.03)',
                      };
                      const border: Record<string, string> = {
                        violet: 'rgba(139,92,246,0.25)', blue: 'rgba(59,130,246,0.25)',
                        emerald: 'rgba(16,185,129,0.25)', yellow: 'rgba(234,179,8,0.25)',
                        pink: 'rgba(236,72,153,0.25)', gray: 'rgba(255,255,255,0.06)',
                      };
                      return (
                        <button key={item.label} onClick={item.action}
                          className="text-left p-5 rounded-2xl space-y-2 transition-all hover:scale-[1.02] active:scale-[0.99]"
                          style={{ background: bg[item.color], border: `1px solid ${border[item.color]}` }}>
                          <div className="flex items-center justify-between">
                            <span className="text-2xl">{item.icon}</span>
                            {item.badge && <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24' }}>{item.badge}</span>}
                          </div>
                          <p className="text-sm font-semibold text-white">{item.label}</p>
                          <p className="text-xs text-gray-500">{item.desc}</p>
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-600 pt-1">
                    <span>Créditos disponibles: <span className="text-violet-400 font-semibold">{status?.credits ?? 0}</span></span>
                    {(status?.credits ?? 0) === 0 && (
                      <a href="https://wa.me/18299607483?text=Quiero recargar créditos Meta Ads"
                        target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline">
                        + Recargar créditos
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* STEP: METRICS SELECT */}
              {step === 'metrics-select' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <button onClick={() => setStep('home')} className="text-xs text-gray-500 hover:text-white">← Inicio</button>
                    <h2 className="text-base font-semibold text-white">¿Qué campaña quieres revisar?</h2>
                  </div>
                  {loadingCampaigns ? (
                    <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" /></div>
                  ) : campaigns.length === 0 ? (
                    <div className="rounded-2xl p-8 text-center" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <p className="text-gray-500 text-sm">Sin campañas creadas aún.</p>
                      <button onClick={() => setStep('type')} className="mt-3 text-xs text-violet-400 hover:underline">Crear primera campaña →</button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {campaigns.map((c: any) => (
                        <button key={c.id} onClick={() => analyzeMetrics(c)}
                          className="w-full text-left rounded-xl px-4 py-4 flex items-center justify-between transition-all hover:border-violet-500/40"
                          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                          <div>
                            <p className="text-sm font-medium text-white">{c.name}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{c.objective} · {c.country} · ${c.dailyBudget}/día</p>
                            <p className="text-[10px] text-gray-700 mt-0.5">Creada: {new Date(c.createdAt).toLocaleDateString('es-DO', { day: '2-digit', month: 'short' })}</p>
                          </div>
                          <ChevronRight size={16} className="text-gray-600" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* STEP: METRICS ANALYSIS */}
              {step === 'metrics-analysis' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <button onClick={() => setStep('metrics-select')} className="text-xs text-gray-500 hover:text-white">← Campañas</button>
                    <h2 className="text-base font-semibold text-white">{selectedCampaign?.name}</h2>
                  </div>

                  {campaignMetrics && (
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                      {[
                        { label: 'Gasto', val: `$${parseFloat(campaignMetrics.spend || 0).toFixed(2)}`, color: '' },
                        { label: 'ROAS', val: campaignMetrics.roas ? `${parseFloat(campaignMetrics.roas).toFixed(2)}x` : '—', color: parseFloat(campaignMetrics.roas) >= 2.5 ? '#34d399' : parseFloat(campaignMetrics.roas) >= 1.5 ? '#fbbf24' : '#f87171' },
                        { label: 'CTR', val: campaignMetrics.ctr ? `${parseFloat(campaignMetrics.ctr).toFixed(2)}%` : '—', color: '' },
                        { label: 'CPC', val: campaignMetrics.cpc ? `$${parseFloat(campaignMetrics.cpc).toFixed(2)}` : '—', color: '' },
                        { label: 'Alcance', val: campaignMetrics.reach ? parseInt(campaignMetrics.reach).toLocaleString() : '—', color: '' },
                        { label: 'Conversiones', val: campaignMetrics.conversions || '—', color: '' },
                      ].map(stat => (
                        <div key={stat.label} className="rounded-xl p-3 text-center" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                          <p className="text-[10px] text-gray-500">{stat.label}</p>
                          <p className="text-sm font-bold mt-0.5" style={{ color: stat.color || 'white' }}>{stat.val}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {loadingAnalysis ? (
                    <div className="rounded-2xl p-8 flex flex-col items-center gap-3" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                      <p className="text-xs text-gray-500">La IA está analizando tu campaña...</p>
                    </div>
                  ) : metricsAnalysis ? (
                    <div className="rounded-2xl p-5 space-y-3" style={{ background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.2)' }}>
                      <p className="text-xs font-semibold text-violet-300">🤖 Análisis de la IA</p>
                      <div className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">{metricsAnalysis}</div>
                    </div>
                  ) : null}
                </div>
              )}

              {/* STEP: SCALE SELECT */}
              {step === 'scale-select' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <button onClick={() => setStep('home')} className="text-xs text-gray-500 hover:text-white">← Inicio</button>
                    <h2 className="text-base font-semibold text-white">¿Qué campaña quieres escalar?</h2>
                  </div>
                  {loadingCampaigns ? (
                    <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" /></div>
                  ) : campaigns.length === 0 ? (
                    <div className="rounded-2xl p-8 text-center" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <p className="text-gray-500 text-sm">Sin campañas creadas aún.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {campaigns.map((c: any) => (
                        <button key={c.id} onClick={() => loadScaleOptions(c)}
                          className="w-full text-left rounded-xl px-4 py-4 flex items-center justify-between transition-all hover:border-yellow-500/40"
                          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                          <div>
                            <p className="text-sm font-medium text-white">{c.name}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{c.objective} · {c.country} · ${c.dailyBudget}/día</p>
                          </div>
                          <ChevronRight size={16} className="text-gray-600" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* STEP: SCALE OPTIONS */}
              {step === 'scale-options' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <button onClick={() => setStep('scale-select')} className="text-xs text-gray-500 hover:text-white">← Campañas</button>
                    <h2 className="text-base font-semibold text-white">¿Cómo quieres escalar?</h2>
                  </div>
                  <p className="text-xs text-gray-500">{selectedCampaign?.name}</p>

                  {loadingAnalysis ? (
                    <div className="rounded-2xl p-8 flex flex-col items-center gap-3" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div className="w-6 h-6 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
                      <p className="text-xs text-gray-500">La IA está preparando las opciones...</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {scaleOptions.map((opt: any, i: number) => (
                        <div key={i} className="rounded-2xl p-5 space-y-3" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1 flex-1">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-semibold text-white">{opt.label}</p>
                                {opt.recommended && <span className="text-[9px] px-1.5 py-0.5 rounded-md font-medium" style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24' }}>⭐ Recomendado</span>}
                              </div>
                              <p className="text-xs text-gray-400">{opt.description}</p>
                              <div className="flex gap-3 mt-2">
                                <span className="text-[10px] text-emerald-400">✓ {opt.benefit}</span>
                                {opt.risk && <span className="text-[10px] text-yellow-400">⚠ {opt.risk}</span>}
                              </div>
                            </div>
                          </div>
                          <button onClick={() => executeScale(opt)}
                            className="w-full py-2 rounded-xl text-xs font-semibold text-white transition-all"
                            style={{ background: opt.recommended ? 'linear-gradient(135deg, #d97706, #b45309)' : 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
                            Aplicar este método →
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* STEP: SCALE EXECUTING */}
              {step === 'scale-executing' && (
                <div className="flex flex-col items-center justify-center py-20 gap-5">
                  <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.3)' }}>
                    <div className="w-8 h-8 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
                  </div>
                  <div className="text-center">
                    <p className="text-white font-semibold">Ejecutando: {selectedScale?.label}</p>
                    <p className="text-xs text-gray-500 mt-1">La IA está aplicando el cambio en tu cuenta de Meta...</p>
                  </div>
                </div>
              )}

              {/* STEP: SCALE DONE */}
              {step === 'scale-done' && scaleResult && (
                <div className="rounded-2xl p-8 text-center space-y-4" style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)' }}>
                  <CheckCircle size={44} className="text-emerald-400 mx-auto" />
                  <div>
                    <p className="text-lg font-semibold text-white">¡Escalado aplicado!</p>
                    <p className="text-sm text-gray-400 mt-1">{selectedScale?.label}</p>
                  </div>
                  {scaleResult.details && (
                    <div className="text-left rounded-xl p-4 text-xs text-gray-400 whitespace-pre-wrap" style={{ background: 'rgba(255,255,255,0.03)' }}>
                      {scaleResult.details}
                    </div>
                  )}
                  <div className="rounded-xl p-3 text-xs text-gray-500" style={{ background: 'rgba(255,255,255,0.02)' }}>
                    <p className="text-yellow-400 font-medium">⏱ Próxima revisión recomendada: 72 horas</p>
                    <p className="mt-1">Deja que Meta re-aprenda con el nuevo presupuesto/estructura antes de evaluar.</p>
                  </div>
                  <button onClick={() => setStep('home')} className="px-6 py-2.5 rounded-xl text-sm font-medium text-white" style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)' }}>
                    Volver al inicio
                  </button>
                </div>
              )}

              {/* STEP: CAMPAIGNS LIST */}
              {step === 'campaigns' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <button onClick={() => setStep('home')} className="text-xs text-gray-500 hover:text-white">← Inicio</button>
                    <h2 className="text-base font-semibold text-white">Mis campañas</h2>
                  </div>
                  {loadingCampaigns ? (
                    <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" /></div>
                  ) : campaigns.length === 0 ? (
                    <div className="rounded-2xl p-8 text-center" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <p className="text-gray-500 text-sm">Sin campañas creadas aún.</p>
                      <button onClick={() => setStep('type')} className="mt-3 text-xs text-violet-400 hover:underline">Crear primera campaña →</button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {campaigns.map((c: any) => (
                        <div key={c.id} className="rounded-xl px-4 py-3 flex items-center gap-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">{c.name}</p>
                            <p className="text-xs text-gray-500">{c.objective} · {c.country} · ${c.dailyBudget}/día</p>
                            <p className="text-[10px] text-gray-700 mt-0.5">{new Date(c.createdAt).toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: '2-digit' })}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {c.fbCampaignId && (
                              <span className="text-[10px] font-mono text-gray-600">ID: {c.fbCampaignId.slice(0, 8)}...</span>
                            )}
                            <span className="text-[10px] px-2 py-0.5 rounded-lg font-medium"
                              style={{ background: 'rgba(251,191,36,0.1)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.2)' }}>
                              {c.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* STEP: TYPE */}
              {step === 'type' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <button onClick={() => setStep('home')} className="text-xs text-gray-500 hover:text-white">← Inicio</button>
                      <h2 className="text-base font-semibold text-white">¿Qué quieres lograr?</h2>
                    </div>
                    <span className="text-xs text-gray-600">{status?.adAccountName}</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {CAMPAIGN_TYPES.map(ct => {
                      const Icon = ct.icon;
                      const colors: Record<string, string> = {
                        emerald: 'rgba(16,185,129,0.15)', blue: 'rgba(59,130,246,0.15)',
                        yellow: 'rgba(234,179,8,0.15)', green: 'rgba(34,197,94,0.15)',
                        purple: 'rgba(139,92,246,0.15)',
                      };
                      const borders: Record<string, string> = {
                        emerald: 'rgba(16,185,129,0.3)', blue: 'rgba(59,130,246,0.3)',
                        yellow: 'rgba(234,179,8,0.3)', green: 'rgba(34,197,94,0.3)',
                        purple: 'rgba(139,92,246,0.3)',
                      };
                      const texts: Record<string, string> = {
                        emerald: '#34d399', blue: '#60a5fa', yellow: '#fbbf24',
                        green: '#4ade80', purple: '#a78bfa',
                      };
                      return (
                        <button key={ct.id} onClick={() => { setCampaignType(ct.id); setStep('form'); }}
                          className="text-left p-4 rounded-2xl space-y-2 transition-all hover:scale-[1.02]"
                          style={{ background: colors[ct.color], border: `1px solid ${borders[ct.color]}` }}>
                          <Icon size={20} style={{ color: texts[ct.color] }} />
                          <p className="text-sm font-semibold text-white">{ct.label}</p>
                          <p className="text-xs text-gray-400">{ct.desc}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* STEP: FORM */}
              {step === 'form' && (
                <div className="rounded-2xl p-6 space-y-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setStep('type')} className="text-xs text-gray-500 hover:text-white">← Cambiar tipo</button>
                    <span className="text-xs text-gray-600">|</span>
                    <span className="text-xs text-violet-400">{CAMPAIGN_TYPES.find(t => t.id === campaignType)?.label}</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs text-gray-500">Nombre del producto</label>
                      <input className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-violet-500/50"
                        placeholder="ej. Faja Reductora Premium" value={productName} onChange={e => setProductName(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs text-gray-500">Landing page / URL del producto</label>
                      <input className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-violet-500/50"
                        placeholder="https://..." value={landingPage} onChange={e => setLandingPage(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs text-gray-500">País de publicación</label>
                      <select className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500/50"
                        value={country} onChange={e => setCountry(e.target.value)}>
                        {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs text-gray-500">Presupuesto diario (USD)</label>
                      <input type="number" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-violet-500/50"
                        placeholder="ej. 10" value={dailyBudget} onChange={e => setDailyBudget(e.target.value)} min="1" />
                    </div>
                  </div>

                  {/* Start time */}
                  <div className="space-y-1.5">
                    <label className="text-xs text-gray-500">¿Cuándo inicia la campaña?</label>
                    <div className="flex gap-3">
                      {[{ val: 'now', label: 'Ahora mismo' }, { val: 'custom', label: 'Fecha específica' }].map(o => (
                        <button key={o.val} onClick={() => setStartTime(o.val)}
                          className="px-4 py-2 rounded-xl text-xs font-medium transition-all"
                          style={startTime === o.val
                            ? { background: 'rgba(139,92,246,0.2)', border: '1px solid rgba(139,92,246,0.5)', color: '#c4b5fd' }
                            : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#6b7280' }}>
                          {o.label}
                        </button>
                      ))}
                    </div>
                    {startTime === 'custom' && (
                      <input type="datetime-local" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500/50"
                        value={customDate} onChange={e => setCustomDate(e.target.value)} />
                    )}
                  </div>

                  {/* Exclude cities */}
                  <div className="space-y-1.5">
                    <label className="text-xs text-gray-500">¿Excluir ciudades? (opcional)</label>
                    <div className="flex gap-2">
                      <input className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-violet-500/50"
                        placeholder="ej. Santiago" value={cityInput} onChange={e => setCityInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && addCity()} />
                      <button onClick={addCity} className="px-3 py-2 rounded-xl text-xs text-gray-400 hover:text-white border border-white/10 hover:border-white/20">
                        <Plus size={14} />
                      </button>
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
                  </div>

                  <button
                    onClick={() => { if (productName && landingPage && dailyBudget) setStep('strategy'); }}
                    disabled={!productName || !landingPage || !dailyBudget}
                    className="w-full py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-50 flex items-center justify-center gap-2"
                    style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)' }}>
                    Continuar → Estrategia
                  </button>
                </div>
              )}

              {/* STEP: STRATEGY */}
              {step === 'strategy' && (() => {
                const budget = parseFloat(dailyBudget) || 0;
                // Expert recommendations based on budget
                const rec = budget < 15
                  ? { mode: 'testeo', type: 'ABO', sets: '1', label: 'Bajo presupuesto', tip: '1 conjunto broad + 3 creativos diferentes. No disperses el budget.' }
                  : budget < 30
                  ? { mode: 'testeo', type: 'ABO', sets: '2', label: 'Presupuesto medio-bajo', tip: '2 conjuntos: 1 broad + 1 intereses específicos. Mínimo $7/día por conjunto.' }
                  : budget < 60
                  ? { mode: 'testeo', type: 'CBO', sets: '3', label: 'Presupuesto medio', tip: 'CBO con 3 conjuntos. Meta distribuye donde convierte mejor.' }
                  : { mode: 'escalar', type: 'ASC+', sets: '1', label: 'Buen presupuesto', tip: 'ASC+ (Advantage+ Shopping). La estructura que más vende en Meta ahora mismo.' };

                return (
                  <div className="rounded-2xl p-6 space-y-5" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div className="flex items-center justify-between">
                      <button onClick={() => setStep('form')} className="text-xs text-gray-500 hover:text-white">← Editar datos</button>
                      <span className="text-xs text-violet-400">${budget}/día</span>
                    </div>

                    {/* Expert recommendation banner */}
                    <div className="rounded-xl p-4 space-y-1" style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.25)' }}>
                      <p className="text-xs font-semibold text-violet-300">⚡ Recomendación experta para tu presupuesto</p>
                      <p className="text-xs text-gray-400">{rec.tip}</p>
                      <button onClick={() => { setCampaignMode(rec.mode); setBudgetType(rec.type); setAdSetsCount(rec.sets); }}
                        className="mt-1 text-xs font-medium text-violet-400 hover:text-violet-300 underline underline-offset-2">
                        Aplicar recomendación →
                      </button>
                    </div>

                    {/* Objetivo */}
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-gray-300">¿En qué momento estás?</label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {[
                          { val: 'testeo', label: '🧪 Testeando', badge: 'Recomendado para empezar', desc: 'Probar creativos, audiencias y ángulos. Encontrar qué convierte antes de invertir más.' },
                          { val: 'escalar', label: '🚀 Escalando', badge: 'Tienes datos y ventas', desc: 'Ya encontraste qué funciona. Ahora aumentar presupuesto manteniendo el ROAS.' },
                        ].map(o => (
                          <button key={o.val} onClick={() => setCampaignMode(o.val)}
                            className="text-left p-4 rounded-xl space-y-1.5 transition-all"
                            style={campaignMode === o.val
                              ? { background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.5)' }
                              : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-semibold text-white">{o.label}</p>
                              <span className="text-[10px] px-1.5 py-0.5 rounded-md" style={{ background: 'rgba(139,92,246,0.2)', color: '#a78bfa' }}>{o.badge}</span>
                            </div>
                            <p className="text-xs text-gray-500">{o.desc}</p>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Estructura */}
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-gray-300">Estructura de campaña</label>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {[
                          { val: 'ABO', label: 'ABO', badge: 'Testeo', desc: 'Presupuesto fijo por conjunto. Control total. Ideal para probar audiencias.', when: 'Testeo con <$50/día' },
                          { val: 'CBO', label: 'CBO', badge: 'Escalar', desc: 'Meta distribuye el budget automáticamente al conjunto que mejor convierte.', when: 'Escalar con $30-150/día' },
                          { val: 'ASC+', label: 'ASC+', badge: '🔥 Mejor 2024', desc: 'Advantage+ Shopping. IA de Meta optimiza todo. La estructura que más vende ahora.', when: 'Vender con $50+/día' },
                        ].map(o => (
                          <button key={o.val} onClick={() => setBudgetType(o.val)}
                            className="text-left p-4 rounded-xl space-y-1.5 transition-all"
                            style={budgetType === o.val
                              ? { background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.5)' }
                              : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-bold text-white">{o.label}</p>
                              <span className="text-[9px] px-1.5 py-0.5 rounded-md" style={{ background: o.val === 'ASC+' ? 'rgba(251,191,36,0.15)' : 'rgba(139,92,246,0.15)', color: o.val === 'ASC+' ? '#fbbf24' : '#a78bfa' }}>{o.badge}</span>
                            </div>
                            <p className="text-xs text-gray-500">{o.desc}</p>
                            <p className="text-[10px] text-gray-600 font-medium">{o.when}</p>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Audiencia */}
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-gray-300">Tipo de audiencia</label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {[
                          { val: 'broad', label: '🌐 Broad (Abierta)', badge: 'Funciona mejor 2024', desc: 'Sin intereses. El algoritmo de Meta sabe a quién mostrarle. Convierte mejor en el 80% de casos.' },
                          { val: 'interests', label: '🎯 Intereses específicos', badge: 'Para nichos', desc: 'Útil en productos de nicho muy específico (fitness, hobbies técnicos, B2B). Más control inicial.' },
                        ].map(o => (
                          <button key={o.val} onClick={() => setAngleMode(o.val)}
                            className="text-left p-4 rounded-xl space-y-1.5 transition-all"
                            style={angleMode === o.val
                              ? { background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.5)' }
                              : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-semibold text-white">{o.label}</p>
                              <span className="text-[9px] px-1.5 py-0.5 rounded-md" style={{ background: 'rgba(139,92,246,0.15)', color: '#a78bfa' }}>{o.badge}</span>
                            </div>
                            <p className="text-xs text-gray-500">{o.desc}</p>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Ángulo del copy */}
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-gray-300">Ángulo del copy</label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {[
                          { val: 'ai', label: '🤖 IA elige el mejor ángulo', desc: 'Analiza tu creativo y producto → elige el ángulo que más vende en tu país y nicho.' },
                          { val: 'custom', label: '✍️ Yo defino el ángulo', desc: 'Tienes un ángulo específico probado. La IA lo usa como base para el copy.' },
                        ].map(o => (
                          <button key={o.val} onClick={() => setAngleMode(prev => o.val === prev ? prev : o.val)}
                            className="text-left p-4 rounded-xl space-y-1 transition-all"
                            style={(angleMode === o.val || (o.val === 'ai' && !angleMode))
                              ? { background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.5)' }
                              : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                            <p className="text-sm font-semibold text-white">{o.label}</p>
                            <p className="text-xs text-gray-500">{o.desc}</p>
                          </button>
                        ))}
                      </div>
                      {angleMode === 'custom' && (
                        <textarea
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-violet-500/50 resize-none"
                          rows={2}
                          placeholder="ej. Urgencia — stock limitado, precio especial solo hoy, transformación en 7 días..."
                          value={customAngle}
                          onChange={e => setCustomAngle(e.target.value)}
                        />
                      )}
                    </div>

                    {/* Info de evaluación */}
                    <div className="rounded-xl p-3 text-xs text-gray-500 space-y-1" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <p className="text-gray-400 font-medium">📊 Cuándo evaluar resultados:</p>
                      <p>• No cortes antes de <span className="text-white">72 horas</span> y <span className="text-white">$20+ gastados</span></p>
                      <p>• Learning phase: necesitas <span className="text-white">50 conversiones/semana</span> para optimización completa</p>
                      <p>• ROAS objetivo mínimo: <span className="text-white">1.5x</span> para seguir. Sobre <span className="text-white">2.5x</span> escalar 20-30% cada 3 días</p>
                    </div>

                    <button
                      onClick={() => { if (campaignMode && budgetType) setStep('ads'); }}
                      disabled={!campaignMode || !budgetType}
                      className="w-full py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                      style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)' }}>
                      Continuar → Subir anuncios
                    </button>
                  </div>
                );
              })()}

              {/* STEP: ADS */}
              {step === 'ads' && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-base font-semibold text-white">Sube tus anuncios</h2>
                      <p className="text-xs text-gray-500 mt-0.5">Imágenes o videos. La IA generará el copy por cada anuncio.</p>
                    </div>
                    <button onClick={() => setStep('form')} className="text-xs text-gray-500 hover:text-white">← Editar datos</button>
                  </div>

                  {/* Phone mockups grid */}
                  <div className="flex flex-wrap gap-4">
                    {adFiles.map((ad, idx) => (
                      <div key={idx} className="relative flex flex-col items-center">
                        {/* Phone frame */}
                        <div className="relative rounded-[2rem] overflow-hidden"
                          style={{ width: 160, height: 280, background: '#0a0a14', border: '3px solid rgba(255,255,255,0.15)', boxShadow: '0 0 0 1px rgba(255,255,255,0.05)' }}>
                          {/* Notch */}
                          <div className="absolute top-3 left-1/2 -translate-x-1/2 w-16 h-4 rounded-full z-10" style={{ background: '#020209' }} />
                          {/* Content */}
                          <div className="w-full h-full flex items-center justify-center overflow-hidden">
                            {ad.type === 'image' ? (
                              <img src={ad.preview} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="relative w-full h-full cursor-pointer" onClick={() => toggleVideo(idx)}>
                                <video
                                  src={ad.preview}
                                  className="w-full h-full object-cover"
                                  loop playsInline
                                  muted={mutedVideos[idx] !== false}
                                  ref={el => { videoRefs.current[idx] = el; }}
                                />
                                <div className="absolute inset-0 flex items-center justify-center">
                                  {playingVideo !== idx && (
                                    <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
                                      <Play size={16} className="text-white ml-1" />
                                    </div>
                                  )}
                                </div>
                                <button
                                  onClick={e => { e.stopPropagation(); toggleMute(idx); }}
                                  className="absolute bottom-8 right-2 p-1 rounded-full text-white text-[10px]"
                                  style={{ background: 'rgba(0,0,0,0.5)' }}>
                                  {mutedVideos[idx] !== false ? '🔇' : '🔊'}
                                </button>
                              </div>
                            )}
                          </div>
                          {/* Type badge */}
                          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-[10px] text-white"
                            style={{ background: 'rgba(0,0,0,0.6)' }}>
                            {ad.type === 'video' ? '📹 Video' : '🖼️ Imagen'}
                          </div>
                        </div>
                        {/* Remove button */}
                        <button onClick={() => removeAd(idx)}
                          className="mt-2 p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-all">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}

                    {/* Add button */}
                    {adFiles.length < 10 && (
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        className="flex flex-col items-center cursor-pointer">
                        <div className="flex items-center justify-center rounded-[2rem] transition-all hover:border-violet-500/50"
                          style={{ width: 160, height: 280, background: 'rgba(255,255,255,0.02)', border: '2px dashed rgba(255,255,255,0.1)' }}>
                          <div className="flex flex-col items-center gap-2 text-gray-600 hover:text-gray-400">
                            <Plus size={24} />
                            <span className="text-xs text-center px-4">Agregar anuncio</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <input ref={fileInputRef} type="file" multiple accept="image/*,video/*" className="hidden"
                    onChange={e => handleFileAdd(e.target.files)} />

                  {adFiles.length > 0 && (
                    <div className="rounded-2xl p-4 space-y-2" style={{ background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.2)' }}>
                      <p className="text-xs text-violet-300 font-medium">La IA generará automáticamente:</p>
                      <div className="grid grid-cols-2 gap-1 text-xs text-gray-500">
                        <span>✓ Copy principal por anuncio</span>
                        <span>✓ Titular optimizado</span>
                        <span>✓ Segmentación por intereses</span>
                        <span>✓ Audiencia del país seleccionado</span>
                        <span>✓ Llamada a la acción</span>
                        <span>✓ Estructura completa de campaña</span>
                      </div>
                    </div>
                  )}

                  {status?.credits === 0 && (
                    <div className="rounded-2xl p-4" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
                      <p className="text-sm text-red-400 font-medium">Sin créditos disponibles</p>
                      <p className="text-xs text-gray-500 mt-1">Recarga créditos para crear campañas.</p>
                      <a href="https://wa.me/18299607483?text=Hola, quiero recargar créditos Meta Ads"
                        target="_blank" rel="noopener noreferrer"
                        className="inline-block mt-2 px-4 py-2 rounded-xl text-xs font-medium text-white"
                        style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)' }}>
                        Recargar créditos
                      </a>
                    </div>
                  )}

                  <button
                    onClick={createCampaign}
                    disabled={adFiles.length === 0 || creating || status?.credits === 0}
                    className="w-full py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-50 flex items-center justify-center gap-2"
                    style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)' }}>
                    {creating ? <><Loader2 size={16} className="animate-spin" /> Creando campaña...</> : <><Zap size={16} /> Crear campaña con IA ({status?.credits ?? 0} crédito{status?.credits !== 1 ? 's' : ''})</>}
                  </button>
                </div>
              )}

              {/* STEP: CREATING */}
              {step === 'creating' && (
                <div className="flex flex-col items-center justify-center py-20 gap-6">
                  <div className="w-16 h-16 border-3 border-violet-500 border-t-transparent rounded-full animate-spin" style={{ borderWidth: 3 }} />
                  <div className="text-center space-y-2">
                    <p className="text-white font-semibold">Creando tu campaña...</p>
                    <p className="text-xs text-gray-500">La IA está analizando tus creativos y generando la estructura óptima</p>
                  </div>
                </div>
              )}

              {/* STEP: DONE */}
              {step === 'done' && result && (
                <div className="rounded-2xl p-8 text-center space-y-5" style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)' }}>
                  <CheckCircle size={48} className="text-emerald-400 mx-auto" />
                  <div>
                    <h2 className="text-lg font-semibold text-white">¡Campaña creada!</h2>
                    <p className="text-sm text-gray-400 mt-1">Tu campaña está en Meta en estado PAUSADA. Actívala cuando estés listo.</p>
                  </div>
                  <div className="text-left rounded-xl p-4 space-y-2 text-xs" style={{ background: 'rgba(255,255,255,0.03)' }}>
                    <p className="text-gray-400">Campaign ID: <span className="text-white font-mono">{result.campaign?.campaignId}</span></p>
                    <p className="text-gray-400">Ad Set ID: <span className="text-white font-mono">{result.campaign?.adSetId}</span></p>
                    <p className="text-gray-400">Anuncios creados: <span className="text-emerald-400">{result.campaign?.adIds?.length ?? 0}</span></p>
                  </div>
                  <button onClick={() => { setStep('type'); setAdFiles([]); setProductName(''); setLandingPage(''); setDailyBudget(''); setResult(null); }}
                    className="px-6 py-2.5 rounded-xl text-sm font-medium text-white"
                    style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)' }}>
                    Crear otra campaña
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
