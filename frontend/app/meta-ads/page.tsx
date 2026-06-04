'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Facebook, Plus, X, Play, Square, ChevronRight, Zap, TrendingUp, MessageSquare, Eye, ShoppingCart, Loader2, CheckCircle, AlertCircle, Trash2 } from 'lucide-react';
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

type Step = 'connect' | 'setup' | 'type' | 'form' | 'ads' | 'creating' | 'done';

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

  // Ads
  const [adFiles, setAdFiles] = useState<AdFile[]>([]);
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
        setStep(s.adAccountId && s.pageId ? 'type' : 'setup');
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
      setStep('type');
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
                <Facebook size={22} className="text-blue-400" />
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
                  <Facebook size={48} className="text-blue-400 mx-auto" />
                  <div>
                    <h2 className="text-lg font-semibold text-white">Conecta tu cuenta de Facebook</h2>
                    <p className="text-sm text-gray-500 mt-1">Necesario para crear campañas en tus cuentas publicitarias</p>
                  </div>
                  <button onClick={connectFacebook}
                    className="mx-auto flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium text-white"
                    style={{ background: 'linear-gradient(135deg, #1877f2, #0c5fc7)' }}>
                    <Facebook size={16} /> Conectar con Facebook
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

              {/* STEP: TYPE */}
              {step === 'type' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-semibold text-white">¿Qué quieres lograr?</h2>
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
                    onClick={() => { if (productName && landingPage && dailyBudget) setStep('ads'); }}
                    disabled={!productName || !landingPage || !dailyBudget}
                    className="w-full py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-50 flex items-center justify-center gap-2"
                    style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)' }}>
                    Continuar → Subir anuncios
                  </button>
                </div>
              )}

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
                              <video src={ad.preview} className="w-full h-full object-cover" muted loop playsInline
                                ref={el => { if (el) el.play().catch(() => {}); }} />
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
