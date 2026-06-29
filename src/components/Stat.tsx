import { useEffect, useState } from "react";

type Stat = {
  id: string;
  label: string;
  value: number;
  change?: number;
  changeLabel?: string;
  trend: "up" | "down" | "alert" | "neutral";
  progress?: number;
  prefix?: string;
  suffix?: string;
  format?: "compact";
  note?: string;
};

export default function ExecutiveOverview() {
  const [stats, setStats] = useState<Stat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/")
      .then(r => r.json())
      .then(data => setStats(data.stats))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const formatValue = (s: Stat) => {
    if (s.format === "compact") {
      return new Intl.NumberFormat("en-NG", {
        notation: "compact",
        maximumFractionDigits: 1
      }).format(s.value);
    }
    return new Intl.NumberFormat("en-NG").format(s.value);
  };

  if (loading) {
    return <div className="grid grid-cols-4 gap-4">{[...Array(4)].map((_,i) => 
      <div key={i} className="h-28 slan-card animate-pulse" />)}</div>;
  }

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.id} className="slan-card">
            <div className="flex justify-between items-start">
              <span className="text-xs font-medium text-gray-500 tracking-wider">{s.label}</span>
              {s.trend !== "alert" && (s.change || s.changeLabel) && (
                <span className={`text- px-2 py-0.5 rounded-full font-medium ${
                  s.trend === "up" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                }`}>
                  {s.changeLabel ?? `${s.change! > 0 ? "+" : ""}${s.change}%`}
                </span>
              )}
              {s.trend === "alert" && (
                <span className="text-amber-500">!</span>
              )}
            </div>

            <div className={`mt-3 text-2xl font-semibold ${
              s.id === "pending_gradings" ? "text-red-700" : "text-green-800"
            }`}>
              {s.prefix}{formatValue(s)}{s.suffix}
            </div>

            {s.progress !== undefined && (
              <div className="mt-4 h-1 w-full bg-gray-100 rounded">
                <div 
                  className={`h-1 rounded ${
                    s.trend === "up" ? "bg-green-700" : s.trend === "down" ? "bg-amber-600" : "bg-green-600"
                  }`}
                  style={{ width: `${s.progress}%` }}
                />
              </div>
            )}

            {s.note && <p className="mt-3 text-xs text-gray-500">{s.note}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}