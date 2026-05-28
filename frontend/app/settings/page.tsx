'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getUser, isAuthenticated } from '@/lib/auth';
import { selectCountryPlatform } from '@/lib/api';
import { Sidebar } from '@/components/sidebar';
import { Globe, CheckCircle2 } from 'lucide-react';

const COUNTRIES = [
  { value: 'RD', label: '🇩🇴 Rep. Dominicana' },
  { value: 'GT', label: '🇬🇹 Guatemala' },
  { value: 'EC', label: '🇪🇨 Ecuador' },
  { value: 'CR', label: '🇨🇷 Costa Rica' },
  { value: 'CO', label: '🇨🇴 Colombia' },
];

const PLATFORMS = [
  { value: 'effi', label: 'Effi', desc: 'Catálogo Effi.com.co' },
  { value: 'dropi', label: 'Dropi', desc: 'Próximamente', disabled: true },
];

export default function SettingsPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const user = typeof window !== 'undefined' ? getUser() : null;

  const [country, setCountry] = useState(user?.selectedCountry ?? '');
  const [platform, setPlatform] = useState(user?.selectedPlatform ?? 'effi');
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAuthenticated()) { router.replace('/login'); return; }
    const u = getUser();
    if (!u) return;
    if (u.plan !== 'basic') { router.replace('/'); return; }
    setAuthed(true);
    setCountry(u.selectedCountry ?? '');
    setPlatform(u.selectedPlatform ?? 'effi');
  }, [router]);

  if (!authed) return null;

  const handleSave = async () => {
    if (!country) { setError('Selecciona un país'); return; }
    setLoading(true);
    setError('');
    try {
      await selectCountryPlatform(country, platform);
      setSaved(true);
      setTimeout(() => router.push('/dashboard'), 800);
    } catch {
      setError('Error al guardar. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const glass = { background: 'rgba(255,255,255,0.025)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.06)' };
  const selectedStyle = { background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.4)', color: '#a78bfa' };
  const normalStyle = { background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', color: '#6b7280' };

  return (
    <div className="min-h-screen bg-[#020209] flex">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <main className="max-w-lg mx-auto w-full px-6 py-12 space-y-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Configuración</h1>
            <p className="text-gray-600 text-sm mt-1">Plan Básico — elige tu país y plataforma</p>
          </div>

          <div className="rounded-2xl p-6 space-y-6" style={glass}>
            <div className="space-y-3">
              <label className="text-[10px] font-bold text-gray-600 uppercase tracking-widest flex items-center gap-1.5">
                <Globe size={11} /> País
              </label>
              <div className="space-y-2">
                {COUNTRIES.map(c => (
                  <button key={c.value} onClick={() => setCountry(c.value)}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200"
                    style={country === c.value ? selectedStyle : normalStyle}>
                    {c.label}
                    {country === c.value && <CheckCircle2 size={15} className="text-violet-400" />}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">Plataforma</label>
              <div className="grid grid-cols-2 gap-2">
                {PLATFORMS.map(p => (
                  <button key={p.value} onClick={() => !p.disabled && setPlatform(p.value)}
                    disabled={p.disabled}
                    className="px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 text-left disabled:opacity-30 disabled:cursor-not-allowed"
                    style={platform === p.value && !p.disabled ? selectedStyle : normalStyle}>
                    <p>{p.label}</p>
                    <p className="text-[10px] mt-0.5 opacity-60">{p.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {error && <p className="text-red-400 text-xs">{error}</p>}

            <button onClick={handleSave} disabled={!country || loading}
              className="w-full py-3 rounded-xl text-sm font-semibold transition-all duration-200 disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)', color: 'white', boxShadow: '0 0 24px rgba(139,92,246,0.3)' }}>
              {loading ? 'Guardando...' : saved ? '✓ Guardado' : 'Guardar'}
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}
