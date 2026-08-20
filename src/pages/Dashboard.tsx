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
    },
    {
      label: "Total Courses",
      value: stats.totalCourses.toLocaleString(),
      icon: BookOpen,
      bg: "bg-green-50",
      iconBg: "bg-green-100 text-green-700",
    },
    {
      label: "Total Tracks",
      value: stats.totalTracks.toLocaleString(),
      icon: GitBranch,
      bg: "bg-amber-50",
      iconBg: "bg-amber-100 text-amber-700",
    },
    {
      label: "Total Modules",
      value: stats.totalModules.toLocaleString(),
      icon: Layers,
      bg: "bg-purple-50",
      iconBg: "bg-purple-100 text-purple-700",
    },
    {
      label: "Total Units",
      value: stats.totalUnits.toLocaleString(),
      icon: Boxes,
      bg: "bg-rose-50",
      iconBg: "bg-rose-100 text-rose-700",
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50/50">
      <div className="max-w- mx-auto p-6">
        {/* Welcome Banner */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#004900] via-[#003d00] to-[#005c00] text-white p-8 mb-6 h-70 animate-slide-up shadow-xl">
          <div className="absolute inset-0 opacity-10">
            <img
              src="https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=1600"
              alt=""
              className="w-full h-full object-cover"
            />
          </div>
          {/* Decorative circles */}
          <div className="absolute top-4 right-4 w-40 h-40 bg-white/5 rounded-full" />
          <div className="absolute bottom-4 right-20 w-24 h-24 bg-white/5 rounded-full" />
          <div className="absolute top-1/2 right-1/3 w-16 h-16 bg-white/5 rounded-full animate-float" />

          <div className="relative z-10 left-0 top-17">
            <h1 className="text-4xl font-bold tracking-tight">Welcome Back, Administrator</h1>
            <p className="text-md text-white/70 mt-2">Manage courses, learners, and track platform performance</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-4 mb-6">
          {statCards.map((card, index) => {
            const Icon = card.icon;
            return (
              <div
                key={card.label}
                className={`${card.bg} rounded-2xl p-5 border border-white/60 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-default animate-slide-up`}
                style={{ animationDelay: `${index * 0.08}s` }}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className={`w-10 h-10 rounded-xl ${card.iconBg} flex items-center justify-center mb-3 transition-transform duration-300 hover:scale-110`}>
                      <Icon size={18} />
                    </div>
                    <div className="text-2xl font-bold text-slate-900">{loading ? "—" : card.value}</div>
                    <div className="text-xs text-slate-600 mt-1 font-medium">{card.label}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* All Users */}
          <div className="xl:col-span-2 bg-white rounded-2xl border border-gray-200/60 shadow-sm animate-slide-up stagger-3">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-slate-900">All Users</h2>
              <a href="/users" className="text-xs text-[#004900] hover:underline font-medium">View All</a>
            </div>
            <div className="divide-y divide-gray-50">
              {loading ? (
                <div className="p-8 text-center text-gray-500 text-sm">Loading users...</div>
              ) : recentUsers.length === 0 ? (
                <div className="p-8 text-center text-gray-500 text-sm">No users found</div>
              ) : (
                recentUsers.map((user) => (
                  <div key={user.id} className="px-6 py-4 flex items-center gap-3 hover:bg-gray-50/80 transition-colors duration-200">
                    <img
                      src={
                        user.avatar ||
                        `https://ui-avatars.com/api/?name=${encodeURIComponent(
                          user.fullName
                        )}&background=004900&color=fff`
                      }
                      className="w-9 h-9 rounded-full object-cover shrink-0 ring-2 ring-white shadow-sm"
                      alt=""
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-900 font-medium truncate">{user.fullName}</p>
                      <p className="text-xs text-gray-500 truncate">{user.email}</p>
                    </div>
                    <span className="inline-flex bg-gray-100 px-2.5 py-1 rounded-full text-xs text-gray-600 shrink-0 font-medium">
                      {user.role}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Quick Links */}
          <div className="bg-white rounded-2xl border border-gray-200/60 shadow-sm p-6 animate-slide-up stagger-4">
            <h2 className="font-semibold text-slate-900 mb-4">Quick Links</h2>
            <div className="space-y-2.5">
              {shortcuts.map((action) => (
                <a
                  key={action.name}
                  href={action.path}
                  className="flex items-center gap-3 w-full bg-gray-50 hover:bg-[#004900]/5 hover:border-[#004900]/20 border border-gray-200/60 rounded-xl px-4 py-3 text-sm text-slate-700 transition-all duration-200 hover:shadow-sm hover:translate-x-1 group"
                >
                  <action.icon size={20} className="text-gray-400 group-hover:text-[#004900] transition-colors duration-200" />
                  {action.name}
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* System Alerts */}
        {alerts.length > 0 && (
          <div className="mt-6 bg-amber-50 border border-amber-200/60 rounded-2xl p-5 animate-slide-up stagger-5">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-amber-700 text-xs font-bold">!</span>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-amber-900 mb-1.5">System Alerts</h3>
                <ul className="space-y-1.5">
                  {alerts.map((alert) => (
                    <li key={alert.id} className="text-xs text-amber-800 flex items-center gap-1.5">
                      <span className="text-amber-400">•</span> {alert.message}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}