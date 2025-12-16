// src/components/StoreCard.tsx
import React from 'react';
import type { Store } from '../api/stores';

type Props = {
  store: Store;
  onView: (id: string | number | undefined) => void;
  onSync?: (id: string | number | undefined) => void;
  onDisconnect?: (id: string | number | undefined) => void;
};

export default function StoreCard({ store, onView, onSync, onDisconnect }: Props) {
  const id = store.store_id ?? store.id;
  const title = store.shop_domain ?? store.name ?? id;

  return (
    <div className="p-4 bg-white rounded shadow flex justify-between items-center">
      <div>
        <div className="text-lg font-medium">{title}</div>
        <div className="text-sm text-slate-500">{store.shopify_domain ?? store.shop_domain}</div>
        <div className="text-sm mt-1">Status: <span className="font-semibold">{store.status ?? '—'}</span></div>
      </div>

      <div className="flex flex-col items-end gap-2">
        <div className="text-center">
          <div className="text-sm">Products</div>
          <div className="font-bold">{store.product_count ?? '-'}</div>
        </div>

        <div className="text-sm text-slate-500">{store.last_sync_at ? new Date(store.last_sync_at).toLocaleString() : 'Not synced'}</div>

        <div className="flex gap-2 mt-2">
          <button onClick={() => onView(id)} className="px-3 py-1 border rounded">View</button>
          {onSync && <button onClick={() => onSync(id)} className="px-3 py-1 border rounded">Sync</button>}
          {onDisconnect && <button onClick={() => onDisconnect(id)} className="px-3 py-1 border rounded text-red-600">Disconnect</button>}
        </div>
      </div>
    </div>
  );
}
