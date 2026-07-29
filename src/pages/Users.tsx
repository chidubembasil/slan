// UsersTable.tsx
import { useEffect, useState } from "react";
import { Search, Eye, Pencil, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
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
  { key: "actions", label: "Actions" },
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
  const [deletingId, setDeletingId] = useState<number | null>(null);

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

  // ---- Action handlers ----
  const handleView = (user: User) => {
    // TODO: wire to your view route/modal, e.g. navigate(`/users/${user.id}`)
    console.log("View user:", user);
  };

  const handleEdit = (user: User) => {
    // TODO: wire to your edit route/modal, e.g. navigate(`/users/${user.id}/edit`)
    console.log("Edit user:", user);
  };

  const handleDelete = async (user: User) => {
    const confirmed = window.confirm(
      `Delete ${user.fullName}? This action cannot be undone.`
    );
    if (!confirmed) return;

    try {
      setDeletingId(user.id);
      const res = await fetch(`${API_BASE}admin/users/${user.id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });

      if (!res.ok) {
        console.error("Failed to delete user:", res.status);
        setError(`Failed to delete user (${res.status})`);
        return;
      }

      setUsers((prev) => prev.filter((u) => u.id !== user.id));
    } catch (err) {
      console.error("Failed to delete user:", err);
      setError("Failed to reach the server while deleting");
    } finally {
      setDeletingId(null);
    }
  };

  const renderCell = (user: User, key: string) => {
    switch (key) {
      case "user":
        return (
          <div className="flex items-center gap-3">
            <img
              src={
                user.avatar ||
                `https://ui-avatars.com/api/?name=${encodeURIComponent(
                  user.fullName
                )}&background=004900&color=fff`
              }
              className="w-9 h-9 rounded-full object-cover"
              alt=""
            />
            <div>
              <p className="font-medium text-sm text-slate-900">{user.fullName}</p>
              <p className="text-xs text-gray-500">{user.email}</p>
            </div>
          </div>
        );
      case "schoolName":
        return <span className="text-sm text-slate-700">{user.schoolName}</span>;
      case "state":
        return <span className="text-sm text-gray-600">{user.state}</span>;
      case "role":
        return (
          <span className="inline-flex bg-gray-100 px-2.5 py-1 rounded-full text-xs text-gray-700">
            {user.role}
          </span>
        );
      case "verified":
        return (
          <span
            className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${
              user.isEmailVerified
                ? "bg-green-100 text-green-700"
                : "bg-yellow-100 text-yellow-700"
            }`}
          >
            {user.isEmailVerified ? "Verified" : "Unverified"}
          </span>
        );
      case "status":
        return (
          <span
            className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${
              user.isActive
                ? "bg-green-100 text-green-700"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            {user.isActive ? "Active" : "Inactive"}
          </span>
        );
      case "actions":
        return (
          <div className="flex gap-1">
            <button
              onClick={() => handleView(user)}
              className="p-1.5 hover:bg-gray-100 rounded transition"
              title="View"
            >
              <Eye size={16} className="text-gray-600" />
            </button>
            <button
              onClick={() => handleEdit(user)}
              className="p-1.5 hover:bg-gray-100 rounded transition"
              title="Edit"
            >
              <Pencil size={16} className="text-gray-600" />
            </button>
            <button
              onClick={() => handleDelete(user)}
              disabled={deletingId === user.id}
              className="p-1.5 hover:bg-red-50 rounded transition disabled:opacity-50"
              title="Delete"
            >
              <Trash2 size={16} className="text-red-500" />
            </button>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="bg-white p-6 shadow-sm rounded-xl w-full border border-gray-100">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Users Management</h1>
        <span className="text-sm text-gray-500">
          {filteredUsers.length} of {users.length} users
        </span>
      </div>

      {/* Search */}
      <div className="flex gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            placeholder="Search by name, email, school, or state..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full pl-10 pr-4 h-11 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#004900]/20 focus:border-[#004900]"
          />
        </div>

        <button
          onClick={handleSearch}
          className="bg-[#004900] hover:bg-[#003600] text-white px-5 h-11 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 whitespace-nowrap"
        >
          <Search size={16} />
          Search
        </button>
      </div>

      {/* Active filters */}
      {searchQuery && (
        <div className="flex items-center gap-2 mb-4 text-xs">
          <span className="text-gray-500">Filters:</span>
          <span className="inline-flex items-center gap-1 bg-[#004900]/10 text-[#004900] px-2.5 py-1 rounded-md">
            "{searchQuery}"
            <button
              onClick={() => {
                setSearchInput("");
                setSearchQuery("");
                setCurrentPage(1);
              }}
              className="hover:text-[#003600]"
            >
              ×
            </button>
          </span>
        </div>
      )}

      {error && (
        <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-2">
          {error}
        </div>
      )}

      {/* TABLE */}
      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className="text-left py-3.5 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {loading ? (
              <tr>
                <td colSpan={COLUMNS.length} className="py-16 text-center">
                  <div className="inline-flex items-center gap-2 text-gray-500">
                    <div className="w-4 h-4 border-2 border-gray-300 border-t-[#004900] rounded-full animate-spin"></div>
                    <span className="text-sm">Loading users...</span>
                  </div>
                </td>
              </tr>
            ) : paginatedUsers.length === 0 ? (
              <tr>
                <td colSpan={COLUMNS.length} className="py-16 text-center">
                  <p className="text-sm text-gray-500">No users found</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {users.length === 0 ? "No data from API" : "Try adjusting your search"}
                  </p>
                </td>
              </tr>
            ) : (
              paginatedUsers.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50/50 transition-colors">
                  {COLUMNS.map((col) => (
                    <td key={col.key} className="py-3.5 px-4 align-middle">
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
        <div className="flex items-center justify-between mt-4">
          <span className="text-xs text-gray-500">
            Page {safePage} of {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => goToPage(safePage - 1)}
              disabled={safePage === 1}
              className="p-1.5 border border-gray-300 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition"
              title="Previous page"
            >
              <ChevronLeft size={16} className="text-gray-600" />
            </button>

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
                  <span key={`ellipsis-${idx}`} className="px-2 text-gray-400 text-sm">
                    …
                  </span>
                ) : (
                  <button
                    key={page}
                    onClick={() => goToPage(page)}
                    className={`min-w-8 h-8 px-2 rounded-lg text-sm font-medium transition ${
                      page === safePage
                        ? "bg-[#004900] text-white"
                        : "border border-gray-300 text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    {page}
                  </button>
                )
              )}

            <button
              onClick={() => goToPage(safePage + 1)}
              disabled={safePage === totalPages}
              className="p-1.5 border border-gray-300 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition"
              title="Next page"
            >
              <ChevronRight size={16} className="text-gray-600" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}