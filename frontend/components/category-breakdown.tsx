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
  'bg-violet-950/60 border-violet-800/60 text-violet-300 hover:border-violet-700',
  'bg-blue-950/60 border-blue-800/60 text-blue-300 hover:border-blue-700',
  'bg-cyan-950/60 border-cyan-800/60 text-cyan-300 hover:border-cyan-700',
  'bg-teal-950/60 border-teal-800/60 text-teal-300 hover:border-teal-700',
  'bg-emerald-950/60 border-emerald-800/60 text-emerald-300 hover:border-emerald-700',
  'bg-yellow-950/60 border-yellow-800/60 text-yellow-300 hover:border-yellow-700',
  'bg-orange-950/60 border-orange-800/60 text-orange-300 hover:border-orange-700',
  'bg-rose-950/60 border-rose-800/60 text-rose-300 hover:border-rose-700',
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
      <h2 className="text-xs font-medium text-zinc-600 uppercase tracking-wider">Categorías</h2>
      <div className="flex flex-wrap gap-2">
        {isLoading
          ? Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-8 w-24 rounded-xl bg-zinc-900" />)
          : categories?.map((cat, i) => (
              <button
                key={cat}
                onClick={() => onSelect(selected === cat ? '' : cat)}
                className={cn(
                  "px-3 py-1.5 rounded-xl border text-xs font-medium transition-all",
                  selected === cat
                    ? COLORS[i % COLORS.length] + ' ring-1 ring-white/10'
                    : 'bg-zinc-900/50 border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:border-zinc-700'
                )}
              >
                {cat}
              </button>
            ))
        }
      </div>
    </div>
  );
}
