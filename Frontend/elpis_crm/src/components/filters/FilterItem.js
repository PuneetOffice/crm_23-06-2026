import React from "react";
import { Trash2 } from "lucide-react";

function FilterItem({
  filter,
  index,
  columns,
  onFieldChange,
  onOperatorChange,
  onValueChange,
  onRemove,
  getFilterableFields,
  getFieldType,
  getOperatorsByType,
}) {
  const filterableFields = getFilterableFields();

  return (
    <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-2">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-gray-500">Filter {index + 1}</span>
        <button
          onClick={() => onRemove(filter.id)}
          className="text-red-500 hover:text-red-700 hover:bg-red-50 rounded p-1 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <p className="text-xs text-gray-500 mb-2">Filters apply to Tags across all tables.</p>

      {/* Field Select */}
      <select
        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
        value={filter.field}
        onChange={(e) => onFieldChange(filter.id, e.target.value)}
      >
        {filterableFields.map((col) => (
          <option key={col.key} value={col.key}>
            {col.label}
          </option>
        ))}
      </select>

      {/* Operator Select */}
      <select
        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
        value={filter.operator}
        onChange={(e) => onOperatorChange(filter.id, e.target.value)}
      >
        {getOperatorsByType(filter.dataType).map((op) => (
          <option key={op.value} value={op.value}>
            {op.label}
          </option>
        ))}
      </select>

      {/* Value Input */}
      {!["isEmpty", "isNotEmpty"].includes(filter.operator) && (
        <>
          {filter.dataType === "date" ? (
            <input
              type="date"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={filter.value}
              onChange={(e) => onValueChange(filter.id, e.target.value)}
            />
          ) : filter.dataType === "number" ? (
            <input
              type="number"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={filter.value}
              onChange={(e) => onValueChange(filter.id, e.target.value)}
              placeholder="Enter number..."
            />
          ) : (
            <input
              type="text"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={filter.value}
              onChange={(e) => onValueChange(filter.id, e.target.value)}
              placeholder="Enter value..."
            />
          )}
        </>
      )}
    </div>
  );
}

export default FilterItem;
