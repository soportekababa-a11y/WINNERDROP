'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { MessageCircle, Store, CheckCircle2, XCircle, AlertCircle, Trash2, Save, RefreshCw, Key, Smartphone, Wifi, WifiOff } from 'lucide-react';
import { getToken, isAuthenticated } from '@/lib/auth';
import { Sidebar } from '@/components/sidebar';

interface ShopifyStore {
  id: string;
  shopDomain: string;
  isActive: boolean;
  messageTemplate: string;
  createdAt: string;
}

interface OrderLog {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  messageSent: string;
  status: 'sent' | 'failed' | 'pending';
  error: string;
  createdAt: string;
}

type WaStatus = 'disconnected' | 'connecting' | 'qr' | 'connected';

async function apiFetch(path: string, options?: RequestInit) {
  const token = getToken();
  const res = await fetch(`/api/proxy${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
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

export default function AutoConfirmPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [store, setStore] = useState<ShopifyStore | null>(null);
  const [logs, setLogs] = useState<OrderLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [shopInput, setShopInput] = useState('');
  const [tokenInput, setTokenInput] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState('');
  const [saving, setSaving] = useState(false);
  const [template, setTemplate] = useState('');
  const [waStatus, setWaStatus] = useState<WaStatus>('disconnected');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [initiating, setInitiating] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isAuthenticated()) { router.replace('/login'); return; }
    setAuthed(true);
    loadStore();
    return () => stopPoll();
  }, [router]);

  function stopPoll() {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }

  function startPoll() {
    stopPoll();
    pollRef.current = setInterval(async () => {
      try {
        const data = await apiFetch('/autoconfirm/whatsapp/status');
        setWaStatus(data.status);
        setQrDataUrl(data.qr || '');
        if (data.status === 'connected') { stopPoll(); loadLogs(); }
      } catch { /* ignore */ }
    }, 3000);
  }

  async function loadStore() {
    setLoading(true);
    try {
      const data = await apiFetch('/autoconfirm/store');
      if (data) {
        setStore(data);
        setTemplate(data.messageTemplate);
        loadLogs();
        // Check WA status
        const waData = await apiFetch('/autoconfirm/whatsapp/status').catch(() => ({ status: 'disconnected' }));
        setWaStatus(waData.status);
        setQrDataUrl(waData.qr || '');
        if (waData.status === 'qr' || waData.status === 'connecting') startPoll();
      }
    } catch {
      setStore(null);
    } finally {
      setLoading(false);
    }
  }

  async function loadLogs() {
    try {
      const data = await apiFetch('/autoconfirm/logs');
      setLogs(data || []);
    } catch { /* ignore */ }
  }

  async function connectShop() {
    if (!shopInput.trim() || !tokenInput.trim()) return;
    setConnecting(true);
    setConnectError('');
    try {
      const data = await apiFetch('/autoconfirm/shopify/connect', {
        method: 'POST',
        body: JSON.stringify({ shopDomain: shopInput.trim(), accessToken: tokenInput.trim() }),
      });
      setStore(data);
      setTemplate(data.messageTemplate);
      setShopInput('');
      setTokenInput('');
    } catch (err: any) {
      setConnectError(err.message || 'Token o dominio incorrecto');
    } finally {
      setConnecting(false);
    }
  }

  async function initWhatsapp() {
    setInitiating(true);
    setWaStatus('connecting');
    try {
      await apiFetch('/autoconfirm/whatsapp/init', { method: 'POST' });
      startPoll();
    } catch (err: any) {
      setWaStatus('disconnected');
      alert(err.message || 'Error iniciando WhatsApp');
    } finally {
      setInitiating(false);
    }
  }

  async function disconnectWhatsapp() {
    if (!confirm('¿Desconectar WhatsApp?')) return;
    await apiFetch('/autoconfirm/whatsapp', { method: 'DELETE' }).catch(() => null);
    setWaStatus('disconnected');
    setQrDataUrl('');
    stopPoll();
  }

  async function disconnectStore() {
    if (!confirm('¿Desconectar tienda? Se eliminará el webhook de Shopify.')) return;
    await disconnectWhatsapp();
    await apiFetch('/autoconfirm/store', { method: 'DELETE' });
    setStore(null);
    setLogs([]);
  }

  async function saveTemplate() {
    setSaving(true);
    try {
      await apiFetch('/autoconfirm/template', {
        method: 'PUT',
        body: JSON.stringify({ messageTemplate: template }),
      });
    } finally {
      setSaving(false);
    }
  }

  const statusBadge = (status: string) => {
    if (status === 'sent') return <span className="flex items-center gap-1 text-xs text-emerald-400"><CheckCircle2 size={12} /> Enviado</span>;
    if (status === 'failed') return <span className="flex items-center gap-1 text-xs text-red-400"><XCircle size={12} /> Fallido</span>;
    return <span className="flex items-center gap-1 text-xs text-yellow-400"><AlertCircle size={12} /> Pendiente</span>;
  };

  if (!authed) return null;

  return (
    <div className="min-h-screen bg-[#020209] flex">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
      {loading ? (
        <div className="flex-1 flex items-center justify-center py-32">
          <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
      <div className="max-w-4xl w-full mx-auto px-6 py-8 space-y-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl" style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)' }}>
          <MessageCircle size={22} className="text-violet-400" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-white">AutoConfirm</h1>
          <p className="text-xs text-gray-500">Confirmaciones de pedidos por WhatsApp — desde tu número</p>
        </div>
      </div>

      {!store ? (
        /* ─── Connect store ─── */
        <div className="max-w-xl space-y-4">
          <div className="rounded-2xl p-6 space-y-5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex items-center gap-3">
              <Store size={18} className="text-gray-400" />
              <h2 className="text-sm font-medium text-white">Conectar tienda Shopify</h2>
            </div>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs text-gray-500">Dominio de la tienda</label>
                <input
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-violet-500/50"
                  placeholder="mi-tienda.myshopify.com"
                  value={shopInput}
                  onChange={e => setShopInput(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-gray-500">Admin API Access Token</label>
                <div className="relative">
                  <Key size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" />
                  <input
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-violet-500/50"
                    placeholder="shpat_xxxxxxxxxxxxxxxxxxxx"
                    value={tokenInput}
                    onChange={e => setTokenInput(e.target.value)}
                    type="password"
                  />
                </div>
              </div>
            </div>
            {connectError && <p className="text-xs text-red-400 flex items-center gap-1.5"><XCircle size={12} /> {connectError}</p>}
            <button
              onClick={connectShop}
              disabled={connecting || !shopInput || !tokenInput}
              className="w-full py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)' }}
            >
              {connecting ? <><RefreshCw size={14} className="animate-spin" /> Verificando...</> : 'Conectar tienda'}
            </button>
          </div>

          <div className="rounded-2xl p-5 space-y-3" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <p className="text-xs font-medium text-gray-400">¿Cómo obtener el Access Token?</p>
            <div className="space-y-2 text-xs text-gray-500">
              <p>1. Shopify Admin → <span className="text-gray-300">Configuración → Apps → Desarrollar apps</span></p>
              <p>2. Crear app → nombre <span className="text-gray-300">AutoConfirm</span></p>
              <p>3. Configurar permisos → activar <span className="text-gray-300">read_orders</span> → Guardar</p>
              <p>4. Instalar app → copiar el <span className="text-gray-300">Admin API access token</span> (empieza con <code className="text-violet-400">shpat_</code>)</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {/* ─── Store status ─── */}
          <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <div>
                  <p className="text-sm font-medium text-white">{store.shopDomain}</p>
                  <p className="text-xs text-gray-500">Tienda conectada · webhook activo</p>
                </div>
              </div>
              <button onClick={disconnectStore} className="p-2 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-all">
                <Trash2 size={14} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* ─── WhatsApp QR ─── */}
            <div className="rounded-2xl p-5 space-y-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Smartphone size={16} className="text-gray-400" />
                  <h2 className="text-sm font-medium text-white">WhatsApp</h2>
                </div>
                {waStatus === 'connected' && (
                  <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                    <Wifi size={12} /> Conectado
                  </span>
                )}
                {waStatus === 'disconnected' && (
                  <span className="flex items-center gap-1.5 text-xs text-gray-500">
                    <WifiOff size={12} /> Desconectado
                  </span>
                )}
                {(waStatus === 'connecting' || waStatus === 'qr') && (
                  <span className="flex items-center gap-1.5 text-xs text-yellow-400">
                    <RefreshCw size={12} className="animate-spin" /> Esperando...
                  </span>
                )}
              </div>

              {waStatus === 'connected' ? (
                <div className="space-y-3">
                  <div className="rounded-xl p-4 text-center" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
                    <CheckCircle2 size={28} className="text-emerald-400 mx-auto mb-2" />
                    <p className="text-sm text-emerald-300 font-medium">WhatsApp activo</p>
                    <p className="text-xs text-gray-500 mt-1">El bot enviará confirmaciones automáticamente</p>
                  </div>
                  <button onClick={disconnectWhatsapp} className="w-full py-2 rounded-xl text-xs text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-all border border-white/5">
                    Desconectar WhatsApp
                  </button>
                </div>
              ) : waStatus === 'qr' && qrDataUrl ? (
                <div className="space-y-3">
                  <div className="rounded-xl p-4 flex flex-col items-center gap-3" style={{ background: 'rgba(255,255,255,0.02)' }}>
                    <img src={qrDataUrl} alt="QR WhatsApp" className="w-48 h-48 rounded-lg" />
                    <div className="text-center">
                      <p className="text-xs text-white font-medium">Escanea con tu WhatsApp</p>
                      <p className="text-xs text-gray-500 mt-0.5">WhatsApp → Dispositivos vinculados → Vincular dispositivo</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-gray-500">
                    Conecta tu WhatsApp para que el bot envíe las confirmaciones de pedidos desde tu número.
                  </p>
                  <button
                    onClick={initWhatsapp}
                    disabled={initiating}
                    className="w-full py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-50 flex items-center justify-center gap-2"
                    style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)' }}
                  >
                    {initiating
                      ? <><RefreshCw size={14} className="animate-spin" /> Generando QR...</>
                      : <><Smartphone size={14} /> Conectar WhatsApp</>
                    }
                  </button>
                  <p className="text-xs text-gray-600 text-center">El QR aparece en segundos</p>
                </div>
              )}
            </div>

            {/* ─── Template editor ─── */}
            <div className="rounded-2xl p-5 space-y-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <h2 className="text-sm font-medium text-white">Mensaje de confirmación</h2>
              <div className="space-y-1.5">
                <textarea
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-violet-500/50 resize-none"
                  rows={5}
                  value={template}
                  onChange={e => setTemplate(e.target.value)}
                  placeholder="¡Hola {{nombre}}! Tu pedido #{{numero}} en {{tienda}} fue confirmado. Lo estamos procesando. 🛍️"
                />
                <p className="text-xs text-gray-600">Variables disponibles: <code className="text-violet-400">{'{{nombre}}'}</code> <code className="text-violet-400">{'{{numero}}'}</code> <code className="text-violet-400">{'{{tienda}}'}</code></p>
              </div>
              <button
                onClick={saveTemplate}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)' }}
              >
                <Save size={14} />
                {saving ? 'Guardando...' : 'Guardar mensaje'}
              </button>
            </div>
          </div>

          {/* ─── Order logs ─── */}
          <div className="rounded-2xl p-5 space-y-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-white">Pedidos recibidos</h2>
              <button onClick={loadLogs} className="p-1.5 rounded-lg text-gray-600 hover:text-gray-300 hover:bg-white/5 transition-all">
                <RefreshCw size={13} />
              </button>
            </div>
            {logs.length === 0 ? (
              <p className="text-xs text-gray-600 text-center py-6">Sin pedidos aún. Cuando llegue uno aparecerá aquí.</p>
            ) : (
              <div className="space-y-2">
                {logs.map(log => (
                  <div key={log.id} className="flex items-center gap-4 px-4 py-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-white font-medium">#{log.orderNumber}</span>
                        <span className="text-xs text-gray-500">{log.customerName}</span>
                      </div>
                      <p className="text-xs text-gray-600 truncate mt-0.5">{log.messageSent || log.error}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs text-gray-600">{log.customerPhone}</span>
                      {statusBadge(log.status)}
                      <span className="text-xs text-gray-700">{new Date(log.createdAt).toLocaleString('es', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
      )}
      </div>
    </div>
  );
}
