import axios from 'axios';

const api = axios.create({ baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001' });

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

export const fetchDashboard = () => api.get<DashboardStats>('/products/dashboard').then(r => r.data);

export const fetchProducts = (params?: { limit?: number; sort?: string; search?: string; category?: string }) =>
  api.get<Product[]>('/products', { params }).then(r => r.data);

export const fetchCategories = () => api.get<string[]>('/products/categories').then(r => r.data);

export const fetchProduct = (id: string) => api.get<Product>(`/products/${id}`).then(r => r.data);

export const fetchProductHistory = (id: string, days = 30) =>
  api.get<DailyHistory[]>(`/products/${id}/daily`, { params: { days } }).then(r => r.data);

export const fetchScraperStats = () => api.get<ScraperStats>('/scraper/stats').then(r => r.data);
