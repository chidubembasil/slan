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
  ClipboardList,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_BASE_URL;

type QuestionType = "single" | "multiple" | "upload";

interface Track {
  id: number;
  name: string;
}

interface ModuleAssessmentRow {
  id: number;
  title: string;
  moduleId: number;
  moduleName: string;
  trackId: number | null;
  trackName: string;
  questionType: QuestionType;
  displayLabel: string;
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

interface ArchivedQuestionRow {
  id: number;
  questionText: string;
  questionType: string;
  assessmentId: number;
  assessmentTitle: string;
  moduleName: string;
  trackName: string;
  archivedAt?: string | null;
}

interface AttemptRow {
  id: number;
  user?: {
    id?: number;
    fullName?: string;
    email?: string;
  };
  status?: string;
  score?: number;
  percentage?: number;
  passed?: boolean;
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

function normalizeCorrectAnswer(it: any): string {
  if (it?.correctAnswer == null) return "";

  if (it.questionType === "true_false") {
    if (typeof it.correctAnswer === "boolean") {
      return it.correctAnswer ? "true" : "false";
    }

    const raw = String(it.correctAnswer).trim().toLowerCase();

    if (["true", "1", "yes"].includes(raw)) return "true";
    if (["false", "0", "no"].includes(raw)) return "false";

    return raw;
  }

  if (it.questionType === "multiple_choice") {
    const options = normalizeOptions(it.options);

    if (typeof it.correctAnswer === "number") {
      return String(it.correctAnswer);
    }

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

    if (/^\d+$/.test(raw)) {
      return raw;
    }

    if (/^[A-Da-d]$/.test(raw)) {
      return String(raw.toUpperCase().charCodeAt(0) - 65);
    }

    const idIndex = options.findIndex((o) => o.id === raw);
    if (idIndex >= 0) {
      return String(idIndex);
    }

    const index = options.findIndex(
      o => o.text.trim().toLowerCase() === raw.toLowerCase()
    );

    if (index >= 0) {
      return String(index);
    }

    return "";
  }

  return String(it.correctAnswer);
}
function buildCorrectAnswerFields(
  item: AssessmentItem
): { correctAnswer: number | string | null; explanation: string } {
  if (item.questionType === "multiple_choice") {
    return { correctAnswer: Number(item.correctAnswer), explanation: item.explanation?.trim() || "" };
  }
  if (item.questionType === "short_answer") {
    return { 
        correctAnswer: item.correctAnswer, 
        explanation: item.explanation?.trim() || "" 
    };
  }
  return { correctAnswer: item.correctAnswer, explanation: item.explanation?.trim() || "" };
}

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
  }
  return null;
}

export default function ModuleAssessments() {
  const [rows, setRows] = useState<ModuleAssessmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [archiveOpen, setArchiveOpen] = useState(false);

  const [tracks, setTracks] = useState<Track[]>([]);
  const [selectedTrackId, setSelectedTrackId] = useState<string>("");

  const [editingRow, setEditingRow] = useState<ModuleAssessmentRow | null>(null);
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    passMarkPercent: 70,
    maxAttempts: 2,
    timeLimitMinutes: 0,
    isActive: true,
  });

  const [items, setItems] = useState<AssessmentItem[]>([emptyItem()]);

  const [showCsvReplace, setShowCsvReplace] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const [loadingItems, setLoadingItems] = useState(false);
  const [saving, setSaving] = useState(false);

  const [archivedQuestions, setArchivedQuestions] = useState<ArchivedQuestionRow[]>([]);
  const [archivedQuestionsLoading, setArchivedQuestionsLoading] = useState(false);
  const [archivedQuestionsError, setArchivedQuestionsError] = useState<string | null>(null);

  const [attemptsOpen, setAttemptsOpen] = useState(false);
  const [attemptsRow, setAttemptsRow] = useState<ModuleAssessmentRow | null>(null);
  const [attemptsList, setAttemptsList] = useState<AttemptRow[]>([]);
  const [attemptsLoading, setAttemptsLoading] = useState(false);
  const [attemptsError, setAttemptsError] = useState<string | null>(null);
  const [expandedAttemptId, setExpandedAttemptId] = useState<number | null>(null);
  const [attemptDetails, setAttemptDetails] = useState<Record<number, any>>({});
  const [attemptDetailLoadingId, setAttemptDetailLoadingId] = useState<number | null>(null);
  const [attemptDetailError, setAttemptDetailError] = useState<string | null>(null);

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

      setTracks(
        trackList.map((t: any) => ({
          id: t.id,
          name: t.title || t.name || `Track #${t.id}`,
        }))
      );

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
            return mods.map((m: any) => ({ ...m, __trackName: trackName, __trackId: track.id }));
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
            }

            const questionType: QuestionType =
              questionCount === 1 ? "single" : questionCount > 1 ? "multiple" : "upload";

            results.push({
              id: assessment.id,
              title: assessment.title || "Untitled Assessment",
              moduleId: mod.id,
              moduleName: mod.title || mod.name || `Module #${mod.id}`,
              trackId: mod.__trackId ?? null,
              trackName: mod.__trackName || "—",
              questionType,
              displayLabel: getDisplayLabel(itemsForRow),
              questionCount,
              isActive: assessment.isActive !== false,
            });
          } catch {
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

  async function fetchArchivedQuestions() {
    setArchivedQuestionsLoading(true);
    setArchivedQuestionsError(null);
    try {
      const res = await fetch(`${API_BASE}admin/assessments`, {
        headers: authHeaders(false),
      });
      if (!res.ok) throw new Error("Failed to load archived questions");
      const data = await res.json();
      const modules = data?.data?.modules || data?.modules || [];

      const result: ArchivedQuestionRow[] = [];
      modules.forEach((mod: any) => {
        const modItems = Array.isArray(mod.items) ? mod.items : [];
        const matchingRow = rows.find((r) => r.id === mod.id);
        modItems.forEach((it: any) => {
          if (!it?.isArchived) return;
          result.push({
            id: it.id,
            questionText: it.questionText || "",
            questionType: it.questionType || "",
            assessmentId: mod.id,
            assessmentTitle: matchingRow?.title || mod.title || "Untitled Assessment",
            moduleName: matchingRow?.moduleName || `Module #${mod.moduleId}`,
            trackName: matchingRow?.trackName || "—",
            archivedAt: it.archivedAt ?? null,
          });
        });
      });

      setArchivedQuestions(result);
    } catch (e: any) {
      setArchivedQuestionsError(e.message || "Failed to load archived questions");
    } finally {
      setArchivedQuestionsLoading(false);
    }
  }

  useEffect(() => {
    fetchModuleAssessments();
  }, []);

  const activeRows = useMemo(() => rows.filter((r) => r.isActive), [rows]);
  const archivedRows = useMemo(() => rows.filter((r) => !r.isActive), [rows]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return activeRows.filter((r) => {
      const matchesTrack =
        !selectedTrackId || String(r.trackId ?? "") === selectedTrackId;
      if (!matchesTrack) return false;
      if (!q) return true;
      return (
        r.title.toLowerCase().includes(q) ||
        r.moduleName.toLowerCase().includes(q) ||
        r.trackName.toLowerCase().includes(q) ||
        r.displayLabel.toLowerCase().includes(q) ||
        String(r.id).includes(q)
      );
    });
  }, [activeRows, query, selectedTrackId]);

  function openArchive() {
    setArchiveOpen(true);
    fetchArchivedQuestions();
  }

  async function openAttempts(row: ModuleAssessmentRow) {
    setAttemptsRow(row);
    setAttemptsOpen(true);
    setAttemptsList([]);
    setAttemptsError(null);
    setExpandedAttemptId(null);
    setAttemptDetails({});
    setAttemptDetailError(null);
    setAttemptsLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}admin/attempts?assessmentType=${PARENT_TYPE}&assessmentId=${row.id}`,
        { headers: authHeaders(false) }
      );
      if (!res.ok) throw new Error("Failed to load attempts");
      const data = await res.json();
      const list = Array.isArray(data) ? data : data.data || [];
      setAttemptsList(list);
    } catch (e: any) {
      setAttemptsError(e.message || "Failed to load attempts");
    } finally {
      setAttemptsLoading(false);
    }
  }

  function closeAttempts() {
    setAttemptsOpen(false);
    setAttemptsRow(null);
    setAttemptsList([]);
    setAttemptsError(null);
    setExpandedAttemptId(null);
    setAttemptDetails({});
    setAttemptDetailError(null);
  }

  async function toggleAttemptDetail(attemptId: number) {
    if (expandedAttemptId === attemptId) {
      setExpandedAttemptId(null);
      return;
    }
    setExpandedAttemptId(attemptId);
    if (attemptDetails[attemptId]) return;

    setAttemptDetailLoadingId(attemptId);
    setAttemptDetailError(null);
    try {
      const res = await fetch(`${API_BASE}admin/attempts/${attemptId}/result`, {
        headers: authHeaders(false),
      });
      if (!res.ok) throw new Error("Failed to load attempt result");
      const data = await res.json();
      const detail = data?.data || data;
      setAttemptDetails((prev) => ({ ...prev, [attemptId]: detail }));
    } catch (e: any) {
      setAttemptDetailError(e.message || "Failed to load attempt result");
    } finally {
      setAttemptDetailLoadingId(null);
    }
  }

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

  async function handleArchive(row: ModuleAssessmentRow) {
    if (!confirm(`Move assessment "${row.title}" for ${row.moduleName} to the archive?`)) return;
    try {
      const res = await fetch(`${API_BASE}admin/modules/${row.moduleId}/assessment`, {
        method: "DELETE",
        headers: authHeaders(false),
      });
      if (!res.ok) throw new Error("Failed to move assessment to archive");
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, isActive: false } : r)));
    } catch (e: any) {
      alert(e.message || "Something went wrong");
    }
  }

  async function handleRestore(row: ModuleAssessmentRow) {
    try {
      const res = await fetch(`${API_BASE}admin/modules/${row.moduleId}/assessment/restore`, {
        method: "POST",
        headers: authHeaders(false),
      });
      if (!res.ok) throw new Error("Failed to restore assessment");
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, isActive: true } : r)));
    } catch (e: any) {
      alert(e.message || "Something went wrong");
    }
  }

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

  async function handleRestoreQuestion(item: ArchivedQuestionRow) {
    try {
      const res = await fetch(`${API_BASE}admin/assessment-items/${item.id}/restore`, {
        method: "POST",
        headers: authHeaders(false),
      });
      if (!res.ok) throw new Error("Failed to restore question");
      setArchivedQuestions((prev) => prev.filter((q) => q.id !== item.id));
      fetchModuleAssessments();
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 -m-4 sm:-m-6 lg:-m-8 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:gap-4 mb-4 sm:mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 tracking-tight">Module Assessments</h1>
              <p className="text-xs sm:text-sm text-gray-500 mt-1">Manage assessments grouped by module and track</p>
            </div>
            <span className="hidden sm:inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-[#004900]/10 text-[#004900] border border-[#004900]/10 self-start sm:self-auto">
              {filteredRows.length} assessment{filteredRows.length !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Toolbar - stack on mobile, row on desktop */}
          <div className="flex flex-col lg:flex-row gap-3">
            <div className="relative flex-1 w-full lg:max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by title, module or question type..."
                className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl sm:rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#004900]/20 focus:border-[#004900] transition-all bg-white shadow-sm"
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <select
                value={selectedTrackId}
                onChange={(e) => setSelectedTrackId(e.target.value)}
                className="w-full sm:w-auto sm:min-w-[160px] px-4 py-2.5 text-sm border border-gray-200 rounded-xl bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#004900]/20 focus:border-[#004900] transition-all shadow-sm"
                title="Filter by track"
              >
                <option value="">All Tracks</option>
                {tracks.map((t) => (
                  <option key={t.id} value={String(t.id)}>
                    {t.name}
                  </option>
                ))}
              </select>
              <button
                onClick={openArchive}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium border border-gray-200 rounded-xl bg-white text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm"
                title="View archive"
              >
                <Archive className="w-4 h-4" />
                Archive
                {(archivedRows.length > 0 || archivedQuestions.length > 0) && (
                  <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 text-[11px] font-semibold rounded-full bg-[#004900]/10 text-[#004900]">
                    {archivedRows.length + archivedQuestions.length}
                  </span>
                )}
              </button>
            </div>
          </div>
          <div className="sm:hidden text-xs text-gray-400">{filteredRows.length} assessment{filteredRows.length !== 1 ? "s" : ""} • {tracks.length} tracks</div>
        </div>

        {/* Content card */}
        <div className="bg-white border border-gray-200/80 rounded-2xl shadow-sm overflow-hidden">
          {/* Desktop table */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-200/80 text-left text-gray-500">
                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider">ID</th>
                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider">Title</th>
                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider">Module Name</th>
                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider">Track</th>
                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider">Question Type</th>
                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading && (
                  <tr>
                    <td colSpan={6} className="px-5 py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center animate-pulse">
                          <Search className="w-4 h-4 text-gray-400" />
                        </div>
                        <p className="text-sm text-gray-400">Loading module assessments...</p>
                      </div>
                    </td>
                  </tr>
                )}
                {!loading && error && (
                  <tr>
                    <td colSpan={6} className="px-5 py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
                          <X className="w-4 h-4 text-red-400" />
                        </div>
                        <p className="text-sm text-red-500">{error}</p>
                      </div>
                    </td>
                  </tr>
                )}
                {!loading && !error && filteredRows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                          <ClipboardList className="w-5 h-5 text-gray-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-500">No module assessments found</p>
                          <p className="text-xs text-gray-400 mt-1">Try adjusting your search or filters.</p>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
                {!loading &&
                  !error &&
                  filteredRows.map((row) => (
                    <tr key={row.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="px-5 py-3.5 text-gray-500 font-mono text-xs">{row.id}</td>
                      <td className="px-5 py-3.5 font-medium text-gray-900 max-w-[220px] truncate" title={row.title}>{row.title}</td>
                      <td className="px-5 py-3.5 text-gray-600 max-w-[180px] truncate" title={row.moduleName}>{row.moduleName}</td>
                      <td className="px-5 py-3.5 text-gray-600">
                        <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">{row.trackName}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${
                            row.displayLabel === "No question yet"
                              ? "bg-gray-100 text-gray-500"
                              : "bg-purple-50 text-purple-700 border border-purple-200/60"
                          }`}
                        >
                          {row.displayLabel}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => openEdit(row)}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                            title="Edit"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openAttempts(row)}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                            title="View attempts"
                          >
                            <ClipboardList className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleArchive(row)}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                            title="Move to archive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {/* Tablet horizontal scroll */}
          <div className="hidden md:block lg:hidden overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-200/80 text-left text-gray-500">
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider">Title</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider">Module</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider">Type</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {!loading && !error && filteredRows.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50/60">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900 truncate max-w-[160px]">{row.title}</div>
                      <div className="text-xs text-gray-400">{row.trackName}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-sm truncate max-w-[140px]">{row.moduleName}</td>
                    <td className="px-4 py-3"><span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${row.displayLabel === "No question yet" ? "bg-gray-100 text-gray-500" : "bg-purple-50 text-purple-700 border border-purple-200/60"}`}>{row.displayLabel}</span></td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button onClick={() => openEdit(row)} className="w-8 h-8 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 inline-flex items-center justify-center"><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => openAttempts(row)} className="w-8 h-8 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 inline-flex items-center justify-center"><ClipboardList className="w-4 h-4" /></button>
                        <button onClick={() => handleArchive(row)} className="w-8 h-8 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 inline-flex items-center justify-center"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {loading && <tr><td colSpan={4} className="px-4 py-12 text-center text-sm text-gray-400">Loading...</td></tr>}
                {!loading && !error && filteredRows.length===0 && <tr><td colSpan={4} className="px-4 py-12 text-center"><p className="text-sm text-gray-500">No module assessments found</p></td></tr>}
                {!loading && error && <tr><td colSpan={4} className="px-4 py-12 text-center text-sm text-red-500">{error}</td></tr>}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden divide-y divide-gray-100">
            {loading && (
              <div className="flex flex-col items-center gap-3 py-12 px-4">
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center animate-pulse"><Search className="w-4 h-4 text-gray-400" /></div>
                <p className="text-sm text-gray-400">Loading module assessments...</p>
              </div>
            )}
            {!loading && error && (
              <div className="flex flex-col items-center gap-3 py-12 px-4">
                <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center"><X className="w-4 h-4 text-red-400" /></div>
                <p className="text-sm text-red-500 text-center">{error}</p>
              </div>
            )}
            {!loading && !error && filteredRows.length === 0 && (
              <div className="flex flex-col items-center gap-3 py-12 px-4 text-center">
                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center"><ClipboardList className="w-5 h-5 text-gray-400" /></div>
                <p className="text-sm font-medium text-gray-500">No module assessments found</p>
                <p className="text-xs text-gray-400">Try adjusting your search or filters.</p>
              </div>
            )}
            {!loading && !error && filteredRows.map((row) => (
              <div key={row.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-gray-900 truncate">{row.title}</h3>
                    <p className="text-xs text-gray-500 truncate mt-0.5">{row.moduleName} • <span className="text-blue-600">{row.trackName}</span></p>
                  </div>
                  <span className="text-xs font-mono text-gray-400 shrink-0">#{row.id}</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${row.displayLabel === "No question yet" ? "bg-gray-100 text-gray-500" : "bg-purple-50 text-purple-700 border border-purple-200/60"}`}>{row.displayLabel}</span>
                  <span className="text-xs text-gray-400">{row.questionCount} question{row.questionCount!==1?"s":""}</span>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <button onClick={() => openEdit(row)} className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-gray-900 text-white hover:bg-black"><Pencil className="w-3.5 h-3.5" /> Edit</button>
                  <button onClick={() => openAttempts(row)} className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border border-gray-200 text-gray-700 hover:bg-gray-50"><ClipboardList className="w-3.5 h-3.5" /> Attempts</button>
                  <button onClick={() => handleArchive(row)} className="w-9 h-9 inline-flex items-center justify-center rounded-xl border border-red-100 text-red-500 hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {editingRow && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[92vh] sm:max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
            <div className="bg-gradient-to-r from-[#004900] to-[#006400] px-4 sm:px-6 py-4 flex items-start justify-between gap-4 shrink-0">
              <div className="min-w-0 flex-1">
                <h3 className="text-base sm:text-lg font-semibold text-white leading-tight truncate pr-2">Edit Module Assessment</h3>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <p className="text-xs sm:text-sm text-white/80 truncate">{editingRow.moduleName}</p>
                  <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-white/15 text-white border border-white/20">{editingRow.displayLabel}</span>
                </div>
              </div>
              <button
                onClick={closeEdit}
                className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-white/80 hover:text-white hover:bg-white/15 transition-colors shrink-0"
                title="cancel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-gray-700 mb-1.5 block">Title</label>
                  <input
                    value={editForm.title}
                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                    className="w-full px-3 sm:px-4 py-2 sm:py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#004900]/20 focus:border-[#004900] transition-all"
                    title="title"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 mb-1.5 block">Description</label>
                  <textarea
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    className="w-full px-3 sm:px-4 py-2 sm:py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#004900]/20 focus:border-[#004900] transition-all"
                    rows={2}
                    title="description"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-700 mb-1.5 block">Pass Mark %</label>
                    <input
                      type="number"
                      value={editForm.passMarkPercent}
                      onChange={(e) =>
                        setEditForm({ ...editForm, passMarkPercent: Number(e.target.value) })
                      }
                      className="w-full px-3 sm:px-4 py-2 sm:py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#004900]/20 focus:border-[#004900] transition-all"
                      title="pass mark"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-700 mb-1.5 block">Max Attempts</label>
                    <input
                      type="number"
                      value={editForm.maxAttempts}
                      onChange={(e) =>
                        setEditForm({ ...editForm, maxAttempts: Number(e.target.value) })
                      }
                      className="w-full px-3 sm:px-4 py-2 sm:py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#004900]/20 focus:border-[#004900] transition-all"
                      title="max attempts"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-700 mb-1.5 block">Time Limit (min)</label>
                    <input
                      type="number"
                      value={editForm.timeLimitMinutes}
                      onChange={(e) =>
                        setEditForm({ ...editForm, timeLimitMinutes: Number(e.target.value) })
                      }
                      className="w-full px-3 sm:px-4 py-2 sm:py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#004900]/20 focus:border-[#004900] transition-all"
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

              <hr className="border-gray-100" />

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
                      className="inline-flex items-center gap-1 text-xs font-medium text-[#004900] hover:underline"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add question
                    </button>
                  </div>
                  {items.map((item, idx) => (
                    <div key={item.id ?? `new-${idx}`} className="border border-gray-200 rounded-xl sm:rounded-2xl p-3 sm:p-4 relative hover:border-gray-300 transition-colors bg-gray-50/30">
                      {items.length > 1 && (
                        <button
                          onClick={() => removeItem(idx)}
                          className="absolute top-2 right-2 sm:top-3 sm:right-3 w-7 h-7 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-gray-400 hover:text-red-500 hover:border-red-200 transition-colors"
                          title="remove question"
                        >
                          <Trash className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <p className="text-xs font-medium text-gray-500 mb-2 sm:mb-3 pr-8">Question {idx + 1}</p>
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

                  <div className="pt-2 border-t border-gray-100">
                    <button
                      type="button"
                      onClick={() => setShowCsvReplace((v) => !v)}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 hover:underline"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      {showCsvReplace
                        ? "Cancel CSV / Excel replace"
                        : "Replace all questions via CSV / Excel upload instead"}
                    </button>
                    {showCsvReplace && (
                      <div className="mt-3">
                        <label className="flex items-center gap-2 px-3 py-2.5 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-500 cursor-pointer hover:border-[#004900]/30 hover:bg-[#004900]/5 transition-colors">
                          <Upload className="w-4 h-4 shrink-0" />
                          <span className="truncate">{uploadFile ? uploadFile.name : "Choose .csv or .xlsx file"}</span>
                          <input
                            type="file"
                            accept=".csv,.xlsx,.xls"
                            className="hidden"
                            onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                          />
                        </label>
                        <p className="text-xs text-gray-400 mt-2 leading-relaxed">
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
            </div>

            <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 p-4 sm:p-6 border-t border-gray-100 shrink-0 bg-white">
              <button
                onClick={closeEdit}
                className="w-full sm:w-auto px-4 py-2.5 text-sm rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={saving || loadingItems}
                className="w-full sm:w-auto px-5 py-2.5 text-sm rounded-xl bg-gradient-to-r from-[#004900] to-[#006400] text-white hover:from-[#003700] hover:to-[#004900] disabled:opacity-50 shadow-sm shadow-[#004900]/20 transition-all font-medium"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {archiveOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] sm:max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-gray-100 flex items-start justify-between gap-4 shrink-0">
              <div>
                <h3 className="text-base sm:text-lg font-semibold text-gray-900">Assessment Archive</h3>
                <p className="text-xs sm:text-sm text-gray-500 mt-1 leading-relaxed">
                  Archived module assessments and archived individual questions. Restore either to make it active again.
                </p>
              </div>
              <button
                onClick={() => setArchiveOpen(false)}
                className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition-colors shrink-0"
                title="close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
              <div>
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
                  Archived Questions
                </p>
                {archivedQuestionsLoading && (
                  <p className="text-sm text-gray-400 text-center py-6">
                    Loading archived questions...
                  </p>
                )}
                {!archivedQuestionsLoading && archivedQuestionsError && (
                  <p className="text-sm text-red-500 text-center py-6">{archivedQuestionsError}</p>
                )}
                {!archivedQuestionsLoading &&
                  !archivedQuestionsError &&
                  archivedQuestions.length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-6 border border-dashed border-gray-200 rounded-xl">
                      No archived questions.
                    </p>
                  )}
                {!archivedQuestionsLoading &&
                  !archivedQuestionsError &&
                  archivedQuestions.length > 0 && (
                    <>
                      {/* Desktop */}
                      <div className="hidden sm:block border border-gray-200 rounded-xl overflow-hidden overflow-x-auto">
                        <table className="w-full text-sm min-w-[520px]">
                          <thead>
                            <tr className="bg-gray-50 border-b border-gray-200 text-left text-gray-500">
                              <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide">Question</th>
                              <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide">Assessment</th>
                              <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide">Module</th>
                              <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide">Track</th>
                              <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {archivedQuestions.map((q) => (
                              <tr key={q.id} className="border-b border-gray-100 hover:bg-gray-50">
                                <td
                                  className="px-4 py-3 text-gray-700 max-w-[180px] truncate"
                                  title={q.questionText}
                                >
                                  {q.questionText || `Question #${q.id}`}
                                </td>
                                <td className="px-4 py-3 text-gray-700 truncate max-w-[120px]">{q.assessmentTitle}</td>
                                <td className="px-4 py-3 text-gray-700 truncate max-w-[120px]">{q.moduleName}</td>
                                <td className="px-4 py-3 text-gray-700">{q.trackName}</td>
                                <td className="px-4 py-3 text-right">
                                  <button
                                    onClick={() => handleRestoreQuestion(q)}
                                    className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-[#004900] hover:bg-green-50 border border-transparent hover:border-green-200"
                                    title="Restore question"
                                  >
                                    <RotateCcw className="w-4 h-4" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {/* Mobile */}
                      <div className="sm:hidden space-y-3">
                        {archivedQuestions.map((q) => (
                          <div key={q.id} className="border border-gray-200 rounded-xl p-3 space-y-2">
                            <p className="text-sm font-medium text-gray-900 line-clamp-2">{q.questionText || `Question #${q.id}`}</p>
                            <div className="flex flex-wrap gap-1.5 text-xs">
                              <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-600">{q.assessmentTitle}</span>
                              <span className="px-2 py-1 rounded-full bg-blue-50 text-blue-700">{q.moduleName}</span>
                              <span className="px-2 py-1 rounded-full bg-purple-50 text-purple-700">{q.trackName}</span>
                            </div>
                            <button onClick={() => handleRestoreQuestion(q)} className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-[#004900] text-white"><RotateCcw className="w-3.5 h-3.5" /> Restore Question</button>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
              </div>

              <hr className="border-gray-100" />

              <div>
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
                  Archived Assessments
                </p>
                {archivedRows.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-10 border border-dashed border-gray-200 rounded-xl">Archive is empty.</p>
                ) : (
                  <>
                    <div className="hidden sm:block border border-gray-200 rounded-xl overflow-hidden overflow-x-auto">
                      <table className="w-full text-sm min-w-[560px]">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-200 text-left text-gray-500">
                            <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide">ID</th>
                            <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide">Title</th>
                            <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide">Module Name</th>
                            <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide">Track</th>
                            <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide">Question Type</th>
                            <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {archivedRows.map((row) => (
                            <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50">
                              <td className="px-4 py-3 text-gray-700 font-mono text-xs">{row.id}</td>
                              <td className="px-4 py-3 font-medium text-gray-900 max-w-[140px] truncate">{row.title}</td>
                              <td className="px-4 py-3 text-gray-700 max-w-[120px] truncate">{row.moduleName}</td>
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
                    <div className="sm:hidden space-y-3">
                      {archivedRows.map((row) => (
                        <div key={row.id} className="border border-gray-200 rounded-xl p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-semibold text-gray-900 truncate pr-2">{row.title}</h4>
                            <span className="text-xs font-mono text-gray-400">#{row.id}</span>
                          </div>
                          <p className="text-xs text-gray-500">{row.moduleName} • {row.trackName}</p>
                          <span className="inline-flex px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-700">{row.displayLabel}</span>
                          <div className="flex gap-2 pt-1">
                            <button onClick={() => handleRestore(row)} className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-[#004900] text-white"><RotateCcw className="w-3.5 h-3.5" /> Restore</button>
                            <button onClick={() => handleDeletePermanently(row)} className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border border-red-200 text-red-600"><Trash2 className="w-3.5 h-3.5" /> Delete</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {attemptsOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[92vh] sm:max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="px-4 sm:px-6 py-4 border-b border-gray-100 flex items-start justify-between gap-4 shrink-0">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="w-8 h-8 rounded-xl bg-[#004900]/10 flex items-center justify-center shrink-0">
                    <ClipboardList className="w-4 h-4 text-[#004900]" />
                  </span>
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900">Attempts</h3>
                  {!attemptsLoading && !attemptsError && (
                    <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600">
                      {attemptsList.length} attempt{attemptsList.length === 1 ? "" : "s"}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-1.5 mt-2 text-xs text-gray-500">
                  <span className="font-medium text-gray-700 truncate">{attemptsRow?.title}</span>
                  <span className="text-gray-300 hidden sm:inline">•</span>
                  <span className="truncate">{attemptsRow?.moduleName}</span>
                  <span className="text-gray-300 hidden sm:inline">•</span>
                  <span className="truncate">{attemptsRow?.trackName}</span>
                </div>
                {!attemptsLoading && !attemptsError && (
                  <span className="sm:hidden inline-flex mt-2 px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600">
                    {attemptsList.length} attempt{attemptsList.length === 1 ? "" : "s"}
                  </span>
                )}
              </div>
              <button
                onClick={closeAttempts}
                className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition-colors shrink-0"
                title="close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              {attemptsLoading && (
                <p className="text-sm text-gray-400 text-center py-10">Loading attempts...</p>
              )}
              {!attemptsLoading && attemptsError && (
                <p className="text-sm text-red-500 text-center py-10">{attemptsError}</p>
              )}
              {!attemptsLoading && !attemptsError && attemptsList.length === 0 && (
                <div className="text-center py-10">
                  <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3"><ClipboardList className="w-5 h-5 text-gray-400" /></div>
                  <p className="text-sm text-gray-400">No learner attempts yet for this assessment.</p>
                </div>
              )}

              {!attemptsLoading && !attemptsError && attemptsList.length > 0 && (
                <div className="space-y-3">
                  {attemptsList.map((attempt) => {
                    const isExpanded = expandedAttemptId === attempt.id;
                    const fullName = attempt.user?.fullName || `User #${attempt.user?.id ?? "—"}`;
                    const initials =
                      fullName
                        .split(" ")
                        .map((p) => p[0])
                        .filter(Boolean)
                        .slice(0, 2)
                        .join("")
                        .toUpperCase() || "?";
                    const detail = attemptDetails[attempt.id];

                    return (
                      <div
                        key={attempt.id}
                        className="border border-gray-200 rounded-xl sm:rounded-2xl overflow-hidden"
                      >
                        <button
                          type="button"
                          onClick={() => toggleAttemptDetail(attempt.id)}
                          className="w-full flex items-center gap-3 p-3 sm:p-3.5 text-left hover:bg-gray-50 transition-colors"
                        >
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#004900] to-[#006400] text-white flex items-center justify-center text-xs font-semibold shrink-0">
                            {initials}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {fullName}
                            </p>
                            <p className="text-xs text-gray-400 truncate">
                              {attempt.user?.email || "—"}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {attempt.status && (
                              <span className="hidden sm:inline text-xs text-gray-500 capitalize">
                                {attempt.status}
                              </span>
                            )}
                            <span
                              className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                                attempt.passed
                                  ? "bg-green-50 text-green-700 border border-green-200"
                                  : "bg-red-50 text-red-600 border border-red-200"
                              }`}
                            >
                              {attempt.percentage != null ? `${attempt.percentage}%` : "—"}
                            </span>
                            <span
                              className={`w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 transition-transform text-xs ${
                                isExpanded ? "rotate-180" : ""
                              }`}
                            >
                              ▾
                            </span>
                          </div>
                        </button>

                        {isExpanded && (
                          <div className="border-t border-gray-100 bg-gray-50/60 p-3 sm:p-4">
                            {attemptDetailLoadingId === attempt.id && (
                              <p className="text-xs text-gray-400 text-center py-4">
                                Loading answers...
                              </p>
                            )}
                            {attemptDetailLoadingId !== attempt.id &&
                              attemptDetailError &&
                              !detail && (
                                <p className="text-xs text-red-500 text-center py-4">
                                  {attemptDetailError}
                                </p>
                              )}
                            {detail && (
                              <div className="space-y-2">
                                <div className="flex flex-wrap gap-2 text-xs text-gray-500 mb-3">
                                  <span className="px-2.5 py-1 rounded-full bg-white border border-gray-200">
                                    Score: <strong className="text-gray-700">{detail.score ?? "—"}</strong>
                                  </span>
                                  <span className="px-2.5 py-1 rounded-full bg-white border border-gray-200">
                                    Percentage: <strong className="text-gray-700">{detail.percentage ?? "—"}%</strong>
                                  </span>
                                  <span className={`px-2.5 py-1 rounded-full border ${detail.passed ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-600 border-red-200"}`}>
                                    <strong>{detail.passed ? "Passed" : "Failed"}</strong>
                                  </span>
                                </div>
                                {(detail.answers || []).map((ans: any, i: number) => (
                                  <div
                                    key={ans.id ?? ans.answerId ?? i}
                                    className="bg-white border border-gray-200 rounded-xl p-3"
                                  >
                                    <p className="text-xs sm:text-sm font-medium text-gray-700 mb-1.5 line-clamp-3">
                                      {i + 1}. {ans.questionText || ans.question || `Question ${i + 1}`}
                                    </p>
                                    <div className="flex flex-col sm:flex-row sm:flex-wrap gap-1 sm:gap-x-4 gap-y-0.5 text-xs text-gray-500">
                                      <span>
                                        Answer given: <span className="text-gray-700 font-medium">{ans.givenAnswer ?? ans.selectedAnswer ?? ans.answer ?? "—"}</span>
                                      </span>
                                      <span>
                                        Correct answer: <span className="text-gray-700 font-medium">{ans.correctAnswer ?? ans.correctAnswerText ?? "—"}</span>
                                      </span>
                                      {typeof ans.isCorrect === "boolean" && (
                                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium w-fit ${ans.isCorrect ? "bg-green-50 text-green-600" : "bg-red-50 text-red-500"}`}>
                                          {ans.isCorrect ? "Correct" : "Incorrect"}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                ))}
                                {(!detail.answers || detail.answers.length === 0) && (
                                  <p className="text-xs text-gray-400 text-center py-2">
                                    No answer details available.
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
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
          className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#004900]/20 focus:border-[#004900] bg-white"
          rows={2}
          title="question text"
        />
      </div>

      <div>
        <label className="text-xs font-medium text-gray-600">Question Type</label>
        <select
          value={item.questionType}
          onChange={(e) => onChange({ questionType: e.target.value as AssessmentItem["questionType"] })}
          className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#004900]/20 focus:border-[#004900]"
          title="question type select"
        >
          <option value="multiple_choice">Multiple Choice</option>
          <option value="true_false">True / False</option>
          <option value="short_answer">Short Answer</option>
        </select>
      </div>

      {item.questionType === "multiple_choice" && (
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">
            Options — mark the correct one
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
            {item.options.map((opt, idx) => {
              const isCorrect = String(idx) === item.correctAnswer;

              return (
                <div key={idx} className="flex items-end gap-2">
                  <div className="flex-1 min-w-0">
                    <label className="text-xs text-gray-500">Option {String.fromCharCode(65 + idx)}</label>
                    <input
                      value={opt.text}
                      onChange={(e) => onOptionChange(idx, e.target.value)}
                      className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#004900]/20 focus:border-[#004900] bg-white"
                      title={`option ${idx}`}
                    />
                  </div>
                  <label
                    className={`flex items-center gap-1 pb-2 cursor-pointer select-none text-xs shrink-0 ${
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
              className={`flex-1 px-3 py-2.5 text-sm rounded-xl border transition-colors font-medium ${
                item.correctAnswer === "true"
                  ? "bg-[#004900] text-white border-[#004900] shadow-sm"
                  : "border-gray-200 text-gray-600 hover:bg-gray-50 bg-white"
              }`}
            >
              True
            </button>
            <button
              type="button"
              onClick={() => onChange({ correctAnswer: "false" })}
              className={`flex-1 px-3 py-2.5 text-sm rounded-xl border transition-colors font-medium ${
                item.correctAnswer === "false"
                  ? "bg-[#004900] text-white border-[#004900] shadow-sm"
                  : "border-gray-200 text-gray-600 hover:bg-gray-50 bg-white"
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
            className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#004900]/20 focus:border-[#004900]"
            title="correct answer"
          />
          <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">
            Short-answer questions aren't auto-graded on the backend, so this text is saved
            inside the explanation field as "Expected answer: …" instead of as a literal
            correct-answer value.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-gray-600">Points</label>
          <input
            type="number"
            value={item.points}
            onChange={(e) => onChange({ points: Number(e.target.value) })}
            className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-xl text-sm max-w-full sm:max-w-36 bg-white focus:outline-none focus:ring-2 focus:ring-[#004900]/20 focus:border-[#004900]"
            title="points"
          />
        </div>
        <div className="hidden sm:block" />
      </div>

      <div>
        <label className="text-xs font-medium text-gray-600">Explanation (optional)</label>
        <textarea
          value={item.explanation}
          onChange={(e) => onChange({ explanation: e.target.value })}
          className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#004900]/20 focus:border-[#004900]"
          rows={2}
          title="explanation"
        />
      </div>
    </div>
  );
}
