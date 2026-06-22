import React, { useState, useRef, useEffect } from "react";
import { X, Filter, ChevronUp, ChevronDown } from "lucide-react";
import ColumnSelector from "../components/filters/ColumnSelector";
import FilterBuilder from "../components/filters/FilterBuilder";

// FilterPanel - Advanced filtering component for tables
function FilterPanel({
  isOpen,
  onClose,
  columns,
  selectedColumns,
  onColumnsChange,
  filters,
  onFiltersChange,
  onApply,
  onClear,
  showColumns = true,
  showFilters = true,
  tagOptions = [],
  createdByOptions = [],
  allowAddFilter = true,
  defaultColumnsExpanded = false, // ← Products passes true so columns show open by default
}) {
  const panelRef = useRef(null);
  const [tempColumns, setTempColumns] = useState(selectedColumns || []);
  const [tempFilters, setTempFilters] = useState(filters || []);
  const [selectedPipeline, setSelectedPipeline] = useState("all");
  const [selectedCreatedBy, setSelectedCreatedBy] = useState("all");
  const [columnsCollapsed, setColumnsCollapsed] = useState(!defaultColumnsExpanded);

  const [tempSelectedTag, setTempSelectedTag] = useState("");

  // initialize selected tag from incoming filters if present
  useEffect(() => {
    const tagFilter = (filters || []).find(f => String(f.field).toLowerCase().includes("tag"));
    setTempSelectedTag(tagFilter ? tagFilter.value : "");
  }, [filters]);

  // Reset columns expand/collapse state each time the panel is (re)opened,
  // so Products always opens expanded and Accounts/Contacts always opens collapsed.
  useEffect(() => {
    if (isOpen) {
      setColumnsCollapsed(!defaultColumnsExpanded);
    }
  }, [isOpen, defaultColumnsExpanded]);

  // Prefer a tags column if present; otherwise fallback to a generic 'tags' field
  const tagColumn = (columns && columns.find(c => String(c.key).toLowerCase().includes("tag"))) || { key: "tags", label: "Tags" };

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        // ignore clicks on any "Filters" trigger button — let its own onClick handle the toggle
        if (event.target.closest('[data-filter-trigger]')) return;
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen, onClose]);

  // Sync temp state with props
  useEffect(() => {
    if (selectedColumns && selectedColumns.length > 0) {
      setTempColumns(selectedColumns);
    } else if (columns && columns.length > 0) {
      const defaultColumns = columns
        .filter(col => {
          if (!col || !col.key) return false;
          const keyLower = String(col.key).toLowerCase().trim().replace(/\s+/g, '');
          return !(
            keyLower === 'id' ||
            keyLower.endsWith('id') ||
            keyLower.includes('accountid') ||
            keyLower.includes('contactid') ||
            keyLower.includes('productid') ||
            keyLower.includes('dealid')
          );
        })
        .map(c => c.key);
      setTempColumns(defaultColumns);
    } else {
      setTempColumns([]);
    }
    setTempFilters(filters || []);

    const pipelineFilter = (filters || []).find(
      (f) => String(f.field || "").toLowerCase().trim() === "dealpipeline"
    );
    const createdByFilter = (filters || []).find(
      (f) => String(f.field || "").toLowerCase().trim() === "createdby"
    );

    setSelectedPipeline(pipelineFilter?.value || "all");
    setSelectedCreatedBy(createdByFilter?.value || "all");
  }, [selectedColumns, filters, columns, isOpen]);

  const handleColumnToggle = (colKey) => {
    setTempColumns(prev =>
      prev.includes(colKey)
        ? prev.filter(k => k !== colKey)
        : [...prev, colKey]
    );
  };

  const handleSelectAllColumns = () => {
    if (!columns) return;
    setTempColumns(columns.map(c => c.key));
  };

  const getFilterableFields = () => {
    if (!columns || !Array.isArray(columns)) return [];
    return columns.filter(col => {
      if (!col || !col.key) return false;
      const keyLower = String(col.key).toLowerCase().trim().replace(/\s+/g, '');
      if (keyLower === 'id') return false;
      if (keyLower.endsWith('id')) return false;
      if (keyLower.includes('accountid')) return false;
      if (keyLower.includes('contactid')) return false;
      if (keyLower.includes('productid')) return false;
      if (keyLower.includes('dealid')) return false;
      return true;
    });
  };

  const handleAddFilter = () => {
    const filterableFields = getFilterableFields();
    const firstKey = filterableFields.length > 0 ? filterableFields[0].key : (tagColumn.key || "");
    const newFilter = {
      id: Date.now(),
      field: firstKey,
      operator: "contains",
      value: "",
      dataType: getFieldType(firstKey)
    };
    setTempFilters([...tempFilters, newFilter]);
  };

  const handleRemoveFilter = (filterId) => {
    setTempFilters(tempFilters.filter(f => f.id !== filterId));
  };

  const handleFilterChange = (filterId, field, value) => {
    setTempFilters(tempFilters.map(f => {
      if (f.id === filterId) {
        if (field === 'field') {
          return { ...f, [field]: value, dataType: getFieldType(value), operator: getDefaultOperator(getFieldType(value)) };
        }
        return { ...f, [field]: value };
      }
      return f;
    }));
  };

  const getFieldType = (fieldKey) => {
    const field = columns.find(c => c.key === fieldKey);
    if (!field) return "text";

    const key = fieldKey.toLowerCase();
    if (key.includes("id") && (key === "id" || key.endsWith("id"))) return null;
    if (key.includes("date") || key.includes("createdat") || key.includes("updatedat") ||
      key.includes("contacted") || key.includes("assigned")) return "date";
    if (key.includes("amount") || key.includes("price") || key.includes("quantity") ||
      key.includes("age")) return "number";
    if (key.includes("status") || key.includes("type") || key.includes("stage") ||
      key.includes("category") || key.includes("active")) return "select";
    if (key.includes("tags")) return "tags";
    return "text";
  };

  const getDefaultOperator = (dataType) => {
    switch (dataType) {
      case "text": return "contains";
      case "number": return "equals";
      case "date": return "equals";
      case "select": return "equals";
      case "tags": return "contains";
      default: return "contains";
    }
  };

  const getOperatorsByType = (dataType) => {
    switch (dataType) {
      case "text":
        return [
          { value: "contains", label: "Contains" },
          { value: "notContains", label: "Does not contain" },
          { value: "equals", label: "Equals" },
          { value: "notEquals", label: "Not equals" },
          { value: "startsWith", label: "Starts with" },
          { value: "endsWith", label: "Ends with" },
          { value: "isEmpty", label: "Is empty" },
          { value: "isNotEmpty", label: "Is not empty" }
        ];
      case "number":
        return [
          { value: "equals", label: "Equals" },
          { value: "notEquals", label: "Not equals" },
          { value: "greaterThan", label: "Greater than" },
          { value: "lessThan", label: "Less than" },
          { value: "greaterOrEqual", label: "Greater or equal" },
          { value: "lessOrEqual", label: "Less or equal" },
          { value: "isEmpty", label: "Is empty" },
          { value: "isNotEmpty", label: "Is not empty" }
        ];
      case "date":
        return [
          { value: "equals", label: "Equals" },
          { value: "notEquals", label: "Not equals" },
          { value: "before", label: "Before" },
          { value: "after", label: "After" },
          { value: "isEmpty", label: "Is empty" },
          { value: "isNotEmpty", label: "Is not empty" }
        ];
      case "select":
      case "tags":
        return [
          { value: "equals", label: "Equals" },
          { value: "notEquals", label: "Not equals" },
          { value: "contains", label: "Contains" },
          { value: "notContains", label: "Does not contain" },
          { value: "isEmpty", label: "Is empty" },
          { value: "isNotEmpty", label: "Is not empty" }
        ];
      default:
        return [{ value: "contains", label: "Contains" }];
    }
  };

  const handleApply = () => {
    let outFilters = tempFilters;
    const hasDealPipelineColumn = columns?.some(c => c.key === "dealPipeline");

    console.log("[FilterPanel.handleApply] Before processing:", {
      tempFilters,
      tagOptions: tagOptions?.length || 0,
      hasDealPipelineColumn,
      tempSelectedTag,
      selectedPipeline,
      selectedCreatedBy,
    });

    if (hasDealPipelineColumn) {
      outFilters = [];
      if (selectedPipeline && selectedPipeline !== "all") {
        outFilters.push({
          id: Date.now(),
          field: "dealPipeline",
          operator: "equals",
          value: selectedPipeline,
          dataType: "select",
        });
      }
      if (selectedCreatedBy && selectedCreatedBy !== "all") {
        outFilters.push({
          id: Date.now() + 1,
          field: "createdBy",
          operator: "equals",
          value: selectedCreatedBy,
          dataType: "text",
        });
      }
    } else if (tagOptions && tagOptions.length > 0) {
      if (tempSelectedTag) {
        const tagField =
          (columns &&
            columns.find(c =>
              String(c.key).toLowerCase().includes("tag")
            )?.key) || "tags";

        outFilters = [
          {
            id: Date.now(),
            field: tagField,
            operator: "contains",
            value: tempSelectedTag,
            dataType: getFieldType(tagField),
          },
        ];
      } else {
        outFilters = [];
      }
    }

    console.log("[FilterPanel.handleApply] After processing:", { outFilters });

    if (showColumns && typeof onColumnsChange === "function") {
      onColumnsChange(tempColumns);
    }
    if (typeof onFiltersChange === "function") {
      console.log("[FilterPanel.handleApply] Calling onFiltersChange with:", outFilters);
      onFiltersChange(outFilters);
    }
    if (typeof onApply === "function") onApply();
    onClose();
  };

  const handleClearAll = () => {
    if (showColumns && columns) setTempColumns(columns.map(c => c.key));
    setTempFilters([]);
    setSelectedPipeline("all");
    setSelectedCreatedBy("all");
    if (typeof onClear === "function") onClear();
  };

  if (!isOpen) return null;

  const activeFilterCount = tempFilters.filter(f => f.value !== "").length;

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-[9998]" onClick={onClose} />
      <div
        ref={panelRef}
        className="fixed top-0 right-0 h-full w-[92vw] sm:w-[420px] bg-white shadow-2xl z-[9999] flex flex-col animate-in slide-in-from-right duration-200 max-w-[calc(100vw-32px)] overflow-hidden drop-shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="Filter panel"
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-blue-50 to-blue-100">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-blue-600" />
            <div>
              <h3 className="font-semibold text-gray-800 text-base">Filters & Columns</h3>
              <p className="text-xs text-gray-500">Refine your table using filters and visible columns</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 hover:bg-white rounded-lg p-1.5 transition-colors"
            aria-label="Close filter panel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {showColumns && (
            <div className="space-y-3">
              {/* Entire row is now a clickable "field" — background + border make it
                  obvious it's expandable, not just the small chevron icon. */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => setColumnsCollapsed(!columnsCollapsed)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setColumnsCollapsed(!columnsCollapsed);
                  }
                }}
                aria-expanded={!columnsCollapsed}
                className="w-full flex items-center justify-between gap-3 px-3 py-3 bg-gray-50 hover:bg-gray-100 border border-gray-200 hover:border-gray-300 rounded-xl cursor-pointer select-none transition-colors"
              >
                <div className="text-left">
                  <h4 className="text-sm font-semibold text-gray-800">Columns</h4>
                  <p className="text-xs text-gray-500">
                    {columnsCollapsed
                      ? "Tap to choose which columns are visible"
                      : "Choose which columns you want visible in the table"}
                  </p>
                </div>
                <div className="flex items-center justify-center w-7 h-7 rounded-full bg-white border border-gray-200 text-blue-600 flex-shrink-0">
                  {columnsCollapsed ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronUp className="w-4 h-4" />
                  )}
                </div>
              </div>

              {!columnsCollapsed && (
                <div className="space-y-3 pl-1">
                  <div className="flex justify-end">
                    <button
                      onClick={handleSelectAllColumns}
                      className="text-sm font-medium text-blue-600 hover:text-blue-700"
                      type="button"
                    >
                      Select All
                    </button>
                  </div>
                  <ColumnSelector
                    columns={columns}
                    selectedColumns={tempColumns}
                    onColumnToggle={handleColumnToggle}
                    onSelectAll={handleSelectAllColumns}
                  />
                </div>
              )}
            </div>
          )}

          {showFilters && (
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-semibold text-gray-800">Filters</h4>
                {!columns?.some(c => c.key === "Name") && (
                  <p className="text-xs text-gray-500">
                    Add rules to narrow the table results.
                  </p>
                )}
              </div>
              {columns?.some(c => c.key === "dealPipeline") ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">Deal Pipeline</label>
                      <select
                        value={selectedPipeline}
                        onChange={(e) => setSelectedPipeline(e.target.value)}
                        className="w-full border border-gray-300 rounded-xl px-3 py-2 bg-white"
                      >
                        <option value="all">All</option>
                        <option value="Hardware Product Sale">Hardware Product Sale</option>
                        <option value="Default Pipeline">Default Pipeline</option>
                        <option value="Software Product Sale">Software Product Sale</option>
                        <option value="Software/Hardware Pipeline">Software/Hardware Pipeline</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">Created By</label>
                      <select
                        value={selectedCreatedBy}
                        onChange={(e) => setSelectedCreatedBy(e.target.value)}
                        className="w-full border border-gray-300 rounded-xl px-3 py-2 bg-white"
                      >
                        <option value="all">All Users</option>
                        {createdByOptions && createdByOptions.length > 0 ? (
                          createdByOptions.map((creator) => (
                            <option key={creator} value={creator}>{creator}</option>
                          ))
                        ) : null}
                      </select>
                    </div>
                  </div>
                </div>
              ) : (
                <FilterBuilder
                  filters={tempFilters}
                  columns={columns}
                  tagOptions={tagOptions}
                  selectedTag={tempSelectedTag}
                  onAddFilter={handleAddFilter}
                  onRemoveFilter={handleRemoveFilter}
                  onFilterChange={handleFilterChange}
                  onTagChange={setTempSelectedTag}
                  getFilterableFields={getFilterableFields}
                  getFieldType={getFieldType}
                  getOperatorsByType={getOperatorsByType}
                  allowAddFilter={allowAddFilter}
                />
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between bg-gray-50 rounded-b-xl gap-2">
          <button
            onClick={handleClearAll}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Clear All
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white hover:bg-gray-100 border border-gray-300 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              className="px-5 py-2 text-sm font-semibold bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-lg transition-all shadow-sm hover:shadow-md"
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export default FilterPanel;