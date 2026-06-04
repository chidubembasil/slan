import { useState, useEffect } from "react"
import { Search, ChevronDown } from "lucide-react"

export default function Manage() {
  const [query, setQuery] = useState("")
  const [courses, setCourses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const BASE = import.meta.env.VITE_CLIENT_KEY

  const fetchCourses = async (search = "") => {
    setLoading(true)
    try {
      const res = await fetch(`${BASE}/api/courses?search=${encodeURIComponent(search)}`)
      const json = await res.json()
      const data = Array.isArray(json)? json : json.data || []
      setCourses(data)
    } catch (err) {
      console.error(err)
      setCourses([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCourses()
  }, [])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    fetchCourses(query)
  }

  const statusColor = (status: string) => {
    switch (status) {
      case "Published": return "bg-green-100 text-green-700"
      case "Draft": return "bg-slate-100 text-slate-600"
      case "Review": return "bg-amber-100 text-amber-700"
      default: return "bg-gray-100 text-gray-600"
    }
  }

  return (
    <div className="w-full max-w-6xl mx-auto">
      <form onSubmit={handleSearch} className="flex gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search courses..."
            className="w-full pl-11 pr-4 py-3 rounded-xl border border-gray-200 bg-white text-sm outline-none focus:ring-2 focus:ring-[#0d2147]/20 focus:border-[#0d2147] transition"
          />
        </div>
        <button
          type="submit"
          className="px-6 py-3 bg-[#004900] hover:bg-[#0d3b2e] text-white rounded-xl font-medium text-sm flex items-center gap-2 shadow-sm transition whitespace-nowrap"
        >
          <Search size={18} />
          Search 
        </button>
      </form>

      <div className="space-y-3">
        {loading? (
          <div className="text-center py-10 text-gray-500">Loading...</div>
        ) : courses.length === 0? (
          <div className="text-center py-10 text-gray-500">No courses found</div>
        ) : (
          courses.map((course) => (
            <div
              key={course.id}
              className="bg-white border border-gray-100 rounded-xl p-5 flex items-center justify-between hover:shadow-md transition cursor-pointer"
            >
              <div>
                <h3 className="font-semibold text- text-[#0d2147]">{course.title}</h3>
                <p className="text-xs text-gray-500 mt-1">
                  {course.category} • {course.units} units • {course.version}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColor(course.status)}`}>
                  {course.status}
                </span>
                <ChevronDown size={18} className="text-gray-400" />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}