// UsersTable.tsx
import { useEffect, useState } from "react";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Users as UsersIcon,
  ShieldCheck,
  BadgeCheck,
  Activity,
  Sparkles,
  X,
  Loader2,
  UserX,
  Mail,
} from "lucide-react";
import { useAuthGuard } from "../hooks/useAuthGuard";

interface User {
  id: number;
  fullName: string;
  email: string;
  phone: string;
  role: string;
  systemRole: string;
  state: string;
  schoolName: string;
  schoolLocation: string;
  schoolType: string;
  isEmailVerified: boolean;
  isActive: boolean;
  createdAt: string;
  avatar?: string;
}

interface Column {
  key: string;
  label: string;
}

const API_BASE = import.meta.env.VITE_BASE_URL;

const COLUMNS: Column[] = [
  { key: "user", label: "User" },
  { key: "schoolName", label: "School Name" },
  { key: "state", label: "State" },
  { key: "role", label: "Role" },
  { key: "verified", label: "Verified" },
  { key: "status", label: "Status" },
];

const PAGE_SIZE = 10;

export default function Users() {
  useAuthGuard();
  const [users, setUsers] = useState<User[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Every other admin page reads the admin token and sends it as a Bearer
  // header — this page was the one exception, which is exactly why
  // `admin/users` came back "401 Authentication required" with an empty
  // table instead of the actual user list.
  const token = localStorage.getItem("adminAccessToken") || "";

  function authHeaders() {
    return { Authorization: `Bearer ${token}` };
  }

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`${API_BASE}admin/users`, {
        headers: authHeaders(),
      });

      if (!res.ok) {
        if (res.status === 401) {
          setError("Session expired — please log in again");
        } else if (res.status === 403) {
          setError("Forbidden — admin token required");
        } else {
          setError(`Request failed (${res.status})`);
        }
        setUsers([]);
        return;
      }

      const json = await res.json();

      if (json?.success && Array.isArray(json.data)) {
        setUsers(json.data);
      } else {
        setUsers([]);
      }
    } catch (err) {
      console.error("Failed to fetch users:", err);
      setError("Failed to reach the server");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }

  const filteredUsers = users.filter((user) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      user.fullName?.toLowerCase().includes(q) ||
      user.email?.toLowerCase().includes(q) ||
      user.schoolName?.toLowerCase().includes(q) ||
      user.state?.toLowerCase().includes(q);

    return matchesSearch;
  });

  // Pagination derived from the filtered set
  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedUsers = filteredUsers.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );

  const handleSearch = () => {
    setSearchQuery(searchInput);
    setCurrentPage(1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  const goToPage = (page: number) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
  };

  const renderCell = (user: User, key: string) => {
    switch (key) {
      case "user":
        return (
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              <img
                src={
                  user.avatar ||
                  `https://ui-avatars.com/api/?name=${encodeURIComponent(
                    user.fullName
                  )}&background=004900&color=fff&bold=true`
                }
                className="w-10 h-10 rounded-full object-cover ring-2 ring-white shadow-sm"
                alt=""
              />
              <span
                className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full ring-2 ring-white ${
                  user.isActive ? "bg-emerald-500" : "bg-gray-300"
                }`}
              />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm text-slate-900 truncate">{user.fullName}</p>
              <p className="text-xs text-slate-500 flex items-center gap-1 truncate">
                <Mail size={11} className="shrink-0 opacity-60" />
                {user.email}
              </p>
            </div>
          </div>
        );
      case "schoolName":
        return (
          <span className="inline-flex max-w-[180px] truncate text-sm font-medium text-slate-700 bg-slate-50 border border-slate-100 px-2.5 py-1 rounded-full">
            {user.schoolName || "—"}
          </span>
        );
      case "state":
        return <span className="text-sm text-slate-600 font-medium">{user.state || "—"}</span>;
      case "role":
        return (
          <span className="inline-flex items-center gap-1 bg-white border border-slate-200 px-2.5 py-1 rounded-full text-xs font-semibold text-slate-700 shadow-sm">
            <ShieldCheck size={12} className="text-[#004900]" />
            {user.role}
          </span>
        );
      case "verified":
        return (
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border shadow-sm ${
              user.isEmailVerified
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-amber-50 text-amber-700 border-amber-200"
            }`}
          >
            <BadgeCheck size={12} className={user.isEmailVerified ? "text-emerald-600" : "text-amber-500"} />
            {user.isEmailVerified ? "Verified" : "Unverified"}
          </span>
        );
      case "status":
        return (
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border shadow-sm ${
              user.isActive
                ? "bg-emerald-500 text-white border-emerald-600 shadow-emerald-100"
                : "bg-white text-slate-600 border-slate-200"
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${user.isActive ? "bg-white animate-pulse" : "bg-slate-400"}`} />
            {user.isActive ? "Active" : "Inactive"}
          </span>
        );
      default:
        return null;
    }
  };

  // derived stats for header bar (no state mutation)
  const totalCount = users.length;
  const activeCount = users.filter((u) => u.isActive).length;
  const verifiedCount = users.filter((u) => u.isEmailVerified).length;

  return (
    <div className="w-full space-y-5 animate-fade-in">
      {/* Header — gradient + stats bar */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#004900] via-[#006400] to-[#003600] p-6 sm:p-7 shadow-lg">
        {/* decorative */}
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-white/5 blur-xl" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(255,255,255,0.08),transparent_60%)]" />

        <div className="relative flex flex-col gap-5 md:gap-6 md:flex-row md:items-center md:justify-between lg:gap-6">
          <div className="flex items-start gap-4">
            <div className="hidden sm:flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 backdrop-blur border border-white/20 shadow-sm">
              <UsersIcon className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Users Management</h1>
                <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium text-white backdrop-blur border border-white/10">
                  <Sparkles size={12} /> Admin
                </span>
              </div>
              <p className="mt-1 text-sm text-white/80 max-w-xl">
                Search, verify and manage all registered users across schools and states.
              </p>
            </div>
          </div>

          {/* stats bar */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 shadow-sm border border-white/0">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-900 text-white">
                <UsersIcon size={14} />
              </div>
              <div className="leading-none">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Total</p>
                <p className="text-sm font-bold text-slate-900">{totalCount}</p>
              </div>
            </div>
            <div className="inline-flex items-center gap-2 rounded-2xl bg-white/95 px-4 py-2.5 shadow-sm border border-white/20 backdrop-blur">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-sm">
                <Activity size={14} />
              </div>
              <div className="leading-none">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Active</p>
                <p className="text-sm font-bold text-slate-900">{activeCount}</p>
              </div>
            </div>
            <div className="inline-flex items-center gap-2 rounded-2xl bg-white/95 px-4 py-2.5 shadow-sm border border-white/20 backdrop-blur">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#004900] text-white shadow-sm">
                <BadgeCheck size={14} />
              </div>
              <div className="leading-none">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Verified</p>
                <p className="text-sm font-bold text-slate-900">{verifiedCount}</p>
              </div>
            </div>
          </div>
        </div>

        {/* bottom meta */}
        <div className="relative mt-5 flex items-center gap-2 text-xs text-white/70">
          <span className="h-px flex-1 bg-white/10 hidden sm:block" />
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 backdrop-blur border border-white/10">
            Showing <b className="text-white">{filteredUsers.length}</b> of <b className="text-white">{users.length}</b> users
          </span>
        </div>
      </div>

      {/* Search + table card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
        {/* Search bar */}
        <div className="p-4 sm:p-5 border-b border-slate-100 bg-gradient-to-b from-white to-slate-50/50">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 group">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#004900] transition-colors" size={18} />
              <input
                placeholder="Search by name, email, school, or state..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full pl-10 pr-4 h-[46px] bg-white border border-slate-200 rounded-2xl text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#004900]/15 focus:border-[#004900] transition-all duration-200 shadow-sm hover:border-slate-300 hover:shadow"
              />
              {searchInput && (
                <button
                  onClick={() => setSearchInput("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                  aria-label="Clear"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <button
              onClick={handleSearch}
              className="inline-flex items-center justify-center gap-2 bg-[#004900] hover:bg-[#005c00] text-white px-6 h-[46px] rounded-2xl text-sm font-semibold transition-all duration-300 shadow-sm hover:shadow-md active:scale-[0.98] whitespace-nowrap"
            >
              <Search size={16} />
              Search
            </button>
          </div>

          {/* Active filters + results meta */}
          {(searchQuery || filteredUsers.length !== users.length) && (
            <div className="flex flex-wrap items-center gap-2 mt-4 animate-slide-down">
              {searchQuery ? (
                <span className="inline-flex items-center gap-2 bg-[#004900] text-white pl-3 pr-1.5 py-1.5 rounded-full text-xs font-medium shadow-sm">
                  <Search size={12} className="opacity-80" />
                  &ldquo;{searchQuery}&rdquo;
                  <button
                    onClick={() => {
                      setSearchInput("");
                      setSearchQuery("");
                      setCurrentPage(1);
                    }}
                    className="ml-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors"
                    aria-label="Clear filter"
                  >
                    <X size={12} />
                  </button>
                </span>
              ) : (
                <span className="text-xs text-slate-500">No filter applied</span>
              )}
              <span className="text-xs text-slate-400 hidden sm:inline">•</span>
              <span className="text-xs font-medium text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200">
                {filteredUsers.length} result{filteredUsers.length !== 1 ? "s" : ""}
              </span>
            </div>
          )}
        </div>

        {error && (
          <div className="mx-4 sm:mx-5 mt-4 flex items-start gap-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-2xl px-4 py-3 animate-slide-down">
            <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-red-100 text-red-600 shrink-0">!</span>
            <span className="font-medium">{error}</span>
          </div>
        )}

        {/* TABLE */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50/80 border-y border-slate-100">
              <tr>
                {COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    className="text-left py-3.5 px-4 sm:px-5 text-[11px] font-bold text-slate-500 uppercase tracking-widest whitespace-nowrap"
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={COLUMNS.length} className="py-16 text-center">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <div className="inline-flex items-center justify-center h-10 w-10 rounded-2xl bg-[#004900]/10 border border-[#004900]/10">
                        <Loader2 className="w-5 h-5 text-[#004900] animate-spin" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-700">Loading users...</p>
                        <p className="text-xs text-slate-400 mt-0.5">Fetching the latest directory</p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : paginatedUsers.length === 0 ? (
                <tr>
                  <td colSpan={COLUMNS.length} className="py-14 text-center">
                    <div className="flex flex-col items-center justify-center gap-3 px-6">
                      <div className="h-12 w-12 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400">
                        <UserX size={20} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-700">No users found</p>
                        <p className="text-xs text-slate-400 mt-1 max-w-sm">
                          {users.length === 0 ? "No data returned from the API. Try refreshing." : "Try adjusting your search or clear the filter to see all users."}
                        </p>
                      </div>
                      {searchQuery && (
                        <button
                          onClick={() => {
                            setSearchInput("");
                            setSearchQuery("");
                            setCurrentPage(1);
                          }}
                          className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold text-[#004900] hover:text-[#005c00] bg-[#004900]/10 hover:bg-[#004900]/15 px-3 py-1.5 rounded-full transition-colors"
                        >
                          <X size={12} /> Clear search
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-[#004900]/[0.03] transition-colors duration-200 group">
                    {COLUMNS.map((col) => (
                      <td key={col.key} className="py-4 px-4 sm:px-5 align-middle whitespace-nowrap">
                        {renderCell(user, col.key)}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION */}
        {!loading && filteredUsers.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 sm:px-5 py-4 bg-slate-50/60 border-t border-slate-100">
            <span className="text-xs font-medium text-slate-600 bg-white border border-slate-200 px-3 py-1.5 rounded-full shadow-sm order-2 sm:order-1">
              Page <b className="text-slate-900">{safePage}</b> of <b className="text-slate-900">{totalPages}</b>
              <span className="text-slate-400 font-normal hidden sm:inline"> • {filteredUsers.length} users</span>
            </span>
            <div className="flex items-center gap-1.5 order-1 sm:order-2">
              <button
                onClick={() => goToPage(safePage - 1)}
                disabled={safePage === 1}
                className="inline-flex items-center gap-1 p-2 sm:px-3 sm:py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 hover:border-slate-300 hover:shadow-sm transition-all duration-200 shadow-sm"
                title="Previous page"
              >
                <ChevronLeft size={16} />
                <span className="hidden sm:inline">Prev</span>
              </button>

              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(
                    (page) =>
                      page === 1 ||
                      page === totalPages ||
                      Math.abs(page - safePage) <= 1
                  )
                  .reduce<number[]>((acc, page) => {
                    if (acc.length && page - acc[acc.length - 1] > 1) {
                      acc.push(-1); // ellipsis marker
                    }
                    acc.push(page);
                    return acc;
                  }, [])
                  .map((page, idx) =>
                    page === -1 ? (
                      <span key={`ellipsis-${idx}`} className="px-1.5 text-slate-400 text-sm">
                        …
                      </span>
                    ) : (
                      <button
                        key={page}
                        onClick={() => goToPage(page)}
                        className={`min-w-9 h-9 px-2 rounded-xl text-sm font-semibold transition-all duration-200 border shadow-sm ${
                          page === safePage
                            ? "bg-[#004900] text-white border-[#004900] shadow-md"
                            : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300"
                        }`}
                      >
                        {page}
                      </button>
                    )
                  )}
              </div>

              <button
                onClick={() => goToPage(safePage + 1)}
                disabled={safePage === totalPages}
                className="inline-flex items-center gap-1 p-2 sm:px-3 sm:py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 hover:border-slate-300 hover:shadow-sm transition-all duration-200 shadow-sm"
                title="Next page"
              >
                <span className="hidden sm:inline">Next</span>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
