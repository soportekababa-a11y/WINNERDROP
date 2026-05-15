'use client';

import { useQuery } from "@tanstack/react-query";
import { fetchScraperStats } from "@/lib/api";
import { cn } from "@/lib/utils";

export function ScraperStatus() {
  const { data } = useQuery({
    queryKey: ['scraper-stats'],
    queryFn: fetchScraperStats,
    refetchInterval: 8_000,
  });

  if (!data) return null;

  const lastRun = data.finishedAt
    ? new Date(data.finishedAt).toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' })
    : null;

  const prog = data.progress;
  const pct = prog && prog.totalPages > 0 ? Math.round((prog.currentPage / prog.totalPages) * 100) : 0;

  if (data.isRunning && prog) {
    return (
      <div className="flex flex-col items-end gap-1 min-w-36">
        <div className="flex items-center gap-1.5 text-xs text-zinc-400">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
          </span>
          Pág {prog.currentPage}/{prog.totalPages} · {prog.accumulated.toLocaleString()} prods
        </div>
        <div className="w-36 h-1 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    );
  }

  if (data.isRunning) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-zinc-400">
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
        </span>
        Actualizando catálogo...
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 text-xs text-zinc-700">
      <span className="w-1.5 h-1.5 rounded-full bg-zinc-800" />
      {lastRun
        ? `Actualizado ${lastRun} · ${data.total.toLocaleString()} prods`
        : 'Sin datos aún'
      }
    </div>
  );
}
