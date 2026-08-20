import { useState } from "react";
// import CourseAssessments from "../components/CourseAssessment";
import TrackAssessments from "../components/TrackAssessments";
import ModuleAssessments from "../components/ModuleAssessments";

type Tab = "course" | "track" | "module";

const tabs: { key: Tab; label: string }[] = [
  // { key: "course", label: "Course Assessments" },
  { key: "track", label: "Track Assessments" },
  { key: "module", label: "Module Assessments" },
];

export default function ManageAssessments() {
  const [activeTab, setActiveTab] = useState<Tab>("track");

  return (
    <div className="min-h-screen bg-gray-50/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 sm:py-8 animate-fade-in">
        {/* Page header */}
        <div className="mb-5 sm:mb-6">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">Manage Assessments</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            View, edit and delete assessments across courses, tracks and modules
          </p>
        </div>

        {/* Tab nav */}
        <div className="flex gap-0 border-b border-gray-200 mb-6 overflow-x-auto scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`shrink-0 whitespace-nowrap px-3 sm:px-6 py-3 text-xs sm:text-sm font-medium border-b-2 transition-all duration-300 -mb-px ${
                activeTab === tab.key
                  ? "border-[#004900] text-[#004900] font-semibold"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="animate-slide-up">
          {activeTab === "track" && <TrackAssessments />}
          {activeTab === "module" && <ModuleAssessments />}
        </div>
      </div>
    </div>
  );
}