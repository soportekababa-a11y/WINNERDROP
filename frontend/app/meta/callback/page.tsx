'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { getToken } from '@/lib/auth';

export default function MetaCallback() {
  const params = useSearchParams();
  const [msg, setMsg] = useState('Conectando tu cuenta de Facebook…');

  useEffect(() => {
    const code = params.get('code');
    const state = params.get('state');
    const error = params.get('error');

    if (error) {
      setMsg('Conexión cancelada.');
      setTimeout(() => window.close(), 1500);
      return;
    }

    if (!code || !state) {
      setMsg('Parámetros inválidos.');
      setTimeout(() => window.close(), 1500);
      return;
    }

    const token = getToken();
    fetch(`/api/proxy/meta-ads/connect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ code, state }),
    })
      .then(async r => {
        if (r.ok) {
          setMsg('¡Cuenta conectada! Cerrando…');
        } else {
          const d = await r.json().catch(() => ({}));
          setMsg(`Error: ${d.message ?? 'Fallo al conectar'}`);
        }
        setTimeout(() => window.close(), 1200);
      })
      .catch(() => {
        setMsg('Error de conexión.');
        setTimeout(() => window.close(), 1500);
      });
  }, []);

  return (
    <div className="min-h-screen bg-[#020209] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-400">{msg}</p>
      </div>
    </div>
  );
}
