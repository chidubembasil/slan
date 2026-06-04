import { useState } from "react";
import Manage from "../components/Manage-Course";
import Upload from "../components/Upload-Course";

export default function Course() {

  const [activeTab, setActiveTab] = useState("manage");

  return (
    <div className="w-[95%] flex flex-col gap-3">

      <ul className="w-full flex flex-row gap-5 border-b pt-2 pl-2">

        <li>
          <button
            type="button"
            onClick={() => setActiveTab("manage")}
            className={`w-fit h-15 px-3 transition
            ${
              activeTab === "manage"
                ? "border-b-2 border-blue-600 text-blue-600 font-semibold"
                : "text-gray-500"
            }`}
          >
            Manage Courses
          </button>
        </li>

        <li>
          <button
            type="button"
            onClick={() => setActiveTab("upload")}
            className={`w-fit h-15 px-3 transition
            ${
              activeTab === "upload"
                ? "border-b-2 border-blue-600 text-blue-600 font-semibold"
                : "text-gray-500"
            }`}
          >
            Upload New
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
            <Upload />
          </div>
        )}

      </div>

    </div>
  );
}