import { useEffect, useState, useRef } from "react";
import {
  Search,
  Send,
  Trash2,
  ChevronDown,
  Clock,
  RefreshCw,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type TicketStatus = "Open" | "In Progress" | "Resolved";
type TicketPriority = "High" | "Medium" | "Low";

interface Ticket {
  id: string;
  title: string;
  learnerName: string;
  course: string;
  status: TicketStatus;
  priority: TicketPriority;
  createdAt: string; // ISO string
  description?: string;
  learnerEmail?: string;
  conversationCount?: number;
}

interface SupportStats {
  open: number;
  inProgress: number;
  resolved: number;
  total: number;
}

// ── API ───────────────────────────────────────────────────────────────────────

const BASE = import.meta.env.VITE_API_BASE_URL ?? "";

async function getTickets(): Promise<Ticket[]> {
  const res = await fetch(`${BASE}/api/support/tickets`, { credentials: "include" });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

async function getStats(): Promise<SupportStats> {
  const res = await fetch(`${BASE}/api/support/stats`, { credentials: "include" });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

async function updateTicket(
  id: string,
  payload: { status?: TicketStatus; priority?: TicketPriority }
): Promise<Ticket> {
  const res = await fetch(`${BASE}/api/support/tickets/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

async function assignTicket(id: string): Promise<Ticket> {
  const res = await fetch(`${BASE}/api/support/tickets/${id}/assign`, {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

async function deleteTicket(id: string): Promise<void> {
  const res = await fetch(`${BASE}/api/support/tickets/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) throw new Error(`${res.status}`);
}

async function sendReply(id: string, message: string): Promise<void> {
  const res = await fetch(`${BASE}/api/support/tickets/${id}/reply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ message }),
  });
  if (!res.ok) throw new Error(`${res.status}`);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

const STATUS_STYLE: Record<TicketStatus, string> = {
  Open: "bg-red-50 text-red-600 border border-red-200",
  "In Progress": "bg-amber-50 text-amber-600 border border-amber-200",
  Resolved: "bg-green-50 text-green-600 border border-green-200",
};

const PRIORITY_STYLE: Record<TicketPriority, string> = {
  High: "bg-red-50 text-red-500 border border-red-200",
  Medium: "bg-amber-50 text-amber-500 border border-amber-200",
  Low: "bg-blue-50 text-blue-500 border border-blue-200",
};

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton({ h = 16, w = "100%" }: { h?: number; w?: string }) {
  return (
    <div
      className="animate-pulse rounded bg-gray-100"
      style={{ height: h, width: w }}
    />
  );
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  color,
  loading,
}: {
  label: string;
  value: number;
  color: string;
  loading: boolean;
}) {
  return (
    <div className="flex-1 min-w-[120px] border rounded-xl p-4 text-center bg-white">
      {loading ? (
        <Skeleton h={28} w="60%" />
      ) : (
        <p className={`text-2xl font-bold ${color}`}>{value}</p>
      )}
      <p className="text-xs text-gray-500 mt-1">{label}</p>
    </div>
  );
}

// ── Detail Panel ──────────────────────────────────────────────────────────────

function DetailPanel({
  ticket,
  onUpdate,
  onDelete,
}: {
  ticket: Ticket;
  onClose: () => void;
  onUpdate: (t: Ticket) => void;
  onDelete: (id: string) => void;
}) {
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const replyRef = useRef<HTMLTextAreaElement>(null);

  async function handleStatusChange(status: TicketStatus) {
    const updated = await updateTicket(ticket.id, { status });
    onUpdate(updated);
  }

  async function handlePriorityChange(priority: TicketPriority) {
    const updated = await updateTicket(ticket.id, { priority });
    onUpdate(updated);
  }

  async function handleSendReply() {
    if (!reply.trim()) return;
    setSending(true);
    try {
      await sendReply(ticket.id, reply);
      setReply("");
    } finally {
      setSending(false);
    }
  }

  async function handleAssign() {
    setAssigning(true);
    try {
      const updated = await assignTicket(ticket.id);
      onUpdate(updated);
    } finally {
      setAssigning(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this ticket?")) return;
    setDeleting(true);
    try {
      await deleteTicket(ticket.id);
      onDelete(ticket.id);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 h-full overflow-y-auto">
      <h2 className="font-semibold text-base leading-snug">{ticket.title}</h2>

      {/* Status */}
      <div>
        <label className="text-xs text-gray-400 mb-1 block">Status</label>
        <div className="relative">
          <select
            value={ticket.status}
            onChange={(e) => handleStatusChange(e.target.value as TicketStatus)}
            className={`w-full appearance-none rounded-lg px-3 py-2 pr-8 text-sm font-medium border focus:outline-none cursor-pointer ${STATUS_STYLE[ticket.status]}`}
            aria-label="select"
          >
            <option>Open</option>
            <option>In Progress</option>
            <option>Resolved</option>
          </select>
          <ChevronDown size={14} className="absolute right-2 top-2.5 pointer-events-none text-gray-400" />
        </div>
      </div>

      {/* Priority */}
      <div>
        <label className="text-xs text-gray-400 mb-1 block">Priority</label>
        <div className="relative">
          <select
            value={ticket.priority}
            onChange={(e) => handlePriorityChange(e.target.value as TicketPriority)}
            className={`w-full appearance-none rounded-lg px-3 py-2 pr-8 text-sm font-medium border focus:outline-none cursor-pointer ${PRIORITY_STYLE[ticket.priority]}`}
            aria-label="select"
          >
            <option>High</option>
            <option>Medium</option>
            <option>Low</option>
          </select>
          <ChevronDown size={14} className="absolute right-2 top-2.5 pointer-events-none text-gray-400" />
        </div>
      </div>

      {/* Learner */}
      <div>
        <label className="text-xs text-gray-400 mb-1 block">Learner</label>
        <p className="text-sm font-medium">{ticket.learnerName}</p>
        {ticket.learnerEmail && (
          <p className="text-xs text-gray-400">{ticket.learnerEmail}</p>
        )}
      </div>

      {/* Description */}
      {ticket.description && (
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Description</label>
          <p className="text-sm text-gray-600 leading-relaxed">{ticket.description}</p>
        </div>
      )}

      {/* Conversation */}
      <div>
        <label className="text-xs text-gray-400 mb-2 block">
          Conversation ({ticket.conversationCount ?? 0})
        </label>
        <div className="relative">
          <textarea
            ref={replyRef}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Type reply..."
            rows={2}
            className="w-full border rounded-lg px-3 py-2 pr-10 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-[#004900]"
          />
          <button
            onClick={handleSendReply}
            disabled={sending || !reply.trim()}
            className="absolute right-2 bottom-2 bg-[#1A3D2B] text-white rounded-lg p-1.5 disabled:opacity-40"
          >
            {sending ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
          </button>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 mt-auto pt-2">
        <button
          onClick={handleAssign}
          disabled={assigning}
          className="flex-1 border border-[#1A3D2B] text-[#1A3D2B] rounded-lg py-2 text-sm font-medium hover:bg-[#1A3D2B] hover:text-white transition-colors disabled:opacity-50"
        >
          {assigning ? "Assigning…" : "Assign to Me"}
        </button>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="border border-red-200 text-red-500 rounded-lg p-2 hover:bg-red-50 transition-colors disabled:opacity-50"
          aria-label="button"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function Support() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [stats, setStats] = useState<SupportStats | null>(null);
  const [loading, setLoading] = useState(true);


  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | TicketStatus>("All");
  const [priorityFilter, setPriorityFilter] = useState<"All" | TicketPriority>("All");
  const [selected, setSelected] = useState<Ticket | null>(null);

  useEffect(() => {
    Promise.all([getTickets(), getStats()])
      .then(([t, s]) => {
        setTickets(t);
        setStats(s);
        if (t.length) setSelected(t[0]);
      })
      .catch((e: Error) => console.error(e.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = tickets.filter((t) => {
    const q = search.toLowerCase();
    const matchSearch =
      t.title.toLowerCase().includes(q) ||
      t.learnerName.toLowerCase().includes(q) ||
      t.course.toLowerCase().includes(q);
    const matchStatus = statusFilter === "All" || t.status === statusFilter;
    const matchPriority = priorityFilter === "All" || t.priority === priorityFilter;
    return matchSearch && matchStatus && matchPriority;
  });

  function handleUpdate(updated: Ticket) {
    setTickets((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    if (selected?.id === updated.id) setSelected(updated);
  }

  function handleDelete(id: string) {
    setTickets((prev) => prev.filter((t) => t.id !== id));
    setSelected((prev) => (prev?.id === id ? null : prev));
  }

  return (
    <div className="p-4 md:p-6 font-sans min-h-screen bg-gray-50">
      {/* Stats */}
      <div className="flex flex-wrap gap-3 mb-6">
        <StatCard label="Open Tickets"  value={stats?.open ?? 0}     color="text-red-500"   loading={loading} />
        <StatCard label="In Progress"   value={stats?.inProgress ?? 0} color="text-amber-500" loading={loading} />
        <StatCard label="Resolved"      value={stats?.resolved ?? 0}  color="text-green-600" loading={loading} />
        <StatCard label="Total Tickets" value={stats?.total ?? 0}     color="text-[#1A3D2B]" loading={loading} />
      </div>

      {/* Content: list + detail */}
      <div className="flex flex-col lg:flex-row gap-4">

        {/* Left: ticket list */}
        <div className="flex-1 min-w-0 flex flex-col gap-3">

          {/* Search */}
          <div className="relative">
            <Search size={16} className="absolute left-3 top-3 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tickets..."
              className="w-full pl-9 pr-4 py-2.5 border rounded-xl text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#004900]"
            />
          </div>

          {/* Filters */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                className="w-full appearance-none border rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none cursor-pointer pr-8"
                aria-label="select"
              >
                <option value="All">All Status</option>
                <option>Open</option>
                <option>In Progress</option>
                <option>Resolved</option>
              </select>
              <ChevronDown size={14} className="absolute right-2.5 top-3 pointer-events-none text-gray-400" />
            </div>
            <div className="relative flex-1">
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value as typeof priorityFilter)}
                className="w-full appearance-none border rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none cursor-pointer pr-8"
                aria-label="select"
              >
                <option value="All">All Priority</option>
                <option>High</option>
                <option>Medium</option>
                <option>Low</option>
              </select>
              <ChevronDown size={14} className="absolute right-2.5 top-3 pointer-events-none text-gray-400" />
            </div>
          </div>

          {/* Ticket rows */}
          <div className="flex flex-col gap-2">
            {loading ? (
              [1, 2, 3].map((i) => <Skeleton key={i} h={80} />)
            ) : filtered.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-10">No tickets found.</p>
            ) : (
              filtered.map((ticket) => (
                <button
                  key={ticket.id}
                  onClick={() => setSelected(ticket)}
                  className={`text-left w-full border rounded-xl p-4 bg-white transition-all ${
                    selected?.id === ticket.id
                      ? "border-[#1A3D2B] ring-1 ring-[#1A3D2B]/20"
                      : "hover:border-gray-300"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium leading-snug">{ticket.title}</p>
                    <div className="flex gap-1.5 shrink-0">
                      <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[ticket.status]}`}>
                        {ticket.status}
                      </span>
                      <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${PRIORITY_STYLE[ticket.priority]}`}>
                        {ticket.priority}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {ticket.learnerName} · {ticket.course}
                  </p>
                  <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                    <Clock size={11} />
                    {fmtDate(ticket.createdAt)}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right: detail panel */}
        {selected && (
          <div className="w-full lg:w-80 xl:w-96 shrink-0 bg-white border rounded-xl p-5 self-start sticky top-4">
            <DetailPanel
              ticket={selected}
              onClose={() => setSelected(null)}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
            />
          </div>
        )}
      </div>
    </div>
  );
}