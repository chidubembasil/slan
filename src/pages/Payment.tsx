// src/pages/Payment.tsx
import { useEffect, useState, useMemo } from "react"
import { Search, Download, Eye, CreditCard, Clock, AlertCircle, TrendingUp } from "lucide-react"

type Stats = {
  totalRevenue: number
  pending: number
  overdue: number
  transactions: number
}

type Invoice = {
  _id: string
  invoiceId: string
  learnerName: string
  amount: number
  method: string
  date: string
  status: "Paid" | "Pending" | "Overdue"
}

const API_BASE = "/api/payments" // <-- change this

export default function Payment() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [limit] = useState(10)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("all")

  // debounce search
  const [debouncedSearch, setDebouncedSearch] = useState("")
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 500)
    return () => clearTimeout(t)
  }, [search])

  // fetch stats
  useEffect(() => {
    fetch(`${API_BASE}/stats`)
     .then(r => r.json())
     .then(setStats)
     .catch(console.error)
  }, [])

  // fetch invoices
  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
      search: debouncedSearch,
      status,
    })
    fetch(`${API_BASE}/invoices?${params}`)
     .then(r => r.json())
     .then(data => {
        setInvoices(data.data || [])
        setTotal(data.total || 0)
      })
     .catch(console.error)
     .finally(() => setLoading(false))
  }, [page, limit, debouncedSearch, status])

  const totalPages = Math.ceil(total / limit)

  const formatNaira = (n: number) =>
    new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(n)

  const formatCompact = (n: number) =>
    n >= 1000? `₦${Math.round(n/1000)}K` : formatNaira(n)

  const statusBadge = (s: string) => {
    const map = {
      Paid: "bg-green-100 text-green-700",
      Pending: "bg-orange-100 text-orange-700",
      Overdue: "bg-red-100 text-red-700",
    }
    return `px-3 py-1 rounded-full text-xs font-medium ${map[s as keyof typeof map]}`
  }

  const handleExport = () => {
    const params = new URLSearchParams({ search: debouncedSearch, status })
    window.open(`${API_BASE}/export?${params}`, "_blank")
  }

  const cards = useMemo(() => [
    { label: "Total Revenue", value: stats? formatCompact(stats.totalRevenue) : "...", icon: CreditCard, color: "text-green-600" },
    { label: "Pending", value: stats? formatCompact(stats.pending) : "...", icon: Clock, color: "text-orange-500" },
    { label: "Overdue", value: stats?.overdue?? "...", icon: AlertCircle, color: "text-red-600" },
    { label: "Transactions", value: stats?.transactions?? "...", icon: TrendingUp, color: "text-slate-700" },
  ], [stats])

  return (
    <div className="w-full">
      {/* Page Title - matches your screenshot */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-slate-800">Payments & Invoices</h1>
      </div>

      {/* STATS CARDS - hand coded */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {cards.map((c) => (
          <div key={c.label} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
            <c.icon className={`w-5 h-5 mb-3 ${c.color}`} />
            <div className="text-2xl font-bold text-slate-800">{c.value}</div>
            <div className="text-sm text-slate-500 mt-1">{c.label}</div>
          </div>
        ))}
      </div>

      {/* SEARCH + FILTERS */}
      <div className="flex flex-col md:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search by learner or invoice ID..."
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
          />
        </div>
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1) }}
          className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm"
          title="select"
        >
          <option value="all">All Status</option>
          <option value="Paid">Paid</option>
          <option value="Pending">Pending</option>
          <option value="Overdue">Overdue</option>
        </select>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#004900] text-white rounded-xl text-sm hover:bg-[#004900]"
        >
          <Download size={16} /> Export
        </button>
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-slate-600">
                <th className="text-left px-6 py-4 font-medium">Invoice ID</th>
                <th className="text-left px-6 py-4 font-medium">Learner</th>
                <th className="text-left px-6 py-4 font-medium">Amount</th>
                <th className="text-left px-6 py-4 font-medium">Method</th>
                <th className="text-left px-6 py-4 font-medium">Date</th>
                <th className="text-left px-6 py-4 font-medium">Status</th>
                <th className="text-left px-6 py-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading? (
                <tr><td colSpan={7} className="px-6 py-10 text-center text-slate-500">Loading...</td></tr>
              ) : invoices.length === 0? (
                <tr><td colSpan={7} className="px-6 py-10 text-center text-slate-500">No invoices found</td></tr>
              ) : (
                invoices.map((inv) => (
                  <tr key={inv._id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="px-6 py-4 font-medium text-slate-800">{inv.invoiceId}</td>
                    <td className="px-6 py-4 text-slate-700">{inv.learnerName}</td>
                    <td className="px-6 py-4 font-semibold text-slate-800">{formatNaira(inv.amount)}</td>
                    <td className="px-6 py-4 text-slate-500">{inv.method}</td>
                    <td className="px-6 py-4 text-slate-500">{new Date(inv.date).toISOString().split('T')[0]}</td>
                    <td className="px-6 py-4"><span className={statusBadge(inv.status)}>{inv.status}</span></td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3 text-slate-500">
                        <button title="View"><Eye size={16} /></button>
                        <button title="Download"><Download size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100">
          <p className="text-xs text-slate-500">
            Showing {(page-1)*limit + 1} - {Math.min(page*limit, total)} of {total}
          </p>
          <div className="flex items-center gap-2">
            <button
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
              className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-40"
            >
              Prev
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const p = i + 1
              return (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-8 h-8 text-sm rounded-lg ${p === page? "bg-[#004900] text-white" : "border"}`}
                >
                  {p}
                </button>
              )
            })}
            <button
              disabled={page === totalPages}
              onClick={() => setPage(p => p + 1)}
              className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}