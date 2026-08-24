// CriticalAlerts.tsx
import { useEffect, useState } from "react";
import { Bell, Info, CheckCircle2 } from "lucide-react";
import { io } from "socket.io-client";

type Alert = {
  id: string;
  type: "error" | "warning" | "info" | "success";
  title: string;
  message: string;
};

const iconMap = {
  error: Bell,
  warning: Bell,
  info: Info,
  success: CheckCircle2,
};

const styleMap = {
  error: "border-red-500 bg-gradient-to-br from-red-50 to-white text-red-800 shadow-red-100",
  warning: "border-amber-500 bg-gradient-to-br from-amber-50 to-white text-amber-800 shadow-amber-100",
  info: "border-sky-500 bg-gradient-to-br from-sky-50 to-white text-sky-800 shadow-sky-100",
  success: "border-emerald-500 bg-gradient-to-br from-emerald-50 to-white text-emerald-800 shadow-emerald-100",
};

export default function CriticalAlerts() {
  const [alerts, setAlerts] = useState<Alert[]>([]);

  // 1. Initial REST load
  useEffect(() => {
    fetch("/api/alerts")
      .then(r => r.json())
      .then(setAlerts)
      .catch(console.error);
  }, []);

  // 2. Optional live updates — comment out if you only want REST
  useEffect(() => {
    const socket = io(import.meta.env.VITE_API_URL, { transports: ["websocket"] });
    
    socket.on("alert:new", (alert: Alert) => {
      setAlerts(prev => [alert, ...prev].slice(0, 20));
    });

    return () => { socket.disconnect(); };
  }, []);

  // 3. Fallback polling if you skip sockets
  // useEffect(() => {
  //   const id = setInterval(() => {
  //     fetch("/api/alerts").then(r => r.json()).then(setAlerts);
  //   }, 30000);
  //   return () => clearInterval(id);
  // }, []);

  return (
    <div className="w-full h-fit bg-white rounded-2xl sm:rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow duration-300 overflow-hidden">
      <div className="px-4 sm:px-5 lg:px-6 py-4 sm:py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-gray-100 bg-gradient-to-r from-white via-gray-50/50 to-white">
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-[#004900] text-white flex items-center justify-center shadow-md shadow-[#004900]/20 shrink-0">
            <Bell size={18} className="sm:w-5 sm:h-5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg lg:text-xl font-bold tracking-tight text-gray-900 leading-none">Critical Alerts</h2>
            <p className="text-xs sm:text-sm text-gray-500 font-medium">
              {alerts.length > 0 ? `${alerts.length} active • live updates` : "No active alerts"}
            </p>
          </div>
        </div>
        {alerts.length > 0 && (
          <span className="inline-flex self-start sm:self-auto items-center px-3 py-1.5 rounded-full text-xs font-bold bg-[#004900] text-white shadow-sm shrink-0">
            {alerts.length} New
          </span>
        )}
      </div>

      <div className="p-3 sm:p-4 lg:p-5 space-y-3 sm:space-y-3.5 max-h-[420px] sm:max-h-[480px] overflow-y-auto scrollbar-thin">
        {alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 sm:py-12 text-center rounded-2xl bg-gray-50/70 border border-dashed border-gray-200">
            <span className="w-12 h-12 rounded-2xl bg-white border border-gray-100 shadow-sm flex items-center justify-center text-gray-400 mb-3">
              <CheckCircle2 size={22} />
            </span>
            <p className="text-sm font-semibold text-gray-700">All clear</p>
            <p className="text-xs text-gray-500 mt-1 max-w-[22ch]">No critical alerts at the moment. New alerts will appear here instantly.</p>
          </div>
        ) : (
          alerts.map((a) => {
            const Icon = iconMap[a.type];
            return (
              <div
                key={a.id}
                className={`group flex flex-col sm:flex-row gap-3 sm:gap-4 p-4 sm:p-4 lg:p-5 border-l-4 rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 ${styleMap[a.type]} border-y border-r border-y-gray-100 border-r-gray-100`}
              >
                <span className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-white border border-black/5 shadow-sm flex items-center justify-center shrink-0 self-start sm:self-start group-hover:scale-105 transition-transform duration-200">
                  <Icon className="w-5 h-5 shrink-0 opacity-80" />
                </span>
                <div className="flex-1 min-w-0 flex flex-col gap-1">
                  <p className="font-bold text-sm sm:text-[15px] leading-snug tracking-tight line-clamp-2">{a.title}</p>
                  <p className="text-xs sm:text-sm leading-relaxed opacity-80 line-clamp-3">{a.message}</p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}