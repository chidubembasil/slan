import { useEffect, useMemo, useState } from "react";
import {
  Pencil,
  Trash2,
  Search,
  Upload,
  X,
  Plus,
  Trash,
  Archive,
  RotateCcw,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_BASE_URL;

type QuestionType = "single" | "multiple" | "upload";

interface ModuleAssessmentRow {
  id: number;
  title: string;
  moduleId: number;
  moduleName: string;
  trackName: string;
  questionType: QuestionType; // used to decide which editor UI to show
  displayLabel: string; // used to render the actual badge in the table
  questionCount: number;
  isActive: boolean;
}

interface AssessmentItem {
  id?: number;
  questionText: string;
  questionType: "multiple_choice" | "true_false" | "short_answer";
  options: {
    id: string;
    text: string;
  }[];
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
      { id: "1", text: "" },
      { id: "2", text: "" },
      { id: "3", text: "" },
      { id: "4", text: "" }
    ],
    correctAnswer: "",
    explanation: "",
    orderIndex: 0,
    points: 1,
  };
}

// Options sometimes come back from the API as objects (e.g. { text: "..." })
// instead of plain strings. This normalizes any shape into a display string
// so inputs never render "[object Object]".
function normalizeOptions(raw: unknown): { id: string; text: string }[] {
  if (Array.isArray(raw) && raw.length) {
    return raw.map((opt: any, index) => ({
      id: String(opt.id ?? index),
      text: String(opt.text ?? opt.label ?? opt.value ?? opt.option ?? opt ?? ""),
    }));
  }

  return [
    { id: "1", text: "" },
    { id: "2", text: "" },
    { id: "3", text: "" },
    { id: "4", text: "" },
  ];
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
// can store the "correct answer" in a few different shapes depending on
// where they came from:
//   - a numeric option index (0-3)                      -> use directly
//   - a letter ("a"-"d")                                 -> convert to index
//   - the option's own id (a UUID assigned by the backend
//     when the question/option was created)              -> match against
//     the question's own options by id and resolve to index
//   - the full text of the correct option (bulk uploads) -> match against
//     the question's own options (case-insensitively) and resolve to index
//   - true/false as a boolean, "True"/"False", or 0/1     -> normalize to
//     the lowercase "true"/"false" the toggle expects
//
// IMPORTANT: the backend actually stores `correctAnswer` as the *option's
// own id* (a UUID), not as the numeric index the frontend sends when
// creating a question. e.g. a saved item looks like:
//   options: [{ id: "e3813e2e-...", text: "..." }, ...]
//   correctAnswer: "e3813e2e-..."   <- matches one option's id, NOT "0"/"1"/etc
// Without the id-matching branch below, the correct-answer radio would
// silently show nothing selected for anything other than a clean numeric
// index, even though the question genuinely has a correct answer saved on
// the backend.
function normalizeCorrectAnswer(it: any): string {
  if (it?.correctAnswer == null) return "";

  // TRUE/FALSE
  if (it.questionType === "true_false") {
    if (typeof it.correctAnswer === "boolean") {
      return it.correctAnswer ? "true" : "false";
    }

    const raw = String(it.correctAnswer).trim().toLowerCase();

    if (["true", "1", "yes"].includes(raw)) return "true";
    if (["false", "0", "no"].includes(raw)) return "false";

    return raw;
  }

  // MULTIPLE CHOICE
  if (it.questionType === "multiple_choice") {
    const options = normalizeOptions(it.options);

    // number
    if (typeof it.correctAnswer === "number") {
      return String(it.correctAnswer);
    }

    // object
    if (typeof it.correctAnswer === "object") {
      const value =
        it.correctAnswer.index ??
        it.correctAnswer.value ??
        it.correctAnswer.option ??
        it.correctAnswer.id ??
        it.correctAnswer.text ??
        "";

      return normalizeCorrectAnswer({
        ...it,
        correctAnswer: value,
      });
    }

    const raw = String(it.correctAnswer).trim();

    // index
    if (/^\d+$/.test(raw)) {
      return raw;
    }

    // A B C D
    if (/^[A-Da-d]$/.test(raw)) {
      return String(raw.toUpperCase().charCodeAt(0) - 65);
    }

    // option id (backend stores the option's own id as the correct answer)
    const idIndex = options.findIndex((o) => o.id === raw);
    if (idIndex >= 0) {
      return String(idIndex);
    }

    // option text
    const index = options.findIndex(
      o => o.text.trim().toLowerCase() === raw.toLowerCase()
    );

    if (index >= 0) {
      return String(index);
    }

    return "";
  }

  // SHORT ANSWER
  return String(it.correctAnswer);
}
// Short-answer questions have no single machine-checkable answer — the API
// validates `correctAnswer` as a number (an option index) for every
// question, which only makes sense for multiple_choice/true_false. Sending
// free text there is exactly what produced the
// `questions.N.correctAnswer: expected number, received string` bulk-save
// errors. So for short_answer we send `correctAnswer: null` and fold
// whatever the admin typed into the "Correct Answer" box into `explanation`
// instead — no text is lost, it just travels in a field the API accepts.
function buildCorrectAnswerFields(
  item: AssessmentItem
): { correctAnswer: number | string | null; explanation: string } {
  // The API schema documents `explanation` as a plain string field on every
  // question (see PUT /admin/assessment-items/{id}). Previously this fell
  // back to `undefined` when the box was empty, which can drop the field
  // from the JSON body entirely instead of sending "" — always send a
  // string so the field is present regardless of question type.
  if (item.questionType === "multiple_choice") {
    return { correctAnswer: Number(item.correctAnswer), explanation: item.explanation?.trim() || "" };
  }
  if (item.questionType === "short_answer") {
    return { 
        correctAnswer: item.correctAnswer, 
        explanation: item.explanation?.trim() || "" 
    };
}
  // true_false
  return { correctAnswer: item.correctAnswer, explanation: item.explanation?.trim() || "" };
}

// Client-side guard so a question with no valid answer never gets sent to
// the backend as null. Returns an error string, or null if the item is fine.
function validateItem(item: AssessmentItem, label: string): string | null {
  if (!item.questionText.trim()) return `${label}: question text is required`;
  if (item.questionType === "multiple_choice") {
    if (item.correctAnswer === "") {
      return `${label}: please mark which option is correct`;
    }
    const validOptionCount = item.options.filter((o) => o.text.trim()).length;
    const idx = Number(item.correctAnswer);
    if (!Number.isInteger(idx) || idx < 0 || idx >= validOptionCount) {
      return `${label}: correct answer is invalid — please mark a correct option`;
    }
  } else if (item.questionType === "true_false") {
    if (item.correctAnswer !== "true" && item.correctAnswer !== "false") {
      return `${label}: please mark True or False as correct`;
    }
  } else if (item.questionType === "short_answer") {
    // correctAnswer is optional for short_answer
  }
  return null;
}

export default function ModuleAssessments() {
  const [rows, setRows] = useState<ModuleAssessmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [archiveOpen, setArchiveOpen] = useState(false);

  const [editingRow, setEditingRow] = useState<ModuleAssessmentRow | null>(null);
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    passMarkPercent: 70,
    maxAttempts: 2,
    timeLimitMinutes: 0,
    isActive: true,
  });

  // A single unified list drives the editor for every assessment,
  // regardless of whether it started out as "single", "multiple", or
  // "upload" (bulk-created), so questions can always be added, edited,
  // or removed one at a time.
  const [items, setItems] = useState<AssessmentItem[]>([emptyItem()]);

  // CSV/Excel replace is now an optional, collapsed secondary action
  // instead of the only way to touch a bulk-uploaded assessment's
  // questions. Choosing a file here takes priority over the editable
  // list on save (it replaces all questions).
  const [showCsvReplace, setShowCsvReplace] = useState(false);
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
            const mods = Array.isArray(data) ? data : data.data || [];
            const trackName = track.title || track.name || `Track #${track.id}`;
            // Tag each module with the track it came from so the row (and
            // the archive table) can show which track it belongs to.
            return mods.map((m: any) => ({ ...m, __trackName: trackName }));
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
            let itemsForRow: any[] = [];
            try {
              const itemsRes = await fetch(
                `${API_BASE}admin/assessment-items?parentId=${assessment.id}&parentType=${PARENT_TYPE}`,
                { headers: authHeaders(false) }
              );
              if (itemsRes.ok) {
                const itemsData = await itemsRes.json();
                itemsForRow = Array.isArray(itemsData) ? itemsData : itemsData.data || [];
                questionCount = itemsForRow.length;
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
              trackName: mod.__trackName || "—",
              questionType,
              displayLabel: getDisplayLabel(itemsForRow),
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
  const archivedRows = useMemo(() => rows.filter((r) => !r.isActive), [rows]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return activeRows;
    return activeRows.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.moduleName.toLowerCase().includes(q) ||
        r.trackName.toLowerCase().includes(q) ||
        r.displayLabel.toLowerCase().includes(q) ||
        String(r.id).includes(q)
    );
  }, [activeRows, query]);

  async function openEdit(row: ModuleAssessmentRow) {
    setEditingRow(row);
    setUploadFile(null);
    setShowCsvReplace(false);
    

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

    // Always load the assessment's questions into the editable list —
    // including assessments that started out as a bulk CSV/Excel upload.
    // CSV replace is still available below as an optional secondary action.
    setLoadingItems(true);
    try {
      const res = await fetch(
        `${API_BASE}admin/assessment-items?parentId=${row.id}&parentType=${PARENT_TYPE}`,
        { headers: authHeaders(false) }
      );
      if (!res.ok) throw new Error("Failed to load questions");
      const data = await res.json();
      const fetchedItems: AssessmentItem[] = Array.isArray(data) ? data : data.data || [];

      const normalized: AssessmentItem[] = fetchedItems.map((it: any, idx: number) => ({
          id: it.id,
          questionText: it.questionText || "",
          questionType: it.questionType || "multiple_choice",
          options: normalizeOptions(it.options),
          correctAnswer: normalizeCorrectAnswer(it),
          explanation: it.explanation || "",
          orderIndex: it.orderIndex ?? idx,
          points: it.points ?? 1,
      }));
      setItems(normalized.length ? normalized : [emptyItem()]);
    } catch (e: any) {
      alert(e.message || "Failed to load existing questions");
    } finally {
      setLoadingItems(false);
    }
  }

  function closeEdit() {
    setEditingRow(null);
    setItems([emptyItem()]);
    setUploadFile(null);
    setShowCsvReplace(false);
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

      // A CSV/Excel file (if chosen via the optional "replace" section)
      // takes priority and replaces all questions; otherwise we save
      // whatever is in the editable list.
      if (uploadFile) {
        await uploadQuestionsFile(editingRow.id, uploadFile);
      } else {
        await saveQuestions(editingRow.id, items);
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
    const { correctAnswer, explanation } = buildCorrectAnswerFields(item);
    return {
      parentId,
      parentType: PARENT_TYPE,
      questionText: item.questionText,
      questionType: item.questionType,
      // The API expects a plain array of option text strings, not
      // {id, text} objects — it regenerates its own option ids/UUIDs from
      // this array and uses `correctAnswer` (0-based index) to know which
      // one is correct. Sending objects here produces
      // "options.N: Invalid input: expected string, received object".
      options:
        item.questionType === "multiple_choice"
          ? item.options.filter((o) => o.text.trim()).map((o) => o.text.trim())
          : [],
      correctAnswer,
      explanation,
      orderIndex: item.orderIndex ?? orderIndex,
      points: item.points,
    };
  }

  async function saveQuestions(parentId: number, questionItems: AssessmentItem[]) {
    for (let i = 0; i < questionItems.length; i++) {
      const validationError = validateItem(questionItems[i], `Question ${i + 1}`);
      if (validationError) throw new Error(validationError);
    }

    const existing = questionItems.filter((i) => i.id);
    const fresh = questionItems.filter((i) => !i.id);

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
        questions: fresh.map((item, idx) => {
          const { correctAnswer, explanation } = buildCorrectAnswerFields(item);
          return {
            questionText: item.questionText,
            questionType: item.questionType,
            options:
              item.questionType === "multiple_choice"
                ? item.options.filter((o) => o.text.trim()).map((o) => o.text.trim())
                : [],
            correctAnswer,
            explanation,
            orderIndex: item.orderIndex ?? idx,
            points: item.points,
          };
        }),
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
  // This is the shared mechanism behind Archive (-> false) and Restore (-> true).
  async function setRowActive(row: ModuleAssessmentRow, isActive: boolean) {
    try {
      const res = await fetch(`${API_BASE}admin/modules/${row.moduleId}/assessment`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({ isActive }),
      });
      if (!res.ok) {
        throw new Error(
          isActive ? "Failed to restore assessment" : "Failed to move assessment to archive"
        );
      }
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, isActive } : r)));
    } catch (e: any) {
      alert(e.message || "Something went wrong");
    }
  }

  async function handleArchive(row: ModuleAssessmentRow) {
    if (!confirm(`Move assessment "${row.title}" for ${row.moduleName} to the archive?`)) return;
    await setRowActive(row, false);
  }

  async function handleRestore(row: ModuleAssessmentRow) {
    await setRowActive(row, true);
  }

  // Permanently removes an archived assessment. This is a hard delete (not
  // the same as archiving) — it's only exposed from the Archive view so it
  // never happens by accident from the main table.
  // NOTE: assumes a DELETE endpoint exists at admin/modules/{moduleId}/assessment.
  // Confirm this against your backend before relying on it — the API docs
  // screenshot we had only showed DELETE documented for individual
  // assessment-items (admin/assessment-items/{id}), not for the assessment
  // container itself.
  async function handleDeletePermanently(row: ModuleAssessmentRow) {
    if (
      !confirm(
        `Permanently delete assessment "${row.title}" for ${row.moduleName}? This cannot be undone.`
      )
    )
      return;
    try {
      const res = await fetch(`${API_BASE}admin/modules/${row.moduleId}/assessment`, {
        method: "DELETE",
        headers: authHeaders(false),
      });
      if (!res.ok) throw new Error("Failed to delete assessment");
      setRows((prev) => prev.filter((r) => r.id !== row.id));
    } catch (e: any) {
      alert(e.message || "Something went wrong");
    }
  }

  function updateItem(index: number, patch: Partial<AssessmentItem>) {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...patch } : item))
    );
  }

  function updateItemOption(itemIndex: number, optionIndex: number, text: string) {
    setItems((prev) =>
      prev.map((item, i) =>
        i === itemIndex
          ? {
              ...item,
              options: item.options.map((o, oi) =>
                oi === optionIndex
                  ? { ...o, text }
                  : o
              ),
            }
          : item
      )
    );
  }

  function addItem() {
    setItems((prev) => [...prev, emptyItem()]);
  }

  async function removeItem(index: number) {
    const item = items[index];
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
    setItems((prev) => prev.filter((_, i) => i !== index));
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
          onClick={() => setArchiveOpen(true)}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
          title="View archive"
        >
          <Archive className="w-4 h-4" />
          Archive
          {archivedRows.length > 0 && (
            <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[11px] rounded-full bg-gray-200 text-gray-700">
              {archivedRows.length}
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
              <th className="px-4 py-3 font-medium">Track</th>
              <th className="px-4 py-3 font-medium">Question Type</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  Loading module assessments...
                </td>
              </tr>
            )}
            {!loading && error && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-red-500">
                  {error}
                </td>
              </tr>
            )}
            {!loading && !error && filteredRows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
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
                  <td className="px-4 py-3 text-gray-700">{row.trackName}</td>
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
                      onClick={() => handleArchive(row)}
                      className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-red-500 hover:bg-red-50"
                      title="Move to archive"
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

            {!loadingItems && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                    Questions ({items.length})
                  </p>
                  <button
                    onClick={addItem}
                    className="inline-flex items-center gap-1 text-xs text-[#004900] hover:underline"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add question
                  </button>
                </div>
                {items.map((item, idx) => (
                  <div key={item.id ?? `new-${idx}`} className="border border-gray-200 rounded-lg p-3 relative">
                    {items.length > 1 && (
                      <button
                        onClick={() => removeItem(idx)}
                        className="absolute top-2 right-2 text-gray-400 hover:text-red-500"
                        title="remove question"
                      >
                        <Trash className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <p className="text-xs text-gray-400 mb-2">Question {idx + 1}</p>
                    <SingleQuestionEditor
                      item={item}
                      groupName={`module-q-${item.id ?? idx}`}
                      onChange={(patch) => updateItem(idx, patch)}
                      onOptionChange={(optionIndex, text) =>
                        updateItemOption(idx, optionIndex, text)
                      }
                    />
                  </div>
                ))}

                {/* CSV/Excel replace is now optional and collapsed by default —
                    it's a secondary path, not a requirement, for assessments
                    that originated from a bulk file upload. */}
                <div className="pt-2 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setShowCsvReplace((v) => !v)}
                    className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 hover:underline"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    {showCsvReplace
                      ? "Cancel CSV / Excel replace"
                      : "Replace all questions via CSV / Excel upload instead"}
                  </button>
                  {showCsvReplace && (
                    <div className="mt-3">
                      <label className="flex items-center gap-2 px-3 py-2 border border-dashed border-gray-300 rounded-lg text-sm text-gray-500 cursor-pointer hover:border-[#004900]">
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
                        Required columns: question_text, question_type, correct_answer.
                        Optional: option_a–d, explanation, points. Max 5MB. Uploading a file
                        here replaces every question above on save.
                      </p>
                      {uploadFile && (
                        <button
                          type="button"
                          onClick={() => setUploadFile(null)}
                          className="text-xs text-red-500 hover:underline mt-1"
                        >
                          Clear selected file
                        </button>
                      )}
                    </div>
                  )}
                </div>
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

      {archiveOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-4xl p-6 relative max-h-[85vh] overflow-y-auto">
            <button
              onClick={() => setArchiveOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
              title="close"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-semibold mb-1">Assessment Archive</h3>
            <p className="text-sm text-gray-500 mb-4">
              Archived module assessments. Restore one to make it active again, or delete it
              permanently.
            </p>

            {archivedRows.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-10">Archive is empty.</p>
            ) : (
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-left text-gray-500">
                      <th className="px-4 py-3 font-medium">ID</th>
                      <th className="px-4 py-3 font-medium">Title</th>
                      <th className="px-4 py-3 font-medium">Module Name</th>
                      <th className="px-4 py-3 font-medium">Track</th>
                      <th className="px-4 py-3 font-medium">Question Type</th>
                      <th className="px-4 py-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {archivedRows.map((row) => (
                      <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-700">{row.id}</td>
                        <td className="px-4 py-3 font-medium text-gray-900">{row.title}</td>
                        <td className="px-4 py-3 text-gray-700">{row.moduleName}</td>
                        <td className="px-4 py-3 text-gray-700">{row.trackName}</td>
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
                            onClick={() => handleDeletePermanently(row)}
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
  groupName,
  onChange,
  onOptionChange,
}: {
  item: AssessmentItem;
  groupName: string;
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

      {/* Correct answer is marked inline. isCorrect is derived by comparing
          the OPTION'S INDEX (not its id) against item.correctAnswer, since
          item.correctAnswer is always kept as a stringified index ("0".."3")
          on the client — regardless of whether the option's own `id` is a
          locally-generated placeholder ("1".."4") or a backend UUID. Comparing
          against `opt.id` directly was the bug: it never matched either shape. */}
      {item.questionType === "multiple_choice" && (
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">
            Options — mark the correct one
          </label>
          <div className="grid grid-cols-2 gap-2">
            {item.options.map((opt, idx) => {
              const isCorrect = String(idx) === item.correctAnswer;

              return (
                <div key={idx} className="flex items-end gap-2">
                  <div className="flex-1">
                    <label className="text-xs text-gray-500">Option {String.fromCharCode(65 + idx)}</label>
                    <input
                      value={opt.text}
                      onChange={(e) => onOptionChange(idx, e.target.value)}
                      className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                      title={`option ${idx}`}
                    />
                  </div>
                  <label
                    className={`flex items-center gap-1 pb-2 cursor-pointer select-none text-xs ${
                      isCorrect ? "text-[#004900] font-medium" : "text-gray-400"
                    }`}
                    title="Mark as correct answer"
                  >
                    <input
                      type="radio"
                      name={groupName}
                      checked={isCorrect}
                      onChange={() => onChange({ correctAnswer: String(idx) })}
                      className="w-4 h-4 accent-[#004900]"
                    />
                    Correct
                  </label>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {item.questionType === "true_false" && (
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">
            Correct Answer
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onChange({ correctAnswer: "true" })}
              className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-colors ${
                item.correctAnswer === "true"
                  ? "bg-[#004900] text-white border-[#004900]"
                  : "border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              True
            </button>
            <button
              type="button"
              onClick={() => onChange({ correctAnswer: "false" })}
              className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-colors ${
                item.correctAnswer === "false"
                  ? "bg-[#004900] text-white border-[#004900]"
                  : "border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              False
            </button>
          </div>
        </div>
      )}

      {item.questionType === "short_answer" && (
        <div>
          <label className="text-xs font-medium text-gray-600">Correct Answer</label>
          <input
            value={item.correctAnswer}
            onChange={(e) => onChange({ correctAnswer: e.target.value })}
            className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
            title="correct answer"
          />
          <p className="text-[11px] text-gray-400 mt-1">
            Short-answer questions aren't auto-graded on the backend, so this text is saved
            inside the explanation field as "Expected answer: …" instead of as a literal
            correct-answer value.
          </p>
        </div>
      )}

      <div>
        <label className="text-xs font-medium text-gray-600">Points</label>
        <input
          type="number"
          value={item.points}
          onChange={(e) => onChange({ points: Number(e.target.value) })}
          className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm max-w-[140px]"
          title="points"
        />
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