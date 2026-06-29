import { useLocation, Link } from 'react-router-dom'
import { Bell, Menu } from "lucide-react"

type HeaderProps = {
  onMenuClick: () => void
}

export default function Header({ onMenuClick }: HeaderProps) {
  const location = useLocation()

  // "/admin/courses" → "courses"
  const page = location.pathname.split('/').filter(Boolean).pop() || 'home'

  return (
    <header className="admin-topbar">
      <div className="flex items-center gap-3">
        <button
          className="md:hidden p-1 -ml-1 text-sidebar-foreground"
          onClick={onMenuClick}
          aria-label="Open menu"
        >
          <Menu size={24} />
        </button>

        <h1 className="text-sidebar-foreground text-xl sm:text-2xl capitalize font-semibold">
          {page} Page
        </h1>
      </div>

      <nav className="flex items-center gap-4">
        <Link to="/notification" className="text-sidebar-foreground hover:text-accent transition-colors">
          <Bell size={22} />
        </Link>
      </nav>
    </header>
  )
}