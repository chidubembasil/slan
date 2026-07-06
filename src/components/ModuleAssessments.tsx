import { useEffect, useMemo, useState } from "react";
import {
  Pencil,
  Trash2,
  Search,
  Upload,
  X,
  Plus,
  Trash,
  History,
  RotateCcw,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_BASE_URL;

type QuestionType = "single" | "multiple" | "upload";

interface ModuleAssessmentRow {
  id: number;
  title: string;
  moduleId: number;
  moduleName: string;
  questionType: QuestionType; // used to decide which editor UI to show
  displayLabel: string; // used to render the actual badge in the table
  questionCount: number;
  isActive: boolean;
}

interface AssessmentItem {
  id?: number;
  questionText: string;
  questionType: "multiple_choice" | "true_false" | "short_answer";
  options: string[];
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
    options: ["", "", "", ""],
    correctAnswer: "",
    explanation: "",
    orderIndex: 0,
    points: 1,
  };
}

// Options sometimes come back from the API as objects (e.g. { text: "..." })
// instead of plain strings. This normalizes any shape into a display string
// so inputs never render "[object Object]".
function optionLabel(opt: unknown): string {
  if (typeof opt === "string") return opt;
  if (opt && typeof opt === "object") {
    const o = opt as Record<string, unknown>;
    const val = o.text ?? o.label ?? o.value ?? o.option ?? "";
    return typeof val === "string" ? val : String(val ?? "");
  }
  return opt === undefined || opt === null ? "" : String(opt);
}

function normalizeOptions(raw: unknown): string[] {
  if (Array.isArray(raw) && raw.length) {
    return raw.map(optionLabel);
  }
  return ["", "", "", ""];
}

// Derives the badge text from the assessment's actual question items,
// instead of guessing from a count. "No question yet" when the assessment
// has zero items; the real question type when there's one shared type
// across items; a comma-joined list of the types present when items have
// different types (e.g. from a bulk file upload with varied questions).
function getDisplayLabel(items: any[]): string {
  if (!items || items.length === 0) return "No question yet";
  const labels: Record<string, string> = {
    multiple_choice: "Multiple Choice",
    true_false: "True/False",
    short_answer: "Short Answer",
  };
  const types = [...new Set(items.map((it) => it?.questionType).filter(Boolean))] as string[];
  return types.map((t) => labels[t] || t).join(", ");
}

// Pulls every bit of detail a backend validation error might carry
// (message, error, errors[], details[], nested field errors) into one
// readable string, instead of showing a bare "Validation error".
function extractErrorMessage(d: any, fallback: string): string {
  if (!d) return fallback;
  const parts: string[] = [];
  if (d.message && typeof d.message === "string") parts.push(d.message);
  if (d.error && d.error !== d.message) {
    parts.push(typeof d.error === "string" ? d.error : JSON.stringify(d.error));
  }
  const flatten = (val: any): string =>
    Array.isArray(val)
      ? val.map((e) => (typeof e === "string" ? e : e?.message || JSON.stringify(e))).join("; ")
      : typeof val === "string"
      ? val
      : JSON.stringify(val);
  if (d.errors) parts.push(flatten(d.errors));
  if (d.details) parts.push(flatten(d.details));
  const unique = [...new Set(parts.filter(Boolean))];
  return unique.length ? unique.join(" — ") : fallback;
}

// Existing questions (especially ones created via CSV/Excel bulk upload)
// sometimes store the multiple-choice correct answer as a letter ("a"-"d")
// rather than the numeric option index the edit form's dropdown expects.
// Without this, the dropdown shows blank ("Select...") for those questions,
// and saving without touching it sends Number("b") -> NaN -> null over the
// wire, which the backend rejects. This converts letters to the matching
// numeric index so the dropdown pre-selects correctly.
function normalizeCorrectAnswer(it: any): string {
  if (it?.correctAnswer === undefined || it?.correctAnswer === null) return "";
  if (typeof it.correctAnswer === "number") return String(it.correctAnswer);
  const raw = String(it.correctAnswer).trim();
  if (/^\d+$/.test(raw)) return raw;
  if (it.questionType === "multiple_choice" && /^[a-dA-D]$/.test(raw)) {
    return String(raw.toLowerCase().charCodeAt(0) - "a".charCodeAt(0));
  }
  return raw;
}

// Client-side guard so a question with no valid answer never gets sent to
// the backend as null. Returns an error string, or null if the item is fine.
function validateItem(item: AssessmentItem, label: string): string | null {
  if (!item.questionText.trim()) return `${label}: question text is required`;
  if (item.questionType === "multiple_choice") {
    if (item.correctAnswer === "") {
      return `${label}: please select the correct answer`;
    }
  } else if (item.questionType === "true_false") {
    if (item.correctAnswer !== "true" && item.correctAnswer !== "false") {
      return `${label}: please select True or False`;
    }
  } else if (item.questionType === "short_answer") {
    if (!item.correctAnswer.trim()) return `${label}: please enter the expected answer`;
  }
  return null;
}

export default function ModuleAssessments() {
  const [rows, setRows] = useState<ModuleAssessmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);

  const [editingRow, setEditingRow] = useState<ModuleAssessmentRow | null>(null);
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    passMarkPercent: 70,
    maxAttempts: 2,
    timeLimitMinutes: 0,
    isActive: true,
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
            let items: any[] = [];
            try {
              const itemsRes = await fetch(
                `${API_BASE}admin/assessment-items?parentId=${assessment.id}&parentType=${PARENT_TYPE}`,
                { headers: authHeaders(false) }
              );
              if (itemsRes.ok) {
                const itemsData = await itemsRes.json();
                items = Array.isArray(itemsData) ? itemsData : itemsData.data || [];
                questionCount = items.length;
              }
            } catch {
              // leave at 0 / empty
            }

            const questionType: QuestionType =
              questionCount === 1 ? "single" : questionCount > 1 ? "multiple" : "upload";

            results.push({
              id: assessment.id,
              title: assessment.title || "Untitled Assessment",
              moduleId: mod.id,
              moduleName: mod.title || mod.name || `Module #${mod.id}`,
              questionType,
              displayLabel: getDisplayLabel(items),
              questionCount,
              isActive: assessment.isActive !== false,
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

  const activeRows = useMemo(() => rows.filter((r) => r.isActive), [rows]);
  const historyRows = useMemo(() => rows.filter((r) => !r.isActive), [rows]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return activeRows;
    return activeRows.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.moduleName.toLowerCase().includes(q) ||
        r.displayLabel.toLowerCase().includes(q) ||
        String(r.id).includes(q)
    );
  }, [activeRows, query]);

  async function openEdit(row: ModuleAssessmentRow) {
    setEditingRow(row);
    setUploadFile(null);

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
          isActive: cfg.isActive ?? true,
        });
      } else {
        setEditForm({
          title: row.title,
          description: "",
          passMarkPercent: 70,
          maxAttempts: 2,
          timeLimitMinutes: 0,
          isActive: row.isActive,
        });
      }
    } catch {
      setEditForm({
        title: row.title,
        description: "",
        passMarkPercent: 70,
        maxAttempts: 2,
        timeLimitMinutes: 0,
        isActive: row.isActive,
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

      const normalized: AssessmentItem[] = items.map((it: any, idx: number) => ({
        id: it.id,
        questionText: it.questionText || "",
        questionType: it.questionType || "multiple_choice",
        options: normalizeOptions(it.options),
        correctAnswer: normalizeCorrectAnswer(it),
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

  function buildQuestionPayload(item: AssessmentItem, parentId: number, orderIndex: number) {
    return {
      parentId,
      parentType: PARENT_TYPE,
      questionText: item.questionText,
      questionType: item.questionType,
      options:
        item.questionType === "multiple_choice"
          ? item.options.filter((o) => o.trim())
          : [],
      correctAnswer:
        item.questionType === "multiple_choice"
          ? Number(item.correctAnswer)
          : item.correctAnswer,
      explanation: item.explanation || undefined,
      orderIndex: item.orderIndex ?? orderIndex,
      points: item.points,
    };
  }

  async function saveSingleQuestion(parentId: number, item: AssessmentItem) {
    const validationError = validateItem(item, "This question");
    if (validationError) throw new Error(validationError);

    const payload = buildQuestionPayload(item, parentId, 0);

    if (item.id) {
      const res = await fetch(`${API_BASE}admin/assessment-items/${item.id}`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        let message = "Failed to update question";
        try {
          const d = await res.json();
          console.error("Update question failed. Payload:", payload, "Response:", d);
          message = extractErrorMessage(d, message);
        } catch {}
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
        try {
          const d = await res.json();
          console.error("Create question failed. Payload:", payload, "Response:", d);
          message = extractErrorMessage(d, message);
        } catch {}
        throw new Error(message);
      }
    }
  }

  async function saveMultipleQuestions(parentId: number, items: AssessmentItem[]) {
    for (let i = 0; i < items.length; i++) {
      const validationError = validateItem(items[i], `Question ${i + 1}`);
      if (validationError) throw new Error(validationError);
    }

    const existing = items.filter((i) => i.id);
    const fresh = items.filter((i) => !i.id);

    // Sequential (not Promise.all) so a failure tells us exactly which
    // question and why, instead of a generic "one of the questions" alert.
    for (let idx = 0; idx < existing.length; idx++) {
      const item = existing[idx];
      const payload = buildQuestionPayload(item, parentId, idx);
      const res = await fetch(`${API_BASE}admin/assessment-items/${item.id}`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const label = item.questionText?.trim()
          ? `"${item.questionText.slice(0, 40)}${item.questionText.length > 40 ? "…" : ""}"`
          : `#${idx + 1}`;
        let message = `Failed to update question ${label}`;
        try {
          const d = await res.json();
          console.error(`Update question ${label} failed. Payload:`, payload, "Response:", d);
          message = extractErrorMessage(d, message);
        } catch {}
        throw new Error(message);
      }
    }

    if (fresh.length) {
      const bulkPayload = {
        parentId,
        parentType: PARENT_TYPE,
        questions: fresh.map((item, idx) => ({
          questionText: item.questionText,
          questionType: item.questionType,
          options:
            item.questionType === "multiple_choice"
              ? item.options.filter((o) => o.trim())
              : [],
          correctAnswer:
            item.questionType === "multiple_choice"
              ? Number(item.correctAnswer)
              : item.correctAnswer,
          explanation: item.explanation || undefined,
          orderIndex: item.orderIndex ?? idx,
          points: item.points,
        })),
      };
      const res = await fetch(`${API_BASE}admin/assessment-items/bulk`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(bulkPayload),
      });
      if (!res.ok) {
        let message = "Failed to add new questions";
        try {
          const d = await res.json();
          console.error("Bulk add questions failed. Payload:", bulkPayload, "Response:", d);
          message = extractErrorMessage(d, message);
        } catch {}
        throw new Error(message);
      }
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

  // Sets a row's active status on the backend and mirrors it in local state.
  // This is the shared mechanism behind Delete (-> false) and Restore (-> true).
  async function setRowActive(row: ModuleAssessmentRow, isActive: boolean) {
    try {
      const res = await fetch(`${API_BASE}admin/modules/${row.moduleId}/assessment`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({ isActive }),
      });
      if (!res.ok) {
        throw new Error(
          isActive ? "Failed to restore assessment" : "Failed to move assessment to history"
        );
      }
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, isActive } : r)));
    } catch (e: any) {
      alert(e.message || "Something went wrong");
    }
  }

  async function handleDelete(row: ModuleAssessmentRow) {
    if (!confirm(`Move assessment "${row.title}" for ${row.moduleName} to history?`)) return;
    await setRowActive(row, false);
  }

  async function handleRestore(row: ModuleAssessmentRow) {
    await setRowActive(row, true);
  }

  async function handlePermanentDelete(row: ModuleAssessmentRow) {
    if (
      !confirm(
        `Permanently delete assessment "${row.title}" for ${row.moduleName}? This cannot be undone.`
      )
    )
      return;
    try {
      const itemsRes = await fetch(
        `${API_BASE}admin/assessment-items?parentId=${row.id}&parentType=${PARENT_TYPE}`,
        { headers: authHeaders(false) }
      );

      if (itemsRes.ok) {
        const itemsData = await itemsRes.json();
        const items = Array.isArray(itemsData) ? itemsData : itemsData.data || [];

        const deleteResults = await Promise.allSettled(
          items.map((item: any) =>
            fetch(`${API_BASE}admin/assessment-items/${item.id}`, {
              method: "DELETE",
              headers: authHeaders(false),
            })
          )
        );

        deleteResults.forEach((result, idx) => {
          if (result.status === "rejected") {
            console.warn(`Failed to delete item ${items[idx]?.id}:`, result.reason);
          }
        });
      }

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
        let message = "Failed to permanently delete assessment";
        try {
          const errData = await res.json();
          message = errData?.message || errData?.error || message;
        } catch {
          try {
            const text = await res.text();
            if (text) message = text;
          } catch {}
        }
        throw new Error(message);
      }

      setRows((prev) => prev.filter((r) => r.id !== row.id));
    } catch (e: any) {
      console.error("Permanent delete error:", e);
      alert(e.message || "Failed to permanently delete assessment");
    }
  }

  function updateMultipleItem(index: number, patch: Partial<AssessmentItem>) {
    setMultipleItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...patch } : item))
    );
  }

  function updateMultipleItemOption(itemIndex: number, optionIndex: number, text: string) {
    setMultipleItems((prev) =>
      prev.map((item, i) =>
        i === itemIndex
          ? {
              ...item,
              options: item.options.map((o, oi) => (oi === optionIndex ? text : o)),
            }
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

  function updateSingleOption(optionIndex: number, text: string) {
    setSingleItem((prev) => ({
      ...prev,
      options: prev.options.map((o, oi) => (oi === optionIndex ? text : o)),
    }));
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by title, module or question type..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#004900]/30 focus:border-[#004900]"
          />
        </div>
        <button
          onClick={() => setHistoryOpen(true)}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
          title="View history"
        >
          <History className="w-4 h-4" />
          History
          {historyRows.length > 0 && (
            <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[11px] rounded-full bg-gray-200 text-gray-700">
              {historyRows.length}
            </span>
          )}
        </button>
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
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-xs ${
                        row.displayLabel === "No question yet"
                          ? "bg-gray-100 text-gray-500"
                          : "bg-purple-50 text-purple-700"
                      }`}
                    >
                      {row.displayLabel}
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
                      title="Move to history"
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
                {editingRow.displayLabel}
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
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={editForm.isActive}
                  onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300 accent-[#004900]"
                />
                <span className="text-sm text-gray-700">Active</span>
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
                      onOptionChange={(optionIndex, text) =>
                        updateMultipleItemOption(idx, optionIndex, text)
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

      {historyOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-3xl p-6 relative max-h-[85vh] overflow-y-auto">
            <button
              onClick={() => setHistoryOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
              title="close"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-semibold mb-1">Assessment History</h3>
            <p className="text-sm text-gray-500 mb-4">
              Deleted or deactivated module assessments. Restore them or remove them for good.
            </p>

            {historyRows.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-10">Nothing in history.</p>
            ) : (
              <div className="border border-gray-200 rounded-xl overflow-hidden">
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
                    {historyRows.map((row) => (
                      <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-700">{row.id}</td>
                        <td className="px-4 py-3 font-medium text-gray-900">{row.title}</td>
                        <td className="px-4 py-3 text-gray-700">{row.moduleName}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-700">
                            {row.displayLabel}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleRestore(row)}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-[#004900] hover:bg-green-50 mr-1"
                            title="Restore"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handlePermanentDelete(row)}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-red-500 hover:bg-red-50"
                            title="Delete permanently"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
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
  onOptionChange: (optionIndex: number, text: string) => void;
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
          {item.options.map((opt, idx) => (
            <div key={idx}>
              <label className="text-xs font-medium text-gray-600">Option {String.fromCharCode(65 + idx)}</label>
              <input
                value={opt}
                onChange={(e) => onOptionChange(idx, e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                title={`option ${idx}`}
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
              {item.options.map((_, idx) => (
                <option key={idx} value={idx}>
                  {String.fromCharCode(65 + idx)}
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