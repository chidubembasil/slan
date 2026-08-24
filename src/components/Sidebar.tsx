import { NavLink } from "react-router-dom"
// import { Link } from "react-router-dom";
// Share2, Headset, ChartCandlestick,
import {
  LayoutGrid, BookOpen, Users, CheckSquare, CreditCard,
  LogOut, X, Award, MessageSquare,
} from "lucide-react"

type Props = {
  isOpen: boolean
  onClose: () => void
}

export default function SideBar({ isOpen, onClose }: Props) {
  const BASE = import.meta.env.VITE_BASE_URL;

  const navItems = [
    { path: "/dashboard", name: "Dashboard", icon: LayoutGrid },
    { path: "/course", name: "Courses", icon: BookOpen },
    { path: "/users", name: "Users", icon: Users },
    { path: "/assessment", name: "Assessment", icon: CheckSquare },
    { path: "/payment", name: "Payment", icon: CreditCard },
    { path: "/discussions", name: "Discussions", icon: MessageSquare },
    { path: "/certificate", name: "Certificate", icon: Award },
  ]

  const handleLogout = async () => {
    const refreshToken = localStorage.getItem("adminRefreshToken");
    try {
      await fetch(`${BASE}admin/auth/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
    } catch (e) {
      console.error("Logout failed", e);
    } finally {
      localStorage.clear();
      window.location.href = "/";
    }
  };

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-30 md:hidden transition-opacity duration-300"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <div
        className={`
        fixed top-0 left-0 h-screen h-[100dvh] flex flex-col z-40
        bg-gradient-to-b from-[#004900] via-[#003d00] to-[#002a00]
        border-r border-white/10 shadow-2xl shadow-black/20
        transform transition-transform duration-300 ease-in-out will-change-transform
        w-[84vw] max-w-[300px] sm:w-72 md:w-64 lg:w-72 xl:w-[19rem]
        rounded-r-3xl md:rounded-none overflow-hidden
        ${isOpen ? "translate-x-0" : "-translate-x-full"}
        md:translate-x-0
      `}
      >
        <div className="h-16 sm:h-[68px] flex items-center justify-between px-4 sm:px-5 shrink-0 border-b border-white/10 bg-white/[0.03] backdrop-blur-sm">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-lg shadow-black/10 shrink-0">
              <span className="text-white font-extrabold text-sm sm:text-base tracking-tight">S</span>
            </div>
            <div className="flex flex-col min-w-0">
              <p className="text-white font-bold tracking-tight leading-none text-[15px] sm:text-lg truncate">SLAN ADMIN</p>
              <span className="text-[10px] sm:text-[11px] font-medium tracking-[0.14em] uppercase text-white/60">Control Center</span>
            </div>
          </div>
          <button
            className="md:hidden inline-flex items-center justify-center text-white/80 hover:text-white p-2 rounded-xl hover:bg-white/10 border border-transparent hover:border-white/10 transition-all duration-200 shrink-0"
            onClick={onClose}
            aria-label="Close menu"
          >
            <X size={20} className="sm:w-[22px] sm:h-[22px]" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 sm:px-3.5 py-4 sm:py-5 space-y-1.5 scrollbar-thin scrollbar-thumb-white/10">
          {navItems.map((item, index) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 sm:px-3.5 py-2.5 sm:py-3 text-[13px] sm:text-sm rounded-xl sm:rounded-2xl transition-all duration-200 group border
                 ${
                   isActive
                     ? "bg-white text-[#004900] font-semibold shadow-xl shadow-black/15 border-white backdrop-blur-sm translate-x-0"
                     : "text-white/75 hover:bg-white/10 hover:text-white hover:translate-x-1 border-transparent hover:border-white/10 hover:shadow-md"
                 }`
              }
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              <span
                className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center shrink-0 transition-all duration-200
                group-[.active]:bg-[#004900]/10 group-[.active]:text-[#004900]`}
              >
                <item.icon size={18} className="sm:w-5 sm:h-5 shrink-0 transition-transform duration-200 group-hover:scale-110" />
              </span>
              <span className="truncate">{item.name}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-3 sm:p-4 border-t border-white/10 bg-black/10 backdrop-blur-sm">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 text-white/70 hover:text-white hover:bg-white/10 text-sm w-full px-3 sm:px-3.5 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl transition-all duration-200 border border-transparent hover:border-white/10 hover:shadow-md active:scale-[0.98]"
          >
            <span className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
              <LogOut size={18} className="sm:w-5 sm:h-5 transition-transform duration-200 group-hover:-translate-x-0.5" />
            </span>
            <span className="font-medium">Logout</span>
          </button>
          <p className="hidden lg:block mt-3 text-[11px] leading-relaxed text-white/40 text-center px-2">
            Secured session • #004900
          </p>
        </div>
      </div>
    </>
  )
}
