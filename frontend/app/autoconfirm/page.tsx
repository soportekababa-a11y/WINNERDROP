'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { MessageCircle, Store, CheckCircle2, XCircle, AlertCircle, ExternalLink, Trash2, Save, RefreshCw } from 'lucide-react';
import { getToken } from '@/lib/auth';

interface ShopifyStore {
  id: string;
  shopDomain: string;
  isActive: boolean;
  messageTemplate: string;
  whatsappTemplateName: string;
  whatsappLanguage: string;
  whatsappEnabled: boolean;
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
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options?.headers },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw err;
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

export default function AutoConfirmPage() {
  const searchParams = useSearchParams();
  const [store, setStore] = useState<ShopifyStore | null>(null);
  const [logs, setLogs] = useState<OrderLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [shopInput, setShopInput] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [template, setTemplate] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [templateLang, setTemplateLang] = useState('es');
  const [waEnabled, setWaEnabled] = useState(false);

  useEffect(() => {
    loadStore();
  }, []);

  useEffect(() => {
    if (searchParams.get('connected') === 'true') {
      loadStore();
    }
  }, [searchParams]);

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
      const data = await apiFetch('/autoconfirm/logs?limit=20');
      setLogs(data || []);
    } catch { /* ignore */ }
  }

  async function connectShop() {
    let shop = shopInput.trim();
    if (!shop) return;
    if (!shop.includes('.myshopify.com')) shop = `${shop}.myshopify.com`;
    setConnecting(true);
    try {
      const data = await apiFetch(`/autoconfirm/shopify/install?shop=${shop}`);
      window.location.href = data.url;
    } catch (err: any) {
      alert(err.message || 'Error al conectar');
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
        body: JSON.stringify({ messageTemplate: template, whatsappTemplateName: templateName, whatsappLanguage: templateLang, whatsappEnabled: waEnabled }),
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
          <p className="text-xs text-gray-500">Bot WhatsApp — confirmación automática de pedidos</p>
        </div>
      </div>

      {!store ? (
        /* ─── Connect store ─── */
        <div className="max-w-lg">
          <div className="rounded-2xl p-6 space-y-5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex items-center gap-3">
              <Store size={18} className="text-gray-400" />
              <h2 className="text-sm font-medium text-white">Conectar tienda Shopify</h2>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">
              Conecta tu tienda para activar el bot. Cuando llegue un pedido, el bot enviará automáticamente un mensaje de confirmación al WhatsApp del cliente.
            </p>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <input
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-violet-500/50"
                  placeholder="mi-tienda o mi-tienda.myshopify.com"
                  value={shopInput}
                  onChange={e => setShopInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && connectShop()}
                />
              </div>
              <button
                onClick={connectShop}
                disabled={connecting || !shopInput}
                className="px-4 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-50 transition-all"
                style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)' }}
              >
                {connecting ? <RefreshCw size={14} className="animate-spin" /> : 'Conectar'}
              </button>
            </div>
            <div className="rounded-xl p-4 text-xs text-gray-500 space-y-1.5" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
              <p className="text-gray-400 font-medium">¿Cómo funciona?</p>
              <p>1. Conectas tu tienda Shopify con OAuth</p>
              <p>2. El bot se registra como webhook en tu tienda</p>
              <p>3. Cuando llega un pedido → bot manda WhatsApp al cliente automáticamente</p>
              <p>4. Configuras el mensaje a tu gusto con variables como <code className="text-violet-400">{'{{nombre}}'}</code>, <code className="text-violet-400">{'{{numero}}'}</code>, <code className="text-violet-400">{'{{tienda}}'}</code></p>
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
                <a
                  href={`https://${store.shopDomain}/admin`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-all"
                >
                  <ExternalLink size={14} />
                </a>
                <button
                  onClick={disconnect}
                  className="p-2 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-all"
                >
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
                <label className="text-xs text-gray-500">Texto del mensaje</label>
                <textarea
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-violet-500/50 resize-none"
                  rows={4}
                  value={template}
                  onChange={e => setTemplate(e.target.value)}
                  placeholder="¡Hola {{nombre}}! Tu pedido #{{numero}} en {{tienda}} fue confirmado. 🛍️"
                />
                <p className="text-xs text-gray-600">Variables: <code className="text-violet-400">{'{{nombre}}'}</code> <code className="text-violet-400">{'{{numero}}'}</code> <code className="text-violet-400">{'{{tienda}}'}</code></p>
              </div>

              <div className="space-y-3 pt-2 border-t border-white/5">
                <p className="text-xs font-medium text-gray-400">WhatsApp Meta Cloud API</p>
                <div className="space-y-1.5">
                  <label className="text-xs text-gray-500">Nombre del template (Meta Business)</label>
                  <input
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-violet-500/50"
                    placeholder="order_confirmation"
                    value={templateName}
                    onChange={e => setTemplateName(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-gray-500">Idioma del template</label>
                  <input
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-violet-500/50"
                    placeholder="es"
                    value={templateLang}
                    onChange={e => setTemplateLang(e.target.value)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-white">Activar envío real</p>
                    <p className="text-xs text-gray-600">Requiere WHATSAPP_ACCESS_TOKEN configurado</p>
                  </div>
                  <button
                    onClick={() => setWaEnabled(!waEnabled)}
                    className={`w-11 h-6 rounded-full transition-colors relative ${waEnabled ? 'bg-violet-600' : 'bg-white/10'}`}
                  >
                    <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${waEnabled ? 'translate-x-5.5 left-0.5' : 'left-0.5'}`} />
                  </button>
                </div>
              </div>

              <button
                onClick={saveTemplate}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white transition-all disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)' }}
              >
                <Save size={14} />
                {saving ? 'Guardando...' : 'Guardar configuración'}
              </button>
            </div>

            {/* ─── Setup guide ─── */}
            <div className="rounded-2xl p-5 space-y-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <h2 className="text-sm font-medium text-white">Configurar WhatsApp</h2>
              <div className="space-y-3 text-xs text-gray-500">
                <div className="flex gap-3">
                  <span className="w-5 h-5 rounded-full bg-violet-500/20 text-violet-400 flex items-center justify-center text-xs shrink-0">1</span>
                  <div>
                    <p className="text-gray-300">Crear cuenta Meta Business</p>
                    <p>Ve a business.facebook.com → crear cuenta de negocio</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <span className="w-5 h-5 rounded-full bg-violet-500/20 text-violet-400 flex items-center justify-center text-xs shrink-0">2</span>
                  <div>
                    <p className="text-gray-300">Configurar WhatsApp Business API</p>
                    <p>En Meta Developers → crear app → WhatsApp → obtener Phone Number ID y Token</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <span className="w-5 h-5 rounded-full bg-violet-500/20 text-violet-400 flex items-center justify-center text-xs shrink-0">3</span>
                  <div>
                    <p className="text-gray-300">Crear template de mensaje</p>
                    <p>En Meta Business → WhatsApp → Message Templates → crear template con variables: {'{{1}}'} nombre, {'{{2}}'} #orden, {'{{3}}'} tienda</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <span className="w-5 h-5 rounded-full bg-violet-500/20 text-violet-400 flex items-center justify-center text-xs shrink-0">4</span>
                  <div>
                    <p className="text-gray-300">Agregar credenciales al servidor</p>
                    <p>En el servidor editar <code className="text-violet-400">/opt/winnerdrop/backend/.env</code> con WHATSAPP_ACCESS_TOKEN y WHATSAPP_PHONE_NUMBER_ID</p>
                  </div>
                </div>
                <div className="rounded-xl p-3 mt-2" style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)' }}>
                  <p className="text-violet-300 font-medium">Gratis hasta 1,000 conversaciones/mes</p>
                  <p className="text-gray-500 mt-0.5">Después: ~$0.015 por confirmación de pedido</p>
                </div>
              </div>
            </div>
          </div>

          {/* ─── Order logs ─── */}
          <div className="rounded-2xl p-5 space-y-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-white">Pedidos recientes</h2>
              <button onClick={loadLogs} className="p-1.5 rounded-lg text-gray-600 hover:text-gray-300 hover:bg-white/5 transition-all">
                <RefreshCw size={13} />
              </button>
            </div>

            {logs.length === 0 ? (
              <p className="text-xs text-gray-600 text-center py-6">No hay pedidos aún. Cuando llegue uno aparecerá aquí.</p>
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
