// src/pages/StoresPage.tsx
import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { listStores, getStore, syncStore, disconnectStore } from '../api/stores';
import type { Store } from '../api/stores';
import StoreCard from '../components/StoreCard';
import useDebouncedValue from '../hooks/useDebouncedValue';

function StoreDetailModal({ store, onClose }:{ store: Store | null; onClose: ()=>void }) {
  if (!store) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="bg-white p-6 rounded shadow z-10 w-[90%] max-w-2xl">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-xl font-semibold">{store.shop_domain ?? store.name}</h3>
            <div className="text-sm text-slate-500">{store.status}</div>
          </div>
          <button onClick={onClose} className="px-2">Close</button>
        </div>

        <div className="mt-4 grid gap-2 text-sm">
          <div><strong>Products:</strong> {store.product_count ?? '-'}</div>
          <div><strong>Last sync:</strong> {store.last_sync_at ? new Date(store.last_sync_at).toLocaleString() : '—'}</div>
          <div><strong>Installed:</strong> {store.installed_at ? new Date(store.installed_at).toLocaleString() : '—'}</div>
          <pre className="mt-2 bg-slate-50 p-2 rounded text-sm overflow-auto">{JSON.stringify(store.settings ?? {}, null, 2)}</pre>
        </div>
      </div>
    </div>
  );
}

export default function StoresPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const debouncedQ = useDebouncedValue(q, 300);

  // fetch store list (React Query v5 object syntax)
  const { data: stores = [], isLoading, refetch } = useQuery({
    queryKey: ['stores'],
    queryFn: listStores,
    staleTime: 60_000,
  });

  const [detailId, setDetailId] = useState<string | number | null>(null);
  const { data: detail } = useQuery({
    queryKey: ['store', detailId],
    queryFn: () => (detailId ? getStore(detailId) : Promise.resolve(null)),
    enabled: !!detailId,
  });

  // client-side filtering by `q` (simple)
  const visible = debouncedQ ? stores.filter((s: Store) => {
    const hay = `${s.shop_domain ?? s.name ?? ''}`.toLowerCase();
    return hay.includes(debouncedQ.toLowerCase());
  }) : stores;

  async function handleSync(id: string | number | undefined) {
    if (!id) return;
    try {
      await syncStore(id);
      refetch();
      alert('Sync started. It may take a short while.');
    } catch (e:any) {
      console.error(e);
      alert(e?.message ?? 'Sync failed');
    }
  }

  async function handleDisconnect(id: string | number | undefined) {
    if (!id) return;
    if (!confirm('Disconnect this store?')) return;
    try {
      await disconnectStore(id);
      qc.invalidateQueries(['stores']);
      alert('Store disconnected');
    } catch (e:any) {
      console.error(e);
      alert('Failed to disconnect');
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-semibold">Stores</h2>
        <div className="flex gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search stores..."
            className="border rounded px-3 py-1"
          />
          <button onClick={() => refetch()} className="px-3 py-1 border rounded">Refresh</button>
        </div>
      </div>

      {isLoading ? (
        <div>Loading…</div>
      ) : (
        <>
          <div className="grid gap-4">
            {visible.length ? visible.map(s => (
              <StoreCard
                key={(s.store_id ?? s.id) as React.Key}
                store={s}
                onView={(id) => setDetailId(id ?? null)}
                onSync={handleSync}
                onDisconnect={handleDisconnect}
              />
            )) : (
              <div className="p-4 bg-white rounded shadow">No stores found</div>
            )}
          </div>
        </>
      )}

      <StoreDetailModal store={detail ?? null} onClose={() => setDetailId(null)} />
    </div>
  );
}
