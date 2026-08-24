// Dashboard.tsx
import { useEffect, useState } from "react";
import {
  Users,
  BookOpen,
  GitBranch,
  Layers,
  Boxes,
  LayoutGrid,
  CheckSquare,
  CreditCard,
  Flag,
  Award,
  Sparkles,
  ArrowUpRight,
  Activity,
  ShieldCheck,
  Clock3,
  AlertTriangle,
  TrendingUp,
} from "lucide-react";
import { useAuthGuard } from "../hooks/useAuthGuard"

const BASE = import.meta.env.VITE_BASE_URL ?? "";

interface Stats {
  totalUsers: number;
  totalCourses: number;
  totalTracks: number;
  totalModules: number;
  totalUnits: number;
}

interface RecentUser {
  id: number;
  fullName: string;
  email: string;
  role: string;
  avatar?: string;
  createdAt: string;
}

interface Alert {
  id: string;
  message: string;
}

const token = () => localStorage.getItem("adminAccessToken") || "";
const authHeaders = () => ({ Authorization: `Bearer ${token()}` });

// Normalizes several possible response shapes into a plain array:
// - a raw array
// - { success, data: [...] }
// - { success, data: { users: [...] } } / { data: { items: [...] } } (paginated list endpoints)
function extractArray(json: any): any[] {
  if (Array.isArray(json)) return json;
  if (Array.isArray(json?.data)) return json.data;
  if (Array.isArray(json?.data?.users)) return json.data.users;
  if (Array.isArray(json?.data?.items)) return json.data.items;
  if (Array.isArray(json?.data?.results)) return json.data.results;
  return [];
}

async function fetchArray(url: string): Promise<any[]> {
  try {
    const res = await fetch(url, { headers: authHeaders() });
    if (!res.ok) {
      console.error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
      return [];
    }
    const json = await res.json();
    return extractArray(json);
  } catch (err) {
    console.error("Failed to fetch:", url, err);
    return [];
  }
}

const shortcuts = [
  { path: "/dashboard", name: "Dashboard", icon: LayoutGrid },
  { path: "/course", name: "Courses", icon: BookOpen },
  { path: "/users", name: "Users", icon: Users },
  { path: "/assessment", name: "Assessment", icon: CheckSquare },
  { path: "/payment", name: "Payment", icon: CreditCard },
  // { path: "/report", name: "Report", icon: ChartCandlestick },
  // { path: "/support", name: "Support Queue", icon: Headset },
  { path: "/community", name: "Community Mod", icon: Flag },
  { path: "/certificate", name: "Certificate", icon: Award },
];

export default function Dashboard() {
  useAuthGuard();
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    totalCourses: 0,
    totalTracks: 0,
    totalModules: 0,
    totalUnits: 0,
  });
  const [recentUsers, setRecentUsers] = useState<RecentUser[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    try {
      setLoading(true);

      const [users, courses, tracks] = await Promise.all([
        fetchArray(`${BASE}admin/users`),
        fetchArray(`${BASE}admin/courses`),
        fetchArray(`${BASE}admin/tracks`),
      ]);

      // Modules are listed per-track (GET /admin/tracks/{trackId}/modules),
      // so total modules = sum of modules across every track.
      const modulesByTrack = await Promise.all(
        tracks.map((track: any) =>
          fetchArray(`${BASE}admin/tracks/${track.id}/modules`)
        )
      );
      const allModules = modulesByTrack.flat();

      // Units are listed per-module (GET /admin/modules/{moduleId}/units),
      // so total units = sum of units across every module.
      const unitsByModule = await Promise.all(
        allModules.map((mod: any) =>
          fetchArray(`${BASE}admin/modules/${mod.id}/units`)
        )
      );
      const allUnits = unitsByModule.flat();

      setStats({
        totalUsers: users.length,
        totalCourses: courses.length,
        totalTracks: tracks.length,
        totalModules: allModules.length,
        totalUnits: allUnits.length,
      });

      const sortedUsers = [...users].sort(
        (a: any, b: any) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setRecentUsers(sortedUsers.slice(0, 6));

      try {
        const alertsRes = await fetch(`${BASE}admin/dashboard/alerts`, {
          headers: authHeaders(),
        });
        if (alertsRes.ok) setAlerts(await alertsRes.json());
      } catch (err) {
        console.error("Failed to fetch alerts", err);
      }
    } catch (err) {
      console.error("Dashboard load failed", err);
    } finally {
      setLoading(false);
    }
  }

  const statCards = [
    {
      label: "Total Users",
      value: stats.totalUsers.toLocaleString(),
      icon: Users,
      bg: "bg-blue-50",
      iconBg: "bg-blue-100 text-blue-600",
      accent: "from-blue-500 to-sky-500",
      soft: "bg-gradient-to-br from-blue-500/10 to-sky-500/10",
    },
    {
      label: "Total Courses",
      value: stats.totalCourses.toLocaleString(),
      icon: BookOpen,
      bg: "bg-emerald-50",
      iconBg: "bg-emerald-100 text-emerald-700",
      accent: "from-emerald-500 to-teal-500",
      soft: "bg-gradient-to-br from-emerald-500/10 to-teal-500/10",
    },
    {
      label: "Total Tracks",
      value: stats.totalTracks.toLocaleString(),
      icon: GitBranch,
      bg: "bg-amber-50",
      iconBg: "bg-amber-100 text-amber-700",
      accent: "from-amber-500 to-orange-500",
      soft: "bg-gradient-to-br from-amber-500/10 to-orange-500/10",
    },
    {
      label: "Total Modules",
      value: stats.totalModules.toLocaleString(),
      icon: Layers,
      bg: "bg-violet-50",
      iconBg: "bg-violet-100 text-violet-700",
      accent: "from-violet-500 to-purple-500",
      soft: "bg-gradient-to-br from-violet-500/10 to-purple-500/10",
    },
    {
      label: "Total Units",
      value: stats.totalUnits.toLocaleString(),
      icon: Boxes,
      bg: "bg-rose-50",
      iconBg: "bg-rose-100 text-rose-700",
      accent: "from-rose-500 to-pink-500",
      soft: "bg-gradient-to-br from-rose-500/10 to-pink-500/10",
    },
  ];

  return (
    <div className="min-h-screen bg-[#f8faf8]">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* ── Fresh Gradient Header ── */}
        <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#003a00] via-[#004900] to-[#0a7c0a] text-white p-7 sm:p-8 lg:p-9 mb-8 shadow-[0_20px_60px_-15px_rgba(0,73,0,0.5)] animate-slide-up">
          {/* subtle pattern overlay */}
          <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`, backgroundSize: `22px 22px` }} />
          {/* decorative orbs */}
          <div className="absolute -top-16 -right-16 w-72 h-72 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-20 -left-10 w-60 h-60 bg-emerald-300/10 rounded-full blur-2xl" />
          <div className="absolute top-1/2 right-[28%] w-28 h-28 bg-white/[0.06] rounded-full hidden lg:block" />
          <div className="absolute bottom-6 right-24 w-14 h-14 bg-white/[0.07] rounded-2xl rotate-12 hidden lg:block" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-5 lg:gap-6">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/15 rounded-full px-3.5 py-1.5 text-xs font-medium tracking-wide">
                <Sparkles size={14} className="text-emerald-200" />
                <span className="text-white/90">Admin Overview</span>
                <span className="w-1 h-1 bg-white/40 rounded-full" />
                <span className="text-white/60 hidden sm:inline">SLAN Platform</span>
              </div>

              <div>
                <h1 className="text-[28px] sm:text-[34px] font-bold tracking-tight leading-none">
                  Welcome back,
                  <span className="bg-gradient-to-r from-white to-emerald-100 bg-clip-text text-transparent"> Administrator</span>
                </h1>
                <p className="text-sm sm:text-[15px] text-white/70 mt-3 max-w-xl leading-relaxed">
                  Manage courses, learners, and track platform performance — everything at a glance.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                <span className="inline-flex items-center gap-1.5 bg-white text-[#004900] rounded-full px-3.5 py-1.5 text-xs font-semibold shadow-sm">
                  <Activity size={14} />
                  Live dashboard
                </span>
                <span className="inline-flex items-center gap-1.5 bg-white/10 backdrop-blur border border-white/15 text-white rounded-full px-3.5 py-1.5 text-xs font-medium">
                  <Clock3 size={14} className="text-white/70" />
                  Updated just now
                </span>
              </div>
            </div>

            {/* right meta card - visible on xl */}
            <div className="hidden lg:flex flex-col gap-3 min-w-[280px]">
              <div className="bg-white/10 backdrop-blur-xl border border-white/15 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-white/60 uppercase tracking-wider">Platform health</span>
                  <span className="inline-flex items-center gap-1 bg-emerald-400 text-emerald-950 rounded-full px-2 py-0.5 text-[11px] font-bold">
                    <span className="w-1.5 h-1.5 bg-emerald-950 rounded-full animate-pulse" />
                    Operational
                  </span>
                </div>
                <div className="flex items-end gap-1.5 h-10">
                  {[40, 65, 35, 80, 55, 90, 70].map((h, i) => (
                    <div key={i} className="flex-1 bg-white/80 rounded-full" style={{ height: `${h}%`, opacity: 0.9 - i * 0.05 }} />
                  ))}
                </div>
                <p className="text-[11px] text-white/50 mt-2 flex items-center gap-1">
                  <TrendingUp size={12} /> All systems nominal
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div className="bg-white rounded-2xl px-4 py-3 shadow-lg">
                  <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Users</p>
                  <p className="text-xl font-bold text-slate-900 mt-0.5">{loading ? "—" : stats.totalUsers.toLocaleString()}</p>
                </div>
                <div className="bg-white rounded-2xl px-4 py-3 shadow-lg">
                  <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Courses</p>
                  <p className="text-xl font-bold text-slate-900 mt-0.5">{loading ? "—" : stats.totalCourses.toLocaleString()}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Stats Cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4 mb-6 sm:mb-8">
          {statCards.map((card, index) => {
            const Icon = card.icon;
            return (
              <div
                key={card.label}
                className="group relative bg-white rounded-3xl p-[1px] shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 animate-slide-up overflow-hidden"
                style={{ animationDelay: `${index * 0.07}s` }}
              >
                <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br ${card.accent}`} style={{ padding: '1px' }} />
                <div className="relative bg-white rounded-[23px] p-5 h-full flex flex-col">
                  {/* accent top line */}
                  <div className={`absolute top-0 left-6 right-6 h-[3px] rounded-full bg-gradient-to-r ${card.accent} opacity-60 group-hover:opacity-100 transition-opacity`} />
                  <div className="flex items-start justify-between mb-4">
                    <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${card.accent} flex items-center justify-center text-white shadow-md group-hover:scale-105 group-hover:rotate-3 transition-all duration-300`}>
                      <Icon size={19} strokeWidth={1.9} />
                    </div>
                    <span className="w-8 h-8 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-400 group-hover:text-[#004900] group-hover:bg-emerald-50 group-hover:border-emerald-100 transition-all duration-300">
                      <ArrowUpRight size={14} />
                    </span>
                  </div>
                  <div className="mt-auto">
                    <div className="text-[28px] font-bold tracking-tight text-slate-900 leading-none">
                      {loading ? (
                        <span className="inline-block w-16 h-7 bg-gray-100 rounded-lg animate-pulse" />
                      ) : (
                        card.value
                      )}
                    </div>
                    <p className="text-xs font-semibold text-slate-500 mt-2 tracking-wide uppercase">{card.label}</p>
                    <div className="mt-3 flex items-center gap-1.5 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-full px-2.5 py-1 w-fit">
                      <TrendingUp size={12} />
                      <span>Active</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* ── All Users ── */}
          <div className="xl:col-span-2 bg-white rounded-[24px] border border-gray-200/70 shadow-sm overflow-hidden animate-slide-up flex flex-col" style={{ animationDelay: "0.35s" }}>
            <div className="flex items-center justify-between px-6 sm:px-7 py-5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#004900] text-white flex items-center justify-center shadow-sm">
                  <Users size={16} />
                </div>
                <div>
                  <h2 className="font-semibold text-slate-900 leading-none">All Users</h2>
                  <p className="text-xs text-gray-500 mt-1">Recently registered members</p>
                </div>
              </div>
              <a
                href="/users"
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#004900] bg-[#004900]/[0.06] hover:bg-[#004900] hover:text-white border border-[#004900]/10 rounded-full px-3.5 py-1.5 transition-all duration-200 group"
              >
                View all
                <ArrowUpRight size={12} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </a>
            </div>

            <div className="h-px bg-gradient-to-r from-transparent via-gray-100 to-transparent" />

            <div className="divide-y divide-gray-50 flex-1">
              {loading ? (
                <div className="p-10 flex flex-col items-center justify-center gap-3 text-center">
                  <div className="w-8 h-8 border-[3px] border-gray-100 border-t-[#004900] rounded-full animate-spin" />
                  <p className="text-sm text-gray-500 font-medium">Loading users…</p>
                </div>
              ) : recentUsers.length === 0 ? (
                <div className="p-10 flex flex-col items-center justify-center text-center">
                  <div className="w-14 h-14 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-400 mb-3">
                    <Users size={22} />
                  </div>
                  <p className="text-sm font-semibold text-slate-700">No users found</p>
                  <p className="text-xs text-gray-400 mt-1 max-w-[240px]">When new learners register, they’ll appear here for quick access.</p>
                </div>
              ) : (
                recentUsers.map((user) => (
                  <div
                    key={user.id}
                    className="px-6 sm:px-7 py-4 flex items-center gap-4 hover:bg-[#f8faf8] transition-colors duration-200 group"
                  >
                    <img
                      src={
                        user.avatar ||
                        `https://ui-avatars.com/api/?name=${encodeURIComponent(
                          user.fullName
                        )}&background=004900&color=fff&bold=true&size=128`
                      }
                      className="w-10 h-10 rounded-full object-cover shrink-0 ring-2 ring-white shadow-sm group-hover:ring-emerald-100 transition-all"
                      alt={user.fullName}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate group-hover:text-[#004900] transition-colors">{user.fullName}</p>
                      <p className="text-xs text-gray-500 truncate">{user.email}</p>
                    </div>
                    <span className="hidden sm:inline-flex items-center gap-1.5 bg-gray-50 border border-gray-200/70 px-3 py-1.5 rounded-full text-xs font-medium text-gray-700 shrink-0 group-hover:bg-white group-hover:border-gray-200 group-hover:shadow-sm transition-all">
                      <ShieldCheck size={12} className="text-gray-400 group-hover:text-emerald-600" />
                      {user.role}
                    </span>
                    <span className="sm:hidden inline-flex bg-gray-50 border border-gray-200/70 px-2.5 py-1 rounded-full text-[11px] font-medium text-gray-600 shrink-0">
                      {user.role}
                    </span>
                  </div>
                ))
              )}
            </div>

            {!loading && recentUsers.length > 0 && (
              <div className="px-6 sm:px-7 py-4 bg-gray-50/60 border-t border-gray-100 flex items-center justify-between">
                <p className="text-xs text-gray-500">
                  Showing <span className="font-semibold text-slate-700">{recentUsers.length}</span> most recent users
                </p>
                <a href="/users" className="text-xs font-medium text-gray-500 hover:text-[#004900] transition-colors">
                  Manage users →
                </a>
              </div>
            )}
          </div>

          {/* ── Quick Links ── */}
          <div className="bg-white rounded-[24px] border border-gray-200/70 shadow-sm p-6 sm:p-7 animate-slide-up flex flex-col" style={{ animationDelay: "0.42s" }}>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#004900] to-[#0a7a0a] text-white flex items-center justify-center shadow-sm">
                <Layers size={16} />
              </div>
              <div>
                <h2 className="font-semibold text-slate-900 leading-none">Quick Links</h2>
                <p className="text-xs text-gray-500 mt-1">Jump to any section</p>
              </div>
            </div>

            <div className="h-px bg-gradient-to-r from-transparent via-gray-100 to-transparent my-5" />

            <div className="grid grid-cols-1 gap-2.5 flex-1 content-start">
              {shortcuts.map((action) => (
                <a
                  key={action.name}
                  href={action.path}
                  className="group flex items-center gap-3.5 bg-[#f8faf8] hover:bg-[#004900] border border-gray-200/60 hover:border-[#004900] rounded-2xl px-4 py-3.5 text-sm font-medium text-slate-700 hover:text-white transition-all duration-200 hover:shadow-md hover:shadow-emerald-900/10 hover:-translate-y-0.5"
                >
                  <span className="w-9 h-9 rounded-xl bg-white border border-gray-200/70 group-hover:bg-white/15 group-hover:border-white/20 group-hover:text-white flex items-center justify-center text-slate-600 transition-all duration-200 shrink-0">
                    <action.icon size={16} />
                  </span>
                  <span className="flex-1">{action.name}</span>
                  <ArrowUpRight size={14} className="text-gray-400 group-hover:text-white/70 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-200" />
                </a>
              ))}
            </div>

            <div className="mt-5 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-100 p-4 flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
                <Sparkles size={14} />
              </div>
              <div>
                <p className="text-xs font-semibold text-amber-900">Tip</p>
                <p className="text-xs text-amber-800/80 leading-relaxed mt-0.5">Use shortcuts to quickly navigate and manage your platform without extra clicks.</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── System Alerts ── */}
        {alerts.length > 0 && (
          <div className="mt-6 bg-white rounded-[20px] border border-amber-200/60 shadow-sm overflow-hidden animate-slide-up" style={{ animationDelay: "0.5s" }}>
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 px-6 py-4 flex items-center gap-3 border-b border-amber-100">
              <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-sm">
                <AlertTriangle size={16} />
              </div>
              <h3 className="text-sm font-semibold text-amber-900">System Alerts</h3>
              <span className="ml-auto bg-amber-500 text-white text-[11px] font-bold px-2.5 py-1 rounded-full">{alerts.length}</span>
            </div>
            <ul className="divide-y divide-amber-50 px-2 py-2">
              {alerts.map((alert) => (
                <li key={alert.id} className="flex items-start gap-3 px-4 py-3 rounded-xl hover:bg-amber-50/60 transition-colors">
                  <span className="mt-1.5 w-1.5 h-1.5 bg-amber-500 rounded-full shrink-0" />
                  <span className="text-sm text-slate-700 leading-relaxed">{alert.message}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* subtle footer meta */}
        <p className="text-center text-[11px] text-gray-400 mt-8 tracking-wide">© SLAN Admin — Platform overview • All data refreshes automatically</p>
      </div>
    </div>
  );
}
