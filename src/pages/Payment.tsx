// src/pages/Payment.tsx
import { useEffect, useState, useMemo } from "react"
import { Search, Download, Eye, CreditCard, Clock, AlertCircle, TrendingUp, Wallet, ArrowUpRight, FileText, SlidersHorizontal, Sparkles, Loader2, Receipt, Filter } from "lucide-react"
import { useAuthGuard } from "../hooks/useAuthGuard"

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
  useAuthGuard();
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

  // helper for card accent — purely presentational, no state logic
  const cardAccent: Record<string, { wrap: string; iconWrap: string; subtle: string }> = {
    "Total Revenue": { wrap: "from-emerald-500/10 via-white to-white border-emerald-100", iconWrap: "bg-[#004900] text-white shadow-md", subtle: "text-emerald-700 bg-emerald-50 border-emerald-100" },
    Pending: { wrap: "from-amber-500/10 via-white to-white border-amber-100", iconWrap: "bg-amber-500 text-white shadow-md", subtle: "text-amber-700 bg-amber-50 border-amber-100" },
    Overdue: { wrap: "from-red-500/10 via-white to-white border-red-100", iconWrap: "bg-red-500 text-white shadow-md", subtle: "text-red-700 bg-red-50 border-red-100" },
    Transactions: { wrap: "from-slate-900/5 via-white to-white border-slate-200", iconWrap: "bg-slate-900 text-white shadow-md", subtle: "text-slate-700 bg-slate-50 border-slate-200" },
  }

  return (
    <div className="w-full space-y-5 animate-fade-in overflow-hidden">
      {/* Header — gradient hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#004900] via-[#006400] to-[#003600] p-4 sm:p-6 md:p-7 shadow-lg">
        <div className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-10 -left-10 h-36 w-36 rounded-full bg-white/5 blur-xl" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(255,255,255,0.08),transparent_60%)]" />
        <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between lg:gap-6">
          <div className="flex items-start gap-3 sm:gap-4 min-w-0 flex-1">
            <div className="hidden sm:flex h-11 w-11 md:h-12 md:w-12 items-center justify-center rounded-2xl bg-white/15 backdrop-blur border border-white/20 shadow-sm shrink-0">
              <Wallet className="h-5 w-5 md:h-6 md:w-6 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight text-white">Payments & Invoices</h1>
                <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium text-white backdrop-blur border border-white/10 shrink-0">
                  <Sparkles size={12} /> Finance
                </span>
              </div>
              <p className="mt-1 text-xs sm:text-sm text-white/80 max-w-2xl leading-relaxed">
                Track revenue, monitor overdue invoices and export transaction reports.
              </p>
              {stats && (
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 font-semibold text-[#004900] shadow-sm text-[11px] sm:text-xs">
                    <Receipt size={12} /> {stats.transactions} transactions
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 font-medium text-white border border-white/10 backdrop-blur text-[11px] sm:text-xs">
                    <ArrowUpRight size={12} /> {formatNaira(stats.totalRevenue)} revenue
                  </span>
                </div>
              )}
            </div>
          </div>
          <button
            onClick={handleExport}
            className="inline-flex items-center justify-center gap-2 self-start md:self-center bg-white text-[#004900] hover:bg-slate-50 px-4 sm:px-5 h-10 sm:h-11 rounded-2xl text-xs sm:text-sm font-semibold shadow-sm hover:shadow-md active:scale-[0.98] transition-all duration-200 whitespace-nowrap w-full md:w-auto"
          >
            <Download size={16} /> Export CSV
          </button>
        </div>
      </div>

      {/* STATS CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c, index) => {
          const accent = cardAccent[c.label] ?? cardAccent["Transactions"]
          return (
            <div
              key={c.label}
              className={`relative overflow-hidden rounded-2xl p-[1px] bg-gradient-to-br ${accent.wrap} shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300`}
              style={{ animationDelay: `${index * 0.06}s` }}
            >
              <div className="rounded-[15px] bg-white p-5 h-full">
                <div className="flex items-start justify-between gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${accent.iconWrap}`}>
                    <c.icon size={18} />
                  </div>
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide uppercase ${accent.subtle}`}>
                    {c.label === "Total Revenue" ? <TrendingUp size={11} /> : c.label === "Pending" ? <Clock size={11} /> : c.label === "Overdue" ? <AlertCircle size={11} /> : <FileText size={11} />}
                    {c.label}
                  </span>
                </div>
                <div className="mt-4">
                  <div className="text-2xl font-bold tracking-tight text-slate-900">{c.value}</div>
                  <div className="text-xs font-medium text-slate-500 mt-1">
                    {c.label === "Total Revenue" && stats ? "Lifetime gross" : c.label === "Pending" ? "Awaiting confirmation" : c.label === "Overdue" ? "Requires attention" : "All time volume"}
                  </div>
                </div>
                {/* subtle bottom bar */}
                <div className="mt-4 h-1 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div className={`h-full w-1/3 rounded-full ${c.label === "Total Revenue" ? "bg-[#004900]" : c.label === "Pending" ? "bg-amber-500" : c.label === "Overdue" ? "bg-red-500" : "bg-slate-900"}`} />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* SEARCH + FILTERS */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
        <div className="p-4 sm:p-5 flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1 group">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-slate-400 group-focus-within:text-[#004900] transition-colors" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              placeholder="Search by learner or invoice ID..."
              className="w-full pl-10 pr-4 h-[46px] bg-white border border-slate-200 rounded-2xl text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#004900]/15 focus:border-[#004900] transition-all duration-200 shadow-sm hover:border-slate-300 hover:shadow"
            />
          </div>
          <div className="flex gap-3">
            <div className="relative">
              <SlidersHorizontal size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <select
                value={status}
                onChange={(e) => { setStatus(e.target.value); setPage(1) }}
                className="pl-8 pr-9 h-[46px] bg-white border border-slate-200 rounded-2xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#004900]/15 focus:border-[#004900] transition-all duration-200 shadow-sm hover:border-slate-300 cursor-pointer appearance-none"
                title="Filter by status"
              >
                <option value="all">All Status</option>
                <option value="Paid">Paid</option>
                <option value="Pending">Pending</option>
                <option value="Overdue">Overdue</option>
              </select>
              <Filter size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>
            <button
              onClick={handleExport}
              className="hidden sm:inline-flex items-center justify-center gap-2 px-5 h-[46px] bg-[#004900] hover:bg-[#005c00] text-white rounded-2xl text-sm font-semibold transition-all duration-300 shadow-sm hover:shadow-md active:scale-[0.98] whitespace-nowrap"
            >
              <Download size={16} /> Export
            </button>
            {/* mobile export icon */}
            <button
              onClick={handleExport}
              className="sm:hidden inline-flex items-center justify-center h-[46px] w-[46px] bg-[#004900] hover:bg-[#005c00] text-white rounded-2xl shadow-sm transition-colors"
              aria-label="Export"
              title="Export"
            >
              <Download size={18} />
            </button>
          </div>
        </div>

        {/* active filter chips */}
        {(debouncedSearch || status !== "all") && (
          <div className="px-4 sm:px-5 pb-4 flex flex-wrap items-center gap-2 animate-slide-down">
            <span className="text-xs font-medium text-slate-500">Filters:</span>
            {debouncedSearch && (
              <span className="inline-flex items-center gap-1.5 bg-slate-900 text-white pl-3 pr-1.5 py-1.5 rounded-full text-xs font-medium shadow-sm">
                <Search size={12} className="opacity-70" /> &ldquo;{debouncedSearch}&rdquo;
                <button
                  onClick={() => { setSearch(""); setPage(1) }}
                  className="ml-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/15 hover:bg-white/25 transition-colors"
                  aria-label="Clear search"
                >
                  <span className="text-sm leading-none">×</span>
                </button>
              </span>
            )}
            {status !== "all" && (
              <span className={`inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 rounded-full text-xs font-semibold border shadow-sm ${
                status === "Paid" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                status === "Pending" ? "bg-amber-50 text-amber-700 border-amber-200" :
                "bg-red-50 text-red-700 border-red-200"
              }`}>
                {status}
                <button
                  onClick={() => { setStatus("all"); setPage(1) }}
                  className="ml-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/5 hover:bg-black/10 transition-colors"
                  aria-label="Clear status"
                >
                  <span className="text-sm leading-none">×</span>
                </button>
              </span>
            )}
            {(debouncedSearch || status !== "all") && (
              <button
                onClick={() => { setSearch(""); setStatus("all"); setPage(1) }}
                className="text-xs font-semibold text-[#004900] hover:text-[#003600] bg-[#004900]/10 hover:bg-[#004900]/15 px-3 py-1.5 rounded-full transition-colors"
              >
                Clear all
              </button>
            )}
          </div>
        )}

        {/* TABLE — desktop */}
        <div className="hidden md:block overflow-x-auto border-t border-slate-100">
          <table className="w-full text-sm min-w-[720px]">
            <thead className="bg-slate-50/80">
              <tr className="border-b border-slate-100 text-slate-500">
                <th className="text-left px-6 py-4 font-bold text-[11px] uppercase tracking-widest">Invoice ID</th>
                <th className="text-left px-6 py-4 font-bold text-[11px] uppercase tracking-widest">Learner</th>
                <th className="text-left px-6 py-4 font-bold text-[11px] uppercase tracking-widest">Amount</th>
                <th className="text-left px-6 py-4 font-bold text-[11px] uppercase tracking-widest">Method</th>
                <th className="text-left px-6 py-4 font-bold text-[11px] uppercase tracking-widest">Date</th>
                <th className="text-left px-6 py-4 font-bold text-[11px] uppercase tracking-widest">Status</th>
                <th className="text-left px-6 py-4 font-bold text-[11px] uppercase tracking-widest">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 bg-white">
              {loading? (
                <tr><td colSpan={7} className="px-6 py-14 text-center">
                  <div className="flex flex-col items-center justify-center gap-3">
                    <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[#004900]/10 border border-[#004900]/10">
                      <Loader2 className="w-5 h-5 text-[#004900] animate-spin" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-700">Loading invoices...</p>
                      <p className="text-xs text-slate-400 mt-0.5">Fetching the latest payments</p>
                    </div>
                  </div>
                </td></tr>
              ) : invoices.length === 0? (
                <tr><td colSpan={7} className="px-6 py-14 text-center">
                  <div className="flex flex-col items-center justify-center gap-3">
                    <div className="h-12 w-12 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400">
                      <Receipt size={20} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-700">No invoices found</p>
                      <p className="text-xs text-slate-400 mt-1">Try adjusting search or status filter</p>
                    </div>
                    {(search || status !== "all") && (
                      <button
                        onClick={() => { setSearch(""); setStatus("all"); setPage(1) }}
                        className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold text-[#004900] bg-[#004900]/10 hover:bg-[#004900]/15 px-3 py-1.5 rounded-full transition-colors"
                      >
                        Clear filters
                      </button>
                    )}
                  </div>
                </td></tr>
              ) : (
                invoices.map((inv) => (
                  <tr key={inv._id} className="hover:bg-[#004900]/[0.03] transition-colors duration-200 group">
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 font-mono text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-full">
                        <FileText size={12} className="text-slate-400" /> {inv.invoiceId}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2.5">
                        <img
                          src={`https://ui-avatars.com/api/?name=${encodeURIComponent(inv.learnerName)}&background=004900&color=fff&bold=true`}
                          alt=""
                          className="w-8 h-8 rounded-full object-cover ring-2 ring-white shadow-sm shrink-0"
                        />
                        <span className="font-medium text-slate-800 truncate max-w-[160px]">{inv.learnerName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-900">{formatNaira(inv.amount)}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 text-slate-600 bg-white border border-slate-200 px-2.5 py-1 rounded-full text-xs font-medium shadow-sm">
                        <CreditCard size={12} className="text-slate-400" /> {inv.method}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-600 font-medium whitespace-nowrap">{new Date(inv.date).toISOString().split('T')[0]}</td>
                    <td className="px-6 py-4"><span className={`${statusBadge(inv.status)} border shadow-sm ${inv.status === "Paid" ? "border-green-200" : inv.status === "Pending" ? "border-orange-200" : "border-red-200"}`}>{inv.status}</span></td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1">
                        <button title="View" className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-[#004900] hover:border-[#004900]/20 hover:bg-[#004900]/5 shadow-sm hover:shadow transition-all duration-200"><Eye size={16} /></button>
                        <button title="Download" className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-[#004900] hover:border-[#004900]/20 hover:bg-[#004900]/5 shadow-sm hover:shadow transition-all duration-200"><Download size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* MOBILE CARDS */}
        <div className="md:hidden divide-y divide-slate-100 border-t border-slate-100">
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 px-4 text-center">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[#004900]/10 border border-[#004900]/10"><Loader2 className="w-5 h-5 text-[#004900] animate-spin" /></div>
              <p className="text-sm font-semibold text-slate-700">Loading invoices...</p>
              <p className="text-xs text-slate-400">Fetching the latest payments</p>
            </div>
          ) : invoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 px-6 text-center">
              <div className="h-12 w-12 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400"><Receipt size={20} /></div>
              <p className="text-sm font-semibold text-slate-700">No invoices found</p>
              <p className="text-xs text-slate-400">Try adjusting search or status filter</p>
              {(search || status !== "all") && (
                <button onClick={() => { setSearch(""); setStatus("all"); setPage(1) }} className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold text-[#004900] bg-[#004900]/10 px-3 py-1.5 rounded-full">Clear filters</button>
              )}
            </div>
          ) : (
            invoices.map((inv) => (
              <div key={inv._id} className="p-4 space-y-3 hover:bg-slate-50/50 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(inv.learnerName)}&background=004900&color=fff&bold=true`} alt="" className="w-10 h-10 rounded-full object-cover ring-2 ring-white shadow-sm shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm text-slate-900 truncate">{inv.learnerName}</p>
                      <span className="inline-flex items-center gap-1 font-mono text-[11px] font-bold text-slate-700 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-full mt-1"><FileText size={10} />{inv.invoiceId}</span>
                    </div>
                  </div>
                  <span className={`${statusBadge(inv.status)} border shadow-sm shrink-0 text-[11px] ${inv.status === "Paid" ? "border-green-200" : inv.status === "Pending" ? "border-orange-200" : "border-red-200"}`}>{inv.status}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-bold text-slate-900 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-full">{formatNaira(inv.amount)}</span>
                  <span className="inline-flex items-center gap-1 text-slate-600 bg-white border border-slate-200 px-2.5 py-1 rounded-full font-medium"><CreditCard size={11} />{inv.method}</span>
                  <span className="text-slate-500">{new Date(inv.date).toISOString().split('T')[0]}</span>
                </div>
                <div className="flex gap-2">
                  <button className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"><Eye size={14} />View</button>
                  <button className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-xl bg-[#004900] text-white text-xs font-semibold hover:bg-[#003d00]"><Download size={14} />Download</button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* PAGINATION */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4 bg-slate-50/60 border-t border-slate-100">
          <p className="text-xs font-medium text-slate-600 bg-white border border-slate-200 px-3 py-1.5 rounded-full shadow-sm order-2 sm:order-1">
            Showing <b className="text-slate-900">{(page-1)*limit + 1}</b> - <b className="text-slate-900">{Math.min(page*limit, total)}</b> of <b className="text-slate-900">{total}</b>
          </p>
          <div className="flex items-center gap-1.5 order-1 sm:order-2">
            <button
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
              className="px-3.5 py-2 text-sm font-medium bg-white border border-slate-200 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 hover:border-slate-300 hover:shadow-sm shadow-sm transition-all duration-200"
            >
              Prev
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const p = i + 1
              return (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-9 h-9 text-sm font-semibold rounded-xl border shadow-sm transition-all duration-200 ${p === page? "bg-[#004900] text-white border-[#004900] shadow-md" : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300"}`}
                >
                  {p}
                </button>
              )
            })}
            <button
              disabled={page === totalPages}
              onClick={() => setPage(p => p + 1)}
              className="px-3.5 py-2 text-sm font-medium bg-white border border-slate-200 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 hover:border-slate-300 hover:shadow-sm shadow-sm transition-all duration-200"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
