'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { isAuthenticated, getToken } from '@/lib/auth';
import { Sidebar } from '@/components/sidebar';
import { cn } from '@/lib/utils';
import { Upload, CheckSquare, Square, Zap, Download, RefreshCw, Film, Mic, MicOff } from 'lucide-react';

type Step = 'input' | 'analyzing' | 'hooks' | 'generating' | 'results';

interface HookItem { type: string; text: string; }
interface AnalysisResult {
  adType: string;
  retentionLevel: string;
  marketingAngle: string;
  hooks: HookItem[];
}
interface VideoResult {
  hookText: string;
  hookType: string;
  filename: string;
  url: string;
}

const TYPE_COLORS: Record<string, { bg: string; color: string }> = {
  'Curiosidad': { bg: 'rgba(251,191,36,0.1)', color: '#fbbf24' },
  'Problema':   { bg: 'rgba(239,68,68,0.1)',  color: '#f87171' },
  'Shock':      { bg: 'rgba(168,85,247,0.12)', color: '#c084fc' },
  'Beneficio':  { bg: 'rgba(52,211,153,0.1)',  color: '#34d399' },
  'UGC Viral':  { bg: 'rgba(96,165,250,0.1)',  color: '#60a5fa' },
};
const RETENTION_COLOR: Record<string, string> = {
  'Alto': '#34d399', 'Medio': '#fbbf24', 'Bajo': '#f87171',
};

const glass = { background: 'rgba(255,255,255,0.025)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.07)' };

export default function HookInjectorPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [step, setStep] = useState<Step>('input');

  // Input state
  const [productName, setProductName] = useState('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [enableVoice, setEnableVoice] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Results state
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [selectedHooks, setSelectedHooks] = useState<HookItem[]>([]);
  const [videos, setVideos] = useState<VideoResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated()) router.replace('/login');
    else setAuthed(true);
  }, [router]);

  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith('video/')) {
      setError('Solo se aceptan archivos de video');
      return;
    }
    setVideoFile(file);
    setError(null);
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, []);

  const toggleHook = (hook: HookItem) => {
    setSelectedHooks(prev => {
      const exists = prev.some(h => h.text === hook.text);
      if (exists) return prev.filter(h => h.text !== hook.text);
      if (prev.length >= 3) return prev;
      return [...prev, hook];
    });
  };

  const handleAnalyze = async () => {
    if (!videoFile || !productName.trim()) return;
    setError(null);
    setStep('analyzing');
    try {
      const form = new FormData();
      form.append('video', videoFile);
      form.append('productName', productName.trim());
      const res = await fetch('/api/proxy/hook-injector/analyze', {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
        body: form,
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({ message: 'Error desconocido' }));
        throw new Error(e.message ?? `Error ${res.status}`);
      }
      const data: AnalysisResult = await res.json();
      setAnalysis(data);
      setSelectedHooks([]);
      setStep('hooks');
    } catch (e: any) {
      setError(e.message);
      setStep('input');
    }
  };

  const handleGenerate = async () => {
    if (!videoFile || selectedHooks.length === 0) return;
    setError(null);
    setStep('generating');
    try {
      const form = new FormData();
      form.append('video', videoFile);
      form.append('hooks', JSON.stringify(selectedHooks));
      form.append('enableVoice', String(enableVoice));
      const res = await fetch('/api/proxy/hook-injector/generate', {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
        body: form,
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({ message: 'Error desconocido' }));
        throw new Error(e.message ?? `Error ${res.status}`);
      }
      const { videos: vids }: { videos: VideoResult[] } = await res.json();
      setVideos(vids);
      setStep('results');
    } catch (e: any) {
      setError(e.message);
      setStep('hooks');
    }
  };

  const reset = () => {
    setStep('input');
    setVideoFile(null);
    setProductName('');
    setAnalysis(null);
    setSelectedHooks([]);
    setVideos([]);
    setError(null);
  };

  if (!authed) return null;

  return (
    <div className="min-h-screen bg-[#020209] flex">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 max-w-3xl w-full mx-auto px-6 py-10 space-y-8">

          {/* Header */}
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="text-3xl">🎬</span>
              <h1 className="text-2xl font-bold text-white tracking-tight">Hook Injector AI</h1>
            </div>
            <p className="text-gray-600 text-sm ml-12">
              Analiza tu anuncio y genera videos optimizados con hooks virales para TikTok y Reels
            </p>
          </div>

          {/* Progress steps */}
          <div className="flex items-center gap-2">
            {(['input', 'hooks', 'results'] as const).map((s, i) => {
              const labels = ['Subir video', 'Seleccionar hooks', 'Videos listos'];
              const idx = ['input', 'hooks', 'results'].indexOf(step === 'analyzing' ? 'input' : step === 'generating' ? 'hooks' : step);
              const done = i < idx;
              const active = i === idx;
              return (
                <div key={s} className="flex items-center gap-2">
                  {i > 0 && <div className="w-8 h-px" style={{ background: done ? '#7c3aed' : 'rgba(255,255,255,0.08)' }} />}
                  <div className="flex items-center gap-1.5">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                      style={{
                        background: done ? '#7c3aed' : active ? 'rgba(124,58,237,0.2)' : 'rgba(255,255,255,0.04)',
                        border: active ? '1px solid rgba(139,92,246,0.5)' : done ? '1px solid #7c3aed' : '1px solid rgba(255,255,255,0.08)',
                        color: done || active ? '#a78bfa' : '#4b5563',
                      }}>
                      {done ? '✓' : i + 1}
                    </div>
                    <span className="text-xs font-medium" style={{ color: active ? '#a78bfa' : done ? '#7c3aed' : '#4b5563' }}>
                      {labels[i]}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-xl px-4 py-3 text-sm" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
              {error}
            </div>
          )}

          {/* ── STEP: INPUT ──────────────────────────────────────────── */}
          {(step === 'input' || step === 'analyzing') && (
            <div className="space-y-5">
              <div className="rounded-2xl p-6 space-y-5" style={glass}>
                {/* Product name */}
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">Nombre del producto</label>
                  <input
                    type="text"
                    placeholder="ej. Masajeador cervical eléctrico"
                    value={productName}
                    onChange={e => setProductName(e.target.value)}
                    disabled={step === 'analyzing'}
                    className="w-full px-4 py-3 rounded-xl text-white text-sm outline-none transition-all placeholder-gray-700 disabled:opacity-50"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
                    onFocus={e => { e.target.style.border = '1px solid rgba(139,92,246,0.5)'; }}
                    onBlur={e => { e.target.style.border = '1px solid rgba(255,255,255,0.07)'; }}
                  />
                </div>

                {/* Video upload */}
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">Video del anuncio</label>
                  <div
                    onDragOver={e => { e.preventDefault(); setDragging(true); }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={onDrop}
                    onClick={() => fileRef.current?.click()}
                    className="cursor-pointer rounded-xl transition-all duration-200"
                    style={{
                      border: `2px dashed ${dragging ? 'rgba(139,92,246,0.6)' : videoFile ? 'rgba(52,211,153,0.4)' : 'rgba(255,255,255,0.1)'}`,
                      background: dragging ? 'rgba(139,92,246,0.05)' : 'rgba(255,255,255,0.02)',
                      padding: '24px',
                    }}
                  >
                    {videoFile ? (
                      <div className="flex items-center gap-3">
                        <Film size={20} className="text-emerald-400 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-emerald-300">{videoFile.name}</p>
                          <p className="text-xs text-gray-600">{(videoFile.size / 1024 / 1024).toFixed(1)} MB</p>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center">
                        <Upload size={24} className="mx-auto text-gray-700 mb-2" />
                        <p className="text-sm text-gray-600">Arrastra tu video o <span style={{ color: '#a78bfa' }}>haz clic para seleccionar</span></p>
                        <p className="text-xs text-gray-700 mt-1">MP4, MOV, AVI · Máx 150 MB</p>
                      </div>
                    )}
                  </div>
                  <input ref={fileRef} type="file" accept="video/*" className="hidden"
                    onChange={e => e.target.files?.[0] && handleFileSelect(e.target.files[0])} />
                </div>

                {/* Voice toggle */}
                <div className="flex items-center justify-between py-1">
                  <div className="flex items-center gap-2">
                    {enableVoice ? <Mic size={15} className="text-violet-400" /> : <MicOff size={15} className="text-gray-600" />}
                    <span className="text-sm font-medium text-gray-400">Voz IA en intro</span>
                    <span className="text-xs text-gray-700">(requiere ElevenLabs API key)</span>
                  </div>
                  <button
                    onClick={() => setEnableVoice(v => !v)}
                    className="relative w-10 h-5 rounded-full transition-colors duration-200"
                    style={{ background: enableVoice ? '#7c3aed' : 'rgba(255,255,255,0.08)' }}
                  >
                    <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all duration-200"
                      style={{ left: enableVoice ? '22px' : '2px' }} />
                  </button>
                </div>
              </div>

              <button
                onClick={handleAnalyze}
                disabled={!videoFile || !productName.trim() || step === 'analyzing'}
                className="w-full py-4 rounded-xl font-bold text-white text-sm transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)', boxShadow: '0 0 30px rgba(124,58,237,0.25)' }}
              >
                {step === 'analyzing' ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    Analizando video con IA...
                  </>
                ) : (
                  <>
                    <Zap size={16} />
                    Analizar y generar hooks
                  </>
                )}
              </button>
            </div>
          )}

          {/* ── STEP: HOOKS ──────────────────────────────────────────── */}
          {(step === 'hooks' || step === 'generating') && analysis && (
            <div className="space-y-5">
              {/* Analysis card */}
              <div className="rounded-2xl p-5 space-y-3" style={glass}>
                <p className="text-xs font-bold text-gray-600 uppercase tracking-widest">Análisis del anuncio</p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl p-3" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.04)' }}>
                    <p className="text-[10px] text-gray-600 mb-1">Tipo</p>
                    <p className="text-xs font-semibold text-gray-200">{analysis.adType}</p>
                  </div>
                  <div className="rounded-xl p-3" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.04)' }}>
                    <p className="text-[10px] text-gray-600 mb-1">Retención</p>
                    <p className="text-xs font-semibold" style={{ color: RETENTION_COLOR[analysis.retentionLevel] ?? '#9ca3af' }}>
                      {analysis.retentionLevel}
                    </p>
                  </div>
                  <div className="rounded-xl p-3 col-span-1" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.04)' }}>
                    <p className="text-[10px] text-gray-600 mb-1">Ángulo actual</p>
                    <p className="text-[11px] text-gray-400 leading-tight">{analysis.marketingAngle}</p>
                  </div>
                </div>
              </div>

              {/* Hook cards */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-gray-400">Selecciona hasta 3 hooks</p>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-lg"
                    style={{ background: selectedHooks.length > 0 ? 'rgba(124,58,237,0.15)' : 'rgba(255,255,255,0.04)', color: selectedHooks.length > 0 ? '#a78bfa' : '#4b5563' }}>
                    {selectedHooks.length}/3 seleccionados
                  </span>
                </div>
                <div className="space-y-2.5">
                  {analysis.hooks.map((hook, i) => {
                    const sel = selectedHooks.some(h => h.text === hook.text);
                    const maxed = selectedHooks.length >= 3 && !sel;
                    const colors = TYPE_COLORS[hook.type] ?? { bg: 'rgba(156,163,175,0.1)', color: '#9ca3af' };
                    return (
                      <button key={i} onClick={() => !maxed && toggleHook(hook)}
                        disabled={maxed}
                        className="w-full text-left rounded-xl p-4 transition-all duration-200 disabled:opacity-40"
                        style={{
                          background: sel ? 'linear-gradient(135deg, rgba(124,58,237,0.12), rgba(168,85,247,0.06))' : 'rgba(255,255,255,0.025)',
                          border: sel ? '1px solid rgba(139,92,246,0.4)' : '1px solid rgba(255,255,255,0.06)',
                        }}>
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex-shrink-0">
                            {sel
                              ? <CheckSquare size={16} style={{ color: '#a78bfa' }} />
                              : <Square size={16} style={{ color: '#374151' }} />}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                                style={{ background: colors.bg, color: colors.color, border: `1px solid ${colors.color}22` }}>
                                {hook.type}
                              </span>
                            </div>
                            <p className="text-sm text-gray-200 leading-snug font-medium">{hook.text}</p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={reset} className="px-4 py-3 rounded-xl text-sm text-gray-600 hover:text-gray-300 transition-colors"
                  style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
                  ← Volver
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={selectedHooks.length === 0 || step === 'generating'}
                  className="flex-1 py-3 rounded-xl font-bold text-white text-sm transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}
                >
                  {step === 'generating' ? (
                    <>
                      <RefreshCw size={15} className="animate-spin" />
                      Generando {selectedHooks.length} video{selectedHooks.length !== 1 ? 's' : ''}...
                    </>
                  ) : (
                    <>
                      <Film size={15} />
                      Generar {selectedHooks.length} video{selectedHooks.length !== 1 ? 's' : ''}
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ── STEP: RESULTS ────────────────────────────────────────── */}
          {step === 'results' && (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.3)' }}>
                  <span className="text-emerald-400 text-sm">✓</span>
                </div>
                <div>
                  <p className="text-sm font-bold text-white">{videos.length} video{videos.length !== 1 ? 's' : ''} generado{videos.length !== 1 ? 's' : ''}</p>
                  <p className="text-xs text-gray-600">Listos para descargar y publicar</p>
                </div>
              </div>

              <div className="space-y-3">
                {videos.map((v, i) => {
                  const colors = TYPE_COLORS[v.hookType] ?? { bg: 'rgba(156,163,175,0.1)', color: '#9ca3af' };
                  return (
                    <div key={i} className="rounded-2xl p-5" style={glass}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                              style={{ background: colors.bg, color: colors.color, border: `1px solid ${colors.color}22` }}>
                              {v.hookType}
                            </span>
                            <span className="text-[10px] text-gray-600">Video {i + 1}</span>
                          </div>
                          <p className="text-sm text-gray-200 font-medium leading-snug">{v.hookText}</p>
                        </div>
                        <a
                          href={`/api/proxy${v.url}`}
                          download={`hook_${v.hookType.toLowerCase().replace(/\s/g, '_')}_${i + 1}.mp4`}
                          className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white transition-all duration-200 hover:opacity-90"
                          style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)', whiteSpace: 'nowrap' }}
                        >
                          <Download size={14} />
                          Descargar
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>

              <button onClick={reset}
                className="w-full py-3 rounded-xl text-sm font-semibold text-gray-400 hover:text-gray-200 transition-colors"
                style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
                + Generar otro video
              </button>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}
