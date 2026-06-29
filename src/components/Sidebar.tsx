import { NavLink } from "react-router-dom"
import {
  LayoutGrid, BookOpen, Users, CheckSquare, CreditCard,
  ChartCandlestick, LogOut, Headset, Flag, X
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
    { path: "/report", name: "Report", icon: ChartCandlestick },
    { path: "/support", name: "Support Queue", icon: Headset },
    { path: "/community", name: "Community Mod", icon: Flag }
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
        fixed top-0 left-0 h-screen w-64 admin-sidebar flex flex-col z-40
        transform transition-transform duration-300 ease-in-out
        ${isOpen? "translate-x-0" : "-translate-x-full"}
        md:translate-x-0
      `}>
        <div className="admin-sidebar-header flex items-center justify-between">
          <p className="text-lg font-semibold text-sidebar-foreground">SLAN ADMIN</p>
          <button className="md:hidden text-sidebar-foreground p-1" onClick={onClose} aria-label="Close menu">
            <X size={20} />
          </button>
        </div>

        <nav className="admin-sidebar-menu flex-1 overflow-y-auto px-2 py-2">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={onClose}
              className={({ isActive }) =>
                `admin-sidebar-item ${isActive? 'active' : ''}`
              }
            >
              <item.icon size={20} />
              {item.name}
            </NavLink>
          ))}
        </nav>

        <div className="admin-sidebar-footer h-14 flex items-center px-3">
          <button onClick={handleLogout} className="flex items-center gap-3 text-sidebar-foreground hover:text-white text-sm w-full">
            <LogOut size={20} /> Logout
          </button>
        </div>
      </div>
    </>
  )
}
