'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Globe, Plus, X, Play, Trash2, ArrowLeft, Sparkles, Loader2, CheckCircle, AlertCircle, Send, Zap, Lock, ChevronDown } from 'lucide-react';
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

interface AdFile { file: File; preview: string; type: 'image' | 'video' }
interface Message { role: 'user' | 'assistant'; content: string }

const glass = { background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' };
const inputClass = 'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-violet-500/50';
const selectStyle = { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: '#e2e8f0' };

const INITIAL_MESSAGE: Message = {
  role: 'assistant',
  content: '¡Hola! 👋 Soy tu asistente de Meta Ads. Cuéntame sobre el producto que quieres anunciar — puedes darme todo de una vez:\n\n• Nombre y descripción del producto\n• Precio (antes y después si hay descuento)\n• URL de tu landing page\n• País donde publicar\n• Presupuesto diario en USD\n• Objetivo (ventas, tráfico, leads, mensajes)\n• ABO o CBO, cuántos conjuntos\n\n¡O simplemente descríbemelo y yo pregunto lo que falta! 🚀',
};

export default function MetaAdsPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<'connect' | 'setup' | 'chat' | 'creating' | 'done'>('connect');
  const [error, setError] = useState('');

  // Setup
  const [adAccounts, setAdAccounts] = useState<any[]>([]);
  const [pages, setPages] = useState<any[]>([]);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [selectedAccountName, setSelectedAccountName] = useState('');
  const [selectedPage, setSelectedPage] = useState('');
  const [selectedPageName, setSelectedPageName] = useState('');

  // Chat
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [campaignData, setCampaignData] = useState<any>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Files
  const [adFiles, setAdFiles] = useState<AdFile[]>([]);
  const [playingVideo, setPlayingVideo] = useState<number | null>(null);
  const videoRefs = useRef<Record<number, HTMLVideoElement | null>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Result
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    if (!isAuthenticated()) { router.replace('/login'); return; }
    setAuthed(true);
    loadStatus();
    const params = new URLSearchParams(window.location.search);
    if (params.get('connected') === '1') window.history.replaceState({}, '', '/meta-ads');
    if (params.get('error')) { setError('Error conectando Facebook. Intenta de nuevo.'); window.history.replaceState({}, '', '/meta-ads'); }
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, thinking]);

  async function loadStatus() {
    setLoading(true);
    try {
      const s = await apiFetch('/meta-ads/status');
      setStatus(s);
      if (s.connected) setStep(s.adAccountId && s.pageId ? 'chat' : 'setup');
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

  async function sendMessage() {
    const text = input.trim();
    if (!text || thinking) return;
    const userMsg: Message = { role: 'user', content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setThinking(true);
    setError('');

    try {
      const res = await apiFetch('/meta-ads/chat', {
        method: 'POST',
        body: JSON.stringify({ messages: newMessages }),
      });
      const aiMsg: Message = { role: 'assistant', content: res.message };
      setMessages(prev => [...prev, aiMsg]);
      if (res.ready && res.data) {
        setCampaignData(res.data);
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Error procesando tu mensaje. Intenta de nuevo.' }]);
    } finally {
      setThinking(false);
    }
  }

  async function createCampaign() {
    if (!campaignData || adFiles.length === 0) return;
    setStep('creating');
    setError('');
    try {
      const form = new FormData();
      Object.entries(campaignData).forEach(([k, v]) => {
        if (Array.isArray(v)) form.append(k, JSON.stringify(v));
        else if (v !== undefined && v !== null && v !== '') form.append(k, String(v));
      });
      form.append('audienceAdSets', JSON.stringify([]));
      form.append('copys', JSON.stringify([]));
      adFiles.forEach(a => form.append('files', a.file));

      const res = await apiFetch('/meta-ads/campaigns', { method: 'POST', body: form });
      setResult(res);
      if (res?.credits !== undefined) setStatus((prev: any) => ({ ...prev, credits: res.credits }));
      setStep('done');
    } catch (e: any) {
      setError(e.message || 'Error creando campaña');
      setStep('chat');
    }
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

  function resetChat() {
    setMessages([INITIAL_MESSAGE]);
    setCampaignData(null);
    setAdFiles([]);
    setResult(null);
    setError('');
    setStep('chat');
  }

  if (!authed) return null;

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
                <p className="text-xs text-gray-500">Campañas profesionales con IA conversacional</p>
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
                  <div>
                    <h2 className="text-lg font-semibold text-white">Conecta tu cuenta de Facebook</h2>
                    <p className="text-sm text-gray-500 mt-1">Necesario para crear campañas en tu cuenta publicitaria</p>
                  </div>
                  <button onClick={() => apiFetch('/meta-ads/auth-url').then(r => { window.location.href = r.url; })}
                    className="mx-auto flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium text-white"
                    style={{ background: 'linear-gradient(135deg, #1877f2, #0c5fc7)' }}>
                    <Globe size={16} /> Conectar con Facebook
                  </button>
                </div>
              )}

              {/* ── SETUP ── */}
              {step === 'setup' && (
                <div className="rounded-2xl p-6 space-y-5" style={glass}>
                  <div className="flex items-center gap-2"><CheckCircle size={16} className="text-emerald-400" /><p className="text-sm text-emerald-400 font-medium">Facebook conectado</p></div>
                  <h2 className="text-base font-semibold text-white">Configura tu cuenta</h2>
                  <div className="space-y-1.5">
                    <label className="text-xs text-gray-500">Cuenta publicitaria</label>
                    <select className={inputClass} value={selectedAccount} onChange={e => { const a = adAccounts.find(x => x.id === e.target.value); setSelectedAccount(e.target.value); setSelectedAccountName(a?.name ?? ''); }}>
                      <option value="">Seleccionar cuenta...</option>
                      {adAccounts.map(a => <option key={a.id} value={a.id}>{a.name} ({a.id})</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-gray-500">Página de Facebook</label>
                    <select className={inputClass} value={selectedPage} onChange={e => { const p = pages.find(x => x.id === e.target.value); setSelectedPage(e.target.value); setSelectedPageName(p?.name ?? ''); }}>
                      <option value="">Seleccionar página...</option>
                      {pages.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <button onClick={async () => {
                    await apiFetch('/meta-ads/select-account', { method: 'POST', body: JSON.stringify({ adAccountId: selectedAccount, adAccountName: selectedAccountName }) });
                    await apiFetch('/meta-ads/select-page', { method: 'POST', body: JSON.stringify({ pageId: selectedPage, pageName: selectedPageName }) });
                    setStep('chat');
                  }} disabled={!selectedAccount || !selectedPage}
                    className="w-full py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-50"
                    style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)' }}>
                    Continuar →
                  </button>
                </div>
              )}

              {/* ── CHAT ── */}
              {step === 'chat' && (
                <div className="space-y-4">
                  {/* Account info bar */}
                  <div className="flex items-center justify-between text-xs text-gray-600 px-1">
                    <span>{status?.adAccountName ?? 'Cuenta conectada'}</span>
                    <button onClick={() => { loadAccounts(); setStep('setup'); }} className="hover:text-gray-400 transition-colors">Cambiar cuenta</button>
                  </div>

                  {/* Chat window */}
                  <div className="rounded-2xl overflow-hidden flex flex-col" style={{ ...glass, minHeight: 400, maxHeight: 520 }}>
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                      {messages.map((msg, i) => (
                        <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                          {msg.role === 'assistant' && (
                            <div className="w-6 h-6 rounded-full flex items-center justify-center mr-2 mt-0.5 shrink-0"
                              style={{ background: 'rgba(139,92,246,0.2)', border: '1px solid rgba(139,92,246,0.4)' }}>
                              <Sparkles size={11} className="text-violet-400" />
                            </div>
                          )}
                          <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                            msg.role === 'user'
                              ? 'text-white rounded-tr-sm'
                              : 'text-gray-200 rounded-tl-sm'
                          }`} style={msg.role === 'user'
                            ? { background: 'rgba(139,92,246,0.3)', border: '1px solid rgba(139,92,246,0.4)' }
                            : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                            {msg.content}
                          </div>
                        </div>
                      ))}
                      {thinking && (
                        <div className="flex justify-start">
                          <div className="w-6 h-6 rounded-full flex items-center justify-center mr-2 shrink-0"
                            style={{ background: 'rgba(139,92,246,0.2)', border: '1px solid rgba(139,92,246,0.4)' }}>
                            <Sparkles size={11} className="text-violet-400" />
                          </div>
                          <div className="px-4 py-2.5 rounded-2xl rounded-tl-sm text-sm text-gray-500"
                            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                            <span className="animate-pulse">Analizando...</span>
                          </div>
                        </div>
                      )}
                      <div ref={chatEndRef} />
                    </div>

                    {/* Input */}
                    <div className="border-t border-white/05 p-3 flex gap-2 items-end">
                      <textarea
                        ref={textareaRef}
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                        placeholder="Describe tu producto, presupuesto, país... (Enter para enviar)"
                        rows={2}
                        className="flex-1 bg-transparent text-sm text-white placeholder-gray-600 resize-none focus:outline-none leading-relaxed"
                        style={{ minHeight: 44 }}
                      />
                      <button onClick={sendMessage} disabled={!input.trim() || thinking}
                        className="p-2.5 rounded-xl flex items-center justify-center transition-all disabled:opacity-40"
                        style={{ background: 'rgba(139,92,246,0.3)', border: '1px solid rgba(139,92,246,0.5)' }}>
                        <Send size={15} className="text-violet-300" />
                      </button>
                    </div>
                  </div>

                  {/* Ready: show file upload */}
                  {campaignData && (
                    <div className="space-y-4">
                      {/* Campaign summary */}
                      <div className="rounded-xl p-4 text-xs space-y-1.5" style={{ background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.2)' }}>
                        <p className="text-violet-300 font-semibold mb-2">✅ Campaña lista para crear</p>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-gray-400">
                          <span>Producto: <span className="text-white">{campaignData.productName}</span></span>
                          <span>País: <span className="text-white">{campaignData.country}</span></span>
                          <span>Presupuesto: <span className="text-white">${campaignData.dailyBudget}/día</span></span>
                          <span>Objetivo: <span className="text-white">{campaignData.campaignType}</span></span>
                          <span>Estructura: <span className="text-white">{campaignData.budgetType} · {campaignData.adSetsCount} conjunto(s)</span></span>
                          {campaignData.priceAfter && <span>Precio: <span className="text-white">{campaignData.priceBefore && <span className="line-through text-gray-600 mr-1">{campaignData.priceBefore}</span>}{campaignData.priceAfter}</span></span>}
                        </div>
                        <button onClick={() => setCampaignData(null)} className="text-gray-600 hover:text-gray-400 text-[10px] mt-1">✏️ Cambiar datos</button>
                      </div>

                      {/* File upload */}
                      <div className="space-y-3">
                        <p className="text-sm font-semibold text-white">Sube tus creativos</p>
                        <div className="rounded-xl p-3 text-xs" style={{ background: 'rgba(234,179,8,0.06)', border: '1px solid rgba(234,179,8,0.15)' }}>
                          <p className="text-yellow-300 font-medium">📐 Formatos recomendados</p>
                          <p className="text-gray-400 mt-0.5">Imagen: 1080×1080 o 1080×1920 · Video: MP4 1080p, 9:16 para Reels</p>
                        </div>

                        <div className="flex flex-wrap gap-3">
                          {adFiles.map((ad, idx) => (
                            <div key={idx} className="relative flex flex-col items-center">
                              <div className="relative rounded-[1.5rem] overflow-hidden" style={{ width: 100, height: 170, background: '#0a0a14', border: '2px solid rgba(255,255,255,0.12)' }}>
                                <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-8 h-2 rounded-full z-10" style={{ background: '#020209' }} />
                                <div className="w-full h-full flex items-center justify-center overflow-hidden">
                                  {ad.type === 'image' ? (
                                    <img src={ad.preview} alt="" className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="relative w-full h-full cursor-pointer" onClick={() => { const el = videoRefs.current[idx]; if (!el) return; el.paused ? (el.play(), setPlayingVideo(idx)) : (el.pause(), setPlayingVideo(null)); }}>
                                      <video src={ad.preview} className="w-full h-full object-cover" loop playsInline muted ref={el => { videoRefs.current[idx] = el; }} />
                                      {playingVideo !== idx && <div className="absolute inset-0 flex items-center justify-center"><div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}><Play size={10} className="text-white ml-0.5" /></div></div>}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <button onClick={() => removeAd(idx)} className="mt-1 p-1 text-gray-600 hover:text-red-400 transition-all"><Trash2 size={10} /></button>
                            </div>
                          ))}
                          {adFiles.length < 10 && (
                            <div onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center cursor-pointer">
                              <div className="flex items-center justify-center rounded-[1.5rem] transition-all hover:border-violet-500/40"
                                style={{ width: 100, height: 170, background: 'rgba(255,255,255,0.02)', border: '2px dashed rgba(255,255,255,0.1)' }}>
                                <div className="flex flex-col items-center gap-1 text-gray-600"><Plus size={16} /><span className="text-[10px]">Agregar</span></div>
                              </div>
                            </div>
                          )}
                        </div>
                        <input ref={fileInputRef} type="file" multiple accept="image/*,video/*" className="hidden" onChange={e => handleFileAdd(e.target.files)} />
                      </div>

                      {/* Create button */}
                      {(status?.credits ?? 0) === 0 ? (
                        <div className="rounded-xl p-4" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
                          <p className="text-sm text-red-400">Sin créditos — <a href="https://wa.me/18299607483" target="_blank" rel="noopener noreferrer" className="underline">recarga aquí</a></p>
                        </div>
                      ) : (
                        <button onClick={createCampaign} disabled={adFiles.length === 0}
                          className="w-full py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-40 flex items-center justify-center gap-2"
                          style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)' }}>
                          <Zap size={16} /> Crear campaña — 1 crédito
                          {adFiles.length === 0 && <span className="text-xs text-violet-300 ml-1">(sube al menos 1 creativo)</span>}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ── CREATING ── */}
              {step === 'creating' && (
                <div className="flex flex-col items-center py-24 gap-5">
                  <div className="w-16 h-16 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                  <div className="text-center space-y-2">
                    <p className="text-white font-semibold">Creando tu campaña en Meta...</p>
                    <p className="text-xs text-gray-500">La IA genera audiencias · copy · creativos → Meta Ads</p>
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
                    <p className="text-gray-400">Conjuntos: <span className="text-emerald-400">{result.campaign?.adSetIds?.length ?? 0}</span></p>
                    <p className="text-gray-400">Anuncios: <span className="text-emerald-400">{result.campaign?.adIds?.length ?? 0}</span></p>
                  </div>
                  <div className="rounded-xl p-3 text-xs text-gray-500" style={{ background: 'rgba(255,255,255,0.02)' }}>
                    <p className="text-yellow-400 font-medium">⏱ Espera 72h antes de evaluar</p>
                    <p className="mt-1">Meta necesita tiempo para salir del learning phase. No hagas cambios en ese periodo.</p>
                  </div>
                  <button onClick={resetChat}
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
