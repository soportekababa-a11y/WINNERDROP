'use client';

import { useState } from 'react';

interface Props {
  productId: string;
  productName: string;
}

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-white/5 ${className}`} />;
}

export function CompetitorSpyPanel({ productId }: Props) {
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [competitors, setCompetitors] = useState<string[]>([]);

  async function runSpy() {
    setState('loading');
    try {
      const { fetchCompetitorSpy } = await import('@/lib/api');
      const data = await fetchCompetitorSpy(productId);
      setCompetitors(data.competitors);
      setState('done');
    } catch {
      setState('error');
    }
  }

  if (state === 'idle') {
    return (
      <button
        onClick={runSpy}
        className="w-full group relative overflow-hidden rounded-2xl border border-violet-500/30 bg-gradient-to-br from-[#0d0d1a] to-[#130d2a] p-5 text-left transition-all duration-300 hover:border-violet-400/60 hover:shadow-[0_0_40px_rgba(139,92,246,0.2)]"
      >
        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
          style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(139,92,246,0.08) 0%, transparent 70%)' }}
        />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/20 text-lg border border-violet-500/30">
              🔍
            </div>
            <p className="font-semibold text-white text-sm">Ver tiendas competidoras</p>
          </div>
          <span className="text-gray-600 group-hover:text-violet-400 transition-colors text-lg">→</span>
        </div>
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-white/8 bg-[#080810] overflow-hidden shadow-[0_0_60px_rgba(139,92,246,0.1)]">
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
        <div className="flex items-center gap-2.5">
          <span className="text-base">🔍</span>
          <span className="text-sm font-semibold text-white">Tiendas competidoras</span>
        </div>
        {state === 'done' && (
          <button
            onClick={() => { setState('idle'); setCompetitors([]); }}
            className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
          >
            Cerrar
          </button>
        )}
      </div>

      {state === 'loading' && (
        <div className="p-6 space-y-3">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-2 h-2 rounded-full bg-violet-500 animate-ping" />
            <span className="text-sm text-gray-400 animate-pulse">Generando...</span>
          </div>
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      )}

      {state === 'error' && (
        <div className="p-6 text-center">
          <p className="text-red-400 text-sm">Error al buscar</p>
          <button onClick={() => setState('idle')} className="mt-3 text-xs text-gray-500 hover:text-gray-300 transition-colors">
            Reintentar
          </button>
        </div>
      )}

      {state === 'done' && (
        <div className="p-5">
          {competitors.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-8">
              No se encontraron tiendas competidoras
            </p>
          ) : (
            <div className="space-y-2">
              {competitors.map((url, i) => {
                let domain = url;
                try { domain = new URL(url).hostname.replace(/^www\./, ''); } catch {}
                return (
                  <a
                    key={i}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/3 px-4 py-3 hover:border-violet-500/30 hover:bg-violet-500/5 transition-all group"
                  >
                    <span className="text-[10px] text-gray-600 w-4 flex-shrink-0">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-white font-medium truncate">{domain}</p>
                      <p className="text-[10px] text-gray-600 truncate">{url}</p>
                    </div>
                    <span className="text-gray-600 group-hover:text-violet-400 transition-colors flex-shrink-0 text-sm">↗</span>
                  </a>
                );
              })}
            </div>
          )}
          <div className="flex justify-end mt-4 pt-3 border-t border-white/5">
            <button onClick={runSpy} className="text-[10px] text-gray-600 hover:text-violet-400 transition-colors">
              Actualizar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
