'use client';

import { ProductWithGrid } from "@/lib/api";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface Props {
  product: ProductWithGrid;
  rank: number;
  highlightDay?: string; // ISO date to highlight
}

function label(date: string, index: number, total: number) {
  const i = total - 1 - index; // i=0 = today
  if (i === 0) return 'Hoy';
  if (i === 1) return 'Ayer';
  const d = new Date(date + 'T12:00:00');
  return `${d.getDate()} ${d.toLocaleString('es', { month: 'short' })}`;
}

function rankBadge(rank: number) {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return null;
}

export function ProductCard({ product: p, rank, highlightDay }: Props) {
  const grid = p.dailyGrid ?? [];
  const maxSales = Math.max(...grid.map(d => d.sales), 1);
  const margin = p.price > 0 && p.cost > 0 ? Math.round(((p.price - p.cost) / p.price) * 100) : null;
  const todayEntry = grid[grid.length - 1];
  const yesterdayEntry = grid[grid.length - 2];
  const growth = todayEntry && yesterdayEntry && yesterdayEntry.sales > 0
    ? Math.round(((todayEntry.sales - yesterdayEntry.sales) / yesterdayEntry.sales) * 100)
    : null;
  const trending = (todayEntry?.sales ?? 0) >= 10 || (growth !== null && growth >= 20);
  const badge = rankBadge(rank);

  return (
    <Link
      href={`/products/${p.id}`}
      className={cn(
        "bg-white border rounded-2xl overflow-hidden hover:shadow-md transition-all duration-200 flex flex-col group",
        trending ? "border-violet-200 hover:border-violet-300" : "border-gray-200 hover:border-gray-300"
      )}
    >
      {/* Image */}
      <div className="relative w-full aspect-[4/3] bg-gray-100 overflow-hidden">
        {p.imageUrl ? (
          <Image src={p.imageUrl} alt={p.name} fill className="object-cover group-hover:scale-105 transition-transform duration-300" unoptimized />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
            <span className="text-3xl text-gray-300">📦</span>
          </div>
        )}
        {/* Rank badge */}
        {badge && (
          <div className="absolute top-2 left-2 text-xl leading-none">{badge}</div>
        )}
        {trending && (
          <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm text-xs font-bold px-2 py-0.5 rounded-full text-violet-600 border border-violet-200">
            🔥 trending
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-4 flex flex-col gap-3 flex-1">
        {/* Name + provider */}
        <div>
          <p className="font-semibold text-sm text-gray-900 line-clamp-2 leading-snug group-hover:text-indigo-600 transition-colors">{p.name}</p>
          <p className="text-xs text-gray-400 mt-0.5 truncate">{[p.category, p.provider].filter(Boolean).join(' · ')}</p>
        </div>

        {/* Price + margin */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-gray-900">RD${p.price.toLocaleString()}</span>
          {margin !== null && (
            <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-lg", margin >= 40 ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500")}>
              {margin}% margen
            </span>
          )}
        </div>

        {/* Today + growth */}
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <p className="text-2xl font-bold text-indigo-600">{(todayEntry?.sales ?? p.salesToday).toLocaleString()}</p>
            <p className="text-xs text-gray-400">ventas hoy</p>
          </div>
          {growth !== null && (
            <span className={cn(
              "text-xs font-bold px-2.5 py-1 rounded-xl",
              growth >= 20 ? "bg-emerald-100 text-emerald-700" :
              growth >= 0  ? "bg-gray-100 text-gray-600" :
                             "bg-red-50 text-red-500"
            )}>
              {growth >= 0 ? '+' : ''}{growth}%
            </span>
          )}
          <div className="text-right">
            <p className="text-sm font-semibold text-gray-500">{(yesterdayEntry?.sales ?? p.salesYesterday).toLocaleString()}</p>
            <p className="text-xs text-gray-400">ayer</p>
          </div>
        </div>

        {/* Mini bar chart */}
        {grid.length > 0 && (
          <div className="mt-1">
            <div className="flex items-end gap-0.5 h-10">
              {grid.map((d, i) => {
                const pct = maxSales > 0 ? (d.sales / maxSales) * 100 : 0;
                const isHighlight = highlightDay === d.date;
                const isToday = i === grid.length - 1;
                const isYesterday = i === grid.length - 2;
                return (
                  <div key={d.date} className="flex-1 flex flex-col items-center gap-0.5 group/bar" title={`${label(d.date, i, grid.length)}: ${d.sales}`}>
                    <div className="w-full relative flex items-end" style={{ height: '32px' }}>
                      <div
                        className={cn(
                          "w-full rounded-t transition-all",
                          isHighlight ? "bg-indigo-600" :
                          isToday     ? "bg-indigo-400" :
                          isYesterday ? "bg-indigo-300" :
                                        "bg-gray-200 group-hover/bar:bg-indigo-200"
                        )}
                        style={{ height: `${Math.max(pct, pct > 0 ? 8 : 0)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Day labels — show only today, yesterday, and every 3rd */}
            <div className="flex gap-0.5 mt-1">
              {grid.map((d, i) => {
                const isToday = i === grid.length - 1;
                const isYesterday = i === grid.length - 2;
                const show = isToday || isYesterday || i % 3 === 0;
                return (
                  <div key={d.date} className="flex-1 text-center">
                    {show && (
                      <span className={cn("text-[9px] leading-none", isToday ? "text-indigo-500 font-bold" : "text-gray-300")}>
                        {isToday ? 'Hoy' : isYesterday ? 'Ayer' : new Date(d.date + 'T12:00:00').getDate()}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Stock */}
        {p.stock < 10 && p.stock > 0 && (
          <p className="text-xs text-red-500 font-semibold">⚠ Solo {p.stock} unidades</p>
        )}
      </div>
    </Link>
  );
}
