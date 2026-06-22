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

  const maxBar = Math.max(...grid.map(d => d.sales), 1);

  return (
    <Link
      href={`/products/${p.id}`}
      className="flex flex-col overflow-hidden rounded-2xl group transition-all duration-300 relative"
      style={{
        background: 'rgba(50, 0, 90, 0.07)',
        backdropFilter: 'blur(16px)',
        border: trending
          ? '1px solid rgba(217,70,239,0.25)'
          : '1px solid rgba(150, 0, 220, 0.1)',
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLElement;
        el.style.border = '1px solid rgba(217,70,239,0.45)';
        el.style.boxShadow = '0 0 30px rgba(217,70,239,0.15), 0 0 80px rgba(168,85,247,0.08), 0 20px 40px rgba(0,0,0,0.5)';
        el.style.transform = 'translateY(-5px) scale(1.01)';
        el.style.background = 'rgba(70, 0, 120, 0.12)';
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLElement;
        el.style.border = trending ? '1px solid rgba(217,70,239,0.25)' : '1px solid rgba(150, 0, 220, 0.1)';
        el.style.boxShadow = 'none';
        el.style.transform = 'translateY(0) scale(1)';
        el.style.background = 'rgba(50, 0, 90, 0.07)';
      }}
    >
      {/* Top border gradient */}
      <div className="absolute top-0 left-0 right-0 h-[1px] z-10 transition-opacity duration-300"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(217,70,239,0.5), transparent)', opacity: trending ? 1 : 0.4 }} />

      {/* Image */}
      <div className="relative w-full aspect-[4/3] overflow-hidden"
        style={{ background: 'linear-gradient(135deg, rgba(80,0,120,0.3), rgba(40,0,80,0.5))' }}>
        {p.imageUrl ? (
          <Image
            src={encodeURI(p.imageUrl)}
            alt={p.name}
            fill
            className="object-cover transition-transform duration-700 group-hover:scale-110"
            unoptimized
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-4xl opacity-15">📦</span>
          </div>
        )}
        {/* Dark gradient overlay */}
        <div className="absolute inset-0 opacity-60 group-hover:opacity-80 transition-opacity duration-300"
          style={{ background: 'linear-gradient(to top, rgba(4,0,14,0.9) 0%, transparent 55%)' }} />

        {badge && (
          <div className="absolute top-2 left-2 text-xl leading-none drop-shadow-lg z-10">{badge}</div>
        )}

        {trending && (
          <div className="absolute top-2 right-2 text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5 z-10"
            style={{
              background: 'rgba(192,38,211,0.85)',
              backdropFilter: 'blur(8px)',
              color: 'white',
              border: '1px solid rgba(232,121,249,0.4)',
              boxShadow: '0 0 12px rgba(217,70,239,0.4)',
            }}>
            <span className="neon-dot relative flex h-1.5 w-1.5 flex-shrink-0">
              <span className="absolute inline-flex h-full w-full rounded-full bg-white opacity-75"
                style={{ animation: 'ping-neon 1.4s cubic-bezier(0,0,0.2,1) infinite' }} />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white" />
            </span>
            trending
          </div>
        )}

        {/* Mini sparkline at bottom of image */}
        {grid.length > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-10 flex items-end gap-px px-2 pb-1.5 z-10">
            {grid.slice(-12).map((d, i) => (
              <div key={i} className="flex-1 rounded-sm transition-all duration-300"
                style={{
                  height: `${Math.max(15, (d.sales / maxBar) * 100)}%`,
                  background: `rgba(217,70,239,${0.25 + (d.sales / maxBar) * 0.5})`,
                  boxShadow: d.sales > 0 ? '0 0 4px rgba(217,70,239,0.4)' : 'none',
                }} />
            ))}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-4 flex flex-col gap-2.5 flex-1">
        <div>
          <p className="font-semibold text-sm text-gray-200 line-clamp-2 leading-snug group-hover:text-white transition-colors duration-200">
            {p.name}
          </p>
          <p className="text-[11px] mt-0.5 truncate" style={{ color: 'rgba(180,130,220,0.5)' }}>
            {[p.category, p.provider].filter(Boolean).join(' · ')}
          </p>
        </div>

        <div>
          <p className="text-2xl font-bold gradient-text-data">{sales.toLocaleString()}</p>
          <p className="text-[11px]" style={{ color: 'rgba(150,220,240,0.4)' }}>ventas hoy</p>
        </div>

        {p.stock < 10 && p.stock > 0 && (
          <p className="text-[11px] font-semibold" style={{ color: '#f87171' }}>⚠ Solo {p.stock} en stock</p>
        )}

        <div className="pt-1 mt-auto">
          <span className="block w-full text-center text-xs font-bold py-2 rounded-xl transition-all duration-200 btn-neon">
            Ver análisis →
          </span>
        </div>
      </div>
    </Link>
  );
}
