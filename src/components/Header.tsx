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
    <ul className="w-full h- bg-card shadow-2xs flex flex-row p-4 justify-between items-center">
      <li className="flex items-center gap-3">
        {/* hamburger - mobile only */}
        <button
          className="md:hidden p-1 -ml-1 text-foreground"
          onClick={onMenuClick}
          aria-label="Open menu"
        >
          <Menu size={24} />
        </button>

        <span className="text-black text-2xl capitalize font-semibold">
          {page} Page
        </span>
      </li>

      <li>
        <Link to="/notification">
          <Bell size={22} color="gray" />
        </Link>
      </li>
    </ul>
  )
}