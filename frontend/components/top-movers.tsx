'use client';

import { useQuery } from "@tanstack/react-query";
import { fetchProducts } from "@/lib/api";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp } from "lucide-react";

export function TopMovers() {
  const { data, isLoading } = useQuery({
    queryKey: ['products', 'growth', '', ''],
    queryFn: () => fetchProducts({ limit: 5, sort: 'growth' }),
    refetchInterval: 60_000,
  });

  const movers = data?.filter(p => p.salesToday > 0 || p.salesYesterday > 0).slice(0, 5);

  if (!isLoading && (!movers || movers.length === 0)) return null;

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4 shadow-sm">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center">
          <TrendingUp size={13} className="text-emerald-600" />
        </div>
        <h2 className="text-sm font-bold text-gray-900">Mayor crecimiento hoy</h2>
      </div>
      <div className="space-y-2">
        {isLoading
          ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 rounded-lg" />)
          : movers?.map((p) => {
              const growth = p.salesYesterday > 0
                ? Math.round(((p.salesToday - p.salesYesterday) / p.salesYesterday) * 100)
                : null;
              return (
                <Link
                  key={p.id}
                  href={`/products/${p.id}`}
                  className="flex items-center gap-3 py-1.5 hover:opacity-75 transition-opacity group"
                >
                  <div className="w-8 h-8 rounded-lg bg-gray-100 flex-shrink-0 overflow-hidden relative border border-gray-200">
                    {p.imageUrl
                      ? <Image src={p.imageUrl} alt={p.name} fill className="object-cover" unoptimized />
                      : <div className="w-full h-full bg-gray-100" />
                    }
                  </div>
                  <p className="flex-1 text-xs text-gray-700 truncate group-hover:text-indigo-600 transition-colors">{p.name}</p>
                  {growth !== null && (
                    <span className={cn(
                      "text-xs font-bold px-1.5 py-0.5 rounded-lg flex-shrink-0",
                      growth >= 0
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-red-50 text-red-500"
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
