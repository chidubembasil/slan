import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useAuthGuard } from "../hooks/useAuthGuard"
const BASE = import.meta.env.VITE_BASE_URL?? "";

interface Report {
  id: string;
  title: string;
  reporterName: string;
  course: string;
  reportedAt: string;
  type: "Post" | "Comment";
  status: "Pending Review" | "Under Review" | "Resolved";
  reason: string;
  author: string;
  source: string;
  content: string;
}

interface Stats {
  pending: number;
  underReview: number;
  resolved: number;
  total: number;
}

export default function Community() {
  useAuthGuard();
  const [allReports, setAllReports] = useState<Report[]>([]);
  const [stats, setStats] = useState<Stats>({ pending: 0, underReview: 0, resolved: 0, total: 0 });
  const [selected, setSelected] = useState<Report | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All Status");
  const [typeFilter, setTypeFilter] = useState<string>("All Types");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [reportsRes, statsRes] = await Promise.all([
        fetch(`${BASE}/api/reports`),
        fetch(`${BASE}/api/reports/stats`).catch(() => null),
      ]);

      const reportsData: Report[] = await reportsRes.json();
      setAllReports(reportsData);

      if (statsRes?.ok) {
        setStats(await statsRes.json());
      } else {
        setStats({
          pending: reportsData.filter(r => r.status === "Pending Review").length,
          underReview: reportsData.filter(r => r.status === "Under Review").length,
          resolved: reportsData.filter(r => r.status === "Resolved").length,
          total: reportsData.length,
        });
      }

      if (reportsData.length > 0) handleSelectReport(reportsData[0]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const filteredReports = useMemo(() => {
    return allReports.filter((r) => {
      const q = search.toLowerCase().trim();
      const matchesSearch =!q ||
        r.title.toLowerCase().includes(q) ||
        r.reporterName.toLowerCase().includes(q) ||
        r.course.toLowerCase().includes(q) ||
        r.content.toLowerCase().includes(q);
      const matchesStatus = statusFilter === "All Status" || r.status === statusFilter;
      const matchesType = typeFilter === "All Types" || r.type === typeFilter;
      return matchesSearch && matchesStatus && matchesType;
    });
  }, [allReports, search, statusFilter, typeFilter]);

  async function handleSelectReport(report: Report) {
    setSelected(report);
    try {
      const res = await fetch(`${BASE}/api/reports/${report.id}/notes`);
      setNotes(res.ok? (await res.json()).notes || "" : "");
    } catch { setNotes(""); }
  }

  async function updateStatus(newStatus: Report["status"]) {
    if (!selected) return;
    const updated = allReports.map(r => r.id === selected.id? {...r, status: newStatus } : r);
    setAllReports(updated);
    setSelected({...selected, status: newStatus });
    setStats({
      pending: updated.filter(r => r.status === "Pending Review").length,
      underReview: updated.filter(r => r.status === "Under Review").length,
      resolved: updated.filter(r => r.status === "Resolved").length,
      total: updated.length,
    });
    await fetch(`${BASE}/api/reports/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    }).catch(console.error);
  }

  async function handleAction(action: "approve" | "request_edit" | "remove") {
    if (!selected) return;
    await fetch(`${BASE}/api/reports/${selected.id}/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    }).catch(console.error);
    updateStatus(action === "request_edit"? "Under Review" : "Resolved");
  }

  async function saveNotes() {
    if (!selected) return;
    await fetch(`${BASE}/api/reports/${selected.id}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes }),
    }).catch(console.error);
  }

  const getStatusColor = (s: string) => s === "Pending Review"? "text-red-600 bg-red-50 border-red-200" : s === "Under Review"? "text-amber-600 bg-amber-50 border-amber-200" : "text-green-700 bg-green-50 border-green-200";

  return (
    <div className="min-h-screen bg-gray-50 p-4 lg:p-6">
      <div className="max-w- mx-auto">

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Pending Review", value: stats.pending, color: "text-red-600" },
            { label: "Under Review", value: stats.underReview, color: "text-amber-600" },
            { label: "Resolved", value: stats.resolved, color: "text-[#004900]" },
            { label: "Total Reports", value: stats.total, color: "text-slate-700" },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl border p-5">
              <div className={`text-3xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-gray-500 mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2">
            <div className="bg-white rounded-xl border p-4 mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search reports..."
                  className="w-full pl-10 pr-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#004900]/30 focus:border-[#004900]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2.5 border rounded-lg text-sm" aria-label="select">
                  <option>All Status</option>
                  <option>Pending Review</option>
                  <option>Under Review</option>
                  <option>Resolved</option>
                </select>
                <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="px-3 py-2.5 border rounded-lg text-sm" aria-label="select">
                  <option>All Types</option>
                  <option>Post</option>
                  <option>Comment</option>
                </select>
              </div>
            </div>

            <div className="space-y-3 max-h-[calc(100vh-320px)] overflow-y-auto">
              {loading? <div className="bg-white rounded-xl border p-12 text-center text-gray-500">Loading...</div> :
               filteredReports.map(r => (
                <div key={r.id} onClick={() => handleSelectReport(r)} className={`bg-white rounded-xl border p-4 cursor-pointer hover:shadow-md ${selected?.id === r.id? "border-[#004900] ring-2 ring-[#004900]/20" : "border-gray-200"}`}>
                  <div className="flex justify-between">
                    <div>
                      <h3 className="font-medium text-sm">🚩 {r.title}</h3>
                      <p className="text-xs text-gray-600 mt-1">By {r.reporterName} • {r.course}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={`text- px-2 py-1 rounded border ${r.type === "Post"? "bg-blue-50 text-blue-700" : "bg-purple-50 text-purple-700"}`}>{r.type}</span>
                      <span className={`text- px-2 py-1 rounded border ${getStatusColor(r.status)}`}>{r.status.replace(" Review","")}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="xl:col-span-1">
            <div className="bg-white rounded-xl border sticky top-6">
              {selected && (
                <div className="p-5">
                  <h2 className="font-semibold mb-3">{selected.title}</h2>
                  <select value={selected.status} onChange={e => updateStatus(e.target.value as any)} className={`w-full px-3 py-2.5 rounded-lg text-sm font-medium border-2 mb-4 ${getStatusColor(selected.status)}`} aria-label="select">
                    <option>Pending Review</option>
                    <option>Under Review</option>
                    <option>Resolved</option>
                  </select>

                  <div className="text-xs space-y-2 border-y py-3 mb-4">
                    <p><span className="text-gray-500">Reported By:</span> {selected.reporterName}</p>
                    <p><span className="text-gray-500">Reason:</span> {selected.reason}</p>
                    <p><span className="text-gray-500">Author:</span> {selected.author}</p>
                  </div>

                  <div className="bg-red-50 border border-red-200 rounded p-3 text-xs text-red-900 mb-4">{selected.content}</div>

                  <button onClick={() => handleAction("approve")} className="w-full py-2.5 bg-[#004900] hover:bg-[#003500] text-white rounded-lg text-sm font-medium mb-2">✓ Approve Content</button>
                  <button onClick={() => handleAction("request_edit")} className="w-full py-2.5 bg-white text-[#004900] border-2 border-[#004900] rounded-lg text-sm font-medium mb-2">↻ Request Edit</button>
                  <button onClick={() => handleAction("remove")} className="w-full py-2.5 bg-white text-red-600 border border-red-300 rounded-lg text-sm font-medium mb-4">🗑 Remove Content</button>

                  <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Add notes..." className="w-full h-20 px-3 py-2 border rounded-lg text-xs focus:ring-2 focus:ring-[#004900]/30" />
                  <button onClick={saveNotes} className="w-full mt-2 py-2.5 bg-[#004900] hover:bg-[#003500] text-white rounded-lg text-sm">Save Notes</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}