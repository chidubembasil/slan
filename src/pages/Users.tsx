// UsersTable.tsx

import { useEffect, useState } from "react";
import {
  Search,
  Eye,
  Pencil,
  Trash2,
} from "lucide-react";

interface User {
  id: string;
  fullName: string;
  email: string;
  school: string;
  location: string;
  role: string;
  progress: number;
  status: "Active" | "Inactive";
  avatar?: string;
}

export default function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("All");

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    try {
      const res = await fetch(
        "http://localhost:5000/api/users"
      );

      const data = await res.json();

      setUsers(data);
    } catch (err) {
      console.log(err);
    }
  }

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.fullName
        .toLowerCase()
        .includes(search.toLowerCase()) ||
      user.email
        .toLowerCase()
        .includes(search.toLowerCase()) ||
      user.school
        .toLowerCase()
        .includes(search.toLowerCase());

    const matchesRole =
      roleFilter === "All" ||
      user.role === roleFilter;

    return matchesSearch && matchesRole;
  });

  return (
    <div className="bg-white  p-6 shadow w-[99%] mt-3">

      <h1 className="text-2xl font-semibold mb-6">
        Users Management
      </h1>

      {/* Search + Filter */}
      <div className="flex gap-4 mb-6">

        <div className="relative flex-1">
          <Search
            className="absolute left-3 top-4 text-gray-400"
            size={18}
          />

          <input
            placeholder="Search by name, email, or school..."
            value={search}
            onChange={(e)=>setSearch(e.target.value)}
            className="w-full pl-10 h-12 border rounded-lg"
          />
        </div>

        <select
          className="border px-4 rounded-lg"
          value={roleFilter}
          onChange={(e)=>setRoleFilter(e.target.value)}
          title="select"
        >
          <option>All</option>
          <option>Principal</option>
          <option>Vice Principal</option>
          <option>Mentor</option>
          <option>Proprietor</option>
        </select>

        <button className="bg-[#004900] text-white px-6 rounded-lg">
          search
        </button>

      </div>

      {/* Table */}

      <table className="w-full">
        <thead>
          <tr className="border-b text-left ">

            <th>User</th>
            <th>School</th>
            <th>Role</th>
            <th>Progress</th>
            <th>Status</th>
            <th>Actions</th>

          </tr>
        </thead>

        <tbody>
          {filteredUsers.map((user)=>(
            <tr
              key={user.id}
              className="border-b"
            >
              <td className="py-5">

                <div className="flex items-center gap-3">
                  <div>
                    <p className="font-semibold">
                      {user.fullName}
                    </p>

                    <p className="text-sm text-gray-500">
                      {user.email}
                    </p>
                  </div>

                </div>

              </td>

              <td>
                <div>
                  <p>{user.school}</p>
                  <p className="text-sm text-gray-500">
                    {user.location}
                  </p>
                </div>
              </td>

              <td>

                <span className="bg-gray-100 px-3 py-1 rounded-full text-sm">
                  {user.role}
                </span>

              </td>

              <td>

                <div className="flex items-center gap-3">

                  <div className="w-24 bg-gray-200 rounded-full h-2">

                    <div
                      style={{
                        width: `${user.progress}%`
                      }}
                      className="bg-green-700 h-2 rounded-full"
                    />

                  </div>

                  <span>{user.progress}%</span>

                </div>

              </td>

              <td>

                <span
                  className={`px-3 py-1 rounded-full text-sm ${
                    user.status === "Active"
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {user.status}
                </span>

              </td>

              <td>

                <div className="flex gap-4">

                  <Eye
                    size={18}
                    className="cursor-pointer"
                  />

                  <Pencil
                    size={18}
                    className="cursor-pointer"
                  />

                  <Trash2
                    size={18}
                    className="cursor-pointer text-red-500"
                  />

                </div>

              </td>

            </tr>
          ))}
        </tbody>

      </table>

    </div>
  );
}