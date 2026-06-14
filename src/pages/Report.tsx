import { useEffect, useState } from "react"
import { Download, Users, BookOpen, Award, TrendingUp, BarChart3 } from "lucide-react"
import { useAuthGuard } from "../hooks/useAuthGuard"

type Period = "week" | "month" | "quarter" | "year"

interface Metric { value: number; change: number }
interface ReportData {
  summary: {
    activeLearners: Metric
    modulesCompleted: Metric
    avgCompletion: Metric
    revenue: Metric
    communityPosts: Metric
    mentorFeedback: Metric
  }
  cards: {
    enrollment: Metric
    completion: Metric
    assessment: Metric
    revenue: Metric
  }
  tracks: { name: string; completion: number; enrolled: number }[]
  engagement: { day: string; value: number }[]
  retention: { label: string; value: number }[]
}

const periods: Period[] = ["week", "month", "quarter", "year"]

// --- MOCK GENERATOR ---
const getMockData = (period: Period): ReportData => {
  const mult = { week: 0.25, month: 1, quarter: 3, year: 12 }[period]

  return {
    summary: {
      activeLearners: { value: Math.round(1247 * mult), change: 12 },
      modulesCompleted: { value: Math.round(3894 * mult), change: 8 },
      avgCompletion: { value: 76, change: 5 },
      revenue: { value: Math.round(2845000 * mult), change: 15 },
      communityPosts: { value: Math.round(342 * mult), change: 22 },
      mentorFeedback: { value: 89, change: 3 },
    },
    cards: {
      enrollment: { value: Math.round(186 * mult), change: 14 },
      completion: { value: 76, change: 5 },
      assessment: { value: 82, change: 4 },
      revenue: { value: Math.round(2845000 * mult), change: 15 },
    },
    tracks: [
      { name: "Product Design", completion: 78, enrolled: Math.round(420 * mult) },
      { name: "Frontend Development", completion: 71, enrolled: Math.round(380 * mult) },
      { name: "Data Analytics", completion: 65, enrolled: Math.round(310 * mult) },
      { name: "Digital Marketing", completion: 82, enrolled: Math.round(290 * mult) },
    ],
    engagement: [
      { day: "Mon", value: 68 },
      { day: "Tue", value: 74 },
      { day: "Wed", value: 81 },
      { day: "Thu", value: 76 },
      { day: "Fri", value: 69 },
      { day: "Sat", value: 45 },
      { day: "Sun", value: 38 },
    ],
    retention: [
      { label: "Week 1", value: 92 },
      { label: "Week 2", value: 84 },
      { label: "Week 4", value: 71 },
      { label: "Week 8", value: 58 },
    ],
  }
}

export default function Report() {
  useAuthGuard();
  const [period, setPeriod] = useState<Period>("month")
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [usingMock, setUsingMock] = useState(false)

  useEffect(() => {
    setLoading(true)
    setUsingMock(false)

    fetch(`/api/admin/reports?period=${period}`, { credentials: "include" })
     .then(async r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        const json = await r.json()
        if (!json?.summary) throw new Error("Invalid shape")
        setData(json)
      })
     .catch(err => {
        console.warn("Backend not reachable, using mock:", err)
        setData(getMockData(period))
        setUsingMock(true)
      })
     .finally(() => setLoading(false))
  }, [period])

  const fmt = (n: number) => new Intl.NumberFormat("en-NG").format(n)
  const fmtCompact = (n: number) =>
    new Intl.NumberFormat("en-NG", { notation: "compact", maximumFractionDigits: 1 }).format(n)
  const fmtNaira = (n: number) => `₦${fmtCompact(n)}`

  const handleExport = () => {
    if (usingMock) return alert("Export disabled in demo mode")
    window.location.href = `/api/admin/reports/export?period=${period}`
  }
  const exportFile = (type: "analytics"|"learners"|"financial", format: string) => {
    if (usingMock) return alert("Export disabled in demo mode")
    window.location.href = `/api/admin/reports/export/${type}?format=${format}&period=${period}`
  }

  if (loading ||!data) {
    return <div className="p-6">Loading reports...</div>
  }

  const s = data.summary
  const c = data.cards

  return (
    <div className="p-4 md:p-6 bg-[#f8fafc] min-h-full">
      {/* Backend status banner */}
      {/* {usingMock && (
        <div className="flex items-center gap-2 mb-4 p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-sm">
          <AlertTriangle size={16} />
          <span>Backend API not connected – showing demo data for "{period}". Connect `/api/admin/reports` to see live data.</span>
        </div>
      )} */}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 w-full ">
        <div className="flex flex-col md:flex-row items-center gap-3 md:justify-between w-full">
          <div className="flex bg-gray-100 rounded-xl p-1">
            {periods.map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-4 py-2 rounded-lg text-sm capitalize transition ${
                  period === p? "bg-[#004900] text-white" : "text-gray-600 hover:text-black"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          <button onClick={handleExport} className="flex items-center gap-2 bg-[#004900] text-white px-4 py-2.5 rounded-xl hover:bg-[#1a2f5a]  cursor-pointer" disabled={usingMock} >
            <Download size={18} /> Export Report
          </button>
        </div>
      </div>

      {/* Top metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {[
          { label: "Active Learners", v: fmt(s.activeLearners.value), ch: s.activeLearners.change },
          { label: "Modules Completed", v: fmt(s.modulesCompleted.value), ch: s.modulesCompleted.change },
          { label: "Avg Completion Rate", v: `${s.avgCompletion.value}%`, ch: s.avgCompletion.change },
          { label: "Total Revenue", v: fmtNaira(s.revenue.value), ch: s.revenue.change },
          { label: "Community Posts", v: fmt(s.communityPosts.value), ch: s.communityPosts.change },
          { label: "Mentor Feedback", v: `${s.mentorFeedback.value}%`, ch: s.mentorFeedback.change },
        ].map(m => (
          <div key={m.label} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <p className="text-sm text-gray-500 mb-1">{m.label}</p>
            <div className="flex items-end justify-between">
              <p className="text-2xl font-bold text-[#0d2147]">{m.v}</p>
              <span className={`text-sm ${m.ch >= 0? 'text-green-600' : 'text-red-600'}`}>{m.ch >= 0? '+' : ''}{m.ch}%</span>
            </div>
          </div>
        ))}
      </div>

      {/* 4 report cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <ReportCard icon={<Users />} color="bg-blue-600" title="Learner Enrollment Report" desc="Track new registrations and enrollment trends" value={fmt(c.enrollment.value)} change={c.enrollment.change} sub="This Month" />
        <ReportCard icon={<BookOpen />} color="bg-green-600" title="Course Completion Report" desc="Module and unit completion rates by track" value={`${c.completion.value}%`} change={c.completion.change} sub="Avg Completion" />
        <ReportCard icon={<Award />} color="bg-purple-600" title="Assessment Performance" desc="Quiz scores and assessment analytics" value={`${c.assessment.value}%`} change={c.assessment.change} sub="Avg Score" />
        <ReportCard icon={<TrendingUp />} color="bg-orange-600" title="Revenue Analytics" desc="Payment and financial performance" value={fmtNaira(c.revenue.value)} change={c.revenue.change} sub="Total Revenue" />
      </div>

      {/* Track Performance */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
        <h2 className="text-lg font-semibold text-[#0d2147] mb-4">Track Performance</h2>
        <div className="space-y-5">
          {data.tracks.map(t => (
            <div key={t.name} className="border-b border-gray-100 pb-4 last:border-0">
              <div className="flex justify-between mb-1">
                <p className="font-medium text-[#0d2147]">{t.name}</p>
                <p className="font-semibold text-[#0d2147]">{t.completion}%</p>
              </div>
              <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                <div className="h-full bg-[#0d2147] rounded-full" style={{ width: `${t.completion}%` }} />
              </div>
              <p className="text-xs text-gray-500 mt-1">{fmt(t.enrolled)} learners enrolled</p>
            </div>
          ))}
        </div>
      </div>

      {/* Engagement + Retention */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-[#0d2147] mb-4">Engagement by Day</h3>
          <div className="space-y-3">
            {data.engagement.map(e => (
              <div key={e.day} className="flex items-center gap-3">
                <span className="w-20 text-sm text-gray-600">{e.day}</span>
                <div className="flex-1 bg-gray-100 h-2 rounded-full overflow-hidden">
                  <div className="h-full bg-green-800 rounded-full" style={{ width: `${e.value}%` }} />
                </div>
                <span className="w-10 text-right text-sm font-medium">{e.value}%</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-[#0d2147] mb-4">Learner Retention</h3>
          <div className="space-y-3">
            {data.retention.map(r => (
              <div key={r.label} className="flex items-center gap-3">
                <span className="w-16 text-sm text-gray-600">{r.label}</span>
                <div className="flex-1 bg-gray-100 h-2 rounded-full overflow-hidden">
                  <div className="h-full bg-yellow-600 rounded-full" style={{ width: `${r.value}%` }} />
                </div>
                <span className="w-10 text-right text-sm font-medium">{r.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Export */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h3 className="font-semibold text-[#0d2147] mb-4">Export Reports</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <ExportBtn title="Analytics Report" sub="PDF format" onClick={() => exportFile("analytics","pdf")} disabled={usingMock} />
          <ExportBtn title="Learner Data" sub="Excel format" onClick={() => exportFile("learners","xlsx")} disabled={usingMock} />
          <ExportBtn title="Financial Report" sub="CSV format" onClick={() => exportFile("financial","csv")} disabled={usingMock} />
        </div>
      </div>
    </div>
  )
}

function ReportCard({ icon, color, title, desc, value, change, sub }: any) {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
      <div className={`w-10 h-10 ${color} rounded-xl flex items-center justify-center text-white mb-3`}>{icon}</div>
      <h4 className="font-medium text-[#0d2147]">{title}</h4>
      <p className="text-sm text-gray-500 mb-4">{desc}</p>
      <div className="flex items-end justify-between pt-3 border-t border-gray-100">
        <p className="text-2xl font-bold text-[#0d2147]">{value}</p>
        <div className="text-right">
          <p className={`text-sm ${change >= 0? 'text-green-600' : 'text-red-600'}`}>{change >= 0? '+' : ''}{change}%</p>
          <p className="text-xs text-gray-500">{sub}</p>
        </div>
      </div>
    </div>
  )
}

function ExportBtn({ title, sub, onClick, disabled }: { title: string; sub: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} className="flex items-center gap-3 p-4 border border-gray-200 rounded-xl hover:bg-gray-50 text-left disabled:opacity-50 disabled:cursor-not-allowed">
      <BarChart3 className="text-[#0d2147]" size={20} />
      <div>
        <p className="font-medium text-[#0d2147]">{title}</p>
        <p className="text-xs text-gray-500">{sub}</p>
      </div>
    </button>
  )
}