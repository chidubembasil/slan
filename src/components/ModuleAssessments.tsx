import { useEffect, useMemo, useState } from "react";
import { Pencil, Trash2, Search, Upload, X, Plus, Trash } from "lucide-react";

const API_BASE = import.meta.env.VITE_BASE_URL;

type QuestionType = "single" | "multiple" | "upload";

const QUESTION_TYPE_LABEL: Record<QuestionType, string> = {
  single: "Single Choice",
  multiple: "Multiple Choice",
  upload: "Upload (CSV/Excel)",
};

interface ModuleAssessmentRow {
  id: number;
  title: string;
  moduleId: number;
  moduleName: string;
  questionType: QuestionType;
  questionCount: number;
}

interface AssessmentItem {
  id?: number;
  questionText: string;
  questionType: "multiple_choice" | "true_false" | "short_answer";
  options: { id: string; text: string }[];
  correctAnswer: string;
  explanation?: string;
  orderIndex?: number;
  points: number;
}

const PARENT_TYPE = "module_assessment";

function emptyItem(): AssessmentItem {
  return {
    questionText: "",
    questionType: "multiple_choice",
    options: [
      { id: "a", text: "" },
      { id: "b", text: "" },
      { id: "c", text: "" },
      { id: "d", text: "" },
    ],
    correctAnswer: "",
    explanation: "",
    orderIndex: 0,
    points: 1,
  };
}

export default function ModuleAssessments() {
  const [rows, setRows] = useState<ModuleAssessmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const [editingRow, setEditingRow] = useState<ModuleAssessmentRow | null>(null);
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    passMarkPercent: 70,
    maxAttempts: 2,
    timeLimitMinutes: 0,
    isActive: false,
  });

  const [singleItem, setSingleItem] = useState<AssessmentItem>(emptyItem());
  const [multipleItems, setMultipleItems] = useState<AssessmentItem[]>([emptyItem()]);
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const [loadingItems, setLoadingItems] = useState(false);
  const [saving, setSaving] = useState(false);

  const token = localStorage.getItem("adminAccessToken") || "";

  function authHeaders(json = true) {
    const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
    if (json) headers["Content-Type"] = "application/json";
    return headers;
  }

  async function fetchModuleAssessments() {
    setLoading(true);
    setError(null);
    try {
      const tracksRes = await fetch(`${API_BASE}admin/tracks`, {
        headers: authHeaders(false),
      });
      if (!tracksRes.ok) throw new Error("Failed to load tracks");
      const tracksData = await tracksRes.json();
      const trackList = Array.isArray(tracksData) ? tracksData : tracksData.data || [];

      const moduleListsNested = await Promise.all(
        trackList.map(async (track: any) => {
          try {
            const res = await fetch(`${API_BASE}admin/tracks/${track.id}/modules`, {
              headers: authHeaders(false),
            });
            if (!res.ok) return [];
            const data = await res.json();
            return Array.isArray(data) ? data : data.data || [];
          } catch {
            return [];
          }
        })
      );
      const moduleList = moduleListsNested.flat();

      const results: ModuleAssessmentRow[] = [];
      await Promise.all(
        moduleList.map(async (mod: any) => {
          try {
            const res = await fetch(`${API_BASE}admin/modules/${mod.id}/assessment`, {
              headers: authHeaders(false),
            });
            if (!res.ok) return;
            const data = await res.json();
            const assessment = data?.data || data;
            if (!assessment || !assessment.id) return;

            let questionCount = 0;
            try {
              const itemsRes = await fetch(
                `${API_BASE}admin/assessment-items?parentId=${assessment.id}&parentType=${PARENT_TYPE}`,
                { headers: authHeaders(false) }
              );
              if (itemsRes.ok) {
                const itemsData = await itemsRes.json();
                const items = Array.isArray(itemsData) ? itemsData : itemsData.data || [];
                questionCount = items.length;
              }
            } catch {
              // leave at 0
            }

            const questionType: QuestionType =
              questionCount === 1 ? "single" : questionCount > 1 ? "multiple" : "upload";

            results.push({
              id: assessment.id,
              title: assessment.title || "Untitled Assessment",
              moduleId: mod.id,
              moduleName: mod.title || mod.name || `Module #${mod.id}`,
              questionType,
              questionCount,
            });
          } catch {
            // skip
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
    fetchModuleAssessments();
  }, []);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.moduleName.toLowerCase().includes(q) ||
        QUESTION_TYPE_LABEL[r.questionType].toLowerCase().includes(q) ||
        String(r.id).includes(q)
    );
  }, [rows, query]);

  async function openEdit(row: ModuleAssessmentRow) {
    setEditingRow(row);
    setUploadFile(null);

    // FIX: fetch the real assessment config so description and all fields are populated
    try {
      const configRes = await fetch(`${API_BASE}admin/modules/${row.moduleId}/assessment`, {
        headers: authHeaders(false),
      });
      if (configRes.ok) {
        const configData = await configRes.json();
        const cfg = configData?.data || configData;
        setEditForm({
          title: cfg.title || row.title,
          description: cfg.description || "",
          passMarkPercent: cfg.passMarkPercent ?? 70,
          maxAttempts: cfg.maxAttempts ?? 2,
          timeLimitMinutes: cfg.timeLimitMinutes ?? 0,
          isActive: cfg.isActive ?? false,
        });
      } else {
        setEditForm({
          title: row.title,
          description: "",
          passMarkPercent: 70,
          maxAttempts: 2,
          timeLimitMinutes: 0,
          isActive: false,
        });
      }
    } catch {
      setEditForm({
        title: row.title,
        description: "",
        passMarkPercent: 70,
        maxAttempts: 2,
        timeLimitMinutes: 0,
        isActive: false,
      });
    }

    if (row.questionType === "upload") return;

    setLoadingItems(true);
    try {
      const res = await fetch(
        `${API_BASE}admin/assessment-items?parentId=${row.id}&parentType=${PARENT_TYPE}`,
        { headers: authHeaders(false) }
      );
      if (!res.ok) throw new Error("Failed to load questions");
      const data = await res.json();
      const items: AssessmentItem[] = Array.isArray(data) ? data : data.data || [];

      const normalized = items.map((it: any, idx: number) => ({
        id: it.id,
        questionText: it.questionText || "",
        questionType: it.questionType || "multiple_choice",
        options:
          it.options && it.options.length
            ? it.options
            : [
                { id: "a", text: "" },
                { id: "b", text: "" },
                { id: "c", text: "" },
                { id: "d", text: "" },
              ],
        correctAnswer: it.correctAnswer || "",
        explanation: it.explanation || "",
        orderIndex: it.orderIndex ?? idx,
        points: it.points ?? 1,
      }));

      if (row.questionType === "single") {
        setSingleItem(normalized[0] || emptyItem());
      } else {
        setMultipleItems(normalized.length ? normalized : [emptyItem()]);
      }
    } catch (e: any) {
      alert(e.message || "Failed to load existing questions");
    } finally {
      setLoadingItems(false);
    }
  }

  function closeEdit() {
    setEditingRow(null);
    setSingleItem(emptyItem());
    setMultipleItems([emptyItem()]);
    setUploadFile(null);
  }

  async function saveAssessmentConfig(moduleId: number) {
    const res = await fetch(`${API_BASE}admin/modules/${moduleId}/assessment`, {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify(editForm),
    });
    if (!res.ok) {
      let message = "Failed to update assessment";
      try {
        const errData = await res.json();
        message = errData?.message || errData?.error || message;
      } catch {}
      throw new Error(message);
    }
  }

  async function handleSaveEdit() {
    if (!editingRow) return;
    setSaving(true);
    try {
      await saveAssessmentConfig(editingRow.moduleId);

      if (editingRow.questionType === "single") {
        await saveSingleQuestion(editingRow.id, singleItem);
      } else if (editingRow.questionType === "multiple") {
        await saveMultipleQuestions(editingRow.id, multipleItems);
      } else if (editingRow.questionType === "upload") {
        if (uploadFile) {
          await uploadQuestionsFile(editingRow.id, uploadFile);
        }
      }

      closeEdit();
      fetchModuleAssessments();
    } catch (e: any) {
      alert(e.message || "Failed to save changes");
    } finally {
      setSaving(false);
    }
  }

  async function saveSingleQuestion(parentId: number, item: AssessmentItem) {
    const payload = {
      parentId,
      parentType: PARENT_TYPE,
      questionText: item.questionText,
      questionType: item.questionType,
      options:
        item.questionType === "multiple_choice"
          ? item.options.filter((o) => o.text.trim())
          : undefined,
      correctAnswer: item.correctAnswer,
      explanation: item.explanation || undefined,
      orderIndex: item.orderIndex ?? 0,
      points: item.points,
    };

    if (item.id) {
      const res = await fetch(`${API_BASE}admin/assessment-items/${item.id}`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        let message = "Failed to update question";
        try { const d = await res.json(); message = d?.message || d?.error || message; } catch {}
        throw new Error(message);
      }
    } else {
      const res = await fetch(`${API_BASE}admin/assessment-items`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        let message = "Failed to create question";
        try { const d = await res.json(); message = d?.message || d?.error || message; } catch {}
        throw new Error(message);
      }
    }
  }

  async function saveMultipleQuestions(parentId: number, items: AssessmentItem[]) {
    const existing = items.filter((i) => i.id);
    const fresh = items.filter((i) => !i.id);

    await Promise.all(
      existing.map((item) =>
        fetch(`${API_BASE}admin/assessment-items/${item.id}`, {
          method: "PUT",
          headers: authHeaders(),
          body: JSON.stringify({
            parentId,
            parentType: PARENT_TYPE,
            questionText: item.questionText,
            questionType: item.questionType,
            options:
              item.questionType === "multiple_choice"
                ? item.options.filter((o) => o.text.trim())
                : undefined,
            correctAnswer: item.correctAnswer,
            explanation: item.explanation || undefined,
            orderIndex: item.orderIndex ?? 0,
            points: item.points,
          }),
        }).then((res) => {
          if (!res.ok) throw new Error("Failed to update one of the questions");
        })
      )
    );

    if (fresh.length) {
      const res = await fetch(`${API_BASE}admin/assessment-items/bulk`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          parentId,
          parentType: PARENT_TYPE,
          questions: fresh.map((item, idx) => ({
            questionText: item.questionText,
            questionType: item.questionType,
            options:
              item.questionType === "multiple_choice"
                ? item.options.filter((o) => o.text.trim())
                : undefined,
            correctAnswer: item.correctAnswer,
            explanation: item.explanation || undefined,
            orderIndex: item.orderIndex ?? idx,
            points: item.points,
          })),
        }),
      });
      if (!res.ok) throw new Error("Failed to add new questions");
    }
  }

  async function uploadQuestionsFile(parentId: number, file: File) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("parentId", String(parentId));
    formData.append("parentType", PARENT_TYPE);

    const res = await fetch(`${API_BASE}admin/assessment-items/bulk-upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.message || "Failed to process questions file");
    }
  }

  async function handleDelete(row: ModuleAssessmentRow) {
    if (!confirm(`Delete assessment "${row.title}" for ${row.moduleName}?`)) return;
    try {
      // FIX: Delete all assessment items first before deleting the config
      const itemsRes = await fetch(
        `${API_BASE}admin/assessment-items?parentId=${row.id}&parentType=${PARENT_TYPE}`,
        { headers: authHeaders(false) }
      );
      if (itemsRes.ok) {
        const itemsData = await itemsRes.json();
        const items = Array.isArray(itemsData) ? itemsData : itemsData.data || [];
        await Promise.all(
          items.map((item: any) =>
            fetch(`${API_BASE}admin/assessment-items/${item.id}`, {
              method: "DELETE",
              headers: authHeaders(false),
            })
          )
        );
      }

      // Now delete the assessment config
      let res = await fetch(`${API_BASE}admin/modules/${row.moduleId}/assessment`, {
        method: "DELETE",
        headers: authHeaders(false),
      });
      if (!res.ok && res.status === 404) {
        res = await fetch(`${API_BASE}admin/assessments/${row.id}`, {
          method: "DELETE",
          headers: authHeaders(false),
        });
      }
      if (!res.ok) {
        let message = "Failed to delete assessment";
        try {
          const errData = await res.json();
          message = errData?.message || errData?.error || message;
        } catch {
          try { const text = await res.text(); if (text) message = text; } catch {}
        }
        throw new Error(message);
      }
      setRows((prev) => prev.filter((r) => r.id !== row.id));
    } catch (e: any) {
      alert(e.message || "Failed to delete");
    }
  }

  function updateMultipleItem(index: number, patch: Partial<AssessmentItem>) {
    setMultipleItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...patch } : item))
    );
  }

  function updateMultipleItemOption(index: number, optionId: string, text: string) {
    setMultipleItems((prev) =>
      prev.map((item, i) =>
        i === index
          ? { ...item, options: item.options.map((o) => (o.id === optionId ? { ...o, text } : o)) }
          : item
      )
    );
  }

  function addMultipleItem() {
    setMultipleItems((prev) => [...prev, emptyItem()]);
  }

  async function removeMultipleItem(index: number) {
    const item = multipleItems[index];
    if (item.id) {
      if (!confirm("Delete this question?")) return;
      try {
        const res = await fetch(`${API_BASE}admin/assessment-items/${item.id}`, {
          method: "DELETE",
          headers: authHeaders(false),
        });
        if (!res.ok) throw new Error("Failed to delete question");
      } catch (e: any) {
        alert(e.message || "Failed to delete question");
        return;
      }
    }
    setMultipleItems((prev) => prev.filter((_, i) => i !== index));
  }

  function updateSingleOption(optionId: string, text: string) {
    setSingleItem((prev) => ({
      ...prev,
      options: prev.options.map((o) => (o.id === optionId ? { ...o, text } : o)),
    }));
  }

  return (
    <div>
      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by title, module or question type..."
          className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#004900]/30 focus:border-[#004900]"
        />
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-left text-gray-500">
              <th className="px-4 py-3 font-medium">ID</th>
              <th className="px-4 py-3 font-medium">Title</th>
              <th className="px-4 py-3 font-medium">Module Name</th>
              <th className="px-4 py-3 font-medium">Question Type</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                  Loading module assessments...
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
                  No module assessments found.
                </td>
              </tr>
            )}
            {!loading &&
              !error &&
              filteredRows.map((row) => (
                <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-700">{row.id}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{row.title}</td>
                  <td className="px-4 py-3 text-gray-700">{row.moduleName}</td>
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
          <div className="bg-white rounded-xl w-full max-w-2xl p-6 relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={closeEdit}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
              title="cancel"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-semibold mb-1">Edit Module Assessment</h3>
            <div className="flex items-center gap-2 mb-4">
              <p className="text-sm text-gray-500">{editingRow.moduleName}</p>
              <span className="inline-flex px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-700">
                {QUESTION_TYPE_LABEL[editingRow.questionType]}
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600">Title</label>
                <input
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  title="title"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Description</label>
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  rows={2}
                  title="description"
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
                    title="pass mark"
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
                    title="max attempts"
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
                    title="time limit"
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
            </div>

            <hr className="my-5 border-gray-100" />

            {loadingItems && (
              <p className="text-sm text-gray-400 text-center py-6">Loading questions...</p>
            )}

            {!loadingItems && editingRow.questionType === "single" && (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  Single Question
                </p>
                <SingleQuestionEditor
                  item={singleItem}
                  onChange={(patch) => setSingleItem((prev) => ({ ...prev, ...patch }))}
                  onOptionChange={updateSingleOption}
                />
              </div>
            )}

            {!loadingItems && editingRow.questionType === "multiple" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                    Questions ({multipleItems.length})
                  </p>
                  <button
                    onClick={addMultipleItem}
                    className="inline-flex items-center gap-1 text-xs text-[#004900] hover:underline"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add question
                  </button>
                </div>
                {multipleItems.map((item, idx) => (
                  <div key={item.id ?? `new-${idx}`} className="border border-gray-200 rounded-lg p-3 relative">
                    <button
                      onClick={() => removeMultipleItem(idx)}
                      className="absolute top-2 right-2 text-gray-400 hover:text-red-500"
                      title="remove question"
                    >
                      <Trash className="w-3.5 h-3.5" />
                    </button>
                    <p className="text-xs text-gray-400 mb-2">Question {idx + 1}</p>
                    <SingleQuestionEditor
                      item={item}
                      onChange={(patch) => updateMultipleItem(idx, patch)}
                      onOptionChange={(optionId, text) =>
                        updateMultipleItemOption(idx, optionId, text)
                      }
                    />
                  </div>
                ))}
              </div>
            )}

            {!loadingItems && editingRow.questionType === "upload" && (
              <div>
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
                  Replace Questions (CSV / Excel)
                </p>
                <label className="mt-1 flex items-center gap-2 px-3 py-2 border border-dashed border-gray-300 rounded-lg text-sm text-gray-500 cursor-pointer hover:border-[#004900]">
                  <Upload className="w-4 h-4" />
                  {uploadFile ? uploadFile.name : "Choose .csv or .xlsx file"}
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    className="hidden"
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  />
                </label>
                <p className="text-xs text-gray-400 mt-2">
                  Required columns: question_text, question_type, correct_answer. Optional:
                  option_a–d, explanation, points. Max 5MB.
                </p>
              </div>
            )}

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={closeEdit}
                className="px-4 py-2 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={saving || loadingItems}
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

function SingleQuestionEditor({
  item,
  onChange,
  onOptionChange,
}: {
  item: AssessmentItem;
  onChange: (patch: Partial<AssessmentItem>) => void;
  onOptionChange: (optionId: string, text: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-medium text-gray-600">Question Text</label>
        <textarea
          value={item.questionText}
          onChange={(e) => onChange({ questionText: e.target.value })}
          className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
          rows={2}
          title="question text"
        />
      </div>

      <div>
        <label className="text-xs font-medium text-gray-600">Question Type</label>
        <select
          value={item.questionType}
          onChange={(e) => onChange({ questionType: e.target.value as AssessmentItem["questionType"] })}
          className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
          title="question type select"
        >
          <option value="multiple_choice">Multiple Choice</option>
          <option value="true_false">True / False</option>
          <option value="short_answer">Short Answer</option>
        </select>
      </div>

      {item.questionType === "multiple_choice" && (
        <div className="grid grid-cols-2 gap-2">
          {item.options.map((opt) => (
            <div key={opt.id}>
              <label className="text-xs font-medium text-gray-600">Option {opt.id.toUpperCase()}</label>
              <input
                value={opt.text}
                onChange={(e) => onOptionChange(opt.id, e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                title={`option ${opt.id}`}
              />
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-gray-600">Correct Answer</label>
          {item.questionType === "multiple_choice" ? (
            <select
              value={item.correctAnswer}
              onChange={(e) => onChange({ correctAnswer: e.target.value })}
              className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
              title="correct answer select"
            >
              <option value="">Select...</option>
              {item.options.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.id.toUpperCase()}
                </option>
              ))}
            </select>
          ) : item.questionType === "true_false" ? (
            <select
              value={item.correctAnswer}
              onChange={(e) => onChange({ correctAnswer: e.target.value })}
              className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
              title="correct answer select"
            >
              <option value="">Select...</option>
              <option value="true">True</option>
              <option value="false">False</option>
            </select>
          ) : (
            <input
              value={item.correctAnswer}
              onChange={(e) => onChange({ correctAnswer: e.target.value })}
              className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
              title="correct answer"
            />
          )}
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600">Points</label>
          <input
            type="number"
            value={item.points}
            onChange={(e) => onChange({ points: Number(e.target.value) })}
            className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
            title="points"
          />
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-gray-600">Explanation (optional)</label>
        <textarea
          value={item.explanation}
          onChange={(e) => onChange({ explanation: e.target.value })}
          className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
          rows={2}
          title="explanation"
        />
      </div>
    </div>
  );
}