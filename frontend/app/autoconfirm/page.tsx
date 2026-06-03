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
  confirmMessage: string;
  cancelMessage: string;
  audioInitialMode: string;
  audioConfirmMode: string;
  audioCancelMode: string;
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
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState('');
  const [saving, setSaving] = useState(false);
  const [template, setTemplate] = useState('');
  const [confirmMsg, setConfirmMsg] = useState('');
  const [cancelMsg, setCancelMsg] = useState('');
  const [audioInitialMode, setAudioInitialMode] = useState('text_only');
  const [audioConfirmMode, setAudioConfirmMode] = useState('text');
  const [audioCancelMode, setAudioCancelMode] = useState('text');
  const [waStatus, setWaStatus] = useState<WaStatus>('disconnected');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [initiating, setInitiating] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [msgUsage, setMsgUsage] = useState<{ used: number; limit: number } | null>(null);

  const WA_PACKS = [
    { msgs: 300,      price: 5,  label: '300 mensajes/mes',    unlimited: false },
    { msgs: 1000,     price: 11, label: '1,000 mensajes/mes',  unlimited: false },
    { msgs: Infinity, price: 25, label: 'Mensajes ilimitados', unlimited: true  },
  ];

  useEffect(() => {
    if (!isAuthenticated()) { router.replace('/login'); return; }
    setAuthed(true);
    // Check if returning from OAuth
    const params = new URLSearchParams(window.location.search);
    if (params.get('connected') === '1') {
      window.history.replaceState({}, '', '/autoconfirm');
    }
    if (params.get('error')) {
      setConnectError(decodeURIComponent(params.get('error')!));
      window.history.replaceState({}, '', '/autoconfirm');
    }
    loadStore();
    apiFetch('/autoconfirm/msg-usage').then(setMsgUsage).catch(() => null);
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
        setConfirmMsg(data.confirmMessage || '');
        setCancelMsg(data.cancelMessage || '');
        setAudioInitialMode(data.audioInitialMode || 'text_only');
        setAudioConfirmMode(data.audioConfirmMode || 'text');
        setAudioCancelMode(data.audioCancelMode || 'text');
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
    if (!shopInput.trim()) return;
    setConnecting(true);
    setConnectError('');
    try {
      const data = await apiFetch('/autoconfirm/shopify/oauth-url', {
        method: 'POST',
        body: JSON.stringify({ shopDomain: shopInput.trim() }),
      });
      window.location.href = data.url;
    } catch (err: any) {
      setConnectError(err.message || 'Error iniciando conexión');
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
        body: JSON.stringify({ messageTemplate: template, confirmMessage: confirmMsg, cancelMessage: cancelMsg, audioInitialMode, audioConfirmMode, audioCancelMode }),
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

      {/* Message usage */}
      {msgUsage && (() => {
        const { used, limit } = msgUsage;
        const unlimited = limit === -1;
        const pct = unlimited ? 0 : Math.min((used / limit) * 100, 100);
        const atLimit = !unlimited && used >= limit;
        const barColor = atLimit ? '#ef4444' : pct >= 75 ? '#fb923c' : '#a78bfa';
        return (
          <div className="rounded-2xl p-5 space-y-4"
            style={{ background: atLimit ? 'rgba(239,68,68,0.06)' : 'rgba(255,255,255,0.025)', border: `1px solid ${atLimit ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.06)'}` }}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-white">Mensajes este mes</p>
              <span className="text-sm font-bold" style={{ color: barColor }}>
                {used} / {unlimited ? '∞' : limit}
              </span>
            </div>
            {!unlimited && (
              <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: barColor }} />
              </div>
            )}
            {atLimit && (
              <div className="space-y-3 pt-1">
                <p className="text-xs text-red-400 font-medium">Alcanzaste el límite mensual. Activa un paquete para seguir enviando:</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {WA_PACKS.map(({ msgs, price, label, unlimited: ul }) => (
                    <a key={price}
                      href={`https://wa.me/18299607483?text=${encodeURIComponent(`Hola, quiero agregar el paquete de ${label} ($${price}/mes) a mi AutoConfirm de MOMENTUM`)}`}
                      target="_blank" rel="noopener noreferrer"
                      className="flex flex-col gap-1.5 p-4 rounded-xl text-center transition-all hover:opacity-90"
                      style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.25)' }}>
                      <span className="text-lg font-black text-white">${price}<span className="text-xs font-normal text-gray-500">/mes</span></span>
                      <span className="text-xs text-violet-300">{label}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })()}

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
                  onKeyDown={e => e.key === 'Enter' && connectShop()}
                />
              </div>
            </div>
            {connectError && <p className="text-xs text-red-400 flex items-center gap-1.5"><XCircle size={12} /> {connectError}</p>}
            <button
              onClick={connectShop}
              disabled={connecting || !shopInput}
              className="w-full py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)' }}
            >
              {connecting ? <><RefreshCw size={14} className="animate-spin" /> Redirigiendo...</> : 'Conectar con Shopify →'}
            </button>
          </div>

          <div className="rounded-2xl p-5 space-y-2" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <p className="text-xs font-medium text-gray-400">¿Cómo conectar?</p>
            <div className="space-y-1.5 text-xs text-gray-500">
              <p>1. Escribe tu dominio de Shopify arriba</p>
              <p>2. Click <span className="text-gray-300">"Conectar con Shopify"</span> — te redirige a Shopify</p>
              <p>3. Aprueba la instalación en Shopify</p>
              <p>4. Listo — vuelves aquí automáticamente</p>
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
            <div className="rounded-2xl p-5 space-y-5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <h2 className="text-sm font-medium text-white">Mensajes automáticos</h2>

              {/* Mensaje inicial */}
              <div className="space-y-2">
                <label className="text-xs text-gray-400 font-medium">📩 Mensaje inicial al recibir el pedido</label>
                <textarea
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-violet-500/50 resize-none"
                  rows={3}
                  value={template}
                  onChange={e => setTemplate(e.target.value)}
                  placeholder="¡Hola {{nombre}}! Tu pedido #{{numero}} en {{tienda}} fue recibido. 🛍️"
                />
                <div className="flex gap-2 pt-0.5">
                  {(['text_only', 'text_and_audio'] as const).map(mode => (
                    <button key={mode} onClick={() => setAudioInitialMode(mode)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                      style={audioInitialMode === mode
                        ? { background: 'rgba(139,92,246,0.2)', border: '1px solid rgba(139,92,246,0.5)', color: '#c4b5fd' }
                        : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#6b7280' }}>
                      {mode === 'text_only' ? '💬 Solo mensaje' : '💬🔊 Mensaje + audio'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mensaje confirmación */}
              <div className="space-y-2">
                <label className="text-xs text-emerald-400 font-medium">✅ Cuando el cliente confirma</label>
                <div className="flex gap-2">
                  {(['text', 'audio'] as const).map(mode => (
                    <button key={mode} onClick={() => setAudioConfirmMode(mode)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                      style={audioConfirmMode === mode
                        ? { background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.4)', color: '#6ee7b7' }
                        : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#6b7280' }}>
                      {mode === 'text' ? '💬 Mensaje de texto' : '🔊 Audio pregrabado'}
                    </button>
                  ))}
                </div>
                {audioConfirmMode === 'text' && (
                  <textarea
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/30 focus:border resize-none"
                    rows={2}
                    value={confirmMsg}
                    onChange={e => setConfirmMsg(e.target.value)}
                    placeholder="✅ ¡Perfecto {{nombre}}! Tu pedido #{{numero}} ha sido confirmado. Pronto te llegará. 🚀"
                  />
                )}
                {audioConfirmMode === 'audio' && (
                  <p className="text-xs text-gray-600 px-1">Se enviará el audio <span className="text-emerald-500">confirmacion.ogg</span> pregrabado.</p>
                )}
              </div>

              {/* Mensaje cancelación */}
              <div className="space-y-2">
                <label className="text-xs text-red-400 font-medium">❌ Cuando el cliente cancela</label>
                <div className="flex gap-2">
                  {(['text', 'audio'] as const).map(mode => (
                    <button key={mode} onClick={() => setAudioCancelMode(mode)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                      style={audioCancelMode === mode
                        ? { background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', color: '#fca5a5' }
                        : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#6b7280' }}>
                      {mode === 'text' ? '💬 Mensaje de texto' : '🔊 Audio pregrabado'}
                    </button>
                  ))}
                </div>
                {audioCancelMode === 'text' && (
                  <textarea
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-red-500/30 focus:border resize-none"
                    rows={2}
                    value={cancelMsg}
                    onChange={e => setCancelMsg(e.target.value)}
                    placeholder="❌ Tu pedido #{{numero}} ha sido cancelado. Si tienes dudas escríbenos. 😊"
                  />
                )}
                {audioCancelMode === 'audio' && (
                  <p className="text-xs text-gray-600 px-1">Se enviará el audio <span className="text-red-500">cancelacion.ogg</span> pregrabado.</p>
                )}
              </div>

              <p className="text-xs text-gray-600">Variables: <code className="text-violet-400">{'{{nombre}}'}</code> <code className="text-violet-400">{'{{numero}}'}</code> <code className="text-violet-400">{'{{tienda}}'}</code> <code className="text-violet-400">{'{{productos}}'}</code> <code className="text-violet-400">{'{{ciudad}}'}</code> <code className="text-violet-400">{'{{precio}}'}</code></p>
              <button
                onClick={saveTemplate}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)' }}
              >
                <Save size={14} />
                {saving ? 'Guardando...' : 'Guardar mensajes'}
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
