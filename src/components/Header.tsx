import { useLocation } from 'react-router-dom'
import { Link } from "react-router-dom"
import { Share } from 'lucide-react'

import {  Menu } from "lucide-react"

type HeaderProps = {
  onMenuClick: () => void
}

export default function Header({ onMenuClick }: HeaderProps) {
  const location = useLocation()

  // "/admin/courses" → "courses"
  const page = location.pathname.split('/').filter(Boolean).pop() || 'home'

  return (
    <ul className="w-full h-auto bg-white/80 backdrop-blur-md border-b border-gray-200/60 shadow-sm flex flex-row p-4 justify-between items-center sticky top-0 z-20">
      <li className="flex items-center gap-3">
        {/* hamburger - mobile only */}
        <button
          className="md:hidden p-1.5 -ml-1 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all duration-200"
          onClick={onMenuClick}
          aria-label="Open menu"
        >
          <Menu size={24} />
        </button>

        <span className="text-gray-900 text-2xl capitalize font-semibold tracking-tight animate-slide-right">
          {page} Page
        </span>
      </li>

      <li>
        <Link
          to="/share"
          className="p-2 rounded-xl text-gray-500 hover:text-[#004900] hover:bg-[#004900]/10 transition-all duration-200 flex items-center justify-center"
        >
          <Share size={22} />
        </Link>
      </li>
    </ul>
  )
}