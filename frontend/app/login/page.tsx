'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { authLogin } from '@/lib/api';
import { Mail, Lock, Loader2, AlertCircle } from 'lucide-react';
import { MomentumIcon, MomentumWordmark } from '@/components/momentum-logo';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await authLogin(email, password);
      router.push('/');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Credenciales incorrectas';
      setError(Array.isArray(msg) ? msg[0] : msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#020209] flex flex-col items-center justify-center px-4">

      {/* Logo */}
      <div className="flex items-center gap-3 mb-10">
        <div className="glow-logo" style={{ filter: 'drop-shadow(0 0 20px rgba(139,92,246,0.5))' }}>
          <MomentumIcon size={48} />
        </div>
        <MomentumWordmark className="text-2xl" />
      </div>

      {/* Card */}
      <div className="w-full max-w-sm rounded-2xl p-7"
        style={{
          background: 'rgba(255,255,255,0.025)',
          backdropFilter: 'blur(24px)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 0 80px rgba(0,0,0,0.6), 0 0 40px rgba(139,92,246,0.05)',
        }}>

        <div className="mb-7">
          <h1 className="text-xl font-bold text-white mb-1">Bienvenido</h1>
          <p className="text-sm text-gray-500">Inicia sesión para continuar</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative">
            <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600 pointer-events-none" />
            <input
              type="email"
              placeholder="Email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full pl-9 pr-4 py-3 rounded-xl text-sm text-white placeholder-gray-600 transition-all duration-200 outline-none"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.07)',
              }}
              onFocus={e => { e.target.style.border = '1px solid rgba(139,92,246,0.5)'; e.target.style.boxShadow = '0 0 20px rgba(139,92,246,0.1)'; }}
              onBlur={e => { e.target.style.border = '1px solid rgba(255,255,255,0.07)'; e.target.style.boxShadow = 'none'; }}
            />
          </div>

          <div className="relative">
            <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600 pointer-events-none" />
            <input
              type="password"
              placeholder="Contraseña"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full pl-9 pr-4 py-3 rounded-xl text-sm text-white placeholder-gray-600 transition-all duration-200 outline-none"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.07)',
              }}
              onFocus={e => { e.target.style.border = '1px solid rgba(139,92,246,0.5)'; e.target.style.boxShadow = '0 0 20px rgba(139,92,246,0.1)'; }}
              onBlur={e => { e.target.style.border = '1px solid rgba(255,255,255,0.07)'; e.target.style.boxShadow = 'none'; }}
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-red-400"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <AlertCircle size={14} className="shrink-0" />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl text-white text-sm font-bold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2 active:scale-[0.98]"
            style={{
              background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
              boxShadow: '0 0 24px rgba(139,92,246,0.35)',
            }}
            onMouseEnter={e => { (e.target as HTMLElement).style.boxShadow = '0 0 40px rgba(139,92,246,0.55)'; }}
            onMouseLeave={e => { (e.target as HTMLElement).style.boxShadow = '0 0 24px rgba(139,92,246,0.35)'; }}
          >
            {loading && <Loader2 size={15} className="animate-spin" />}
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
