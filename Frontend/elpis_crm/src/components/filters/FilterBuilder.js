import React from "react";
import { Filter, Plus } from "lucide-react";
import FilterItem from "./FilterItem";

function FilterBuilder({
  filters,
  columns,
  tagOptions,
  selectedTag,
  onAddFilter,
  onRemoveFilter,
  onFilterChange,
  onTagChange,
  getFilterableFields,
  getFieldType,
  getOperatorsByType,
  allowAddFilter = true,
}) {
  if (
    typeof tagOptions !== "undefined" &&
    tagOptions &&
    tagOptions.length > 0
  ) {
    return (
      <div className="space-y-3">
        <div className="text-sm text-gray-600 mb-2">
          Select a tag to filter rows in this table
        </div>
        <select
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white"
          value={selectedTag}
          onChange={(e) => onTagChange(e.target.value)}
        >
          <option value="">-- All tags --</option>
          {Array.isArray(tagOptions) && tagOptions.length > 0 ? (
            tagOptions.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))
          ) : (
            <option value="" disabled>
              -- No tags available --
            </option>
          )}
        </select>
      </div>
    );
  }

  if (filters.length === 0 && !allowAddFilter) {
    return null;
  }

  if (filters.length === 0) {
    return (
      <div className="text-center py-8">
        <Filter className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500 text-sm mb-4">
          No filters applied
        </p>
        {allowAddFilter && (
          <button
            onClick={onAddFilter}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Filter
          </button>
        )}
      </div>
    );
  }

  return (
    <>
      {filters.map((filter, index) => (
        <FilterItem
          key={filter.id}
          filter={filter}
          index={index}
          columns={columns}
          onFieldChange={(id, field) =>
            onFilterChange(id, "field", field)
          }
          onOperatorChange={(id, operator) =>
            onFilterChange(id, "operator", operator)
          }
          onValueChange={(id, value) =>
            onFilterChange(id, "value", value)
          }
          onRemove={onRemoveFilter}
          getFilterableFields={getFilterableFields}
          getFieldType={getFieldType}
          getOperatorsByType={getOperatorsByType}
        />
      ))}

      {allowAddFilter && (
        <button
          onClick={onAddFilter}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-white hover:bg-gray-50 border-2 border-dashed border-gray-300 hover:border-blue-400 text-gray-700 hover:text-blue-700 rounded-lg text-sm font-medium transition-all"
        >
          <Plus className="w-4 h-4" />
          Add Another Filter
        </button>
      )}
    </>
  );
}

export default FilterBuilder;