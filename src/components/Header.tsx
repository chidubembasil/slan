import { useLocation } from 'react-router-dom'
import { Link } from "react-router-dom"
import { Share, PanelLeftClose, PanelLeft, Menu } from 'lucide-react'

type HeaderProps = {
  onMenuClick: () => void
  collapsed?: boolean
  onToggleCollapse?: () => void
}

export default function Header({ onMenuClick, collapsed, onToggleCollapse }: HeaderProps) {
  const location = useLocation()

  // "/admin/courses" → "courses"
  const page = location.pathname.split('/').filter(Boolean).pop() || 'home'

  return (
    <header className="w-full sticky top-0 z-20 bg-white/85 backdrop-blur-xl border-b border-gray-200/60 shadow-sm supports-[backdrop-filter]:bg-white/70">
      <div className="flex flex-row items-center justify-between gap-3 p-3 sm:p-4 md:px-6 lg:px-8">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {/* hamburger - mobile only */}
          <button
            className="md:hidden inline-flex items-center justify-center p-2 -ml-1 text-gray-600 hover:text-[#004900] hover:bg-[#004900]/10 rounded-xl sm:rounded-2xl transition-all duration-200 shrink-0 shadow-sm hover:shadow"
            onClick={onMenuClick}
            aria-label="Open menu"
          >
            <Menu size={22} className="sm:w-6 sm:h-6" />
          </button>
          {/* Desktop collapse / expand button */}
          {onToggleCollapse && (
            <button
              className="hidden md:inline-flex items-center justify-center p-2.5 rounded-xl border border-gray-200 bg-white text-gray-600 hover:text-[#004900] hover:border-[#004900]/20 hover:bg-[#004900]/5 shadow-sm transition-all duration-200 shrink-0"
              onClick={onToggleCollapse}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />}
            </button>
          )}

          <div className="flex flex-col min-w-0">
            <span className="text-gray-900 capitalize font-bold tracking-tight leading-none truncate text-lg sm:text-xl md:text-2xl lg:text-[26px] animate-slide-right">
              {page} Page
            </span>
            <span className="hidden sm:block text-[11px] sm:text-xs font-medium tracking-widest uppercase text-gray-400">
              SLAN Admin Workspace
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <Link
            to="/share"
            className="inline-flex items-center justify-center gap-2 p-2.5 sm:px-4 sm:py-2.5 rounded-xl sm:rounded-2xl bg-gradient-to-br from-[#004900] to-[#003d00] text-white shadow-md shadow-[#004900]/20 hover:shadow-lg hover:shadow-[#004900]/25 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 sm:bg-none sm:bg-white sm:text-gray-500 sm:shadow-sm sm:hover:text-[#004900] sm:hover:bg-[#004900]/10 sm:border sm:border-gray-200/60"
            aria-label="Share"
          >
            <Share size={18} className="sm:w-[20px] sm:h-[20px]" />
            <span className="hidden lg:inline text-sm font-semibold">Share</span>
          </Link>
        </div>
      </div>
    </header>
  )
}