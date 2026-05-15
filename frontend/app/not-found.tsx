import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="text-center space-y-4">
        <p className="text-6xl">📦</p>
        <h1 className="text-2xl font-bold text-white">Página no encontrada</h1>
        <p className="text-zinc-500 text-sm">Esta ruta no existe en WinnerDrop</p>
        <Link href="/" className="inline-block mt-4 px-4 py-2 bg-white text-black text-sm font-medium rounded-xl hover:bg-zinc-200 transition-colors">
          Ir al dashboard
        </Link>
      </div>
    </div>
  );
}
