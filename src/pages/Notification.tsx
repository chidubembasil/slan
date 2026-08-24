import { useAuthGuard } from "../hooks/useAuthGuard";
import { Bell, CheckCheck, Filter, Clock, Sparkles, AlertCircle } from "lucide-react";

export default function Notification() {
  useAuthGuard();
  return (
    <div className="w-full space-y-4 sm:space-y-6 animate-fade-in">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#004900] via-[#003d00] to-[#0a5c00] p-5 sm:p-6 md:p-7 shadow-lg">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-12 -left-8 h-32 w-32 rounded-full bg-amber-400/10 blur-xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3 sm:gap-4">
            <div className="hidden sm:flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 backdrop-blur border border-white/20 shrink-0">
              <Bell className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Notifications</h1>
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-400 text-[#002a00] px-2.5 py-1 text-xs font-bold">0 new</span>
              </div>
              <p className="mt-1 text-sm text-white/80">System alerts, updates and activity feed.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-center">
            <button className="inline-flex items-center gap-1.5 rounded-xl bg-white/15 backdrop-blur border border-white/20 text-white px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium hover:bg-white/20 transition-colors">
              <Filter size={14} /> Filter
            </button>
            <button className="inline-flex items-center gap-1.5 rounded-xl bg-white text-[#004900] px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold shadow-sm hover:bg-gray-50 transition-colors">
              <CheckCheck size={14} /> Mark all read
            </button>
          </div>
        </div>
      </div>

      {/* Filter tabs - responsive scroll on mobile/tablet */}
      <div className="bg-white rounded-2xl border border-gray-200/70 shadow-sm p-2 flex gap-1.5 overflow-x-auto scrollbar-hide">
        {["All", "Unread", "System", "Alerts"].map((tab, i) => (
          <button
            key={tab}
            className={`shrink-0 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-colors ${i === 0 ? "bg-[#004900] text-white shadow-sm" : "text-gray-600 hover:bg-gray-50"}`}
          >
            {tab}
          </button>
        ))}
        <span className="ml-auto hidden sm:inline-flex items-center gap-1 text-xs text-gray-400 shrink-0">
          <Sparkles size={12} /> Responsive
        </span>
      </div>

      {/* Empty state */}
      <div className="bg-white rounded-2xl border border-gray-200/70 shadow-sm overflow-hidden">
        <div className="p-8 sm:p-12 text-center">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl sm:rounded-3xl bg-amber-50 border border-amber-100 flex items-center justify-center mx-auto">
            <Bell size={28} className="text-amber-500 sm:w-8 sm:h-8" />
          </div>
          <h3 className="mt-4 text-base sm:text-lg font-semibold text-gray-900">No notifications</h3>
          <p className="mt-1 text-sm text-gray-500 max-w-sm mx-auto">You’re all caught up. New system alerts and updates will appear here and adapt to mobile, tablet and desktop.</p>
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3 text-xs text-gray-400">
            <span className="inline-flex items-center gap-1.5">
              <Clock size={12} /> Updated just now
            </span>
            <span className="hidden sm:inline">•</span>
            <span className="inline-flex items-center gap-1.5">
              <AlertCircle size={12} /> No pending alerts
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
