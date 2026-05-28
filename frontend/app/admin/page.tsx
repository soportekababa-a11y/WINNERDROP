'use client';

import { useState } from 'react';
import axios from 'axios';
import { MomentumIcon, MomentumWordmark } from '@/components/momentum-logo';
import { UserPlus, Users, RefreshCw, CheckCircle2, AlertCircle, Loader2, RotateCcw } from 'lucide-react';

const COUNTRIES = ['RD', 'GT', 'EC', 'CR', 'CO'];
const PLATFORMS = ['effi', 'dropi'];
type Plan = 'free' | 'basic' | 'pro' | 'premium';
const PLANS: Plan[] = ['free', 'basic', 'pro', 'premium'];

const PLAN_COLOR: Record<Plan, string> = {
  free:    '#6b7280',
  basic:   '#60a5fa',
  pro:     '#a78bfa',
  premium: '#fbbf24',
};

interface UserRow {
  id: string;
  email: string;
  name: string | null;
  plan: Plan;
  selectedCountry: string | null;
  selectedPlatform: string | null;
  planActivatedAt: string | null;
  planExpiresAt: string | null;
  isActive: boolean;
  createdAt: string;
}

const api = (secret: string) => axios.create({
  baseURL: '/api/proxy',
  headers: { 'x-admin-secret': secret },
});

export default function AdminPage() {
  const [secret, setSecret] = useState('');
  const [authed, setAuthed] = useState(false);
  const [authError, setAuthError] = useState('');

  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(false);

  // Create form
  const [form, setForm] = useState({ email: '', password: '', name: '', plan: 'basic' as Plan, selectedCountry: 'RD', selectedPlatform: 'effi' });
  const [creating, setCreating] = useState(false);
  const [createMsg, setCreateMsg] = useState('');
  const [createError, setCreateError] = useState('');

  // Plan change
  const [changingPlan, setChangingPlan] = useState<string | null>(null);
  const [renewingUser, setRenewingUser] = useState<string | null>(null);

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setAuthError('');
    try {
      await api(secret).get('/subscriptions/admin/users');
      setAuthed(true);
      loadUsers(secret);
    } catch {
      setAuthError('Clave incorrecta');
    }
  }

  async function loadUsers(s = secret) {
    setLoading(true);
    try {
      const res = await api(s).get<UserRow[]>('/subscriptions/admin/users');
      setUsers(res.data);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setCreateMsg('');
    setCreateError('');
    try {
      await api(secret).post('/subscriptions/admin/create-user', form);
      setCreateMsg(`Cuenta creada: ${form.email}`);
      setForm({ email: '', password: '', name: '', plan: 'basic', selectedCountry: 'RD', selectedPlatform: 'effi' });
      loadUsers();
    } catch (err: any) {
      setCreateError(err?.response?.data?.message ?? 'Error al crear cuenta');
    } finally {
      setCreating(false);
    }
  }

  async function handlePlanChange(userId: string, email: string, plan: Plan) {
    setChangingPlan(userId);
    try {
      await api(secret).post('/subscriptions/admin/activate', { email, plan });
      loadUsers();
    } finally {
      setChangingPlan(null);
    }
  }

  async function handleRenew(userId: string, email: string) {
    setRenewingUser(userId);
    try {
      await api(secret).post('/subscriptions/admin/renew', { email, days: 30 });
      loadUsers();
    } finally {
      setRenewingUser(null);
    }
  }

  function fmtExpiry(dateStr: string | null) {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.ceil((d.getTime() - now.getTime()) / 86400000);
    const label = d.toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: '2-digit' });
    return { label, expired: diffDays < 0, soon: diffDays >= 0 && diffDays <= 5, days: diffDays };
  }

  const glass = { background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' };
  const inputStyle = { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: '#e2e8f0' };
  const selectStyle = { ...inputStyle };

  if (!authed) {
    return (
      <div className="min-h-screen bg-[#020209] flex flex-col items-center justify-center px-4">
        <div className="flex items-center gap-3 mb-10">
          <MomentumIcon size={40} />
          <MomentumWordmark className="text-xl" />
        </div>
        <form onSubmit={handleAuth} className="w-full max-w-sm space-y-4 rounded-2xl p-7" style={glass}>
          <p className="text-white font-bold text-lg">Panel Admin</p>
          <input
            type="password"
            placeholder="Clave de administrador"
            value={secret}
            onChange={e => setSecret(e.target.value)}
            className="w-full px-4 py-3 rounded-xl text-sm outline-none"
            style={inputStyle}
          />
          {authError && (
            <div className="flex items-center gap-2 text-sm text-red-400 rounded-xl px-3 py-2"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <AlertCircle size={13} /> {authError}
            </div>
          )}
          <button type="submit" className="w-full py-3 rounded-xl text-sm font-bold text-white"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}>
            Entrar
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020209] text-white">
      <header className="sticky top-0 z-10 px-6 py-4 flex items-center justify-between"
        style={{ background: 'rgba(2,2,9,0.9)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="flex items-center gap-3">
          <MomentumIcon size={28} />
          <span className="text-sm font-bold text-gray-400">Admin Panel</span>
        </div>
        <button onClick={() => loadUsers()} className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-300 transition-colors">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Actualizar
        </button>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-10">

        {/* Create user */}
        <section className="rounded-2xl p-6 space-y-5" style={glass}>
          <div className="flex items-center gap-2">
            <UserPlus size={16} className="text-violet-400" />
            <h2 className="font-bold text-white">Crear cuenta</h2>
          </div>

          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <input placeholder="Correo electrónico" type="email" required value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className="px-4 py-2.5 rounded-xl text-sm outline-none" style={inputStyle} />
              <input placeholder="Contraseña" type="text" required value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                className="px-4 py-2.5 rounded-xl text-sm outline-none" style={inputStyle} />
              <input placeholder="Nombre (opcional)" value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="px-4 py-2.5 rounded-xl text-sm outline-none" style={inputStyle} />
              <select value={form.plan} onChange={e => setForm(f => ({ ...f, plan: e.target.value as Plan }))}
                className="px-4 py-2.5 rounded-xl text-sm outline-none" style={selectStyle}>
                {PLANS.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
              </select>
              {form.plan === 'basic' && (
                <>
                  <select value={form.selectedCountry} onChange={e => setForm(f => ({ ...f, selectedCountry: e.target.value }))}
                    className="px-4 py-2.5 rounded-xl text-sm outline-none" style={selectStyle}>
                    {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <select value={form.selectedPlatform} onChange={e => setForm(f => ({ ...f, selectedPlatform: e.target.value }))}
                    className="px-4 py-2.5 rounded-xl text-sm outline-none" style={selectStyle}>
                    {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </>
              )}
            </div>

            {createMsg && (
              <div className="flex items-center gap-2 text-sm text-emerald-400 rounded-xl px-3 py-2"
                style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
                <CheckCircle2 size={13} /> {createMsg}
              </div>
            )}
            {createError && (
              <div className="flex items-center gap-2 text-sm text-red-400 rounded-xl px-3 py-2"
                style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <AlertCircle size={13} /> {createError}
              </div>
            )}

            <button type="submit" disabled={creating}
              className="px-6 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-40 flex items-center gap-2"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}>
              {creating && <Loader2 size={14} className="animate-spin" />}
              Crear cuenta
            </button>
          </form>
        </section>

        {/* Users list */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-violet-400" />
            <h2 className="font-bold text-white">Usuarios ({users.length})</h2>
          </div>

          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 size={20} className="animate-spin text-violet-500" />
            </div>
          ) : (
            <div className="space-y-2">
              {users.map(u => (
                <div key={u.id} className="rounded-xl px-4 py-3 flex items-center gap-4 flex-wrap" style={glass}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{u.email}</p>
                    {u.name && <p className="text-xs text-gray-600">{u.name}</p>}
                    <p className="text-[10px] text-gray-700 mt-0.5">
                      {u.selectedCountry && `${u.selectedCountry} · `}{u.selectedPlatform && `${u.selectedPlatform} · `}
                      Creado: {new Date(u.createdAt).toLocaleDateString('es-DO')}
                    </p>
                    {(() => {
                      const exp = fmtExpiry(u.planExpiresAt);
                      if (!exp) return null;
                      const color = exp.expired ? '#f87171' : exp.soon ? '#fbbf24' : '#34d399';
                      return (
                        <p className="text-[10px] mt-0.5 font-semibold" style={{ color }}>
                          {exp.expired ? `Expiró: ${exp.label}` : `Vence: ${exp.label} (${exp.days}d)`}
                        </p>
                      );
                    })()}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg"
                      style={{ color: PLAN_COLOR[u.plan], background: `${PLAN_COLOR[u.plan]}18`, border: `1px solid ${PLAN_COLOR[u.plan]}30` }}>
                      {u.plan}
                    </span>
                    <select
                      value={u.plan}
                      onChange={e => handlePlanChange(u.id, u.email, e.target.value as Plan)}
                      disabled={changingPlan === u.id}
                      className="text-xs px-2 py-1 rounded-lg outline-none disabled:opacity-40"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#9ca3af' }}>
                      {PLANS.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <button
                      onClick={() => handleRenew(u.id, u.email)}
                      disabled={renewingUser === u.id}
                      title="+30 días"
                      className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg font-semibold disabled:opacity-40 transition-colors"
                      style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', color: '#34d399' }}>
                      {renewingUser === u.id ? <Loader2 size={11} className="animate-spin" /> : <RotateCcw size={11} />}
                      +30d
                    </button>
                    {changingPlan === u.id && <Loader2 size={12} className="animate-spin text-violet-400" />}
                  </div>
                </div>
              ))}
              {users.length === 0 && (
                <p className="text-center text-gray-700 text-sm py-8">Sin usuarios aún</p>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
