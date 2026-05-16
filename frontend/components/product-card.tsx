'use client';

import { ProductWithGrid } from "@/lib/api";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface Props {
  product: ProductWithGrid;
  rank: number;
}

function rankBadge(rank: number) {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return null;
}

export function ProductCard({ product: p, rank }: Props) {
  const grid = p.dailyGrid ?? [];
  const todayEntry = grid[grid.length - 1];
  const trending = (todayEntry?.sales ?? 0) >= 10;
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

        {/* Today sales */}
        <div>
          <p className="text-2xl font-bold text-indigo-600">{(todayEntry?.sales ?? p.salesToday).toLocaleString()}</p>
          <p className="text-xs text-gray-400">ventas hoy</p>
        </div>


        {/* Stock */}
        {p.stock < 10 && p.stock > 0 && (
          <p className="text-xs text-red-500 font-semibold">⚠ Solo {p.stock} unidades</p>
        )}

        {/* CTA */}
        <div className="pt-1">
          <span className="block w-full text-center text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl py-2 transition-colors">
            Ver últimos 7 días →
          </span>
        </div>
      </div>
    </Link>
  );
}
