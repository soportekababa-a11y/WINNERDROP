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

function rankColor(rank: number) {
  if (rank === 1) return 'text-yellow-400';
  if (rank === 2) return 'text-zinc-300';
  if (rank === 3) return 'text-amber-600';
  return 'text-zinc-600';
}

export function ProductRow({ product: p, rank }: ProductRowProps) {
  const growth = growthPercent(p);
  const trending = isTrending(p, growth);
  const margin = p.price > 0 && p.cost > 0 ? Math.round(((p.price - p.cost) / p.price) * 100) : null;

  return (
    <Link
      href={`/products/${p.id}`}
      className={cn(
        "flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-150",
        trending
          ? "bg-zinc-900 border-zinc-700 hover:border-emerald-800"
          : "bg-zinc-900/50 border-zinc-800/50 hover:border-zinc-700 hover:bg-zinc-900"
      )}
    >
      {/* Rank */}
      <span className={cn("font-mono text-sm w-6 text-center flex-shrink-0 font-bold", rankColor(rank))}>
        {rank <= 3 ? ['🥇','🥈','🥉'][rank - 1] : rank}
      </span>

      {/* Image */}
      <div className="w-11 h-11 rounded-lg bg-zinc-800 flex-shrink-0 overflow-hidden relative">
        {p.imageUrl ? (
          <Image src={p.imageUrl} alt={p.name} fill className="object-cover" unoptimized />
        ) : (
          <div className="w-full h-full bg-zinc-700 rounded-lg" />
        )}
      </div>

      {/* Name + category */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          {trending && <span className="text-xs">🔥</span>}
          <p className="font-medium text-sm text-white truncate">{p.name}</p>
        </div>
        <p className="text-xs text-zinc-500 mt-0.5 truncate">
          {[p.category, p.provider].filter(Boolean).join(' · ')}
        </p>
      </div>

      {/* Sales today */}
      <div className="text-right flex-shrink-0 w-20">
        <p className="text-sm font-bold text-white">{p.salesToday > 0 ? p.salesToday.toLocaleString() : '—'}</p>
        <p className="text-xs text-zinc-600">hoy</p>
      </div>

      {/* Growth badge */}
      <div className="w-14 text-right flex-shrink-0">
        {growth !== null ? (
          <span className={cn(
            "text-xs font-semibold px-1.5 py-0.5 rounded",
            growth >= 20 ? "bg-emerald-950 text-emerald-400" :
            growth >= 0  ? "bg-zinc-800 text-zinc-300" :
                           "bg-red-950/60 text-red-400"
          )}>
            {growth >= 0 ? '+' : ''}{growth}%
          </span>
        ) : (
          <span className="text-zinc-700 text-xs">—</span>
        )}
      </div>

      {/* Price + margin */}
      <div className="w-24 text-right flex-shrink-0 hidden md:block">
        <p className="text-sm text-zinc-300">RD${p.price.toLocaleString()}</p>
        {margin !== null && (
          <p className={cn("text-xs", margin >= 40 ? "text-emerald-500" : "text-zinc-600")}>
            {margin}% margen
          </p>
        )}
      </div>

      {/* Stock */}
      <div className="w-16 text-right flex-shrink-0 hidden lg:block">
        <p className={cn("text-xs", p.stock < 10 ? "text-red-400" : "text-zinc-600")}>
          {p.stock < 10 && p.stock > 0 ? '⚠ ' : ''}{p.stock} uds
        </p>
      </div>
    </Link>
  );
}
