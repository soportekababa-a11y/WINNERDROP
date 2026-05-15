import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="min-h-screen bg-zinc-950">
      <header className="border-b border-zinc-900 px-4 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/20 animate-pulse" />
            <Skeleton className="h-5 w-28 bg-zinc-900" />
          </div>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl bg-zinc-900" />
          ))}
        </div>
        <Skeleton className="h-10 rounded-xl bg-zinc-900" />
        <div className="space-y-1.5">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-[60px] rounded-xl bg-zinc-900" />
          ))}
        </div>
      </main>
    </div>
  );
}
