import { useState, useEffect, useCallback } from "react";
import { FrameworkForm } from "./FrameworkForm";
import type { Framework, FrameworkModule, FrameworkUnit } from "./FrameworkForm";

const BASE = import.meta.env.VITE_BASE_URL;

type Track = { id: number; title: string };

// ── Modal Shell ───────────────────────────────────────────────────────────────

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="bg-[#004900] px-6 py-4 flex items-center justify-between rounded-t-2xl sticky top-0 z-10">
          <h2 className="text-white font-semibold text-base">{title}</h2>
          <button onClick={onClose} className="text-white/70 hover:text-white text-xl leading-none">
            ✕
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

// ── Confirm Delete ────────────────────────────────────────────────────────────

function ConfirmModal({
  message,
  onConfirm,
  onCancel,
  loading,
}: {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-start gap-3 mb-5">
          <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center shrink-0 mt-0.5">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.5">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <p className="text-sm text-gray-700 leading-relaxed">{message}</p>
        </div>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-sm border border-gray-300 text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="px-4 py-2 rounded-lg text-sm bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"
          >
            {loading ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

type ModalState =
  | { type: "none" }
  | { type: "create" }
  | { type: "edit"; framework: Framework }
  | { type: "delete"; framework: Framework };

export default function ManageFrameworks() {
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [modules, setModules] = useState<FrameworkModule[]>([]);
  const [units, setUnits] = useState<FrameworkUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [modal, setModal] = useState<ModalState>({ type: "none" });
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setFetchError("");
    const token = localStorage.getItem("adminAccessToken");
    try {
      // 1. Tracks
      const tracksRes = await fetch(`${BASE}admin/tracks`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });
      const tracksData = await tracksRes.json();
      if (!tracksRes.ok) throw new Error(tracksData.message || "Failed to load tracks");
      const allTracks: Track[] = Array.isArray(tracksData)
        ? tracksData
        : tracksData.data ?? tracksData.tracks ?? [];

      // 2. Modules (per track)
      const moduleResults = await Promise.all(
        allTracks.map((track) =>
          fetch(`${BASE}admin/tracks/${track.id}/modules`, {
            headers: { Authorization: `Bearer ${token}` },
            credentials: "include",
          })
            .then((r) => r.json())
            .then((d) => {
              const mods: FrameworkModule[] = Array.isArray(d) ? d : d.data ?? d.modules ?? [];
              return mods.map((m) => ({ ...m, trackId: track.id }));
            })
            .catch(() => [] as FrameworkModule[])
        )
      );
      const allModules = moduleResults.flat();
      setModules(allModules);

      // 3. Units (per module)
      const unitResults = await Promise.all(
        allModules.map((mod) =>
          fetch(`${BASE}admin/modules/${mod.id}/units`, {
            headers: { Authorization: `Bearer ${token}` },
            credentials: "include",
          })
            .then((r) => r.json())
            .then((d) => {
              const unitList: FrameworkUnit[] = Array.isArray(d) ? d : d.data ?? d.units ?? [];
              return unitList.map((u) => ({ ...u, moduleId: u.moduleId ?? mod.id }));
            })
            .catch(() => [] as FrameworkUnit[])
        )
      );
      const allUnits = unitResults.flat();
      setUnits(allUnits);

      // 4. Frameworks
      const fwRes = await fetch(`${BASE}frameworks`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });
      const fwData = await fwRes.json();
      if (!fwRes.ok) throw new Error(fwData.message || "Failed to load frameworks");
      const allFrameworks: Framework[] = Array.isArray(fwData)
        ? fwData
        : fwData.data ?? fwData.frameworks ?? [];
      setFrameworks(allFrameworks);
    } catch (err: any) {
      setFetchError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleDelete = async () => {
    if (modal.type !== "delete") return;
    const token = localStorage.getItem("adminAccessToken");
    setDeleting(true);
    try {
      const res = await fetch(`${BASE}frameworks/${modal.framework.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Delete failed");
      }
      setModal({ type: "none" });
      showToast(`Framework "${modal.framework.title}" deleted`);
      fetchAll();
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setDeleting(false);
    }
  };

  const closeModal = () => setModal({ type: "none" });

  const unitTitle = (unitId: number) => units.find((u) => u.id === unitId)?.title ?? `Unit #${unitId}`;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Manage Frameworks</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Educational frameworks referenced in the curriculum
            </p>
          </div>
          <button
            onClick={() => setModal({ type: "create" })}
            className="bg-[#004900] text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-[#003700] inline-flex items-center gap-2"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Framework
          </button>
        </div>

        {/* Table card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {loading && (
            <div className="flex items-center justify-center py-20 text-gray-400 text-sm">
              Loading frameworks…
            </div>
          )}

          {!loading && fetchError && (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <p className="text-sm text-red-600">{fetchError}</p>
              <button onClick={fetchAll} className="text-sm text-[#004900] underline">
                Retry
              </button>
            </div>
          )}

          {!loading && !fetchError && frameworks.length === 0 && (
            <div className="flex items-center justify-center py-20 text-gray-400 text-sm">
              No frameworks found. Click "Add Framework" to create one.
            </div>
          )}

          {!loading && !fetchError && frameworks.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide w-12">
                      ID
                    </th>
                    <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Unit ID
                    </th>
                    <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Unit Name
                    </th>
                    <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Framework Title
                    </th>
                    <th className="text-right px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {frameworks.map((fw) => (
                    <tr key={fw.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="px-6 py-4 text-gray-400 font-mono text-xs">{fw.id}</td>
                      <td className="px-6 py-4 text-gray-400 font-mono text-xs">{fw.unitId}</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                          {unitTitle(fw.unitId)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {fw.imageUrl && (
                            <img
                              src={fw.imageUrl}
                              alt={fw.title}
                              className="w-9 h-9 object-cover rounded-md"
                            />
                          )}
                          <div>
                            <div className="font-medium text-gray-900">{fw.title}</div>
                            {fw.author && <div className="text-xs text-gray-400">{fw.author}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          {/* Edit */}
                          <button
                            onClick={() => setModal({ type: "edit", framework: fw })}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-blue-200 text-blue-600 hover:bg-blue-50 transition-colors"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                            Edit
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => setModal({ type: "delete", framework: fw })}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                              <path d="M10 11v6M14 11v6" />
                              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                            </svg>
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Create / Edit Modal ── */}
      {(modal.type === "create" || modal.type === "edit") && (
        <Modal
          title={modal.type === "create" ? "Add Framework" : `Edit Framework — ${modal.framework.title}`}
          onClose={closeModal}
        >
          <FrameworkForm
            framework={modal.type === "edit" ? modal.framework : undefined}
            modules={modules}
            units={units}
            onDone={() => {
              closeModal();
              showToast(
                modal.type === "create" ? "Framework created successfully" : "Framework updated successfully"
              );
              fetchAll();
            }}
            onCancel={closeModal}
          />
        </Modal>
      )}

      {/* ── Delete Confirm ── */}
      {modal.type === "delete" && (
        <ConfirmModal
          message={`Are you sure you want to delete "${modal.framework.title}"? This action cannot be undone.`}
          onConfirm={handleDelete}
          onCancel={closeModal}
          loading={deleting}
        />
      )}

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 px-5 py-3 rounded-xl shadow-lg flex items-center gap-3 z-50 ${
            toast.type === "error" ? "bg-red-600" : "bg-[#004900]"
          } text-white`}
        >
          {toast.type === "success" ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          )}
          <span className="text-sm font-medium">{toast.msg}</span>
        </div>
      )}
    </div>
  );
}