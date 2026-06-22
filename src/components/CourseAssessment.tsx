import { useEffect, useMemo, useState } from "react";
import { Pencil, Trash2, Search, Upload, X } from "lucide-react";

const API_BASE = import.meta.env.VITE_BASE_URL;

const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_API_KEY = import.meta.env.VITE_API_KEY;
const CLOUDINARY_API_SECRET = import.meta.env.VITE_API_SECRET_KEY;

async function uploadFileToCloudinary(file: File, folder: string = "assessments"): Promise<string> {
  if (!CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET || !CLOUDINARY_CLOUD_NAME) {
    throw new Error("Cloudinary credentials missing");
  }

  const timestamp = Math.round(new Date().getTime() / 1000);
  const signatureString = `folder=${folder}&timestamp=${timestamp}${CLOUDINARY_API_SECRET}`;
  const signature = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(signatureString));
  const signatureHex = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const formData = new FormData();
  formData.append("file", file);
  formData.append("api_key", CLOUDINARY_API_KEY);
  formData.append("timestamp", timestamp.toString());
  formData.append("signature", signatureHex);
  formData.append("folder", folder);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/raw/upload`,
    { method: "POST", body: formData }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || "Cloudinary upload failed");
  }

  const data = await res.json();
  return data.secure_url as string;
}

type QuestionType = "single" | "multiple" | "upload";

interface CourseAssessmentRow {
  id: number;
  title: string;
  courseId: number;
  courseName: string;
  questionType: QuestionType;
}

const QUESTION_TYPE_LABEL: Record<QuestionType, string> = {
  single: "Single Choice",
  multiple: "Multiple Choice",
  upload: "Upload (CSV/Excel)",
};

export default function CourseAssessments() {
  const [rows, setRows] = useState<CourseAssessmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const [editingRow, setEditingRow] = useState<CourseAssessmentRow | null>(null);
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    passMarkPercent: 70,
    maxAttempts: 2,
    timeLimitMinutes: 0,
    isActive: false,
  });
  const [editFile, setEditFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const token = localStorage.getItem("adminAccessToken") || "";

  async function fetchCourseAssessments() {
    setLoading(true);
    setError(null);
    try {
      const coursesRes = await fetch(`${API_BASE}admin/courses`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!coursesRes.ok) throw new Error("Failed to load courses");
      const courses = await coursesRes.json();
      const courseList = Array.isArray(courses) ? courses : courses.data || [];

      const results: CourseAssessmentRow[] = [];
      await Promise.all(
        courseList.map(async (course: any) => {
          try {
            const res = await fetch(
              `${API_BASE}admin/courses/${course.id}/assessment`,
              { headers: { Authorization: `Bearer ${token}` } }
            );
            if (!res.ok) return;
            const data = await res.json();
            const assessment = data?.data || data;
            if (!assessment || !assessment.id) return;

            const questions = assessment.questions || [];
            const questionType: QuestionType = questions.some(
              (q: any) =>
                q.questionType === "multiple_choice" &&
                Array.isArray(q.options) &&
                q.options.length > 0
            )
              ? "multiple"
              : questions.length > 0
              ? "single"
              : "upload";

            results.push({
              id: assessment.id,
              title: assessment.title || "Untitled Assessment",
              courseId: course.id,
              courseName: course.title || course.name || `Course #${course.id}`,
              questionType,
            });
          } catch {
            // skip course on error
          }
        })
      );

      setRows(results);
    } catch (e: any) {
      setError(e.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchCourseAssessments();
  }, []);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.courseName.toLowerCase().includes(q) ||
        QUESTION_TYPE_LABEL[r.questionType].toLowerCase().includes(q) ||
        String(r.id).includes(q)
    );
  }, [rows, query]);

  function openEdit(row: CourseAssessmentRow) {
    setEditingRow(row);
    setEditFile(null);
    setEditForm({
      title: row.title,
      description: "",
      passMarkPercent: 70,
      maxAttempts: 2,
      timeLimitMinutes: 0,
      isActive: false,
    });
  }

  async function handleSaveEdit() {
    if (!editingRow) return;
    setSaving(true);
    try {
      const res = await fetch(
        `${API_BASE}admin/courses/${editingRow.courseId}/assessment`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(editForm),
        }
      );
      if (!res.ok) throw new Error("Failed to update assessment");

      if (editFile) {
        const cloudinaryUrl = await uploadFileToCloudinary(editFile);
        
        const uploadRes = await fetch(
          `${API_BASE}admin/assessment-items/bulk-upload`,
          {
            method: "POST",
            headers: { 
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}` 
            },
            body: JSON.stringify({
              fileUrl: cloudinaryUrl,
              parentId: editingRow.id,
              parentType: "course_assessment",
            }),
          }
        );
        if (!uploadRes.ok) throw new Error("Failed to process questions file");
      }

      setEditingRow(null);
      fetchCourseAssessments();
    } catch (e: any) {
      alert(e.message || "Failed to save changes");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(row: CourseAssessmentRow) {
    if (!confirm(`Delete assessment "${row.title}" for ${row.courseName}?`)) return;
    try {
      const res = await fetch(
        `${API_BASE}admin/courses/${row.courseId}/assessment`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (!res.ok) throw new Error("Failed to delete assessment");
      setRows((prev) => prev.filter((r) => r.id !== row.id));
    } catch (e: any) {
      alert(e.message || "Failed to delete");
    }
  }

  return (
    <div>
      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by title, course or question type..."
          className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#004900]/30 focus:border-[#004900]"
        />
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-left text-gray-500">
              <th className="px-4 py-3 font-medium">ID</th>
              <th className="px-4 py-3 font-medium">Title</th>
              <th className="px-4 py-3 font-medium">Course Name</th>
              <th className="px-4 py-3 font-medium">Question Type</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                  Loading course assessments...
                </td>
              </tr>
            )}
            {!loading && error && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-red-500">
                  {error}
                </td>
              </tr>
            )}
            {!loading && !error && filteredRows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                  No course assessments found.
                </td>
              </tr>
            )}
            {!loading &&
              !error &&
              filteredRows.map((row) => (
                <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-700">{row.id}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{row.title}</td>
                  <td className="px-4 py-3 text-gray-700">{row.courseName}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-700">
                      {QUESTION_TYPE_LABEL[row.questionType]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => openEdit(row)}
                      className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-gray-500 hover:bg-gray-100 mr-1"
                      title="Edit"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(row)}
                      className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-red-500 hover:bg-red-50"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {editingRow && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg p-6 relative">
            <button
              onClick={() => setEditingRow(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
              title="button"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-semibold mb-1">Edit Course Assessment</h3>
            <p className="text-sm text-gray-500 mb-4">{editingRow.courseName}</p>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600">Title</label>
                <input
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  title="input"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Description</label>
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  rows={2}
                  title="textarea"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">Pass Mark %</label>
                  <input
                    type="number"
                    value={editForm.passMarkPercent}
                    onChange={(e) =>
                      setEditForm({ ...editForm, passMarkPercent: Number(e.target.value) })
                    }
                    className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                    title="input"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Max Attempts</label>
                  <input
                    type="number"
                    value={editForm.maxAttempts}
                    onChange={(e) =>
                      setEditForm({ ...editForm, maxAttempts: Number(e.target.value) })
                    }
                    className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                    title="input"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Time Limit (min)</label>
                  <input
                    type="number"
                    value={editForm.timeLimitMinutes}
                    onChange={(e) =>
                      setEditForm({ ...editForm, timeLimitMinutes: Number(e.target.value) })
                    }
                    className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                    title="input"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={editForm.isActive}
                  onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                />
                Active
              </label>

              <div>
                <label className="text-xs font-medium text-gray-600">
                  Replace Questions (CSV / Excel)
                </label>
                <label className="mt-1 flex items-center gap-2 px-3 py-2 border border-dashed border-gray-300 rounded-lg text-sm text-gray-500 cursor-pointer hover:border-[#004900]">
                  <Upload className="w-4 h-4" />
                  {editFile ? editFile.name : "Choose .csv or .xlsx file"}
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    className="hidden"
                    onChange={(e) => setEditFile(e.target.files?.[0] || null)}
                  />
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setEditingRow(null)}
                className="px-4 py-2 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={saving}
                className="px-4 py-2 text-sm rounded-lg bg-[#004900] text-white hover:bg-[#003600] disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}