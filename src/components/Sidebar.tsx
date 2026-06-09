// SideBar.tsx
import { NavLink, useNavigate } from "react-router-dom"
import {
  LayoutGrid, BookOpen, Users, CheckSquare, CreditCard,
  ChartCandlestick, LogOut, Headset, Flag, X
} from "lucide-react"

type Props = {
  isOpen: boolean
  onClose: () => void
}

const BASE = import.meta.env.VITE_BASE_URL;

export default function SideBar({ isOpen, onClose }: Props) {
  const navigate = useNavigate()

  const navItems = [
    { path: "/", name: "Dashboard", icon: LayoutGrid },
    { path: "/course", name: "Course", icon: BookOpen },
    { path: "/users", name: "Users", icon: Users },
    { path: "/assessment", name: "Assessment", icon: CheckSquare },
    { path: "/payment", name: "Payment", icon: CreditCard },
    { path: "/report", name: "Report", icon: ChartCandlestick },
    { path: "/support", name: "Support Queue", icon: Headset },
    { path: "/community", name: "Community Mod", icon: Flag }
  ]

  const handleLogout = async () => {
    const refreshToken = localStorage.getItem("adminRefreshToken");
    try {
      await fetch(`${BASE}/admin/auth/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
    } catch (e) {
      console.error("Logout failed", e);
    } finally {
      localStorage.removeItem("adminAccessToken");
      localStorage.removeItem("adminRefreshToken");
      localStorage.removeItem("adminUser");
      navigate("/auth");
    }
  };

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 md:hidden" onClick={onClose} />
      )}

      <div className={`
        fixed top-0 left-0 h-screen w-60 bg-[#004900] flex flex-col z-40
        transform transition-transform duration-300 ease-in-out
        ${isOpen? "translate-x-0" : "-translate-x-full"}
        md:translate-x-0
      `}>
        <div className="h-16 flex items-center justify-between px-4 shrink-0">
          <p className="text-2xl text-white">SLAN ADMIN</p>
          <button className="md:hidden text-white p-1" onClick={onClose} aria-label="Close menu">
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-2">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 text-sm rounded
                 ${isActive? "bg-[rgba(255,255,255,0.1)] text-white font-bold border-l-4 border-[#FACC15]" : "text-white/80 hover:bg-[#005A00] hover:text-white"}`
              }
            >
              <item.icon size={20} />
              {item.name}
            </NavLink>
          ))}
        </nav>

        <div className="h-14 border-t border-[#3f4864] flex items-center px-3">
          <button onClick={handleLogout} className="flex items-center gap-3 text-white/80 hover:text-white text-sm w-full">
            <LogOut size={20} /> Logout
          </button>
        </div>
      </div>
    </>
  )
}