// Dashboard.tsx
import { useEffect, useState } from "react";
import { Users, BookOpen, GitBranch, Layers, Boxes } from "lucide-react";
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

// Normalizes either { success, data: [...] } or a raw array response
function extractArray(json: any): any[] {
  if (Array.isArray(json)) return json;
  if (json?.success && Array.isArray(json.data)) return json.data;
  if (Array.isArray(json?.data)) return json.data;
  return [];
}

async function fetchArray(url: string): Promise<any[]> {
  try {
    const res = await fetch(url, { headers: authHeaders() });
    if (!res.ok) return [];
    const json = await res.json();
    return extractArray(json);
  } catch (err) {
    console.error("Failed to fetch:", url, err);
    return [];
  }
}

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
        fetchArray(`${BASE}/admin/users`),
        fetchArray(`${BASE}/admin/courses`),
        fetchArray(`${BASE}/admin/tracks`),
      ]);

      // Modules are listed per-track (GET /admin/tracks/{trackId}/modules),
      // so total modules = sum of modules across every track.
      const modulesByTrack = await Promise.all(
        tracks.map((track: any) =>
          fetchArray(`${BASE}/admin/tracks/${track.id}/modules`)
        )
      );
      const allModules = modulesByTrack.flat();

      // Units are listed per-module (GET /admin/modules/{moduleId}/units),
      // so total units = sum of units across every module.
      const unitsByModule = await Promise.all(
        allModules.map((mod: any) =>
          fetchArray(`${BASE}/admin/modules/${mod.id}/units`)
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
        const alertsRes = await fetch(`${BASE}/api/dashboard/alerts`, {
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
    <div className="min-h-screen bg-gray-50">
      <div className="max-w- mx-auto p-6">
        {/* Welcome Banner - no New Course button */}
        <div className="relative overflow-hidden rounded-2xl bg-[#0f2a1f] text-white p-8 mb-6 h-70">
          <div className="absolute inset-0 opacity-20">
            <img
              src="https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=1600"
              alt=""
              className="w-full h-full object-cover"
            />
          </div>
          <div className="relative z-10 left-0 top-17">
            <h1 className="text-4xl font-semibold">Welcome Back, Administrator</h1>
            <p className="text-md text-white/80 mt-1">Manage courses, learners, and track platform performance</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-4 mb-6">
          {statCards.map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.label} className={`${card.bg} rounded-xl p-5 border border-gray-100`}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className={`w-9 h-9 rounded-lg ${card.iconBg} flex items-center justify-center mb-3`}>
                      <Icon size={18} />
                    </div>
                    <div className="text-2xl font-bold text-slate-900">{loading ? "—" : card.value}</div>
                    <div className="text-xs text-slate-600 mt-1">{card.label}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* All Users */}
          <div className="xl:col-span-2 bg-white rounded-xl border border-gray-200">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h2 className="font-semibold text-slate-900">All Users</h2>
              <a href="/users" className="text-xs text-[#004900] hover:underline">View All</a>
            </div>
            <div className="divide-y">
              {loading ? (
                <div className="p-8 text-center text-gray-500 text-sm">Loading users...</div>
              ) : recentUsers.length === 0 ? (
                <div className="p-8 text-center text-gray-500 text-sm">No users found</div>
              ) : (
                recentUsers.map((user) => (
                  <div key={user.id} className="px-5 py-4 flex items-center gap-3 hover:bg-gray-50">
                    <img
                      src={
                        user.avatar ||
                        `https://ui-avatars.com/api/?name=${encodeURIComponent(
                          user.fullName
                        )}&background=004900&color=fff`
                      }
                      className="w-8 h-8 rounded-full object-cover shrink-0"
                      alt=""
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-900 font-medium truncate">{user.fullName}</p>
                      <p className="text-xs text-gray-500 truncate">{user.email}</p>
                    </div>
                    <span className="inline-flex bg-gray-100 px-2.5 py-1 rounded-full text-xs text-gray-700 shrink-0">
                      {user.role}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Quick Actions */}
         {/*  <div className="bg-[#f3f5f4] rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-slate-900 mb-4">Quick Actions</h2>
            <div className="space-y-2.5">
              {[
                { path: "/", name: "Dashboard", icon: LayoutGrid },
                { path: "/course", name: "Course", icon: BookOpen },
                { path: "/users", name: "Users", icon: Users },
                { path: "/assessment", name: "Assessment", icon: CheckSquare },
                { path: "/payment", name: "Payment", icon: CreditCard },
                { path: "/report", name: "Report", icon: ChartCandlestick },
                { path: "/support", name: "Support Queue", icon: Headset },
                { path: "/community", name: "Community Mod", icon: Flag }
              ].map((action) => (
                <a
                  key={action.name}
                  href={action.path}
                  className="flex items-center gap-2.5 w-full bg-white hover:bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-slate-700 transition"
                >
                  <action.icon size={20} />
                  {action.name}
                </a>
              ))}
            </div>
          </div> */}
        </div>

        {/* System Alerts */}
        {alerts.length > 0 && (
          <div className="mt-6 bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="flex items-start gap-2.5">
              <div className="w-5 h-5 rounded-full bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-amber-700 text-xs">!</span>
              </div>
              <div>
                <h3 className="text-sm font-medium text-amber-900 mb-1.5">System Alerts</h3>
                <ul className="space-y-1">
                  {alerts.map((alert) => (
                    <li key={alert.id} className="text-xs text-amber-800 flex items-center gap-1.5">
                      <span>•</span> {alert.message}
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