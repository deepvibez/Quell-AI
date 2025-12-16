// src/api/stores.ts
import api from './axios';

export type Store = {
  id?: number;
  store_id?: string | number; // your backend sometimes uses store_id
  shop_domain?: string;
  shopify_domain?: string;
  name?: string;
  product_count?: number;
  status?: string;
  last_sync_at?: string | null;
  installed_at?: string | null;
  settings?: Record<string, any>;
};

/**
 * listStores
 * Adapted to common backend shapes. If your endpoint returns { success, stores } or { data },
 * this function expects an array under `stores`. Update if your backend differs.
 *
 * NOTE: `api` baseURL should already include `/api`, so we call `/stores` here.
 */
export async function listStores(): Promise<Store[]> {
  const res = await api.get<{ success?: boolean; stores?: Store[]; data?: Store[] }>('/stores');
  return res.data.stores ?? res.data.data ?? [];
}

export async function getStore(id: string | number): Promise<Store> {
  const res = await api.get<{ success?: boolean; store?: Store; data?: Store }>(`/stores/${id}`);
  return res.data.store ?? res.data.data!;
}

export async function syncStore(id: string | number) {
  const res = await api.post(`/stores/${id}/sync`);
  return res.data;
}

export async function disconnectStore(id: string | number) {
  const res = await api.delete(`/stores/${id}`);
  return res.data;
}
