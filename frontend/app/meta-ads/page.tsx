'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getToken } from '@/lib/auth';
import { Sidebar } from '@/components/sidebar';

function apiFetch(path: string, options?: RequestInit) {
  const token = getToken();
  return fetch(`/api/proxy${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, ...(options?.headers ?? {}) },
  });
}

// ─── Strategies ───────────────────────────────────────────────────────────────

const STRATEGIES = [
  {
    id: 'creative_test',
    icon: '🧪',
    name: 'Test de Creativos',
    badge: '🔥 Más popular',
    tagline: 'Descubre qué imagen o video convierte más',
    description: '1 conjunto broad + múltiples anuncios. Meta decide a quién mostrar cada creativo automáticamente.',
    when: 'Primera campaña o cuando tienes varios creativos',
    campaignType: 'VENTAS',
    budgetType: 'ABO',
    fixedAdSets: 1,
    minCreatives: 3,
    audienceType: 'broad',
  },
  {
    id: 'audience_test',
    icon: '🎯',
    name: 'Test de Audiencias',
    badge: null,
    tagline: 'Compara qué audiencia compra más',
    description: '2-4 conjuntos con intereses diferentes, mismo creativo. La IA genera audiencias validadas contra Meta API.',
    when: 'Ya tienes un creativo ganador',
    campaignType: 'VENTAS',
    budgetType: 'ABO',
    fixedAdSets: null,
    minCreatives: 1,
    audienceType: 'interests',
  },
  {
    id: 'scale_cbo',
    icon: '🚀',
    name: 'Escalar con CBO',
    badge: '⭐ Para escalar',
    tagline: 'Meta distribuye el budget donde más convierte',
    description: 'CBO con 2-4 conjuntos mixtos. Meta decide automáticamente cuánto gastar en cada audiencia.',
    when: 'Ya tienes datos y quieres crecer el gasto',
    campaignType: 'VENTAS',
    budgetType: 'CBO',
    fixedAdSets: null,
    minCreatives: 2,
    audienceType: 'mixed',
  },
  {
    id: 'asc_plus',
    icon: '🤖',
    name: 'Advantage+ Shopping',
    badge: '🧠 Full IA',
    tagline: 'Meta controla audiencias, placements y creativos',
    description: 'Campaña ASC+ — la IA de Meta optimiza todo automáticamente. Máximo ROAS con pixel activo.',
    when: 'Pixel con 50+ compras/semana, $30+/día',
    campaignType: 'VENTAS',
    budgetType: 'CBO',
    fixedAdSets: 1,
    minCreatives: 3,
    audienceType: 'broad',
  },
  {
    id: 'traffic',
    icon: '🌐',
    name: 'Tráfico al Sitio',
    badge: null,
    tagline: 'Lleva visitas baratas a tu landing page',
    description: 'Optimizado para landing page views. Ideal para construir audiencias de pixel o productos nuevos.',
    when: 'Nuevo producto, construir audiencia de pixel',
    campaignType: 'TRAFICO',
    budgetType: 'ABO',
    fixedAdSets: 1,
    minCreatives: 1,
    audienceType: 'interests',
  },
  {
    id: 'leads',
    icon: '📋',
    name: 'Captación de Leads',
    badge: null,
    tagline: 'Capta nombre, email y teléfono',
    description: 'Lead generation con pixel. Capta datos de contacto de personas interesadas en tu producto.',
    when: 'Servicios, cursos, productos de alta consideración',
    campaignType: 'LEADS',
    budgetType: 'ABO',
    fixedAdSets: 1,
    minCreatives: 1,
    audienceType: 'interests',
  },
  {
    id: 'messages',
    icon: '💬',
    name: 'Mensajes WhatsApp',
    badge: '💬 Popular LATAM',
    tagline: 'Clientes te escriben directo por WhatsApp',
    description: 'Anuncios con botón que abre WhatsApp. Resultados excelentes en LATAM para ventas personalizadas.',
    when: 'Ventas personalizadas, negocios locales, servicios',
    campaignType: 'MENSAJES',
    budgetType: 'ABO',
    fixedAdSets: 1,
    minCreatives: 1,
    audienceType: 'interests',
  },
  {
    id: 'awareness',
    icon: '👁️',
    name: 'Reconocimiento de Marca',
    badge: null,
    tagline: 'Llega al máximo de personas en tu mercado',
    description: 'Objetivo REACH — maximiza impresiones únicas y construye top of mind antes de vender.',
    when: 'Lanzamiento de marca, antes de campañas de venta',
    campaignType: 'RECONOCIMIENTO',
    budgetType: 'ABO',
    fixedAdSets: 1,
    minCreatives: 2,
    audienceType: 'broad',
  },
  {
    id: 'full_test',
    icon: '⚡',
    name: 'Test Completo',
    badge: '🎯 Máximo info',
    tagline: 'Varios creativos × varias audiencias al mismo tiempo',
    description: 'Elige cuántos conjuntos y sube los creativos que quieras. Cada conjunto recibe TODOS los creativos — máxima información en un solo vuelo.',
    when: 'Quieres testear todo a la vez con el mayor aprendizaje',
    campaignType: 'VENTAS',
    budgetType: 'ABO',
    fixedAdSets: null,
    minCreatives: 2,
    audienceType: 'interests',
  },
] as const;

type StrategyId = typeof STRATEGIES[number]['id'];

const COUNTRIES = [
  { code: 'RD', name: '🇩🇴 Rep. Dominicana' },
  { code: 'MX', name: '🇲🇽 México' },
  { code: 'CO', name: '🇨🇴 Colombia' },
  { code: 'GT', name: '🇬🇹 Guatemala' },
  { code: 'EC', name: '🇪🇨 Ecuador' },
  { code: 'CR', name: '🇨🇷 Costa Rica' },
  { code: 'PE', name: '🇵🇪 Perú' },
  { code: 'CL', name: '🇨🇱 Chile' },
  { code: 'AR', name: '🇦🇷 Argentina' },
  { code: 'US', name: '🇺🇸 Estados Unidos' },
  { code: 'ES', name: '🇪🇸 España' },
];

type Step = 'connect' | 'setup' | 'strategy' | 'form' | 'creating' | 'done';

interface ConnStatus {
  connected: boolean;
  adAccountId?: string;
  adAccountName?: string;
  pageId?: string;
  pageName?: string;
  credits: number;
}

interface FormState {
  productName: string;
  landingPage: string;
  country: string;
  dailyBudget: string;
  priceBefore: string;
  priceAfter: string;
  excludeCities: string;
  adSetsCount: string;
  audienceHint: string;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MetaAdsPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('connect');
  const [connStatus, setConnStatus] = useState<ConnStatus | null>(null);
  const [selectedStrategy, setSelectedStrategy] = useState<StrategyId | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [creatingMsg, setCreatingMsg] = useState('');
  const [accounts, setAccounts] = useState<any[]>([]);
  const [pages, setPages] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<FormState>({
    productName: '',
    landingPage: 'https://',
    country: 'RD',
    dailyBudget: '',
    priceBefore: '',
    priceAfter: '',
    excludeCities: '',
    adSetsCount: '2',
    audienceHint: '',
  });

  const strategy = STRATEGIES.find(s => s.id === selectedStrategy);

  // ─── Init ────────────────────────────────────────────────────────────────────

  useEffect(() => {
    checkStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkStatus = async () => {
    try {
      const res = await apiFetch('/meta-ads/status');
      const data: ConnStatus = await res.json();
      setConnStatus(data);
      if (data.connected && data.adAccountId && data.pageId) setStep('strategy');
      else if (data.connected) {
        setStep('setup');
        loadSetup();
      } else {
        setStep('connect');
      }
    } catch {
      setStep('connect');
    }
  };

  const loadSetup = async () => {
    const [accRes, pgRes] = await Promise.all([
      apiFetch('/meta-ads/accounts').then(r => r.json()),
      apiFetch('/meta-ads/pages').then(r => r.json()),
    ]);
    setAccounts(accRes.accounts ?? []);
    setPages(pgRes.pages ?? []);
  };

  // ─── Handlers ────────────────────────────────────────────────────────────────

  const connectMeta = async () => {
    // Open popup synchronously (before any await) to avoid browser popup blocker
    const popup = window.open('about:blank', 'meta-oauth', 'width=600,height=700');
    try {
      const res = await apiFetch('/meta-ads/auth-url');
      const { url } = await res.json();
      if (popup) popup.location.href = url;
    } catch {
      popup?.close();
      setError('Error obteniendo URL de Meta. Intenta de nuevo.');
      return;
    }
    const iv = setInterval(async () => {
      if (popup?.closed) { clearInterval(iv); await checkStatus(); }
    }, 1000);
  };

  const disconnectMeta = async () => {
    await apiFetch('/meta-ads/disconnect', { method: 'DELETE' });
    setConnStatus(null);
    setAccounts([]);
    setPages([]);
    setStep('connect');
  };

  const changeAccount = async () => {
    setAccounts([]);
    setPages([]);
    setStep('setup');
    loadSetup();
  };

  const selectAccount = async (id: string, name: string) => {
    await apiFetch('/meta-ads/select-account', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adAccountId: id, adAccountName: name }),
    });
    setConnStatus(s => s ? { ...s, adAccountId: id, adAccountName: name } : s);
  };

  const selectPage = async (id: string, name: string) => {
    await apiFetch('/meta-ads/select-page', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pageId: id, pageName: name }),
    });
    setConnStatus(s => s ? { ...s, pageId: id, pageName: name } : s);
    setStep('strategy');
  };

  const addFiles = (incoming: FileList | File[]) => {
    const arr = Array.from(incoming).filter(f => f.type.startsWith('image/') || f.type.startsWith('video/'));
    setFiles(prev => {
      const seen = new Set(prev.map(f => f.name + f.size));
      return [...prev, ...arr.filter(f => !seen.has(f.name + f.size))].slice(0, 10);
    });
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    addFiles(e.dataTransfer.files);
  }, []);

  const upd = (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }));

  const createCampaign = async () => {
    if (!strategy) return;
    setError(null);
    if (!form.productName.trim()) return setError('Nombre del producto requerido');
    if (!form.landingPage.startsWith('http')) return setError('URL inválida — debe empezar con https://');
    if (!form.dailyBudget || parseFloat(form.dailyBudget) < 1) return setError('Presupuesto diario requerido');
    if (files.length === 0) return setError('Sube al menos un creativo (imagen o video)');

    setStep('creating');
    const msgs = [
      'Buscando intereses en Meta API…',
      'Validando audiencias…',
      'Generando copies con IA…',
      'Creando campaña en Meta…',
      'Subiendo creativos…',
      'Configurando conjuntos de anuncios…',
    ];
    let mi = 0;
    setCreatingMsg(msgs[0]);
    const iv = setInterval(() => { mi = (mi + 1) % msgs.length; setCreatingMsg(msgs[mi]); }, 4000);

    const fd = new FormData();
    fd.append('campaignType', strategy.campaignType);
    fd.append('productName', form.productName.trim());
    fd.append('landingPage', form.landingPage.trim());
    fd.append('country', form.country);
    fd.append('dailyBudget', form.dailyBudget);
    fd.append('budgetType', strategy.budgetType);
    fd.append('adSetsCount', strategy.fixedAdSets ? String(strategy.fixedAdSets) : form.adSetsCount);
    fd.append('strategy', strategy.id);
    fd.append('startTime', 'now');
    if (form.priceBefore) fd.append('priceBefore', form.priceBefore);
    if (form.priceAfter) fd.append('priceAfter', form.priceAfter);
    const cities = form.excludeCities.split(',').map(c => c.trim()).filter(Boolean);
    if (cities.length) fd.append('excludeCities', JSON.stringify(cities));
    if (form.audienceHint.trim()) fd.append('audienceHint', form.audienceHint.trim());
    fd.append('audienceAdSets', JSON.stringify([]));
    fd.append('copys', JSON.stringify([]));
    files.forEach(f => fd.append('files', f));

    try {
      const res = await apiFetch('/meta-ads/campaigns', { method: 'POST', body: fd });
      clearInterval(iv);
      const text = await res.text();
      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(`Respuesta inválida del servidor: ${text.slice(0, 300)}`);
      }
      if (!res.ok) throw new Error(data.message ?? JSON.stringify(data));
      setResult(data);
      setStep('done');
    } catch (e: any) {
      clearInterval(iv);
      setError(e.message ?? 'Error desconocido');
      setStep('form');
    }
  };

  const resetForm = () => {
    setStep('strategy');
    setFiles([]);
    setResult(null);
    setSelectedStrategy(null);
    setForm(f => ({ ...f, productName: '', landingPage: 'https://', priceBefore: '', priceAfter: '', audienceHint: '', excludeCities: '' }));
  };

  // ─── Styles ───────────────────────────────────────────────────────────────────

  const fieldCls = 'w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500 transition-colors placeholder:text-zinc-600';
  const labelCls = 'block text-xs font-medium text-zinc-400 mb-1.5';

  // ─── Renders ─────────────────────────────────────────────────────────────────

  const renderContent = () => {

    // CONNECT
    if (step === 'connect') return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <div className="max-w-sm w-full text-center">
          <div className="text-5xl mb-5">📣</div>
          <h1 className="text-2xl font-bold text-white mb-3">Meta Ads con IA</h1>
          <p className="text-zinc-400 text-sm mb-7 leading-relaxed">
            Crea campañas profesionales en minutos. La IA genera audiencias y copies — tú solo subes los creativos.
          </p>
          <button onClick={connectMeta} className="w-full bg-violet-600 hover:bg-violet-500 text-white font-semibold py-3 rounded-xl transition-colors mb-3">
            Conectar cuenta de Meta
          </button>
          <button onClick={() => router.push('/dashboard')} className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors">
            Volver al dashboard
          </button>
        </div>
      </div>
    );

    // SETUP
    if (step === 'setup') return (
      <div className="max-w-xl">
        <div className="flex items-center gap-3 mb-6">
          {connStatus?.connected && (
            <button onClick={() => setStep('strategy')} className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors">← Volver</button>
          )}
          <h1 className="text-xl font-bold text-white">
            {connStatus?.adAccountId ? 'Selecciona una página' : 'Selecciona una cuenta publicitaria'}
          </h1>
        </div>
        {!connStatus?.adAccountId ? (
          <div>
            <h2 className="text-sm font-semibold text-zinc-300 mb-3">Cuenta publicitaria</h2>
            <div className="space-y-2">
              {accounts.length === 0 && <p className="text-zinc-500 text-sm">Cargando cuentas…</p>}
              {accounts.map((acc: any) => (
                <button key={acc.id} onClick={() => selectAccount(acc.id, acc.name)}
                  className="w-full text-left bg-zinc-900 border border-zinc-800 rounded-xl p-4 hover:border-violet-600 transition-colors">
                  <div className="font-medium text-white text-sm">{acc.name}</div>
                  <div className="text-xs text-zinc-500 mt-0.5">{acc.id}</div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div>
            <h2 className="text-sm font-semibold text-zinc-300 mb-3">Página de Facebook</h2>
            <div className="space-y-2">
              {pages.length === 0 && <p className="text-zinc-500 text-sm">Cargando páginas…</p>}
              {pages.map((pg: any) => (
                <button key={pg.id} onClick={() => selectPage(pg.id, pg.name)}
                  className="w-full text-left bg-zinc-900 border border-zinc-800 rounded-xl p-4 hover:border-violet-600 transition-colors">
                  <div className="font-medium text-white text-sm">{pg.name}</div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );

    // STRATEGY SELECTION
    if (step === 'strategy') return (
      <div>
        <div className="flex items-start justify-between mb-7 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Nueva Campaña</h1>
            <p className="text-zinc-400 text-sm mt-1">Elige la estrategia según tu objetivo</p>
          </div>
          <div className="flex-shrink-0 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-right">
            <div className="text-xs text-zinc-500 mb-0.5">Cuenta publicitaria</div>
            <div className="text-sm text-white font-medium">{connStatus?.adAccountName ?? '—'}</div>
            <div className="flex items-center gap-3 mt-2 justify-end">
              <div className="flex items-center gap-1">
                <span className="text-yellow-400 text-xs">⚡</span>
                <span className="text-sm font-medium text-white">{connStatus?.credits ?? 0}</span>
                <span className="text-zinc-500 text-xs">créditos</span>
              </div>
              <span className="text-zinc-700">·</span>
              <button onClick={changeAccount} className="text-xs text-violet-400 hover:text-violet-300 transition-colors">
                Cambiar cuenta
              </button>
              <span className="text-zinc-700">·</span>
              <button onClick={disconnectMeta} className="text-xs text-zinc-500 hover:text-red-400 transition-colors">
                Desconectar
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {STRATEGIES.map(s => (
            <button key={s.id} onClick={() => { setSelectedStrategy(s.id); setStep('form'); }}
              className="text-left bg-zinc-900 border border-zinc-800 rounded-2xl p-5 hover:border-violet-500 hover:bg-zinc-800/80 transition-all group">
              <div className="flex items-start justify-between mb-3">
                <span className="text-3xl">{s.icon}</span>
                {s.badge && (
                  <span className="text-xs bg-violet-600/20 text-violet-300 px-2 py-0.5 rounded-full border border-violet-600/30 leading-5">
                    {s.badge}
                  </span>
                )}
              </div>
              <h3 className="font-bold text-white text-sm mb-1 group-hover:text-violet-300 transition-colors">{s.name}</h3>
              <p className="text-violet-400 text-xs mb-2 font-medium">{s.tagline}</p>
              <p className="text-zinc-500 text-xs leading-relaxed mb-3">{s.description}</p>
              <div className="border-t border-zinc-800 pt-3 mb-3">
                <p className="text-xs text-zinc-600"><span className="text-zinc-500">Cuándo: </span>{s.when}</p>
              </div>
              <div className="flex gap-1.5 flex-wrap">
                <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full">{s.budgetType}</span>
                <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full">{s.campaignType}</span>
              </div>
            </button>
          ))}
        </div>

        <p className="text-center text-zinc-600 text-xs mt-6">
          <button onClick={() => router.push('/dashboard')} className="hover:text-zinc-400 transition-colors">← Volver al dashboard</button>
        </p>
      </div>
    );

    // FORM
    if (step === 'form' && strategy) {
      const showAdSets = !strategy.fixedAdSets;
      const perSet = showAdSets && form.dailyBudget && strategy.budgetType === 'ABO'
        ? (parseFloat(form.dailyBudget) / parseInt(form.adSetsCount)).toFixed(2)
        : null;

      return (
        <div className="max-w-2xl">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 mb-6 text-sm">
            <button onClick={() => setStep('strategy')} className="text-zinc-500 hover:text-zinc-300 transition-colors">← Estrategias</button>
            <span className="text-zinc-700">/</span>
            <span className="text-xl">{strategy.icon}</span>
            <span className="text-white font-medium">{strategy.name}</span>
            <div className="ml-auto flex gap-2">
              <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full">{strategy.budgetType}</span>
              <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full">{strategy.campaignType}</span>
            </div>
          </div>

          {/* Strategy hint */}
          <div className="bg-violet-600/10 border border-violet-600/20 rounded-xl p-4 mb-5 text-sm text-violet-300">
            {strategy.description}
            {strategy.minCreatives > 1 && (
              <span className="block text-violet-400/60 text-xs mt-1">Sube {strategy.minCreatives}+ creativos distintos para mejores resultados.</span>
            )}
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-5 text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-5">
            {/* Product */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
              <h2 className="text-white font-semibold text-sm mb-4">Producto</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className={labelCls}>Nombre del producto *</label>
                  <input className={fieldCls} value={form.productName} onChange={upd('productName')} placeholder="ej. Faja Reductora Premium" />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls}>URL de la landing page *</label>
                  <input className={fieldCls} value={form.landingPage} onChange={upd('landingPage')} type="url" placeholder="https://tutienda.com/producto" />
                </div>
                <div>
                  <label className={labelCls}>Precio antes (opcional)</label>
                  <input className={fieldCls} value={form.priceBefore} onChange={upd('priceBefore')} type="number" placeholder="ej. 59.99" />
                </div>
                <div>
                  <label className={labelCls}>Precio actual (opcional)</label>
                  <input className={fieldCls} value={form.priceAfter} onChange={upd('priceAfter')} type="number" placeholder="ej. 39.99" />
                </div>
              </div>
            </div>

            {/* Campaign config */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
              <h2 className="text-white font-semibold text-sm mb-4">Configuración</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>País *</label>
                  <select className={fieldCls} value={form.country} onChange={upd('country')}>
                    {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Presupuesto diario (USD) *</label>
                  <input className={fieldCls} value={form.dailyBudget} onChange={upd('dailyBudget')} type="number" min="1" step="0.01" placeholder="ej. 20" />
                </div>
                {showAdSets && (
                  <div>
                    <label className={labelCls}>
                      Conjuntos de anuncios
                      {strategy.id === 'full_test' && <span className="ml-1 text-violet-400">(cada uno recibe todos los creativos)</span>}
                    </label>
                    <select className={fieldCls} value={form.adSetsCount} onChange={upd('adSetsCount')}>
                      <option value="2">2 conjuntos</option>
                      <option value="3">3 conjuntos</option>
                      <option value="4">4 conjuntos</option>
                      <option value="5">5 conjuntos</option>
                      <option value="6">6 conjuntos</option>
                    </select>
                  </div>
                )}
                <div>
                  <label className={labelCls}>Excluir ciudades (separadas por coma)</label>
                  <input className={fieldCls} value={form.excludeCities} onChange={upd('excludeCities')} placeholder="ej. Santiago, Valparaíso" />
                </div>
              </div>

              {strategy.audienceType !== 'broad' && (
                <div className="mt-4">
                  <label className={labelCls}>Describe tu audiencia ideal (opcional)</label>
                  <textarea className={`${fieldCls} resize-none`} rows={2} value={form.audienceHint} onChange={upd('audienceHint')}
                    placeholder="ej. mujeres 25-45 interesadas en fajas, fitness y moda" />
                  <p className="text-zinc-600 text-xs mt-1">La IA usa esto para generar intereses más precisos en Meta</p>
                </div>
              )}

              <div className="mt-4 bg-zinc-800/60 rounded-xl p-3 text-xs text-zinc-400">
                {strategy.budgetType === 'CBO'
                  ? '💡 CBO — El presupuesto va en la campaña. Meta decide cuánto gastar en cada conjunto según lo que convierte.'
                  : `💡 ABO — El presupuesto va en cada conjunto.${perSet ? ` ≈ $${perSet}/día por conjunto.` : ''}`}
              </div>
            </div>

            {/* Creatives */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
              <h2 className="text-white font-semibold text-sm mb-1">Creativos *</h2>
              {(() => {
                const sets = strategy.fixedAdSets ?? parseInt(form.adSetsCount);
                const total = files.length * sets;
                return (
                  <div className="mb-4">
                    {strategy.id === 'full_test' && files.length > 0 ? (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-violet-400 text-xs font-semibold">
                          {files.length} creativo{files.length !== 1 ? 's' : ''} × {sets} conjuntos
                        </span>
                        <span className="text-zinc-600 text-xs">=</span>
                        <span className="text-white text-xs font-bold">{total} anuncios en Meta</span>
                      </div>
                    ) : (
                      <p className="text-zinc-500 text-xs">
                        {files.length > 0
                          ? `${files.length} creativo${files.length !== 1 ? 's' : ''} en ${sets} conjunto${sets !== 1 ? 's' : ''} — ${total} anuncio${total !== 1 ? 's' : ''} en Meta`
                          : 'Sube imágenes o videos — se crearán anuncios en cada conjunto'}
                      </p>
                    )}
                  </div>
                );
              })()}

              <div
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${dragging ? 'border-violet-500 bg-violet-500/5' : 'border-zinc-700 hover:border-zinc-600 hover:bg-zinc-800/30'}`}
              >
                <div className="text-3xl mb-2">📁</div>
                <p className="text-zinc-400 text-sm mb-1">Arrastra aquí o haz clic para subir</p>
                <p className="text-zinc-600 text-xs">JPG, PNG, MP4, MOV — máx. 10 archivos</p>
                <input ref={fileInputRef} type="file" multiple accept="image/*,video/*" className="hidden"
                  onChange={e => e.target.files && addFiles(e.target.files)} />
              </div>

              {files.length > 0 && (
                <div className="mt-3 space-y-2">
                  {files.map((f, i) => (
                    <div key={i} className="flex items-center gap-3 bg-zinc-800 rounded-lg px-3 py-2">
                      <span>{f.type.startsWith('video/') ? '🎬' : '🖼️'}</span>
                      <span className="text-zinc-300 text-sm flex-1 truncate">{f.name}</span>
                      <span className="text-zinc-600 text-xs">{(f.size / 1024 / 1024).toFixed(1)} MB</span>
                      <button onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))} className="text-zinc-600 hover:text-red-400 transition-colors text-lg leading-none">×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button onClick={createCampaign}
              className="w-full bg-violet-600 hover:bg-violet-500 text-white font-bold py-4 rounded-xl transition-colors text-base">
              Crear Campaña — {strategy.name}
            </button>
            <p className="text-center text-xs text-zinc-600">
              Usa 1 crédito · {connStatus?.credits ?? 0} disponibles · La campaña se crea en modo PAUSA
            </p>
          </div>
        </div>
      );
    }

    // CREATING
    if (step === 'creating') return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="max-w-sm w-full text-center">
          <div className="relative inline-flex items-center justify-center mb-7">
            <div className="w-20 h-20 rounded-full border-4 border-violet-600/30 border-t-violet-500 animate-spin" />
            <span className="absolute text-3xl">{strategy?.icon}</span>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">{strategy?.name}</h2>
          <p className="text-zinc-400 text-sm mb-5">{creatingMsg}</p>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-left text-xs text-zinc-500 space-y-1.5">
            <div className="flex items-center gap-2"><span className="text-green-500">✓</span> {form.productName}</div>
            <div className="flex items-center gap-2"><span className="text-green-500">✓</span> {COUNTRIES.find(c => c.code === form.country)?.name} · ${form.dailyBudget}/día</div>
            <div className="flex items-center gap-2"><span className="text-green-500">✓</span> {files.length} creativo{files.length !== 1 ? 's' : ''} · {strategy?.budgetType}</div>
          </div>
          <p className="text-zinc-600 text-xs mt-4">Videos pueden tardar 1-2 min para procesar</p>
        </div>
      </div>
    );

    // DONE
    if (step === 'done') return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="max-w-sm w-full text-center">
          <div className="text-6xl mb-5">🎉</div>
          <h2 className="text-2xl font-bold text-white mb-2">¡Campaña creada!</h2>
          <p className="text-zinc-400 text-sm mb-6">
            Está en modo <span className="text-yellow-400 font-semibold">PAUSA</span>. Revísala en Meta Ads Manager y actívala cuando estés listo.
          </p>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 text-left mb-6 text-sm">
            <div className="font-semibold text-white mb-3">Resumen</div>
            <div className="space-y-2">
              {[
                ['Estrategia', `${strategy?.icon} ${strategy?.name}`],
                ['Producto', form.productName],
                ['Presupuesto', `$${form.dailyBudget}/día · ${strategy?.budgetType}`],
                ['Creativos', `${files.length} anuncio${files.length !== 1 ? 's' : ''}`],
                result?.campaign?.adSetIds ? ['Conjuntos', result.campaign.adSetIds.length] : null,
                ['Créditos restantes', `${result?.credits ?? 0} ⚡`],
              ].filter(Boolean).map(([k, v]: any) => (
                <div key={k} className="flex justify-between">
                  <span className="text-zinc-500">{k}</span>
                  <span className="text-white">{v}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <button onClick={resetForm} className="w-full bg-violet-600 hover:bg-violet-500 text-white font-semibold py-3 rounded-xl transition-colors">
              Crear otra campaña
            </button>
            <button onClick={() => router.push('/dashboard')} className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-semibold py-3 rounded-xl transition-colors">
              Ver mis campañas
            </button>
          </div>
        </div>
      </div>
    );

    return null;
  };

  // ─── Layout ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-screen bg-zinc-950">
      <Sidebar />
      <main className="flex-1 p-6 overflow-auto">
        {renderContent()}
      </main>
    </div>
  );
}
