import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AdminTicket } from "../api/admin";
import { listAdminTickets, updateTicket } from "../api/admin";

function TicketModal({
  ticket,
  onClose,
}: {
  ticket: AdminTicket | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [status, setStatus] = useState(ticket?.status ?? "open");
  const [priority, setPriority] = useState(ticket?.priority ?? "Medium");

  const mutation = useMutation({
    mutationFn: (payload: { status: string; priority: string }) =>
      updateTicket(ticket!.id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-tickets"] });
      onClose();
    },
  });

  if (!ticket) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white border border-indigo-200 rounded-xl shadow-lg w-[95%] max-w-2xl p-6 space-y-4 z-10">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-indigo-900">{ticket.subject}</h2>
            <p className="text-xs text-slate-500 mt-1">
              {ticket.store_url} • {ticket.channel}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-xs text-indigo-600 hover:text-indigo-800"
          >
            Close
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full border rounded px-2 py-1 text-sm"
            >
              <option value="open">Open</option>
              <option value="pending">Pending</option>
              <option value="closed">Closed</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full border rounded px-2 py-1 text-sm"
            >
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
              <option value="Urgent">Urgent</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-3 text-sm">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded border border-slate-200 bg-white text-slate-700"
          >
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate({ status, priority })}
            disabled={mutation.isPending}
            className="px-4 py-2 rounded bg-indigo-600 text-white disabled:opacity-60 hover:bg-indigo-700"
          >
            {mutation.isPending ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TicketsPage() {
  const [statusFilter, setStatusFilter] = useState<string>("open");
  const [priorityFilter, setPriorityFilter] = useState<string>("");
  const [selected, setSelected] = useState<AdminTicket | null>(null);

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ["admin-tickets", { statusFilter, priorityFilter }],
    queryFn: () =>
      listAdminTickets({
        status: statusFilter || undefined,
        priority: priorityFilter || undefined,
      }),
    staleTime: 30_000,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-indigo-900">Support tickets</h1>
          <p className="text-sm text-slate-600">
            Manage issues raised across all stores.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-slate-500 text-xs">Status</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border rounded px-2 py-1 bg-white border-indigo-200 text-sm"
            >
              <option value="">All</option>
              <option value="open">Open</option>
              <option value="pending">Pending</option>
              <option value="closed">Closed</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-500 text-xs">Priority</span>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="border rounded px-2 py-1 bg-white border-indigo-200 text-sm"
            >
              <option value="">All</option>
              <option value="Urgent">Urgent</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white border border-indigo-200 rounded-xl shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-indigo-800 border-b bg-indigo-50">
                <th className="py-3 px-4">ID</th>
                <th className="py-3 px-4">Store</th>
                <th className="py-3 px-4">Subject</th>
                <th className="py-3 px-4">Issue type</th>
                <th className="py-3 px-4">Channel</th>
                <th className="py-3 px-4">Priority</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Created</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((t) => (
                <tr
                  key={t.id}
                  className="border-b last:border-0 hover:bg-indigo-50 cursor-pointer"
                  onClick={() => setSelected(t)}
                >
                  <td className="py-3 px-4 text-xs text-slate-500">#{t.id}</td>
                  <td className="py-3 px-4">
                    <div className="text-sm font-medium truncate max-w-[220px] text-slate-800">
                      {t.store_url}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="text-sm font-medium truncate max-w-[260px] text-slate-800">
                      {t.subject}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-sm text-slate-600">
                    {t.issue_type}
                  </td>
                  <td className="py-3 px-4 text-sm text-slate-600">{t.channel}</td>
                  <td className="py-3 px-4 text-sm">
                    <span
                      className={
                        "inline-flex px-2 py-0.5 rounded-full text-xs font-medium " +
                        (t.priority === "Urgent"
                          ? "bg-red-100 text-red-700"
                          : t.priority === "High"
                          ? "bg-orange-100 text-orange-700"
                          : t.priority === "Low"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-indigo-100 text-indigo-800")
                      }
                    >
                      {t.priority}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-sm">
                    <span className="inline-flex px-2 py-0.5 rounded-full bg-indigo-600 text-white text-xs font-medium">
                      {t.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right text-sm text-slate-500">
                    {new Date(t.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}

              {tickets.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-sm text-slate-500">
                    No tickets match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {isLoading && (
          <div className="py-3 px-4 text-sm text-slate-500">Loading tickets…</div>
        )}
      </div>

      <TicketModal ticket={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
