import React, { useState, useEffect } from "react";
import { X, Filter, RotateCcw, Check } from "lucide-react";

// Right-side sliding Deals filter panel.
// Filters: Deal Pipeline, Created By  (→ standard filters array)
//          Created At range, Updated At range  (→ dealsDateRange event via onApply)

const PIPELINE_OPTIONS = [
  "Default Pipeline",
  "Hardware Product Sale",
  "Software Product Sale",
  "Software/Hardware Pipeline",
];

const LABEL_CLS = "block text-xs font-medium text-gray-600 mb-1.5";
const INPUT_CLS =
  "w-full h-10 px-3 rounded-lg border border-gray-200 bg-gray-50/60 text-sm text-gray-800 placeholder:text-gray-400 outline-none focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all";

function SectionTitle({ children }) {
  return (
    <h4 className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mt-5 mb-2 first:mt-0">{children}</h4>
  );
}

function getFilterValue(filters, fieldNames) {
  const arr = Array.isArray(filters) ? filters : [];
  const f = arr.find((x) => fieldNames.includes(String(x?.field || "").toLowerCase().trim()));
  return f?.value || "";
}

function DealsFilterDrawer({
  isOpen,
  onClose,
  filters = [],
  dateRange = {},
  onApply,
  onClear,
  createdByOptions = [],
}) {
  const [pipeline, setPipeline] = useState("");
  const [createdBy, setCreatedBy] = useState("");
  const [dateField, setDateField] = useState("createdAt"); // which date the From/To below apply to
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");
  const [updatedFrom, setUpdatedFrom] = useState("");
  const [updatedTo, setUpdatedTo] = useState("");

  // From/To bound to the currently selected date field
  const fromVal = dateField === "createdAt" ? createdFrom : updatedFrom;
  const toVal = dateField === "createdAt" ? createdTo : updatedTo;
  const setFromVal = (v) => (dateField === "createdAt" ? setCreatedFrom(v) : setUpdatedFrom(v));
  const setToVal = (v) => (dateField === "createdAt" ? setCreatedTo(v) : setUpdatedTo(v));

  // Prefill whenever the drawer opens
  useEffect(() => {
    if (!isOpen) return;
    setPipeline(getFilterValue(filters, ["dealpipeline", "pipeline"]));
    setCreatedBy(getFilterValue(filters, ["createdby"]));
    setCreatedFrom(dateRange.createdFrom || "");
    setCreatedTo(dateRange.createdTo || "");
    setUpdatedFrom(dateRange.updatedFrom || "");
    setUpdatedTo(dateRange.updatedTo || "");
    // Default the dropdown to whichever field already has a value
    setDateField((dateRange.updatedFrom || dateRange.updatedTo) && !(dateRange.createdFrom || dateRange.createdTo) ? "updatedAt" : "createdAt");
  }, [isOpen, filters, dateRange]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const activeCount =
    [pipeline, createdBy, createdFrom, createdTo, updatedFrom, updatedTo].filter(
      (v) => String(v ?? "").trim() !== ""
    ).length;

  const handleApply = () => {
    const out = [];
    if (pipeline.trim()) out.push({ field: "dealPipeline", operator: "equals", value: pipeline.trim(), dataType: "select" });
    if (createdBy.trim()) out.push({ field: "createdBy", operator: "equals", value: createdBy.trim(), dataType: "select" });
    onApply?.(out, { createdFrom, createdTo, updatedFrom, updatedTo });
    onClose();
  };

  const handleClear = () => {
    setPipeline(""); setCreatedBy("");
    setDateField("createdAt");
    setCreatedFrom(""); setCreatedTo(""); setUpdatedFrom(""); setUpdatedTo("");
    onClear?.();
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 z-[9998] animate-in fade-in duration-200" onClick={onClose} />

      {/* Drawer */}
      <div
        className="fixed top-0 right-0 h-full w-[92vw] sm:w-[400px] bg-white shadow-2xl z-[9999] flex flex-col animate-in slide-in-from-right duration-200"
        style={{ fontFamily: "Poppins, sans-serif" }}
        role="dialog"
        aria-modal="true"
        aria-label="Deal filters"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <Filter className="w-4 h-4 text-white" />
            </span>
            <div>
              <h3 className="text-sm font-semibold text-gray-800">Filters</h3>
              <p className="text-[11px] text-gray-500">{activeCount > 0 ? `${activeCount} active` : "Refine your deals"}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 hover:bg-white rounded-lg p-1.5 transition-colors" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <SectionTitle>Deal</SectionTitle>
          <div className="space-y-3">
            <div>
              <label className={LABEL_CLS}>Deal Pipeline</label>
              <select value={pipeline} onChange={(e) => setPipeline(e.target.value)} className={INPUT_CLS}>
                <option value="">All Pipelines</option>
                {PIPELINE_OPTIONS.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL_CLS}>Created By</label>
              <select value={createdBy} onChange={(e) => setCreatedBy(e.target.value)} className={INPUT_CLS}>
                <option value="">All Users</option>
                {(createdByOptions || []).map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </div>
          </div>

          <SectionTitle>Date Filter</SectionTitle>
          <div className="space-y-3">
            <div>
              <label className={LABEL_CLS}>Date Field</label>
              <select value={dateField} onChange={(e) => setDateField(e.target.value)} className={INPUT_CLS}>
                <option value="createdAt">Created At</option>
                <option value="updatedAt">Updated At</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={LABEL_CLS}>From</label>
                <input type="date" value={fromVal} max={toVal || undefined} onChange={(e) => setFromVal(e.target.value)} className={INPUT_CLS} />
              </div>
              <div>
                <label className={LABEL_CLS}>To</label>
                <input type="date" value={toVal} min={fromVal || undefined} onChange={(e) => setToVal(e.target.value)} className={INPUT_CLS} />
              </div>
            </div>
            {(createdFrom || createdTo) && (updatedFrom || updatedTo) && (
              <p className="text-[11px] text-gray-500">Both Created At and Updated At ranges are applied.</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 px-5 py-4 border-t border-gray-100 bg-gray-50">
          <button onClick={handleClear} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded-lg transition-colors">
            <RotateCcw className="w-4 h-4" /> Clear All
          </button>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white hover:bg-gray-100 border border-gray-300 rounded-lg transition-colors">Cancel</button>
            <button onClick={handleApply} className="inline-flex items-center gap-1.5 px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors">
              <Check className="w-4 h-4" /> Apply
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export default DealsFilterDrawer;
