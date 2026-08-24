import { useState } from "react";
import Manage from "../components/Manage-Course";
import Upload from "../components/Upload-Course";
import ManageTracks from "../components/Manage-Tracks";
import ManageModules from "../components/Manage-Module";
import ManageUnits from "../components/Manage-Unit";
import { useAuthGuard } from "../hooks/useAuthGuard";
import {
  BookOpen,
  PlusCircle,
  GitBranch,
  Layers,
  Boxes,
  Sparkles,
} from "lucide-react";

const TABS = [
  { key: "manage", label: "Manage Courses", icon: BookOpen, desc: "Browse & edit" },
  { key: "upload", label: "Create Course", icon: PlusCircle, desc: "New course" },
  { key: "tracks", label: "Manage Tracks", icon: GitBranch, desc: "Learning paths" },
  { key: "modules", label: "Manage Modules", icon: Layers, desc: "Module groups" },
  { key: "units", label: "Manage Units", icon: Boxes, desc: "Unit content" },
] as const;

export default function Course() {
  useAuthGuard();
  const [activeTab, setActiveTab] = useState("manage");

  const activeMeta = TABS.find((t) => t.key === activeTab) ?? TABS[0];

  return (
    <div className="min-h-screen bg-gray-50/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 sm:py-8 animate-fade-in">
        {/* Header — decorative banner consistent with Dashboard */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#004900] via-[#003d00] to-[#005c00] text-white p-6 sm:p-8 mb-6 shadow-xl animate-slide-up">
          {/* subtle image overlay */}
          <div className="absolute inset-0 opacity-[0.07]">
            <img
              src="https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=1600"
              alt=""
              className="w-full h-full object-cover"
            />
          </div>
          {/* decorative circles */}
          <div className="absolute -top-10 -right-10 w-48 h-48 bg-white/[0.06] rounded-full blur-[1px]" />
          <div className="absolute top-6 right-24 w-24 h-24 bg-white/[0.05] rounded-full" />
          <div className="absolute bottom-0 right-48 w-16 h-16 bg-white/[0.04] rounded-full animate-float" />
          <div className="absolute -bottom-8 left-1/3 w-32 h-32 bg-white/[0.03] rounded-full" />

          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/10 rounded-full px-3 py-1 text-xs font-medium text-white/90 mb-3">
                <Sparkles size={12} className="text-white/80" />
                Course Management
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                Courses &amp; Curriculum
              </h1>
              <p className="text-sm text-white/70 mt-2 max-w-xl leading-relaxed">
                Create courses, organize tracks, modules and units — all in one place.
                Switch tabs to manage each layer of your curriculum.
              </p>
            </div>
            <div className="hidden sm:flex items-center gap-3 shrink-0">
              <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl px-4 py-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white text-[#004900] flex items-center justify-center shadow-sm">
                  <activeMeta.icon size={16} />
                </div>
                <div className="text-left">
                  <p className="text-xs text-white/60 leading-none">Active —</p>
                  <p className="text-sm font-semibold text-white leading-tight">
                    {activeMeta.label}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Pill / segmented tab navigation */}
        <div className="bg-white rounded-2xl border border-gray-200/60 shadow-sm p-1.5 sm:p-2 mb-6 animate-slide-up" style={{ animationDelay: "0.06s" }}>
          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`group inline-flex items-center gap-2 sm:gap-2.5 px-3.5 sm:px-4 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all duration-200 border ${
                    isActive
                      ? "bg-[#004900] text-white border-[#004900] shadow-md shadow-[#004900]/20"
                      : "bg-white text-gray-600 border-gray-200/70 hover:bg-gray-50 hover:text-gray-900 hover:border-gray-200 hover:shadow-sm"
                  }`}
                >
                  <Icon
                    size={16}
                    className={`shrink-0 transition-colors duration-200 ${isActive ? "text-white" : "text-gray-400 group-hover:text-gray-700"}`}
                  />
                  <span className="whitespace-nowrap">{tab.label}</span>
                  <span
                    className={`hidden xl:inline text-[11px] font-normal whitespace-nowrap ${isActive ? "text-white/70" : "text-gray-400"}`}
                  >
                    · {tab.desc}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Content card */}
        <div className="bg-white rounded-2xl border border-gray-200/60 shadow-sm p-4 sm:p-6 animate-slide-up" style={{ animationDelay: "0.12s" }}>
          <div className="flex items-center gap-2 mb-4 pb-4 border-b border-gray-100">
            <div className="w-8 h-8 rounded-xl bg-[#004900]/10 text-[#004900] flex items-center justify-center">
              <activeMeta.icon size={14} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900 leading-none">
                {activeMeta.label}
              </h2>
              <p className="text-xs text-gray-500 mt-1">{activeMeta.desc}</p>
            </div>
          </div>

          <div className="animate-slide-up">
            {activeTab === "manage" && <Manage />}
            {activeTab === "upload" && <Upload onComplete={() => setActiveTab("manage")} />}
            {activeTab === "tracks" && <ManageTracks />}
            {activeTab === "modules" && <ManageModules />}
            {activeTab === "units" && <ManageUnits />}
          </div>
        </div>
      </div>
    </div>
  );
}
