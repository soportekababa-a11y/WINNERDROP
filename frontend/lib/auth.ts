const TOKEN_KEY = 'wd_token';
const USER_KEY = 'wd_user';

export type PlanType = 'free' | 'basic' | 'pro' | 'premium';

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  plan: PlanType;
  selectedCountry: string | null;
  selectedPlatform: string | null;
  planExpiresAt: string | null;
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function saveAuth(token: string, user: AuthUser) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

const PLAN_RANK: Record<PlanType, number> = { free: 0, basic: 1, pro: 2, premium: 3 };

export function isPlanAtLeast(userPlan: PlanType, required: PlanType): boolean {
  return PLAN_RANK[userPlan] >= PLAN_RANK[required];
}
