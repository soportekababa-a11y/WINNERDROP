'use client';

import { useState, useEffect } from 'react';
import { MessageCircle, Store, CheckCircle2, XCircle, AlertCircle, ExternalLink, Trash2, Save, RefreshCw, Key } from 'lucide-react';
import { getToken } from '@/lib/auth';

interface ShopifyStore {
  id: string;
  shopDomain: string;
  isActive: boolean;
  messageTemplate: string;
  whatsappTemplateName: string;
  whatsappLanguage: string;
  whatsappEnabled: boolean;
  whatsappPhoneNumberId: string;
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
  const [store, setStore] = useState<ShopifyStore | null>(null);
  const [logs, setLogs] = useState<OrderLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [shopInput, setShopInput] = useState('');
  const [tokenInput, setTokenInput] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState('');
  const [saving, setSaving] = useState(false);
  const [template, setTemplate] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [templateLang, setTemplateLang] = useState('es');
  const [waEnabled, setWaEnabled] = useState(false);
  const [waPhoneId, setWaPhoneId] = useState('');
  const [waToken, setWaToken] = useState('');

  useEffect(() => { loadStore(); }, []);

  async function loadStore() {
    setLoading(true);
    try {
      const data = await apiFetch('/autoconfirm/store');
      if (data) {
        setStore(data);
        setTemplate(data.messageTemplate);
        setTemplateName(data.whatsappTemplateName || '');
        setTemplateLang(data.whatsappLanguage || 'es');
        setWaEnabled(data.whatsappEnabled);
        setWaPhoneId(data.whatsappPhoneNumberId || '');
        loadLogs();
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
      await apiFetch('/autoconfirm/shopify/connect', {
        method: 'POST',
        body: JSON.stringify({ shopDomain: shopInput.trim(), accessToken: tokenInput.trim() }),
      });
      setShopInput('');
      setTokenInput('');
      await loadStore();
    } catch (err: any) {
      setConnectError(err.message || 'Token o dominio incorrecto');
    } finally {
      setConnecting(false);
    }
  }

  async function disconnect() {
    if (!confirm('¿Desconectar tienda? Se eliminará el webhook de Shopify.')) return;
    await apiFetch('/autoconfirm/store', { method: 'DELETE' });
    setStore(null);
    setLogs([]);
  }

  async function saveTemplate() {
    setSaving(true);
    try {
      await apiFetch('/autoconfirm/template', {
        method: 'PUT',
        body: JSON.stringify({ messageTemplate: template, whatsappTemplateName: templateName, whatsappLanguage: templateLang, whatsappEnabled: waEnabled, whatsappPhoneNumberId: waPhoneId, ...(waToken ? { whatsappAccessToken: waToken } : {}) }),
      });
      await loadStore();
    } finally {
      setSaving(false);
    }
  }

  const statusBadge = (status: string) => {
    if (status === 'sent') return <span className="flex items-center gap-1 text-xs text-emerald-400"><CheckCircle2 size={12} /> Enviado</span>;
    if (status === 'failed') return <span className="flex items-center gap-1 text-xs text-red-400"><XCircle size={12} /> Fallido</span>;
    return <span className="flex items-center gap-1 text-xs text-yellow-400"><AlertCircle size={12} /> Pendiente</span>;
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl" style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)' }}>
          <MessageCircle size={22} className="text-violet-400" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-white">AutoConfirm</h1>
          <p className="text-xs text-gray-500">Bot WhatsApp — confirmación automática de pedidos Shopify</p>
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

            {connectError && (
              <p className="text-xs text-red-400 flex items-center gap-1.5"><XCircle size={12} /> {connectError}</p>
            )}

            <button
              onClick={connectShop}
              disabled={connecting || !shopInput || !tokenInput}
              className="w-full py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)' }}
            >
              {connecting ? <><RefreshCw size={14} className="animate-spin" /> Verificando...</> : 'Conectar tienda'}
            </button>
          </div>

          {/* Instructions */}
          <div className="rounded-2xl p-5 space-y-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <p className="text-xs font-medium text-gray-400">¿Cómo obtener el Access Token?</p>
            <div className="space-y-3 text-xs text-gray-500">
              <div className="flex gap-3">
                <span className="w-5 h-5 rounded-full bg-violet-500/20 text-violet-400 flex items-center justify-center shrink-0">1</span>
                <p>Ve a tu Shopify Admin → <span className="text-gray-300">Configuración → Apps y canales de ventas</span></p>
              </div>
              <div className="flex gap-3">
                <span className="w-5 h-5 rounded-full bg-violet-500/20 text-violet-400 flex items-center justify-center shrink-0">2</span>
                <p>Clic en <span className="text-gray-300">Desarrollar apps</span> → <span className="text-gray-300">Crear una app</span></p>
              </div>
              <div className="flex gap-3">
                <span className="w-5 h-5 rounded-full bg-violet-500/20 text-violet-400 flex items-center justify-center shrink-0">3</span>
                <p>Nombre: <span className="text-gray-300">AutoConfirm</span> → Configurar permisos de Admin API → activar <span className="text-gray-300">read_orders</span></p>
              </div>
              <div className="flex gap-3">
                <span className="w-5 h-5 rounded-full bg-violet-500/20 text-violet-400 flex items-center justify-center shrink-0">4</span>
                <p>Clic <span className="text-gray-300">Instalar app</span> → copia el <span className="text-gray-300">Admin API access token</span> (empieza con <code className="text-violet-400">shpat_</code>)</p>
              </div>
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
                  <p className="text-xs text-gray-500">Conectado · webhook activo</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a href={`https://${store.shopDomain}/admin`} target="_blank" rel="noopener noreferrer"
                  className="p-2 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-all">
                  <ExternalLink size={14} />
                </a>
                <button onClick={disconnect}
                  className="p-2 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-all">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* ─── Template editor ─── */}
            <div className="rounded-2xl p-5 space-y-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <h2 className="text-sm font-medium text-white">Mensaje automático</h2>

              <div className="space-y-1.5">
                <label className="text-xs text-gray-500">Texto del mensaje (preview)</label>
                <textarea
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-violet-500/50 resize-none"
                  rows={4}
                  value={template}
                  onChange={e => setTemplate(e.target.value)}
                  placeholder="¡Hola {{nombre}}! Tu pedido #{{numero}} en {{tienda}} fue confirmado. 🛍️"
                />
                <p className="text-xs text-gray-600">Variables: <code className="text-violet-400">{'{{nombre}}'}</code> <code className="text-violet-400">{'{{numero}}'}</code> <code className="text-violet-400">{'{{tienda}}'}</code></p>
              </div>

              <div className="space-y-3 pt-3 border-t border-white/5">
                <p className="text-xs font-medium text-gray-400">WhatsApp Meta Cloud API</p>
                <div className="space-y-1.5">
                  <label className="text-xs text-gray-500">Nombre del template aprobado en Meta</label>
                  <input
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-violet-500/50"
                    placeholder="order_confirmation"
                    value={templateName}
                    onChange={e => setTemplateName(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-gray-500">Idioma</label>
                  <input
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-violet-500/50"
                    placeholder="es"
                    value={templateLang}
                    onChange={e => setTemplateLang(e.target.value)}
                  />
                </div>
                <div className="flex items-center justify-between py-1">
                  <div>
                    <p className="text-xs text-white">Activar envío real</p>
                    <p className="text-xs text-gray-600">Requiere credenciales WhatsApp en el servidor</p>
                  </div>
                  <button onClick={() => setWaEnabled(!waEnabled)}
                    className={`w-11 h-6 rounded-full transition-colors relative ${waEnabled ? 'bg-violet-600' : 'bg-white/10'}`}>
                    <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${waEnabled ? 'left-[22px]' : 'left-0.5'}`} />
                  </button>
                </div>
              </div>

              <button onClick={saveTemplate} disabled={saving}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white transition-all disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)' }}>
                <Save size={14} />
                {saving ? 'Guardando...' : 'Guardar configuración'}
              </button>
            </div>

            {/* ─── WhatsApp credentials ─── */}
            <div className="rounded-2xl p-5 space-y-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div>
                <h2 className="text-sm font-medium text-white">Tu número WhatsApp Business</h2>
                <p className="text-xs text-gray-500 mt-0.5">Los mensajes salen desde tu número — el cliente lo ve como si tú se lo mandaras</p>
              </div>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs text-gray-500">Phone Number ID <span className="text-gray-700">(de Meta Developers)</span></label>
                  <input
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-violet-500/50"
                    placeholder="123456789012345"
                    value={waPhoneId}
                    onChange={e => setWaPhoneId(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-gray-500">Access Token <span className="text-gray-700">(déjalo vacío para no cambiar)</span></label>
                  <input
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-violet-500/50"
                    placeholder="EAAxxxxxxx..."
                    value={waToken}
                    onChange={e => setWaToken(e.target.value)}
                    type="password"
                  />
                </div>
              </div>

              <div className="rounded-xl p-3 space-y-2 text-xs" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                <p className="text-gray-400 font-medium">¿Cómo obtener estas credenciales?</p>
                <p className="text-gray-600">1. Ve a <span className="text-gray-400">developers.facebook.com</span> → crear app → agregar WhatsApp</p>
                <p className="text-gray-600">2. En WhatsApp → Getting Started → copia <span className="text-gray-400">Phone Number ID</span> y <span className="text-gray-400">Temporary access token</span></p>
                <p className="text-gray-600">3. Para token permanente: Meta Business → System Users → generar token</p>
                <p className="text-gray-600">4. Crea template en Meta Business → WhatsApp → Message Templates</p>
              </div>

              <div className="rounded-xl p-3" style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)' }}>
                <p className="text-violet-300 text-xs font-medium">Gratis hasta 1,000 mensajes/mes por número</p>
                <p className="text-gray-500 text-xs mt-0.5">Después: ~$0.015 por confirmación de pedido</p>
              </div>
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
  );
}
