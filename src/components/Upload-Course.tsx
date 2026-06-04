import { useState } from "react";

export default function Upload() {
  const BASE = import.meta.env.VITE_CLIENT_KEY
  const [formData, setFormData] = useState({
    title: "",
    learning: "",
    prerequisite: "none",
    version: "",
    unit: "",
    description: "",
  });

  const [files, setFiles] = useState({
    image: null as File | null,
    bulk: null as File | null,
  });

  const [errors, setErrors] = useState<any>({});
  const [loading, setLoading] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });

    setErrors({
      ...errors,
      [e.target.name]: "",
    });
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (!file) return;

    setFiles({
      ...files,
      [e.target.name]: file,
    });
  };

  function validate() {
    let newErrors: any = {};

    if (!formData.title.trim())
      newErrors.title = "Course title required";

    if (!formData.learning)
      newErrors.learning = "Select a track";

    if (!formData.version.trim())
      newErrors.version = "Version required";

    if (!formData.unit)
      newErrors.unit = "Units required";

    if (!formData.description.trim())
      newErrors.description = "Description required";

    setErrors(newErrors);

    return Object.keys(newErrors).length === 0;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();

    if (!validate()) return;

    try {
      setLoading(true);

      const data = new FormData();

      data.append("title", formData.title);
      data.append("learning", formData.learning);
      data.append(
        "prerequisite",
        formData.prerequisite
      );
      data.append("version", formData.version);
      data.append("unit", formData.unit);
      data.append(
        "description",
        formData.description
      );

      if (files.image)
        data.append("image", files.image);

      if (files.bulk)
        data.append("bulk", files.bulk);

      const response = await fetch(`${BASE}/upload`,
        {
          method: "POST",
          body: data,
        }
      );

      const result = await response.json();

      console.log(result);

      alert("Course uploaded");
    } catch (err) {
      console.log(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full p-6">
      <form
        onSubmit={submit}
        className="w-full flex flex-col gap-6"
      >
        {/* Section 1 */}

        <div className="bg-card w-full rounded-xl flex flex-col gap-6 p-6 border border-gray-200 shadow-sm">

          <div>
            <p className="text-xl font-semibold">
              Course Information
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="title">
              Course Title*
            </label>

            <input
              type="text"
              name="title"
              id="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="e.g Student Welfare & Safety"
              className="border rounded-lg h-12 px-4 outline-none focus:ring-2 focus:ring-blue-500"
            />

            {errors.title && (
              <p className="text-red-500 text-sm">
                {errors.title}
              </p>
            )}
          </div>

          <div className="grid md:grid-cols-2 gap-5">

            <div className="flex flex-col gap-2">
              <label htmlFor="learning">
                Learning Track*
              </label>

              <select
                name="learning"
                id="learning"
                value={formData.learning}
                onChange={handleChange}
                className="border rounded-lg h-12 px-4"
              >
                <option value="">
                  Select Track
                </option>

                <option value="leadership">
                  Leadership Fundamental
                </option>

                <option value="operations">
                  Operations
                </option>

                <option value="people">
                  People
                </option>

                <option value="student">
                  Student Focus
                </option>

                <option value="technology">
                  Technology & Innovation
                </option>

                <option value="community">
                  Community Engagement
                </option>

                <option value="professional">
                  Professional Development
                </option>

              </select>

              {errors.learning && (
                <p className="text-red-500 text-sm">
                  {errors.learning}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <label>
                Prerequisite Course*
              </label>

              <select
                name="prerequisite"
                value={formData.prerequisite}
                onChange={handleChange}
                className="border rounded-lg h-12 px-4"
                title="select"
              >
                <option value="none">
                  None
                </option>

                <option value="strategic">
                  Strategic Management
                </option>

                <option value="financial">
                  Financial Management
                </option>

                <option value="staff">
                  Staff Management
                </option>

              </select>
            </div>

          </div>

          <div className="grid md:grid-cols-2 gap-5">

            <div className="flex flex-col gap-2">
              <label>
                Version Tag*
              </label>

              <input
                type="text"
                name="version"
                value={formData.version}
                onChange={handleChange}
                placeholder="1.0"
                className="border rounded-lg h-12 px-4"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label>
                Number of Units*
              </label>

              <input
                type="number"
                name="unit"
                value={formData.unit}
                onChange={handleChange}
                placeholder="5"
                className="border rounded-lg h-12 px-4"
              />
            </div>

          </div>

          <div className="flex flex-col gap-2">
            <label>
              Course Description*
            </label>

            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              className="border rounded-lg p-4 h-32 resize-none"
              title="textarea"
            />

            {errors.description && (
              <p className="text-red-500 text-sm">
                {errors.description}
              </p>
            )}

          </div>

        </div>

        {/* Section 2 */}

        <div className="bg-card w-full rounded-xl flex flex-col gap-5 p-6 border border-gray-200 shadow-sm">

          <div className="flex flex-col gap-2">

            <label htmlFor="image">
              Course Cover Image*
            </label>

            <input
              type="file"
              name="image"
              id="image"
              onChange={handleFile}
              className="border rounded-lg p-3"
            />

          </div>

          <div className="flex flex-col gap-2">

            <label htmlFor="bulk">
              Bulk Upload*
            </label>

            <input
              type="file"
              name="bulk"
              id="bulk"
              onChange={handleFile}
              className="border rounded-lg p-3"
            />

          </div>

        </div>

        {/* Section 3 */}

        <div className="bg-card rounded-xl flex justify-end gap-4 p-6 border border-gray-200 shadow-sm">

          <button
            type="reset"
            className="px-6 h-11 rounded-lg border"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={loading}
            className="px-6 h-11 rounded-lg bg-[#004900] text-white"
          >
            {loading
              ? "Uploading..."
              : "Upload"}
          </button>

        </div>

      </form>
    </div>
  );
}