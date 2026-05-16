'use client';

import { useQuery } from "@tanstack/react-query";
import { fetchCategories } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  selected: string;
  onSelect: (cat: string) => void;
}

const COLORS = [
  { base: 'bg-white border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-600',   active: 'bg-indigo-600 border-indigo-600 text-white shadow-sm' },
  { base: 'bg-white border-gray-200 text-gray-600 hover:border-violet-300 hover:text-violet-600',   active: 'bg-violet-600 border-violet-600 text-white shadow-sm' },
  { base: 'bg-white border-gray-200 text-gray-600 hover:border-emerald-300 hover:text-emerald-600', active: 'bg-emerald-600 border-emerald-600 text-white shadow-sm' },
  { base: 'bg-white border-gray-200 text-gray-600 hover:border-amber-400 hover:text-amber-600',     active: 'bg-amber-500 border-amber-500 text-white shadow-sm' },
  { base: 'bg-white border-gray-200 text-gray-600 hover:border-rose-300 hover:text-rose-600',       active: 'bg-rose-500 border-rose-500 text-white shadow-sm' },
  { base: 'bg-white border-gray-200 text-gray-600 hover:border-cyan-300 hover:text-cyan-600',       active: 'bg-cyan-600 border-cyan-600 text-white shadow-sm' },
  { base: 'bg-white border-gray-200 text-gray-600 hover:border-teal-300 hover:text-teal-600',       active: 'bg-teal-600 border-teal-600 text-white shadow-sm' },
  { base: 'bg-white border-gray-200 text-gray-600 hover:border-orange-300 hover:text-orange-600',   active: 'bg-orange-500 border-orange-500 text-white shadow-sm' },
  { base: 'bg-white border-gray-200 text-gray-600 hover:border-pink-300 hover:text-pink-600',       active: 'bg-pink-500 border-pink-500 text-white shadow-sm' },
];

export function CategoryBreakdown({ selected, onSelect }: Props) {
  const { data: categories, isLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: fetchCategories,
    staleTime: 5 * 60_000,
  });

  if (!isLoading && (!categories || categories.length === 0)) return null;

  return (
    <div className="space-y-3">
      <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Categorías</h2>
      <div className="flex flex-wrap gap-2">
        {isLoading
          ? Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-8 w-24 rounded-xl" />)
          : categories?.map((cat, i) => {
              const color = COLORS[i % COLORS.length];
              const isActive = selected === cat;
              return (
                <button
                  key={cat}
                  onClick={() => onSelect(isActive ? '' : cat)}
                  className={cn(
                    "px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all duration-150",
                    isActive ? color.active : color.base
                  )}
                >
                  {cat}
                </button>
              );
            })
        }
      </div>
    </div>
  );
}
