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
    <div className="w-[95%] flex flex-col gap-3">
      <ul className="w-full flex flex-row gap-5 border-b pt-2 pl-2 overflow-x-auto">
        <li>
          <button
            type="button"
            onClick={() => setActiveTab("upload")}
            className={`w-fit h-15 px-3 transition whitespace-nowrap
            ${
              activeTab === "upload"
                ? "border-b-2 border-[#004900] text-[#004900] font-semibold"
                : "text-gray-500"
            }`}
          >
            Create Course
          </button>
        </li>

        <li>
          <button
            type="button"
            onClick={() => setActiveTab("manage")}
            className={`w-fit h-15 px-3 transition whitespace-nowrap
            ${
              activeTab === "manage"
                ? "border-b-2 border-[#004900] text-[#004900] font-semibold"
                : "text-gray-500"
            }`}
          >
            Manage Courses
          </button>
        </li>

        <li>
          <button
            type="button"
            onClick={() => setActiveTab("tracks")}
            className={`w-fit h-15 px-3 transition whitespace-nowrap
            ${
              activeTab === "tracks"
                ? "border-b-2 border-[#004900] text-[#004900] font-semibold"
                : "text-gray-500"
            }`}
          >
            Manage Tracks
          </button>
        </li>

        <li>
          <button
            type="button"
            onClick={() => setActiveTab("modules")}
            className={`w-fit h-15 px-3 transition whitespace-nowrap
            ${
              activeTab === "modules"
                ? "border-b-2 border-[#004900] text-[#004900] font-semibold"
                : "text-gray-500"
            }`}
          >
            Manage Modules
          </button>
        </li>

        <li>
          <button
            type="button"
            onClick={() => setActiveTab("units")}
            className={`w-fit h-15 px-3 transition whitespace-nowrap
            ${
              activeTab === "units"
                ? "border-b-2 border-[#004900] text-[#004900] font-semibold"
                : "text-gray-500"
            }`}
          >
            Manage Units
          </button>
        </li>
       
      </ul>

      <div>
        {activeTab === "manage" && (
          <div>
            <Manage />
          </div>
        )}

        {activeTab === "upload" && (
          <div>
            <Upload onComplete={() => setActiveTab("manage")} />
          </div>
        )}

        {activeTab === "tracks" && (
          <div>
            <ManageTracks />
          </div>
        )}

        {activeTab === "modules" && (
          <div>
            <ManageModules />
          </div>
        )}

        {activeTab === "units" && (
          <div>
            <ManageUnits />
          </div>
        )}
        
      </div>
    </div>
  );
}