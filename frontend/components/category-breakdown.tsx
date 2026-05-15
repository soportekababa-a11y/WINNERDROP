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
  { base: 'bg-violet-950/50 border-violet-700/50 text-violet-300',   active: 'bg-violet-600 border-violet-500 text-white shadow-lg shadow-violet-900/50' },
  { base: 'bg-indigo-950/50 border-indigo-700/50 text-indigo-300',   active: 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-900/50' },
  { base: 'bg-cyan-950/50 border-cyan-700/50 text-cyan-300',         active: 'bg-cyan-600 border-cyan-500 text-white shadow-lg shadow-cyan-900/50' },
  { base: 'bg-teal-950/50 border-teal-700/50 text-teal-300',         active: 'bg-teal-600 border-teal-500 text-white shadow-lg shadow-teal-900/50' },
  { base: 'bg-emerald-950/50 border-emerald-700/50 text-emerald-300',active: 'bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-900/50' },
  { base: 'bg-amber-950/50 border-amber-700/50 text-amber-300',      active: 'bg-amber-500 border-amber-400 text-black shadow-lg shadow-amber-900/50' },
  { base: 'bg-orange-950/50 border-orange-700/50 text-orange-300',   active: 'bg-orange-500 border-orange-400 text-white shadow-lg shadow-orange-900/50' },
  { base: 'bg-fuchsia-950/50 border-fuchsia-700/50 text-fuchsia-300',active: 'bg-fuchsia-600 border-fuchsia-500 text-white shadow-lg shadow-fuchsia-900/50' },
  { base: 'bg-rose-950/50 border-rose-700/50 text-rose-300',         active: 'bg-rose-600 border-rose-500 text-white shadow-lg shadow-rose-900/50' },
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
      <h2 className="text-xs font-bold text-violet-400 uppercase tracking-widest">Categorías</h2>
      <div className="flex flex-wrap gap-2">
        {isLoading
          ? Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-8 w-24 rounded-xl bg-indigo-950/40" />)
          : categories?.map((cat, i) => {
              const color = COLORS[i % COLORS.length];
              const isActive = selected === cat;
              return (
                <button
                  key={cat}
                  onClick={() => onSelect(isActive ? '' : cat)}
                  className={cn(
                    "px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all duration-150",
                    isActive ? color.active : color.base + ' hover:brightness-110'
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
