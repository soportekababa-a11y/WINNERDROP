'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getToken } from '@/lib/auth';

export default function MetaCallback() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    const code = params.get('code');
    const state = params.get('state');
    const error = params.get('error');

    if (error) {
      router.replace('/meta-ads?error=cancelled');
      return;
    }

    if (!code || !state) {
      router.replace('/meta-ads?error=invalid');
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
      .then(r => r.ok ? router.replace('/meta-ads?connected=1') : router.replace('/meta-ads?error=failed'))
      .catch(() => router.replace('/meta-ads?error=failed'));
  }, []);

  return (
    <div className="min-h-screen bg-[#020209] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-400">Conectando tu cuenta de Facebook...</p>
      </div>
    </div>
  );
}
