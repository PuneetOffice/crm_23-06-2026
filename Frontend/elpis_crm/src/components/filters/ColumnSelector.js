import React from "react";

function ColumnSelector({ columns, selectedColumns, onColumnToggle, onSelectAll }) {
  if (!columns) return null;

  return (
    <div className="space-y-2">
      <div className="flex gap-2 mb-3">
        <button
          onClick={onSelectAll}
          className="flex-1 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
        >
          Select All
        </button>
      </div>
      {columns
        .filter((col) => {
          const keyLower = String(col.key).toLowerCase().trim().replace(/\s+/g, "");
          return !(
            keyLower === "id" ||
            keyLower.endsWith("id") ||
            keyLower.includes("accountid") ||
            keyLower.includes("contactid") ||
            keyLower.includes("productid") ||
            keyLower.includes("dealid")
          );
        })
        .map((col) => (
          <label
            key={col.key}
            className="flex items-center px-3 py-2.5 cursor-pointer text-sm text-gray-700 rounded-lg hover:bg-gray-50 transition-colors group"
          >
            <input
              type="checkbox"
              className="w-4 h-4 mr-3 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500 cursor-pointer"
              checked={selectedColumns.includes(col.key)}
              onChange={() => onColumnToggle(col.key)}
            />
            <span className="group-hover:text-gray-900">{col.label}</span>
          </label>
        ))}
    </div>
  );
}

export default ColumnSelector;
