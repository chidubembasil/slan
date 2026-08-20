import { NavLink } from "react-router-dom"
// import { Link } from "react-router-dom";
// Share2, Headset, ChartCandlestick,
import {
  LayoutGrid, BookOpen, Users, CheckSquare, CreditCard,
  LogOut, Flag, X, Award, 
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
    // { path: "/report", name: "Report", icon: ChartCandlestick },
    // { path: "/support", name: "Support Queue", icon: Headset },
    { path: "/community", name: "Community Mod", icon: Flag },
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
        <div className="fixed inset-0 bg-black/50 z-30 md:hidden" onClick={onClose} />
      )}

      <div className={`
        fixed top-0 left-0 h-screen w-60 bg-gradient-to-b from-[#004900] via-[#003d00] to-[#002a00] flex flex-col z-40
        transform transition-transform duration-300 ease-in-out shadow-2xl
        ${isOpen? "translate-x-0" : "-translate-x-full"}
        md:translate-x-0
      `}>
        <div className="h-16 flex items-center justify-between px-4 shrink-0 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <span className="text-white font-bold text-sm">S</span>
            </div>
            <p className="text-xl text-white font-semibold tracking-tight">SLAN ADMIN</p>
          </div>
          <button className="md:hidden text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-all duration-200" onClick={onClose} aria-label="Close menu">
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
          {navItems.map((item, index) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 text-sm rounded-xl transition-all duration-200 group
                 ${isActive
                   ? "bg-white/15 text-white font-semibold shadow-lg shadow-black/10 border-l-4 border-[#FACC15] backdrop-blur-sm"
                   : "text-white/70 hover:bg-white/10 hover:text-white hover:translate-x-1"}`
              }
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              <item.icon size={20} className="shrink-0 transition-transform duration-200 group-hover:scale-110" />
              <span>{item.name}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-white/10">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 text-white/60 hover:text-white hover:bg-white/10 text-sm w-full px-3 py-2.5 rounded-xl transition-all duration-200"
          >
            <LogOut size={20} className="transition-transform duration-200 hover:-translate-x-1" />
            Logout
          </button>
        </div>
      </div>
    </>
  )
}
