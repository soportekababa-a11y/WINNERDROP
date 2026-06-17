'use client';

import { ProductWithGrid } from "@/lib/api";
import Link from "next/link";
import Image from "next/image";

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
  const sales = p.salesToday;
  const trending = sales >= 10;
  const badge = rankBadge(rank);

  return (
    <Link
      href={`/products/${p.id}`}
      className="flex flex-col overflow-hidden rounded-2xl group transition-all duration-300"
      style={{
        background: 'rgba(255,255,255,0.025)',
        backdropFilter: 'blur(12px)',
        border: trending ? '1px solid rgba(139,92,246,0.25)' : '1px solid rgba(255,255,255,0.06)',
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLElement;
        el.style.border = '1px solid rgba(139,92,246,0.4)';
        el.style.boxShadow = '0 0 40px rgba(139,92,246,0.15), 0 20px 40px rgba(0,0,0,0.4)';
        el.style.transform = 'translateY(-4px) scale(1.01)';
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLElement;
        el.style.border = trending ? '1px solid rgba(139,92,246,0.25)' : '1px solid rgba(255,255,255,0.06)';
        el.style.boxShadow = 'none';
        el.style.transform = 'translateY(0) scale(1)';
      }}
    >
      {/* Image */}
      <div className="relative w-full aspect-[4/3] overflow-hidden" style={{ background: '#0a0a12' }}>
        {p.imageUrl ? (
          <Image
            src={encodeURI(p.imageUrl)}
            alt={p.name}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-110"
            unoptimized
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.05), rgba(168,85,247,0.08))' }}>
            <span className="text-3xl opacity-20">📦</span>
          </div>
        )}
        {/* Gradient overlay on hover */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          style={{ background: 'linear-gradient(to top, rgba(2,2,9,0.6) 0%, transparent 60%)' }} />

        {badge && <div className="absolute top-2 left-2 text-xl leading-none drop-shadow-lg">{badge}</div>}

        {trending && (
          <div className="absolute top-2 right-2 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1"
            style={{ background: 'rgba(139,92,246,0.85)', backdropFilter: 'blur(8px)', color: 'white', border: '1px solid rgba(255,255,255,0.15)' }}>
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white" />
            </span>
            trending
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-4 flex flex-col gap-2.5 flex-1">
        <div>
          <p className="font-semibold text-sm text-gray-200 line-clamp-2 leading-snug group-hover:text-white transition-colors duration-200">{p.name}</p>
          <p className="text-[11px] text-gray-700 mt-0.5 truncate">{[p.category, p.provider].filter(Boolean).join(' · ')}</p>
        </div>

        <div>
          <p className="text-2xl font-bold bg-clip-text text-transparent"
            style={{ backgroundImage: 'linear-gradient(135deg, #c4b5fd, #8b5cf6)' }}>
            {sales.toLocaleString()}
          </p>
          <p className="text-[11px] text-gray-700">ventas hoy</p>
        </div>

        {p.stock < 10 && p.stock > 0 && (
          <p className="text-[11px] font-semibold" style={{ color: '#f87171' }}>⚠ Solo {p.stock} en stock</p>
        )}

        <div className="pt-1 mt-auto">
          <span className="block w-full text-center text-xs font-bold py-2 rounded-xl transition-all duration-200"
            style={{
              background: 'rgba(124,58,237,0.12)',
              color: '#a78bfa',
              border: '1px solid rgba(139,92,246,0.2)',
            }}>
            Ver análisis →
          </span>
        </div>
      </div>
    </Link>
  );
}
