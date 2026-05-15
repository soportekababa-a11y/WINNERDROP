'use client';

import { Product } from "@/lib/api";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface ProductRowProps {
  product: Product;
  rank: number;
}

function growthPercent(p: Product) {
  if (!p.salesYesterday || p.salesYesterday === 0) return null;
  return Math.round(((p.salesToday - p.salesYesterday) / p.salesYesterday) * 100);
}

function isTrending(p: Product, growth: number | null) {
  return (growth !== null && growth >= 20) || p.salesToday >= 10;
}

function rankBadge(rank: number) {
  if (rank === 1) return { text: '🥇', cls: 'text-amber-400' };
  if (rank === 2) return { text: '🥈', cls: 'text-slate-300' };
  if (rank === 3) return { text: '🥉', cls: 'text-orange-400' };
  return { text: String(rank), cls: 'text-indigo-600 font-mono text-xs' };
}

export function ProductRow({ product: p, rank }: ProductRowProps) {
  const growth = growthPercent(p);
  const trending = isTrending(p, growth);
  const margin = p.price > 0 && p.cost > 0 ? Math.round(((p.price - p.cost) / p.price) * 100) : null;
  const badge = rankBadge(rank);

  return (
    <Link
      href={`/products/${p.id}`}
      className={cn(
        "flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-150",
        trending
          ? "bg-violet-950/40 border-violet-800/50 hover:border-violet-500/70 hover:bg-violet-950/60"
          : "bg-indigo-950/20 border-indigo-900/30 hover:border-indigo-700/50 hover:bg-indigo-950/40"
      )}
    >
      {/* Rank */}
      <span className={cn("w-6 text-center flex-shrink-0 font-bold text-sm", badge.cls)}>
        {badge.text}
      </span>

      {/* Image */}
      <div className="w-11 h-11 rounded-lg bg-indigo-950 flex-shrink-0 overflow-hidden relative border border-indigo-900/50">
        {p.imageUrl ? (
          <Image src={p.imageUrl} alt={p.name} fill className="object-cover" unoptimized />
        ) : (
          <div className="w-full h-full bg-indigo-900/40 rounded-lg" />
        )}
      </div>

      {/* Name + category */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          {trending && <span className="text-xs">🔥</span>}
          <p className="font-semibold text-sm text-white truncate">{p.name}</p>
        </div>
        <p className="text-xs text-violet-400/70 mt-0.5 truncate">
          {[p.category, p.provider].filter(Boolean).join(' · ')}
        </p>
      </div>

      {/* Sales today */}
      <div className="text-right flex-shrink-0 w-20">
        <p className="text-sm font-bold text-fuchsia-300">{p.salesToday > 0 ? p.salesToday.toLocaleString() : '—'}</p>
        <p className="text-xs text-indigo-600">hoy</p>
      </div>

      {/* Growth badge */}
      <div className="w-16 text-right flex-shrink-0">
        {growth !== null ? (
          <span className={cn(
            "text-xs font-bold px-2 py-0.5 rounded-lg",
            growth >= 20 ? "bg-emerald-950 text-emerald-400 ring-1 ring-emerald-800/50" :
            growth >= 0  ? "bg-indigo-950 text-indigo-300" :
                           "bg-rose-950/60 text-rose-400"
          )}>
            {growth >= 0 ? '+' : ''}{growth}%
          </span>
        ) : (
          <span className="text-indigo-800 text-xs">—</span>
        )}
      </div>

      {/* Price + margin */}
      <div className="w-24 text-right flex-shrink-0 hidden md:block">
        <p className="text-sm text-amber-300 font-medium">RD${p.price.toLocaleString()}</p>
        {margin !== null && (
          <p className={cn("text-xs", margin >= 40 ? "text-emerald-400" : "text-indigo-600")}>
            {margin}% margen
          </p>
        )}
      </div>

      {/* Stock */}
      <div className="w-16 text-right flex-shrink-0 hidden lg:block">
        <p className={cn("text-xs", p.stock < 10 ? "text-rose-400 font-semibold" : "text-indigo-700")}>
          {p.stock < 10 && p.stock > 0 ? '⚠ ' : ''}{p.stock} uds
        </p>
      </div>
    </Link>
  );
}
