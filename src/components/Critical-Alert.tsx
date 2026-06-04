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
  error: "border-red-500 bg-red-50 text-red-800",
  warning: "border-amber-500 bg-amber-50 text-amber-800",
  info: "border-sky-500 bg-sky-50 text-sky-800",
  success: "border-green-500 bg-green-50 text-green-800",
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
    <div className="w-full h-fit bg-card p-4">
      <h2 className="text-xl font-semibold mb-4 border-b-1 border-b-gray">Critical Alerts</h2>
      <div className="space-y-3">
        {alerts.map(a => {
          const Icon = iconMap[a.type];
          return (
            <div key={a.id} className={`flex gap-3 p-4 border-l-4 rounded-md ${styleMap[a.type]}`}>
              <Icon className="w-5 h-5 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">{a.title}</p>
                <p className="text-sm opacity-90">{a.message}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}