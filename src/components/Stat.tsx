import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, AlertTriangle, Activity, Minus, ArrowUpRight, ArrowDownRight } from "lucide-react";

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
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="h-32 sm:h-36 bg-white rounded-2xl sm:rounded-3xl border border-gray-100 shadow-sm animate-pulse p-5"
          >
            <div className="h-4 w-24 bg-gray-100 rounded-full" />
            <div className="mt-6 h-8 w-32 bg-gray-100 rounded-xl" />
            <div className="mt-4 h-2 w-full bg-gray-50 rounded-full" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
        {stats.map((s) => {
          const isAlert = s.id === "pending_gradings" || s.trend === "alert";
          const TrendIcon =
            s.trend === "up" ? TrendingUp : s.trend === "down" ? TrendingDown : s.trend === "alert" ? AlertTriangle : Minus;
          const ChangeIcon = s.trend === "up" ? ArrowUpRight : s.trend === "down" ? ArrowDownRight : Activity;
          return (
            <div
              key={s.id}
              className={`group relative overflow-hidden bg-white rounded-2xl sm:rounded-3xl border p-4 sm:p-5 lg:p-6 shadow-sm hover:shadow-xl hover:shadow-gray-200/40 hover:-translate-y-0.5 transition-all duration-300 flex flex-col
                ${isAlert ? "border-amber-200/60 bg-gradient-to-br from-white to-amber-50/40" : "border-gray-100 hover:border-[#004900]/10"}`}
            >
              {/* subtle gradient accent */}
              <div
                className={`absolute inset-x-0 top-0 h-1 ${isAlert ? "bg-gradient-to-r from-amber-400 to-orange-400" : s.trend === "up" ? "bg-gradient-to-r from-[#004900] to-emerald-500" : s.trend === "down" ? "bg-gradient-to-r from-amber-500 to-yellow-400" : "bg-gradient-to-r from-gray-200 to-gray-100"}`}
              />

              {/* header: label + badge - stacked on mobile handled by flex */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  <span
                    className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0 shadow-sm border
                    ${
                      isAlert
                        ? "bg-amber-500 text-white border-amber-600 shadow-amber-200"
                        : s.trend === "up"
                          ? "bg-[#004900] text-white border-[#004900] shadow-[#004900]/20"
                          : s.trend === "down"
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : "bg-gray-50 text-gray-500 border-gray-200"
                    }`}
                  >
                    <TrendIcon size={18} className="sm:w-5 sm:h-5" />
                  </span>
                  <span className="text-[11px] sm:text-xs font-semibold tracking-[0.08em] uppercase text-gray-500 leading-tight line-clamp-2">
                    {s.label}
                  </span>
                </div>

                {s.trend !== "alert" && (s.change || s.changeLabel) ? (
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] sm:text-xs px-2 sm:px-2.5 py-1 rounded-full font-bold border shrink-0
                    ${s.trend === "up" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}
                  >
                    <ChangeIcon size={12} className="hidden sm:inline" />
                    {s.changeLabel ?? `${s.change! > 0 ? "+" : ""}${s.change}%`}
                  </span>
                ) : s.trend === "alert" ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-500 text-white shadow-md shadow-amber-200 shrink-0">
                    <AlertTriangle size={12} /> Attention
                  </span>
                ) : null}
              </div>

              {/* value + note: stacked on mobile, horizontal on tablet via flex-col sm:flex-row? kept stacked with responsive typography */}
              <div className="mt-4 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 sm:gap-3">
                <div className="flex flex-col min-w-0">
                  <div
                    className={`text-2xl sm:text-3xl lg:text-[30px] font-extrabold tracking-tight leading-none truncate
                    ${isAlert ? "text-red-700" : "text-[#004900]"}`}
                  >
                    {s.prefix}
                    {formatValue(s)}
                    {s.suffix}
                  </div>
                  {s.note && <p className="mt-2 text-xs sm:text-[13px] leading-relaxed text-gray-500 line-clamp-2">{s.note}</p>}
                </div>
                {/* decorative spark on larger screens */}
                <div className="hidden lg:flex w-12 h-12 rounded-2xl bg-gray-50 border border-gray-100 items-center justify-center text-gray-400 group-hover:text-[#004900] group-hover:bg-[#004900]/5 transition-colors duration-300 shrink-0">
                  <Activity size={18} />
                </div>
              </div>

              {s.progress !== undefined && (
                <div className="mt-4 sm:mt-5">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-medium tracking-wide uppercase text-gray-400">Progress</span>
                    <span className="text-xs font-bold text-gray-600">{s.progress}%</span>
                  </div>
                  <div className="h-2 sm:h-2.5 w-full bg-gray-100 rounded-full overflow-hidden p-0.5">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ease-out
                      ${s.trend === "up" ? "bg-gradient-to-r from-[#004900] to-emerald-500" : s.trend === "down" ? "bg-gradient-to-r from-amber-500 to-yellow-400" : isAlert ? "bg-gradient-to-r from-amber-500 to-orange-500" : "bg-gradient-to-r from-[#004900] to-[#006400]"}`}
                      style={{ width: `${s.progress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}