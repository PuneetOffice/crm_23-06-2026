import React, { useState, useEffect, useContext, useCallback } from "react";
import apiClient from "../api/client";
import AuthContext from "../auth/AuthContext";
import { FiTrash2 } from "react-icons/fi";

function formatDate(val) {
  if (!val) return "";
  const d = new Date(val);
  if (isNaN(d.getTime())) return String(val);
  return d.toLocaleDateString();
}

const COLUMNS = [
  { key: "callOwner",          label: "Call Owner" },
  { key: "callDirection",      label: "Direction" },
  { key: "callStatus",         label: "Status" },
  { key: "callDuration",       label: "Duration" },
  { key: "outcome",            label: "Outcome" },
  { key: "phone",              label: "Phone" },
  { key: "callType",           label: "Call Type" },
  { key: "notes",              label: "Notes" },
  { key: "associatedWithCall", label: "Associated With" },
  { key: "createdAt",          label: "Created At" },
];

export default function CallLogs({ onToast }) {
  const auth = useContext(AuthContext);
  const userRole = auth?.getRole?.();
  const isAdmin = userRole === "Admin" || userRole === "admin";

  const [data, setData]         = useState([]);
  const [loading, setLoading]   = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [search, setSearch]     = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get("/CallLog");
      setData(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      onToast?.("Failed to load call logs", "error");
    } finally {
      setLoading(false);
    }
  }, [onToast]);

  useEffect(() => {
    fetchData();
    try { window.refetchCallLogs = fetchData; } catch (_) {}
  }, [fetchData]);

  const filtered = search.trim()
    ? data.filter(r =>
        Object.values(r).join(" ").toLowerCase().includes(search.trim().toLowerCase())
      )
    : data;

  const allSelected  = filtered.length > 0 && selected.size === filtered.length;
  const someSelected = selected.size > 0 && !allSelected;

  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(filtered.map((_, i) => i)));
  const toggleRow = (i) => setSelected(prev => {
    const next = new Set(prev);
    next.has(i) ? next.delete(i) : next.add(i);
    return next;
  });

  const confirmDelete = async () => {
    const ids = Array.from(selected)
      .map(i => filtered[i]?.callLogId)
      .filter(Boolean);
    setShowDeleteModal(false);
    if (!ids.length) return;
    try {
      await Promise.all(ids.map(id => apiClient.delete(`/CallLog/${id}`)));
      onToast?.(`Deleted ${ids.length} call log(s)`, "success");
      setSelected(new Set());
      fetchData();
    } catch {
      onToast?.("Failed to delete call logs", "error");
    }
  };

  return (
    <div className="flex flex-col w-full h-full font-[poppins,sans-serif]">
      {/* Selection bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-4 bg-blue-50 border border-blue-100 rounded-xl px-6 py-3 mb-4 shadow-sm">
          <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-medium">
            {selected.size}
          </div>
          <span className="text-sm text-gray-700">selected</span>
          <div className="flex-1" />
          {isAdmin && (
            <button
              className="flex items-center gap-1 bg-white border border-red-200 text-red-600 rounded-lg px-4 py-2 text-sm hover:bg-red-50 transition"
              onClick={() => setShowDeleteModal(true)}
            >
              <FiTrash2 className="inline" /> Delete
            </button>
          )}
        </div>
      )}

      {/* Delete modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <div className="bg-white w-full sm:w-96 rounded-2xl shadow-2xl p-6 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h4 className="text-lg font-semibold text-gray-900 mb-2">Confirm Delete</h4>
            <p className="text-sm text-gray-600 mb-6">Delete <span className="font-semibold">{selected.size}</span> call log(s)?</p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => setShowDeleteModal(false)} className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium">Cancel</button>
              <button onClick={confirmDelete} className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="w-full flex flex-col rounded-xl border border-gray-200 shadow-sm bg-white flex-1 min-h-0">
        {/* Search */}
        <div className="sticky top-0 z-20 bg-white border-b border-gray-200 px-4 py-2.5 flex items-center justify-end gap-3">
          <input
            type="text"
            placeholder="Search call logs..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-xs w-full"
          />
        </div>

        <div className="flex-1 overflow-auto min-h-0">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
            </div>
          ) : (
            <table className="w-full border-collapse">
              <thead className="sticky top-0 bg-gray-50 border-b border-gray-200 z-10">
                <tr>
                  <th className="px-3 py-3 text-center w-10">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      ref={el => { if (el) el.indeterminate = someSelected; }}
                      onChange={toggleAll}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer"
                    />
                  </th>
                  {COLUMNS.map(col => (
                    <th key={col.key} className="px-4 py-3 text-left text-xs font-semibold text-gray-700 whitespace-nowrap">
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={COLUMNS.length + 1} className="text-center py-16 text-gray-400 text-sm">
                      No call logs found
                    </td>
                  </tr>
                ) : (
                  filtered.map((row, i) => (
                    <tr key={row.callLogId ?? i} className={`transition hover:bg-gray-50 ${selected.has(i) ? "bg-blue-50" : "bg-white"}`}>
                      <td className="px-3 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={selected.has(i)}
                          onChange={() => toggleRow(i)}
                          className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer"
                        />
                      </td>
                      {COLUMNS.map(col => (
                        <td key={col.key} className="px-4 py-3 text-xs text-gray-700 max-w-xs truncate">
                          {col.key === "createdAt" ? formatDate(row[col.key]) : (row[col.key] ?? "")}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer count */}
        <div className="border-t border-gray-200 px-6 py-3 text-sm text-gray-500">
          {filtered.length} record{filtered.length !== 1 ? "s" : ""}
        </div>
      </div>
    </div>
  );
}
