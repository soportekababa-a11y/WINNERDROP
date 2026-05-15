'use client';

import { useQuery } from "@tanstack/react-query";
import { fetchProducts } from "@/lib/api";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Flame } from "lucide-react";

export function TopMovers() {
  const { data, isLoading } = useQuery({
    queryKey: ['products', 'growth', '', ''],
    queryFn: () => fetchProducts({ limit: 5, sort: 'growth' }),
    refetchInterval: 60_000,
  });

  const movers = data?.filter(p => p.salesToday > 0 || p.salesYesterday > 0).slice(0, 5);

  if (!isLoading && (!movers || movers.length === 0)) return null;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Flame size={14} className="text-orange-400" />
        <h2 className="text-sm font-semibold text-white">Mayor crecimiento hoy</h2>
      </div>
      <div className="space-y-2">
        {isLoading
          ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 bg-zinc-800 rounded-lg" />)
          : movers?.map((p) => {
              const growth = p.salesYesterday > 0
                ? Math.round(((p.salesToday - p.salesYesterday) / p.salesYesterday) * 100)
                : null;
              return (
                <Link
                  key={p.id}
                  href={`/products/${p.id}`}
                  className="flex items-center gap-3 py-1.5 hover:opacity-80 transition-opacity"
                >
                  <div className="w-8 h-8 rounded-lg bg-zinc-800 flex-shrink-0 overflow-hidden relative">
                    {p.imageUrl
                      ? <Image src={p.imageUrl} alt={p.name} fill className="object-cover" unoptimized />
                      : <div className="w-full h-full bg-zinc-700" />
                    }
                  </div>
                  <p className="flex-1 text-xs text-zinc-300 truncate">{p.name}</p>
                  {growth !== null && (
                    <span className={cn(
                      "text-xs font-bold px-1.5 py-0.5 rounded flex-shrink-0",
                      growth >= 0 ? "text-emerald-400" : "text-red-400"
                    )}>
                      {growth >= 0 ? '+' : ''}{growth}%
                    </span>
                  )}
                </Link>
              );
            })
        }
      </div>
    </div>
  );
}
