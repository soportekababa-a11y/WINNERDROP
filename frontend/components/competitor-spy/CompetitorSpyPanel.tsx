'use client';

import { useState } from 'react';
import { SpyResult } from '@/lib/api';

interface Props {
  productId: string;
  productName: string;
}

const CREATIVE_COLORS: Record<string, string> = {
  ugc: 'text-violet-400',
  problem_solution: 'text-blue-400',
  lifestyle: 'text-pink-400',
  offer: 'text-amber-400',
  demo: 'text-cyan-400',
  before_after: 'text-emerald-400',
  unknown: 'text-gray-400',
};

function ScoreRing({ score }: { score: number }) {
  const r = 38;
  const circ = 2 * Math.PI * r;
  const filled = (score / 100) * circ;
  const color = score >= 70 ? '#f97316' : score >= 45 ? '#22c55e' : '#ef4444';

  return (
    <div className="relative flex items-center justify-center" style={{ width: 100, height: 100 }}>
      <svg width="100" height="100" className="-rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="#1f2937" strokeWidth="8" />
        <circle
          cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={`${filled} ${circ - filled}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 1.2s ease', filter: `drop-shadow(0 0 8px ${color}88)` }}
        />
      </svg>
      <span className="absolute text-2xl font-black text-white">{score}</span>
    </div>
  );
}

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-white/5 ${className}`} />;
}

function LoadingState() {
  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center gap-3">
        <div className="w-2 h-2 rounded-full bg-violet-500 animate-ping" />
        <span className="text-sm text-gray-400 animate-pulse">Analizando el mercado dominicano...</span>
      </div>
      <Skeleton className="h-24 w-full" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
      <Skeleton className="h-32 w-full" />
      <div className="grid grid-cols-3 gap-3">
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
      </div>
    </div>
  );
}

export function CompetitorSpyPanel({ productId, productName }: Props) {
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [result, setResult] = useState<SpyResult | null>(null);
  const [error, setError] = useState('');

  async function runSpy() {
    setState('loading');
    try {
      const { fetchCompetitorSpy } = await import('@/lib/api');
      const data = await fetchCompetitorSpy(productId);
      setResult(data);
      setState('done');
    } catch (e: any) {
      setError(e?.message ?? 'Error al analizar');
      setState('error');
    }
  }

  if (state === 'idle') {
    return (
      <button
        onClick={runSpy}
        className="w-full group relative overflow-hidden rounded-2xl border border-violet-500/30 bg-gradient-to-br from-[#0d0d1a] to-[#130d2a] p-5 text-left transition-all duration-300 hover:border-violet-400/60 hover:shadow-[0_0_40px_rgba(139,92,246,0.2)]"
      >
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
          style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(139,92,246,0.08) 0%, transparent 70%)' }} />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/20 text-lg border border-violet-500/30">
              🔍
            </div>
            <div>
              <p className="font-semibold text-white text-sm">Espía la competencia</p>
              <p className="text-xs text-gray-500 mt-0.5">Analizar mercado RD en Meta Ads</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-violet-400 border border-violet-500/30 rounded-md px-2 py-0.5 bg-violet-500/10">PREMIUM</span>
            <span className="text-gray-600 group-hover:text-violet-400 transition-colors text-lg">→</span>
          </div>
        </div>
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-white/8 bg-[#080810] overflow-hidden shadow-[0_0_60px_rgba(139,92,246,0.1)]">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
        <div className="flex items-center gap-2.5">
          <span className="text-base">🔍</span>
          <span className="text-sm font-semibold text-white">Inteligencia Competitiva</span>
          {result && (
            <span className="text-xs text-gray-500">{result.marketFlag} {result.market}</span>
          )}
        </div>
        {state === 'done' && (
          <button
            onClick={() => { setState('idle'); setResult(null); }}
            className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
          >
            Cerrar
          </button>
        )}
      </div>

      {state === 'loading' && <LoadingState />}

      {state === 'error' && (
        <div className="p-6 text-center">
          <p className="text-red-400 text-sm">{error}</p>
          <button onClick={() => setState('idle')} className="mt-3 text-xs text-gray-500 hover:text-gray-300 transition-colors">
            Reintentar
          </button>
        </div>
      )}

      {state === 'done' && result && (
        <div className="p-5 space-y-5">
          {/* Opportunity Score + Saturation */}
          <div className="flex items-center gap-4">
            <ScoreRing score={result.opportunityScore} />
            <div className="flex-1">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Opportunity Score RD</p>
              <p className="text-lg font-bold text-white">
                {result.opportunityEmoji} {result.opportunityScore}/100
              </p>
              <p className="text-sm text-gray-400 mt-0.5">{result.opportunityLabel}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs text-gray-500">Saturación:</span>
                <span className="text-xs font-medium text-white">
                  {result.saturation.emoji} {result.saturation.label}
                </span>
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-white/8 bg-white/3 p-3 text-center">
              <p className="text-xl font-black text-white">{result.totalAdsFound}</p>
              <p className="text-[10px] text-gray-500 mt-0.5 uppercase tracking-wide">Anuncios</p>
            </div>
            <div className="rounded-xl border border-white/8 bg-white/3 p-3 text-center">
              <p className="text-xl font-black text-white">{result.competitors.length}</p>
              <p className="text-[10px] text-gray-500 mt-0.5 uppercase tracking-wide">Competidores</p>
            </div>
            <div className="rounded-xl border border-white/8 bg-white/3 p-3 text-center">
              <p className="text-xl font-black text-white">
                {result.dominantCompetitor?.maxDaysActive ?? '—'}
              </p>
              <p className="text-[10px] text-gray-500 mt-0.5 uppercase tracking-wide">Días max activo</p>
            </div>
          </div>

          {/* Format winner */}
          <div className="rounded-xl border border-white/8 bg-white/3 p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-gray-500 uppercase tracking-wider">Formato ganador</p>
              <span className="text-sm font-semibold text-white">
                {result.formatWinner.emoji} {result.formatWinner.label}
              </span>
            </div>
            <div className="flex gap-2 items-center">
              <span className="text-[10px] text-gray-600 w-12">Video</span>
              <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-violet-600 to-violet-400 transition-all duration-1000"
                  style={{ width: `${result.formatWinner.format === 'video' ? result.formatWinner.percentage : 100 - result.formatWinner.percentage}%` }}
                />
              </div>
              <span className="text-[10px] text-gray-600 w-12 text-right">Imagen</span>
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[10px] text-violet-400">{result.formatWinner.videoCount} ads</span>
              <span className="text-[10px] text-gray-500">{result.formatWinner.imageCount} ads</span>
            </div>
          </div>

          {/* Creative type + Fatigue */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-white/8 bg-white/3 p-4">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Creativo dominante</p>
              <p className={`text-sm font-semibold ${CREATIVE_COLORS[result.dominantCreativeType.type] ?? 'text-white'}`}>
                {result.dominantCreativeType.emoji} {result.dominantCreativeType.label}
              </p>
              <p className="text-[10px] text-gray-600 mt-1">{result.dominantCreativeType.percentage}% de los anuncios</p>
            </div>
            <div className="rounded-xl border border-white/8 bg-white/3 p-4">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Fatiga creativa</p>
              <p className="text-sm font-semibold text-white">{result.creativeFatigue.emoji} {result.creativeFatigue.label}</p>
            </div>
          </div>

          {/* Dominant competitor */}
          {result.dominantCompetitor && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
              <p className="text-[10px] text-amber-400/70 uppercase tracking-wider mb-2">👑 Competidor dominante</p>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{result.dominantCompetitor.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{result.dominantCompetitor.insight}</p>
                </div>
                {result.dominantCompetitor.pageUrl && (
                  <a
                    href={result.dominantCompetitor.pageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-shrink-0 text-[10px] text-amber-400 border border-amber-500/30 rounded-md px-2 py-1 hover:bg-amber-500/10 transition-colors"
                  >
                    Ver →
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Competitors list */}
          {result.competitors.length > 1 && (
            <div>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-3">
                Competidores detectados ({result.competitors.length})
              </p>
              <div className="space-y-2">
                {result.competitors.slice(0, 8).map((comp, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 rounded-lg border border-white/5 bg-white/2 px-3 py-2.5"
                  >
                    <span className="text-[10px] text-gray-600 w-4">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-white truncate font-medium">{comp.name}</p>
                      <p className="text-[10px] text-gray-600">
                        {comp.totalAds} {comp.totalAds === 1 ? 'anuncio' : 'anuncios'} · {comp.maxDaysActive}d activo · {comp.dominantFormat === 'video' ? '🎥' : '🖼️'}
                      </p>
                    </div>
                    {comp.pageUrl && (
                      <a
                        href={comp.pageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-gray-600 hover:text-gray-300 transition-colors flex-shrink-0"
                      >
                        ↗
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer meta */}
          <div className="flex items-center justify-between pt-1 border-t border-white/5">
            <p className="text-[10px] text-gray-700">
              Vía {result.platform} · {new Date(result.scrapedAt).toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' })}
            </p>
            <button
              onClick={runSpy}
              className="text-[10px] text-gray-600 hover:text-violet-400 transition-colors"
            >
              Actualizar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
