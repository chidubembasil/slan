// Dashboard.tsx
import { useEffect, useState } from "react";
import { Users, BookOpen, ClipboardCheck, CreditCard } from "lucide-react";
import { useAuthGuard } from "../hooks/useAuthGuard"

const BASE = import.meta.env.VITE_BASE_URL?? "";

interface Stats {
  totalLearners: number;
  activeCourses: number;
  pendingAssessments: number;
  revenue: number;
  learnersChange?: number;
  coursesChange?: number;
  assessmentsChange?: number;
  revenueChange?: number;
}

interface Activity {
  id: string;
  userName: string;
  action: string;
  course?: string;
  timeAgo: string;
  type: "enroll" | "submit" | "complete";
}

interface Alert {
  id: string;
  message: string;
}


export default function Dashboard() {
  useAuthGuard();
  const [stats, setStats] = useState<Stats>({
    totalLearners: 0,
    activeCourses: 0,
    pendingAssessments: 0,
    revenue: 0,
  });
  const [activity, setActivity] = useState<Activity[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    try {
      setLoading(true);
      const [statsRes, activityRes, alertsRes] = await Promise.all([
        fetch(`${BASE}/api/dashboard/stats`),
        fetch(`${BASE}/api/dashboard/activity`),
        fetch(`${BASE}/api/dashboard/alerts`),
      ]);

      if (statsRes.ok) setStats(await statsRes.json());
      if (activityRes.ok) setActivity(await activityRes.json());
      if (alertsRes.ok) setAlerts(await alertsRes.json());
    } catch (err) {
      console.error("Dashboard load failed", err);
    } finally {
      setLoading(false);
    }
  }

  const statCards = [
    {
      label: "Total Learners",
      value: stats.totalLearners.toLocaleString(),
      icon: Users,
      bg: "bg-blue-50",
      iconBg: "bg-blue-100 text-blue-600",
      change: stats.learnersChange,
    },
    {
      label: "Active Courses",
      value: stats.activeCourses.toString(),
      icon: BookOpen,
      bg: "bg-green-50",
      iconBg: "bg-green-100 text-green-700",
      change: stats.coursesChange,
    },
    {
      label: "Pending Assessments",
      value: stats.pendingAssessments.toString(),
      icon: ClipboardCheck,
      bg: "bg-amber-50",
      iconBg: "bg-amber-100 text-amber-700",
      change: stats.assessmentsChange,
    },
    {
      label: "Revenue (This Month)",
      value: `₦${(stats.revenue / 1000000).toFixed(1)}M`,
      icon: CreditCard,
      bg: "bg-purple-50",
      iconBg: "bg-purple-100 text-purple-700",
      change: stats.revenueChange,
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
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
          {statCards.map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.label} className={`${card.bg} rounded-xl p-5 border border-gray-100`}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className={`w-9 h-9 rounded-lg ${card.iconBg} flex items-center justify-center mb-3`}>
                      <Icon size={18} />
                    </div>
                    <div className="text-2xl font-bold text-slate-900">{loading? "—" : card.value}</div>
                    <div className="text-xs text-slate-600 mt-1">{card.label}</div>
                  </div>
                  {card.change!== undefined && (
                    <span className={`text- px-2 py-0.5 rounded-full ${card.change >= 0? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                      {card.change > 0? "+" : ""}{card.change}%
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Recent Activity */}
          <div className="xl:col-span-2 bg-white rounded-xl border border-gray-200">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h2 className="font-semibold text-slate-900">Recent Activity</h2>
              <button className="text-xs text-[#004900] hover:underline">View All</button>
            </div>
            <div className="divide-y">
              {loading? (
                <div className="p-8 text-center text-gray-500 text-sm">Loading activity...</div>
              ) : activity.length === 0? (
                <div className="p-8 text-center text-gray-500 text-sm">No recent activity</div>
              ) : (
                activity.map((item) => (
                  <div key={item.id} className="px-5 py-4 flex items-start gap-3 hover:bg-gray-50">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium text-white shrink-0 ${
                      item.type === "enroll"? "bg-[#004900]" : item.type === "submit"? "bg-blue-600" : "bg-emerald-600"
                    }`}>
                      {item.userName.split(" ").map(n => n[0]).join("").slice(0,2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-900">
                        <span className="font-medium">{item.userName}</span>
                        <span className="text-slate-600"> {item.action}</span>
                        {item.course && <span className="text-[#004900]"> {item.course}</span>}
                      </p>
                      <p className="text- text-gray-500 mt-1">{item.timeAgo}</p>
                    </div>
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