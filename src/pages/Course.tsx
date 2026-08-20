import { useState } from "react";
import Manage from "../components/Manage-Course";
import Upload from "../components/Upload-Course";
import ManageTracks from "../components/Manage-Tracks";
import ManageModules from "../components/Manage-Module";
import ManageUnits from "../components/Manage-Unit";
import { useAuthGuard } from "../hooks/useAuthGuard"

export default function Course() {
  useAuthGuard();
  const [activeTab, setActiveTab] = useState("manage");

  return (
    <div className="w-[95%] flex flex-col gap-4 animate-fade-in">
      <ul className="w-full flex flex-row gap-1 border-b border-gray-200 pt-2 pl-2 overflow-x-auto">
        {[
          { key: "upload", label: "Create Course" },
          { key: "manage", label: "Manage Courses" },
          { key: "tracks", label: "Manage Tracks" },
          { key: "modules", label: "Manage Modules" },
          { key: "units", label: "Manage Units" },
        ].map((tab) => (
          <li key={tab.key}>
            <button
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`w-fit h-15 px-4 transition-all duration-300 whitespace-nowrap relative
              ${
                activeTab === tab.key
                  ? "text-[#004900] font-semibold"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
              {activeTab === tab.key && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#004900] rounded-full" />
              )}
            </button>
          </li>
        ))}
      </ul>

      <div className="animate-slide-up">
        {activeTab === "manage" && <Manage />}
        {activeTab === "upload" && <Upload onComplete={() => setActiveTab("manage")} />}
        {activeTab === "tracks" && <ManageTracks />}
        {activeTab === "modules" && <ManageModules />}
        {activeTab === "units" && <ManageUnits />}
      </div>
    </div>
  );
}