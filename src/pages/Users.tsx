// UsersTable.tsx
import { useEffect, useState } from "react";
import { Search, Eye, Pencil, Trash2 } from "lucide-react";
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

export default function Users() {
  useAuthGuard();
  const [users, setUsers] = useState<User[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("All");
  const [appliedRole, setAppliedRole] = useState("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`${API_BASE}admin/users`);

      if (!res.ok) {
        if (res.status === 403) {
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

    const matchesRole = appliedRole === "All" || user.role === appliedRole;
    return matchesSearch && matchesRole;
  });

  const handleSearch = () => {
    setSearchQuery(searchInput);
    setAppliedRole(roleFilter);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
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
            <button className="p-1.5 hover:bg-gray-100 rounded transition" title="View">
              <Eye size={16} className="text-gray-600" />
            </button>
            <button className="p-1.5 hover:bg-gray-100 rounded transition" title="Edit">
              <Pencil size={16} className="text-gray-600" />
            </button>
            <button className="p-1.5 hover:bg-red-50 rounded transition" title="Delete">
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

      {/* Search + Filter */}
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

        <select
          className="border border-gray-300 px-4 h-11 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#004900]/20"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          aria-label="select"
        >
          <option value="All">All Roles</option>
          <option value="Principal">Principal</option>
          <option value="Vice Principal">Vice Principal</option>
          <option value="Head Teacher">Head Teacher</option>
          <option value="Teacher">Teacher</option>
          <option value="Aspiring Head">Aspiring Head</option>
          <option value="Proprietor">Proprietor</option>
        </select>

        <button
          onClick={handleSearch}
          className="bg-[#004900] hover:bg-[#003600] text-white px-5 h-11 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 whitespace-nowrap"
        >
          <Search size={16} />
          Search
        </button>
      </div>

      {/* Active filters */}
      {(searchQuery || appliedRole !== "All") && (
        <div className="flex items-center gap-2 mb-4 text-xs">
          <span className="text-gray-500">Filters:</span>
          {searchQuery && (
            <span className="inline-flex items-center gap-1 bg-[#004900]/10 text-[#004900] px-2.5 py-1 rounded-md">
              "{searchQuery}"
              <button
                onClick={() => {
                  setSearchInput("");
                  setSearchQuery("");
                }}
                className="hover:text-[#003600]"
              >
                ×
              </button>
            </span>
          )}
          {appliedRole !== "All" && (
            <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 px-2.5 py-1 rounded-md">
              {appliedRole}
              <button
                onClick={() => {
                  setRoleFilter("All");
                  setAppliedRole("All");
                }}
                className="hover:text-blue-900"
              >
                ×
              </button>
            </span>
          )}
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
            ) : filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={COLUMNS.length} className="py-16 text-center">
                  <p className="text-sm text-gray-500">No users found</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {users.length === 0 ? "No data from API" : "Try adjusting your search"}
                  </p>
                </td>
              </tr>
            ) : (
              filteredUsers.map((user) => (
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
    </div>
  );
}