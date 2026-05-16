import axios from 'axios';
import { getToken, saveAuth, clearAuth, AuthUser } from './auth';

const baseURL = typeof window !== 'undefined'
  ? '/api/proxy'
  : (process.env.BACKEND_URL ?? 'http://localhost:3001');

const api = axios.create({ baseURL });

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Redirect to login on 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      clearAuth();
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// Auth API (no interceptors needed — public endpoints)
const authApi = axios.create({
  baseURL: typeof window !== 'undefined' ? '/api/proxy' : (process.env.BACKEND_URL ?? 'http://localhost:3001'),
});

export async function authLogin(email: string, password: string) {
  const res = await authApi.post<{ token: string; user: AuthUser }>('/auth/login', { email, password });
  saveAuth(res.data.token, res.data.user);
  return res.data;
}

export async function authRegister(email: string, password: string, name?: string) {
  const res = await authApi.post<{ token: string; user: AuthUser }>('/auth/register', { email, password, name });
  saveAuth(res.data.token, res.data.user);
  return res.data;
}

export interface Product {
  id: string;
  effiId: string;
  name: string;
  imageUrl: string;
  provider: string;
  category: string;
  subcategory: string;
  price: number;
  cost: number;
  stock: number;
  totalSalesAccum: number;
  salesToday: number;
  salesYesterday: number;
  isActive: boolean;
  updatedAt: string;
  createdAt: string;
}

export interface DashboardStats {
  totalSalesToday: number;
  totalSalesYesterday: number;
  growthPercent: number;
  activeProducts: number;
  topProducts: Product[];
}

export interface DailyHistory {
  date: string;
  sales: number;
}

export interface ScraperStats {
  isRunning: boolean;
  total: number;
  pages: number;
  durationMs: number;
  finishedAt: string | null;
  progress: { currentPage: number; totalPages: number; accumulated: number } | null;
}

export interface ProductWithGrid extends Product {
  dailyGrid: { date: string; sales: number }[];
}

export const fetchProductsGrid = (params?: { limit?: number; sort?: string; days?: number; search?: string; category?: string; offset?: number; hot?: boolean }) =>
  api.get<ProductWithGrid[]>('/products/grid', { params }).then(r => r.data);

export const fetchDashboard = () => api.get<DashboardStats>('/products/dashboard').then(r => r.data);

export const fetchProducts = (params?: { limit?: number; sort?: string; search?: string; category?: string }) =>
  api.get<Product[]>('/products', { params }).then(r => r.data);

export const fetchCategories = () => api.get<string[]>('/products/categories').then(r => r.data);

export const fetchProduct = (id: string) => api.get<Product>(`/products/${id}`).then(r => r.data);

export const fetchProductHistory = (id: string, days = 30) =>
  api.get<DailyHistory[]>(`/products/${id}/daily`, { params: { days } }).then(r => r.data);

export const fetchScraperStats = () => api.get<ScraperStats>('/scraper/stats').then(r => r.data);
