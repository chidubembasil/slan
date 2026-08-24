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

interface CourseAssessmentRow {
  id: number;
  title: string;
  courseId: number;
  courseName: string;
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

const PARENT_TYPE = "course_assessment";

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

export default function CourseAssessments() {
  const [rows, setRows] = useState<CourseAssessmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [archiveOpen, setArchiveOpen] = useState(false);

  const [editingRow, setEditingRow] = useState<CourseAssessmentRow | null>(null);
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

  const token = localStorage.getItem("adminAccessToken") || "";

  function authHeaders(json = true) {
    const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
    if (json) headers["Content-Type"] = "application/json";
    return headers;
  }

  async function fetchCourseAssessments() {
    setLoading(true);
    setError(null);
    try {
      const coursesRes = await fetch(`${API_BASE}admin/courses`, {
        headers: authHeaders(false),
      });
      if (!coursesRes.ok) throw new Error("Failed to load courses");
      const courses = await coursesRes.json();
      const courseList = Array.isArray(courses) ? courses : courses.data || [];

      const results: CourseAssessmentRow[] = [];
      await Promise.all(
        courseList.map(async (course: any) => {
          try {
            const res = await fetch(`${API_BASE}admin/courses/${course.id}/assessment`, {
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
              courseId: course.id,
              courseName: course.title || course.name || `Course #${course.id}`,
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

  useEffect(() => {
    fetchCourseAssessments();
  }, []);

  const activeRows = useMemo(() => rows.filter((r) => r.isActive), [rows]);
  const archivedRows = useMemo(() => rows.filter((r) => !r.isActive), [rows]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return activeRows;
    return activeRows.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.courseName.toLowerCase().includes(q) ||
        r.displayLabel.toLowerCase().includes(q) ||
        String(r.id).includes(q)
    );
  }, [activeRows, query]);

  async function openEdit(row: CourseAssessmentRow) {
    setEditingRow(row);
    setUploadFile(null);
    setShowCsvReplace(false);

    try {
      const configRes = await fetch(`${API_BASE}admin/courses/${row.courseId}/assessment`, {
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

  async function saveAssessmentConfig(courseId: number) {
    const res = await fetch(`${API_BASE}admin/courses/${courseId}/assessment`, {
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
      await saveAssessmentConfig(editingRow.courseId);

      if (uploadFile) {
        await uploadQuestionsFile(editingRow.id, uploadFile);
      } else {
        await saveQuestions(editingRow.id, items);
      }

      closeEdit();
      fetchCourseAssessments();
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

  async function setRowActive(row: CourseAssessmentRow, isActive: boolean) {
    try {
      const res = await fetch(`${API_BASE}admin/courses/${row.courseId}/assessment`, {
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

  async function handleArchive(row: CourseAssessmentRow) {
    if (!confirm(`Move assessment "${row.title}" for ${row.courseName} to the archive?`)) return;
    await setRowActive(row, false);
  }

  async function handleRestore(row: CourseAssessmentRow) {
    await setRowActive(row, true);
  }

  async function handleDeletePermanently(row: CourseAssessmentRow) {
    if (
      !confirm(
        `Permanently delete assessment "${row.title}" for ${row.courseName}? This cannot be undone.`
      )
    )
      return;
    try {
      const res = await fetch(`${API_BASE}admin/courses/${row.courseId}/assessment`, {
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-5 sm:space-y-6">
        {/* Header card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6 lg:p-8">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-start gap-3 sm:gap-4">
              <div className="hidden sm:flex w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-[#004900] to-[#006400] items-center justify-center shadow-md shadow-[#004900]/20 shrink-0">
                <ClipboardList className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 tracking-tight">Course Assessments</h1>
                <p className="text-xs sm:text-sm text-gray-500 mt-1">Manage quizzes linked to each course</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-500 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 w-fit">
              <span className="w-2 h-2 rounded-full bg-[#004900] animate-pulse" />
              {activeRows.length} active · {archivedRows.length} archived
            </div>
          </div>

          {/* Search + Archive controls — stacked on mobile, row on tablet/desktop */}
          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 w-full sm:max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by title, course or question type..."
                className="w-full pl-10 pr-4 py-2.5 sm:py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#004900]/20 focus:border-[#004900] transition-all bg-white shadow-sm placeholder:text-gray-400"
              />
            </div>
            <button
              onClick={() => setArchiveOpen(true)}
              className="inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 sm:py-3 text-sm font-semibold border border-gray-200 rounded-xl text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm bg-white w-full sm:w-auto shrink-0"
              title="View archive"
            >
              <Archive className="w-4 h-4" />
              Archive
              {archivedRows.length > 0 && (
                <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 text-[11px] font-bold rounded-full bg-gradient-to-r from-[#004900] to-[#006400] text-white shadow-sm">
                  {archivedRows.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Table / Cards */}
        <div className="bg-white border border-gray-200/80 rounded-2xl shadow-sm overflow-hidden">
          {/* Desktop / tablet table — horizontal scroll on small tablets */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm min-w-[680px]">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-200/80 text-left text-gray-500">
                  <th className="px-4 lg:px-5 py-3.5 text-xs font-bold uppercase tracking-wider w-16">ID</th>
                  <th className="px-4 lg:px-5 py-3.5 text-xs font-bold uppercase tracking-wider">Title</th>
                  <th className="px-4 lg:px-5 py-3.5 text-xs font-bold uppercase tracking-wider">Course Name</th>
                  <th className="px-4 lg:px-5 py-3.5 text-xs font-bold uppercase tracking-wider">Question Type</th>
                  <th className="px-4 lg:px-5 py-3.5 text-xs font-bold uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading && (
                  <tr>
                    <td colSpan={5} className="px-5 py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center animate-pulse">
                          <Search className="w-4 h-4 text-gray-400" />
                        </div>
                        <p className="text-sm text-gray-400">Loading course assessments...</p>
                      </div>
                    </td>
                  </tr>
                )}
                {!loading && error && (
                  <tr>
                    <td colSpan={5} className="px-5 py-16 text-center">
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
                    <td colSpan={5} className="px-5 py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center">
                          <ClipboardList className="w-5 h-5 text-gray-400" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-600">No course assessments found</p>
                          <p className="text-xs text-gray-400 mt-1">Try adjusting your search or check back later.</p>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
                {!loading &&
                  !error &&
                  filteredRows.map((row) => (
                    <tr key={row.id} className="hover:bg-gray-50/60 transition-colors group">
                      <td className="px-4 lg:px-5 py-4 text-gray-500 font-mono text-xs">{row.id}</td>
                      <td className="px-4 lg:px-5 py-4 font-semibold text-gray-900 group-hover:text-[#004900] transition-colors max-w-[220px] truncate">{row.title}</td>
                      <td className="px-4 lg:px-5 py-4 text-gray-600 max-w-[180px] truncate">{row.courseName}</td>
                      <td className="px-4 lg:px-5 py-4">
                        <span
                          className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold shadow-sm ring-1 ${
                            row.displayLabel === "No question yet"
                              ? "bg-gray-100 text-gray-500 ring-gray-200"
                              : "bg-purple-50 text-purple-700 ring-purple-200"
                          }`}
                        >
                          {row.displayLabel}
                        </span>
                      </td>
                      <td className="px-4 lg:px-5 py-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => openEdit(row)}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-xl text-gray-400 hover:text-[#004900] hover:bg-[#004900]/5 border border-transparent hover:border-[#004900]/10 transition-colors"
                            title="Edit"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleArchive(row)}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 border border-transparent hover:border-red-100 transition-colors"
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

          {/* Mobile stacked cards — visible only on mobile */}
          <div className="md:hidden divide-y divide-gray-100">
            {loading && (
              <div className="flex flex-col items-center gap-3 py-16 px-4">
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center animate-pulse">
                  <Search className="w-4 h-4 text-gray-400" />
                </div>
                <p className="text-sm text-gray-400">Loading course assessments...</p>
              </div>
            )}
            {!loading && error && (
              <div className="flex flex-col items-center gap-3 py-16 px-4">
                <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
                  <X className="w-4 h-4 text-red-400" />
                </div>
                <p className="text-sm text-red-500 text-center">{error}</p>
              </div>
            )}
            {!loading && !error && filteredRows.length === 0 && (
              <div className="flex flex-col items-center gap-3 py-16 px-4">
                <div className="w-12 h-12 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center">
                  <ClipboardList className="w-5 h-5 text-gray-400" />
                </div>
                <p className="text-sm font-semibold text-gray-600">No course assessments found</p>
                <p className="text-xs text-gray-400 text-center">Try adjusting your search.</p>
              </div>
            )}
            {!loading && !error && filteredRows.map((row) => (
              <div key={row.id} className="p-4 sm:p-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <span className="text-[11px] font-mono text-gray-500 bg-gray-50 border border-gray-100 px-2 py-0.5 rounded-full">#{row.id}</span>
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-semibold ring-1 ${row.displayLabel === "No question yet" ? "bg-gray-100 text-gray-500 ring-gray-200" : "bg-purple-50 text-purple-700 ring-purple-200"}`}>{row.displayLabel}</span>
                    </div>
                    <h3 className="font-semibold text-gray-900 text-sm leading-tight break-words">{row.title}</h3>
                    <p className="text-xs text-gray-500 mt-1 truncate">{row.courseName}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => openEdit(row)} className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-semibold border border-gray-200 bg-white text-gray-700 hover:bg-gray-50">
                    <Pencil className="w-3.5 h-3.5" /> Edit
                  </button>
                  <button onClick={() => handleArchive(row)} className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-semibold border border-red-200 bg-red-50/50 text-red-600 hover:bg-red-50">
                    <Trash2 className="w-3.5 h-3.5" /> Archive
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {editingRow && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4 lg:p-6">
            <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
              <div className="sticky top-0 bg-gradient-to-r from-[#004900] to-[#006400] px-4 sm:px-6 py-4 sm:py-5 rounded-t-2xl flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="text-base sm:text-lg font-bold text-white leading-tight">Edit Course Assessment</h3>
                  <div className="flex flex-wrap items-center gap-2 mt-1.5">
                    <p className="text-xs sm:text-sm text-white/80 truncate">{editingRow.courseName}</p>
                    <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-white/20 text-white backdrop-blur">
                      {editingRow.displayLabel}
                    </span>
                  </div>
                </div>
                <button
                  onClick={closeEdit}
                  className="shrink-0 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors"
                  title="cancel"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-4 sm:p-6">
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-gray-700 mb-1.5 block">Title</label>
                  <input
                    value={editForm.title}
                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#004900]/20 focus:border-[#004900] transition-all shadow-sm bg-white"
                    title="title"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 mb-1.5 block">Description</label>
                  <textarea
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#004900]/20 focus:border-[#004900] transition-all shadow-sm bg-white resize-none"
                    rows={2}
                    title="description"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-700 mb-1.5 block">Pass Mark %</label>
                    <input
                      type="number"
                      value={editForm.passMarkPercent}
                      onChange={(e) =>
                        setEditForm({ ...editForm, passMarkPercent: Number(e.target.value) })
                      }
                      className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#004900]/20 focus:border-[#004900] transition-all shadow-sm bg-white"
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
                      className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#004900]/20 focus:border-[#004900] transition-all shadow-sm bg-white"
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
                      className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#004900]/20 focus:border-[#004900] transition-all shadow-sm bg-white"
                      title="time limit"
                    />
                  </div>
                </div>
                <label className="flex items-center gap-2.5 cursor-pointer select-none bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5 w-fit">
                  <input
                    type="checkbox"
                    checked={editForm.isActive}
                    onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-300 accent-[#004900]"
                  />
                  <span className="text-sm font-medium text-gray-700">Active</span>
                </label>
              </div>

              <hr className="my-5 sm:my-6 border-gray-100" />

              {loadingItems && (
                <p className="text-sm text-gray-400 text-center py-8">Loading questions...</p>
              )}

              {!loadingItems && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <p className="text-xs font-bold text-gray-700 uppercase tracking-wide">
                      Questions ({items.length})
                    </p>
                    <button
                      onClick={addItem}
                      className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-white bg-gradient-to-r from-[#004900] to-[#006400] px-3 py-2 rounded-full shadow-sm shadow-[#004900]/20 hover:from-[#003700] hover:to-[#004900] transition-colors w-full sm:w-auto"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add question
                    </button>
                  </div>
                  {items.map((item, idx) => (
                    <div
                      key={item.id ?? `new-${idx}`}
                      className="border border-gray-200 rounded-2xl p-3 sm:p-4 relative bg-gray-50/30 shadow-sm"
                    >
                      {items.length > 1 && (
                        <button
                          onClick={() => removeItem(idx)}
                          className="absolute top-2 right-2 sm:top-3 sm:right-3 w-7 h-7 rounded-full bg-white border border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50 flex items-center justify-center transition-colors"
                          title="remove question"
                        >
                          <Trash className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <p className="text-xs font-bold text-[#004900] uppercase tracking-wide mb-2 pr-8">Question {idx + 1}</p>
                      <SingleQuestionEditor
                        item={item}
                        groupName={`course-q-${item.id ?? idx}`}
                        onChange={(patch) => updateItem(idx, patch)}
                        onOptionChange={(optionIndex, text) =>
                          updateItemOption(idx, optionIndex, text)
                        }
                      />
                    </div>
                  ))}

                  <div className="pt-3 border-t border-gray-100">
                    <button
                      type="button"
                      onClick={() => setShowCsvReplace((v) => !v)}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-[#004900] hover:underline transition-colors"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      {showCsvReplace
                        ? "Cancel CSV / Excel replace"
                        : "Replace all questions via CSV / Excel upload instead"}
                    </button>
                    {showCsvReplace && (
                      <div className="mt-3">
                        <label className="flex items-center gap-2 px-3 py-3 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-500 cursor-pointer hover:border-[#004900]/30 hover:bg-[#004900]/5 transition-colors bg-white">
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
                            className="text-xs font-medium text-red-500 hover:text-red-600 hover:underline mt-2"
                          >
                            Clear selected file
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row justify-end gap-3 mt-6">
                <button
                  onClick={closeEdit}
                  className="px-5 py-2.5 text-sm rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors font-semibold w-full sm:w-auto order-2 sm:order-1"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={saving || loadingItems}
                  className="px-5 py-2.5 text-sm rounded-xl bg-gradient-to-r from-[#004900] to-[#006400] text-white hover:from-[#003600] hover:to-[#004900] disabled:opacity-50 shadow-md shadow-[#004900]/20 transition-all font-semibold w-full sm:w-auto order-1 sm:order-2"
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
              </div>
            </div>
          </div>
        )}

        {archiveOpen && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4 lg:p-6">
            <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden shadow-2xl flex flex-col">
              <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-gray-100 flex items-start justify-between gap-4 shrink-0">
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-gray-900">Assessment Archive</h3>
                  <p className="text-xs sm:text-sm text-gray-500 mt-1">
                    Archived course assessments. Restore one to make it active again, or delete it permanently.
                  </p>
                </div>
                <button
                  onClick={() => setArchiveOpen(false)}
                  className="shrink-0 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-700 transition-colors"
                  title="close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="overflow-y-auto p-4 sm:p-6">
              {archivedRows.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-10">Archive is empty.</p>
              ) : (
                <>
                  <div className="hidden sm:block border border-gray-200 rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm min-w-[520px]">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-200 text-left text-gray-500">
                            <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider">ID</th>
                            <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider">Title</th>
                            <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider">Course Name</th>
                            <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider">Question Type</th>
                            <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {archivedRows.map((row) => (
                            <tr key={row.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3 text-gray-600 font-mono text-xs">{row.id}</td>
                              <td className="px-4 py-3 font-semibold text-gray-900 max-w-[150px] truncate">{row.title}</td>
                              <td className="px-4 py-3 text-gray-600 max-w-[140px] truncate">{row.courseName}</td>
                              <td className="px-4 py-3">
                                <span className="inline-flex px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-600 ring-1 ring-gray-200">
                                  {row.displayLabel}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <div className="inline-flex items-center gap-1">
                                  <button
                                    onClick={() => handleRestore(row)}
                                    className="inline-flex items-center justify-center w-8 h-8 rounded-xl text-[#004900] hover:bg-green-50 border border-transparent hover:border-green-100 transition-colors"
                                    title="Restore"
                                  >
                                    <RotateCcw className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDeletePermanently(row)}
                                    className="inline-flex items-center justify-center w-8 h-8 rounded-xl text-red-500 hover:bg-red-50 border border-transparent hover:border-red-100 transition-colors"
                                    title="Delete permanently"
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
                  </div>
                  <div className="sm:hidden space-y-3">
                    {archivedRows.map((row) => (
                      <div key={row.id} className="border border-gray-200 rounded-2xl p-4 space-y-3 bg-gray-50/30">
                        <div>
                          <p className="text-xs font-mono text-gray-400">#{row.id}</p>
                          <p className="font-semibold text-gray-900 text-sm mt-1 break-words">{row.title}</p>
                          <p className="text-xs text-gray-500 mt-1">{row.courseName}</p>
                          <span className="inline-flex mt-2 px-2 py-1 rounded-full text-xs bg-white border border-gray-200 text-gray-600">{row.displayLabel}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <button onClick={() => handleRestore(row)} className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-semibold bg-white border border-green-200 text-[#004900] hover:bg-green-50">
                            <RotateCcw className="w-3.5 h-3.5" /> Restore
                          </button>
                          <button onClick={() => handleDeletePermanently(row)} className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-semibold bg-white border border-red-200 text-red-600 hover:bg-red-50">
                            <Trash2 className="w-3.5 h-3.5" /> Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
              </div>
            </div>
          </div>
        )}
      </div>
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
    <div className="space-y-3 sm:space-y-4">
      <div>
        <label className="text-xs font-semibold text-gray-700 mb-1.5 block">Question Text</label>
        <textarea
          value={item.questionText}
          onChange={(e) => onChange({ questionText: e.target.value })}
          className="w-full mt-1 px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#004900]/20 focus:border-[#004900] bg-white shadow-sm resize-none placeholder:text-gray-400"
          rows={2}
          title="question text"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <div>
          <label className="text-xs font-semibold text-gray-700 mb-1.5 block">Question Type</label>
          <select
            value={item.questionType}
            onChange={(e) => onChange({ questionType: e.target.value as AssessmentItem["questionType"] })}
            className="w-full mt-1 px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#004900]/20 focus:border-[#004900] bg-white shadow-sm"
            title="question type select"
          >
            <option value="multiple_choice">Multiple Choice</option>
            <option value="true_false">True / False</option>
            <option value="short_answer">Short Answer</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-700 mb-1.5 block">Points</label>
          <input
            type="number"
            value={item.points}
            onChange={(e) => onChange({ points: Number(e.target.value) })}
            className="w-full mt-1 px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#004900]/20 focus:border-[#004900] bg-white shadow-sm max-w-full sm:max-w-32"
            title="points"
          />
        </div>
      </div>

      {item.questionType === "multiple_choice" && (
        <div>
          <label className="text-xs font-semibold text-gray-700 mb-2 block">
            Options — mark the correct one
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {item.options.map((opt, idx) => {
              const isCorrect = String(idx) === item.correctAnswer;

              return (
                <div key={idx} className={`flex items-end gap-2 p-2.5 rounded-xl border transition-colors ${isCorrect ? "bg-[#004900]/5 border-[#004900]/20" : "bg-white border-gray-100"}`}>
                  <div className="flex-1 min-w-0">
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Option {String.fromCharCode(65 + idx)}</label>
                    <input
                      value={opt.text}
                      onChange={(e) => onOptionChange(idx, e.target.value)}
                      className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#004900]/20 focus:border-[#004900] bg-white"
                      title={`option ${idx}`}
                    />
                  </div>
                  <label
                    className={`flex items-center gap-1 pb-2 cursor-pointer select-none text-xs whitespace-nowrap ${
                      isCorrect ? "text-[#004900] font-semibold" : "text-gray-400"
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
          <label className="text-xs font-semibold text-gray-700 mb-1.5 block">
            Correct Answer
          </label>
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => onChange({ correctAnswer: "true" })}
              className={`px-3 py-2.5 text-sm font-semibold rounded-xl border transition-colors ${
                item.correctAnswer === "true"
                  ? "bg-gradient-to-r from-[#004900] to-[#006400] text-white border-[#004900] shadow-md shadow-[#004900]/20"
                  : "border-gray-200 text-gray-600 hover:bg-gray-50 bg-white"
              }`}
            >
              True
            </button>
            <button
              type="button"
              onClick={() => onChange({ correctAnswer: "false" })}
              className={`px-3 py-2.5 text-sm font-semibold rounded-xl border transition-colors ${
                item.correctAnswer === "false"
                  ? "bg-gradient-to-r from-[#004900] to-[#006400] text-white border-[#004900] shadow-md shadow-[#004900]/20"
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
          <label className="text-xs font-semibold text-gray-700 mb-1.5 block">Correct Answer</label>
          <input
            value={item.correctAnswer}
            onChange={(e) => onChange({ correctAnswer: e.target.value })}
            className="w-full mt-1 px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#004900]/20 focus:border-[#004900] bg-white shadow-sm"
            title="correct answer"
          />
          <p className="text-[11px] text-gray-400 mt-1.5 leading-relaxed">
            Short-answer questions aren't auto-graded on the backend, so this text is saved
            inside the explanation field as "Expected answer: …" instead of as a literal
            correct-answer value.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <div className="sm:col-span-1">
          <label className="text-xs font-semibold text-gray-700 mb-1.5 block">Points</label>
          <input
            type="number"
            value={item.points}
            onChange={(e) => onChange({ points: Number(e.target.value) })}
            className="w-full mt-1 px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#004900]/20 focus:border-[#004900] bg-white shadow-sm"
            title="points"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs font-semibold text-gray-700 mb-1.5 block">Explanation <span className="font-normal text-gray-400">(optional)</span></label>
          <textarea
            value={item.explanation}
            onChange={(e) => onChange({ explanation: e.target.value })}
            className="w-full mt-1 px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#004900]/20 focus:border-[#004900] bg-white shadow-sm resize-none"
            rows={2}
            title="explanation"
          />
        </div>
      </div>
    </div>
  );
}
