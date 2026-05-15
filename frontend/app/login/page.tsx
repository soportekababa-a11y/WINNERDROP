'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { authLogin, authRegister } from '@/lib/api';
import { Zap, Mail, Lock, User, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

type Tab = 'login' | 'register';

export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (tab === 'login') {
        await authLogin(email, password);
      } else {
        await authRegister(email, password, name || undefined);
      }
      router.push('/');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        (tab === 'login' ? 'Credenciales incorrectas' : 'No se pudo crear la cuenta');
      setError(Array.isArray(msg) ? msg[0] : msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#07071A] flex flex-col items-center justify-center px-4">
      {/* Logo */}
      <div className="flex items-center gap-2.5 mb-10">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-violet-900/50">
          <Zap size={16} className="text-white" />
        </div>
        <span className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-violet-300 to-fuchsia-300">
          WinnerDrop
        </span>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm bg-indigo-950/40 border border-indigo-900/60 rounded-2xl p-6 shadow-2xl shadow-violet-950/30">
        {/* Tabs */}
        <div className="flex gap-1 bg-[#07071A]/60 border border-indigo-900/50 rounded-xl p-1 mb-6">
          {(['login', 'register'] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => { setTab(t); setError(''); }}
              className={cn(
                'flex-1 py-2 rounded-lg text-sm font-semibold transition-all',
                tab === t
                  ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-900/50'
                  : 'text-indigo-500 hover:text-indigo-300'
              )}
            >
              {t === 'login' ? 'Iniciar sesión' : 'Registrarse'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name (register only) */}
          {tab === 'register' && (
            <div className="relative">
              <User size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-violet-600 pointer-events-none" />
              <input
                type="text"
                placeholder="Nombre (opcional)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-[#07071A]/60 border border-indigo-900/60 rounded-xl text-sm text-white placeholder-indigo-700 focus:outline-none focus:border-violet-600/70 transition-colors"
              />
            </div>
          )}

          {/* Email */}
          <div className="relative">
            <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-violet-600 pointer-events-none" />
            <input
              type="email"
              placeholder="Email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-[#07071A]/60 border border-indigo-900/60 rounded-xl text-sm text-white placeholder-indigo-700 focus:outline-none focus:border-violet-600/70 transition-colors"
            />
          </div>

          {/* Password */}
          <div className="relative">
            <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-violet-600 pointer-events-none" />
            <input
              type="password"
              placeholder="Contraseña"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-[#07071A]/60 border border-indigo-900/60 rounded-xl text-sm text-white placeholder-indigo-700 focus:outline-none focus:border-violet-600/70 transition-colors"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 bg-red-950/40 border border-red-800/50 rounded-xl px-3 py-2.5 text-sm text-red-400">
              <AlertCircle size={14} className="shrink-0" />
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white text-sm font-semibold hover:from-violet-500 hover:to-fuchsia-500 transition-all shadow-lg shadow-violet-900/40 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            {tab === 'login' ? 'Entrar' : 'Crear cuenta'}
          </button>
        </form>
      </div>

      <p className="mt-6 text-xs text-indigo-800">
        Productos ganadores para dropshipping en República Dominicana
      </p>
    </div>
  );
}
