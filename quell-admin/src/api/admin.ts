import axios from "axios";
import type { Store } from "./stores";

// Derive the backend root (without `/api`) from VITE_API_BASE when possible.
const apiBase = import.meta.env.VITE_API_BASE ?? "http://localhost:3000/api";
const rootBase = apiBase.replace(/\/api\/?$/, "");

const rootApi = axios.create({
  baseURL: rootBase,
  headers: {
    "Content-Type": "application/json",
  },
});

// Reuse the same token as the main api client.
rootApi.interceptors.request.use((config) => {
  const token = localStorage.getItem("quell_token");
  if (token) {
    config.headers = config.headers ?? {};
    config.headers["Authorization"] = `Bearer ${token}`;
  }
  return config;
});

export type AdminStore = Store;

export async function listAdminStores(): Promise<AdminStore[]> {
  const res = await rootApi.get<{ stores: AdminStore[] }>("/admin/stores");
  return res.data.stores ?? [];
}

export type PlatformOverview = {
  stores: {
    total_stores: number;
    active_stores: number;
    suspended_stores: number;
    disconnected_stores: number;
  };
  signups: { new_signups: number };
  conversations: {
    total_conversations: number;
    total_messages: number;
    stores_with_activity: number;
  };
  tokens: {
    total_tokens: number;
    total_input_tokens: number;
    total_output_tokens: number;
    stores_using_tokens: number;
    estimated_cost: string;
  };
  tickets: {
    total_tickets: number;
    open_tickets: number;
    pending_tickets: number;
    urgent_tickets: number;
  };
};

export async function fetchPlatformOverview(params?: { since?: string }) {
  const res = await rootApi.get<PlatformOverview>("/admin/platform-overview", {
    params,
  });
  return res.data;
}

export type TopStore = {
  store_url: string;
  shop_domain: string;
  store_status: string;
  conversations: number;
  messages: number;
  tokens_used: number;
};

export async function fetchTopStores(params?: {
  since?: string;
  limit?: number;
  sortBy?: "conversations" | "messages" | "tokens_used";
}) {
  const res = await rootApi.get<{ top_stores: TopStore[] }>("/admin/top-stores", {
    params,
  });
  return res.data.top_stores ?? [];
}

export type GrowthPoint = { date: string; new_stores: number };

export async function fetchGrowth(days = 30) {
  const res = await rootApi.get<{ growth_data: GrowthPoint[] }>("/admin/growth", {
    params: { days },
  });
  return res.data.growth_data ?? [];
}

export type DailyStatPoint = {
  date: string;
  conversations: number;
  messages: number;
  active_stores: number;
  tokens: number;
};

export async function fetchDailyStats(days = 30) {
  const res = await rootApi.get<{ daily_stats: DailyStatPoint[] }>(
    "/admin/stats/daily",
    { params: { days } }
  );
  return res.data.daily_stats ?? [];
}

export type AdminTicket = {
  id: number;
  store_url: string;
  subject: string;
  issue_type: string;
  priority: string;
  status: string;
  channel: string;
  created_at: string;
  updated_at: string;
};

export async function listAdminTickets(params?: {
  status?: string;
  priority?: string;
}) {
  const res = await rootApi.get<{ tickets: AdminTicket[] }>("/admin/tickets", {
    params,
  });
  return res.data.tickets ?? [];
}

export async function updateTicket(
  id: number,
  patch: Partial<Pick<AdminTicket, "status" | "priority" | "issue_type" | "channel" | "subject">> & {
    description?: string;
  }
) {
  const res = await rootApi.patch<{ data: AdminTicket }>(
    `/support/tickets/${id}`,
    patch
  );
  return res.data.data;
}

export type TokenUsageByStore = {
  store_url: string;
  total_tokens: number;
  input_tokens: number;
  output_tokens: number;
  sessions_with_tokens: number;
};

export type TokenUsageByDate = {
  date: string;
  total_tokens: number;
  active_stores: number;
};

export async function fetchTokenUsageByStore(params?: { since?: string }) {
  const res = await rootApi.get<{ by_store: TokenUsageByStore[] }>(
    "/admin/token-usage",
    { params: { ...(params || {}), groupBy: "store" } }
  );
  return res.data.by_store ?? [];
}

export async function fetchTokenUsageByDate(params?: { since?: string }) {
  const res = await rootApi.get<{ by_date: TokenUsageByDate[] }>(
    "/admin/token-usage",
    { params: { ...(params || {}), groupBy: "date" } }
  );
  return res.data.by_date ?? [];
}

/**
 * fetchTokenUsageBySession
 * Get token usage for all sessions in a store_url (since a date if given)
 * @param store_url required
 * @param since optional (YYYY-MM-DD)
 */
export type SessionTokenUsage = {
  session_id: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  first_message: string;
  last_message: string;
};
export async function fetchTokenUsageBySession(store_url: string, since?: string) {
  const res = await rootApi.get<{ sessions: SessionTokenUsage[] }>(
    "/admin/token-usage/session",
    {
      params: { store_url, ...(since ? { since } : {}) },
    }
  );
  return res.data.sessions ?? [];
}
