import React, { useMemo, useState, useEffect, useCallback, useContext } from "react";
import { FiTrash2 } from "react-icons/fi";
import AuthContext from "../auth/AuthContext";
import { applyFilters } from "../utils/filterUtils";
import { exportTableToExcel } from "../utils/excelExport";
import { useSearchParams } from "react-router-dom";

// Get backend host from environment variables, use port 7229
import apiClient from "../api/client";

async function fetchApi(url, options) {
  try {
    if (/^https?:\/\//i.test(url)) return window.fetch(url, options);
    const path = url.startsWith("/") ? url : `/${url}`;
    const method = (options && options.method) || "GET";
    if (method === "GET") {
      const res = await apiClient.get(path, { params: options && options.params });
      return { ok: res.status >= 200 && res.status < 300, status: res.status, json: async () => res.data, text: async () => JSON.stringify(res.data) };
    }

    const res = await apiClient.request({ url: path, method, data: options && options.body, headers: options && options.headers });
    return { ok: res.status >= 200 && res.status < 300, status: res.status, json: async () => res.data, text: async () => JSON.stringify(res.data) };
  } catch (err) {
    return Promise.reject(err);
  }
}

const fetch = fetchApi;

// Pure helper — defined outside the component so it has a stable reference
function getActiveValue(v) {
  if (v === "Yes" || v === "yes" || v === "YES") return "Yes";
  if (v === "No" || v === "no" || v === "NO") return "No";
  if (v === true || v === "true" || v === "True" || v === 1 || v === "1") return "Yes";
  return "No";
}

function Product({
  products,
  onToast,
  onRefetch,
  categoryFilter,
  selectedColumns,
  highlightMatch,
  search,
  filters,
}) {
  console.log("[Product] Component received props:", { filters, search, onRefetch: typeof onRefetch });
  // Get user role from AuthContext
  const auth = useContext(AuthContext);
  const userRole = auth?.getRole?.();
  const isAdmin = userRole === "Admin" || userRole === "admin";

  // Get the first letter from product name for circle
  function getInitials(name) {
    if (!name) return "?";
    return name.trim().charAt(0).toUpperCase();
  }

  // Generate a light background color based on product name
  function getColorFromString(str, alpha = 0.35, lightness = 85) {
    if (!str) return `hsla(210, 70%, 90%, ${alpha})`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = hash % 360;
    return `hsla(${hue}, 70%, ${lightness}%, ${alpha})`;
  }

  // Generate a darker version of the color for text
  function getDarkerColorFromString(str, alpha = 1, lightness = 45) {
    if (!str) return `hsla(210, 70%, 45%, ${alpha})`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = hash % 360;
    return `hsla(${hue}, 70%, ${lightness}%, ${alpha})`;
  }

  // format a value as date-only (YYYY-MM-DD) using local timezone
  function formatDateOnly(val) {
    if (val === null || val === undefined || val === "") return "";
    const d = new Date(val);
    if (isNaN(d.getTime())) return String(val);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const date = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${date}`;
  }

  // Helper to read fields with case-insensitive fallback
  const getField = (obj, key) => {
    if (!obj) return undefined;
    if (key in obj) return obj[key];
    const lower = key.charAt(0).toLowerCase() + key.slice(1);
    if (lower in obj) return obj[lower];
    const alt = key.toLowerCase();
    return obj[alt];
  };

  // fields to render as date-only
  const dateFields = new Set(["createdAt"]);

  // TABLE

  // Define the table columns once using useMemo
  const allColumns = useMemo(
    () => [
      { key: "name", label: "Name" },
      { key: "category", label: "Category" },
      { key: "active", label: "Active" },
      { key: "baseCurrencyAmount", label: "Base Currency Amount" },
      { key: "createdAt", label: "Created At" },
      { key: "createdBy", label: "Created By" },
      { key: "updatedAt", label: "Updated At" },
      { key: "updatedBy", label: "Updated By" },
    ],
    []
  );

  const filteredProducts = useMemo(() => {
    return applyFilters(products || [], filters || []);
  }, [products, filters]);

  // Filter columns based on selectedColumns prop
  const columns = useMemo(() => {
    if (!selectedColumns || selectedColumns.length === 0) return allColumns;
    return allColumns.filter((col) => selectedColumns.includes(col.key));
  }, [allColumns, selectedColumns]);

  // Log when filters prop changes
  useEffect(() => {
    console.log("[Product] Filters prop changed:", filters);
  }, [filters]);

  // STATE MANAGEMENT
  useEffect(() => {
    setData(filteredProducts || []);
    setCurrentPage(1);
  }, [filteredProducts]);

  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 100;
  const [selected, setSelected] = useState(() => new Set());
  const [data, setData] = useState(products || []);
  const [isEditing, setIsEditing] = useState(false);
  const [editIndex, setEditIndex] = useState(null);
  const [editForm, setEditForm] = useState({
    name: "",
    active: "Yes",
    baseCurrencyAmount: "",
    category: "",
    createdAt: "",
    createdBy: "",
    updatedAt: "",
    updatedBy: "",
  });
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteCount, setDeleteCount] = useState(0);
  const [selectedProductDetails, setSelectedProductDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState(null);
  const [dataLoading, setDataLoading] = useState(false);

  // Check if active is Yes
  const isActiveYes = (v) => {
    return getActiveValue(v) === "Yes";
  };

  // Convert any value to "Yes" or "No" for API
  const toYesNo = (v) => {
    return getActiveValue(v);
  };

  // Handler to show product details in slide-in
  const handleShowProductDetails = useCallback(async (productId) => {
    if (!productId && productId !== 0) return;
    setDetailsLoading(true);
    setDetailsError(null);
    setSelectedProductDetails(null);
    try {
      const res = await fetch(`/Products/${encodeURIComponent(productId)}`);
      if (!res.ok) {
        setDetailsError(`Failed to load details: ${res.status}`);
        return;
      }
      const data = await res.json();
      if (data) {
        data.active = getActiveValue(data.active);
      }
      setSelectedProductDetails(data);
    } catch (err) {
      setDetailsError("Error fetching product details");
    } finally {
      setDetailsLoading(false);
    }
  }, []);

  const handleCloseProductDetails = () => {
    setSelectedProductDetails(null);
    setDetailsError(null);
    setDetailsLoading(false);
  };

  // Handle opening product from query parameter
  const [searchParams] = useSearchParams();
  
  useEffect(() => {
    const queryProductId = searchParams.get('id');
    if (queryProductId) {
      handleShowProductDetails(queryProductId);
    }
  }, [searchParams, handleShowProductDetails]);

  // API CALLS
  const fetchAllCategories = useCallback(async () => {
    try {
      await fetch(`/Products`);
    } catch (_) { }
  }, []);

  const fetchProducts = useCallback(async (category) => {
    setDataLoading(true);
    try {
      let url = `/Products`;
      if (category && category !== "All") {
        url = `/Products/category/${encodeURIComponent(category)}`;
      }
      const res = await fetch(url);
      const json = await res.json();
      const normalizedData = Array.isArray(json) ? json.map(item => ({
        ...item,
        active: getActiveValue(item.active)
      })) : [];
      setData(normalizedData);
    } catch (_) { }
    finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts(categoryFilter);
  }, [categoryFilter, fetchProducts]);

  useEffect(() => {
    const handleProductAdded = () => {
      fetchProducts(categoryFilter);
    };

    window.addEventListener("productAdded", handleProductAdded);

    return () => {
      window.removeEventListener("productAdded", handleProductAdded);
    };
  }, [categoryFilter, fetchProducts]);

  useEffect(() => {
    fetchProducts(categoryFilter);
    fetchAllCategories();
  }, [categoryFilter, fetchProducts, fetchAllCategories]);

  useEffect(() => {
    const normalizedProducts = Array.isArray(products) ? products.map(p => ({
      ...p,
      active: getActiveValue(p.active)
    })) : [];
    setData(normalizedProducts);
  }, [products]);

  // SELECTION LOGIC
  const allSelected = data.length > 0 && selected.size === data.length;
  const someSelected = selected.size > 0 && !allSelected;

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(data.map((_, idx) => idx)));
  };

  const toggleRow = (idx) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  // SORTING LOGIC
  const handleSort = (key) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
      }
      return { key, direction: "asc" };
    });
  };

  // CRUD OPERATIONS
  const refetch = async () => {
    await fetchProducts(categoryFilter);
    try { onRefetch?.(); } catch (_) { }
  };

  const exportCsv = () => {
    try {
      exportTableToExcel({
        data,
        selected,
        columns,
        title: "Products Export",
        filename: "products_export.xlsx",
        getField,
      });
      onToast && onToast(`Exported ${selected.size} products to Excel`, "success");
    } catch (error) {
      onToast && onToast("Failed to export products", "error");
      console.error("Export error:", error);
    }
  };

  const handleDeleteClick = () => {
    const indexes = Array.from(selected);
    const ids = indexes
      .map((i) => data[i]?.productId ?? data[i]?.ProductId ?? null)
      .filter((id) => id !== null && id !== undefined);
    if (ids.length === 0) return;
    setDeleteCount(ids.length);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    const indexes = Array.from(selected);
    const ids = indexes
      .map((i) => data[i]?.productId ?? data[i]?.ProductId ?? null)
      .filter((id) => id !== null && id !== undefined);
    setShowDeleteModal(false);
    if (ids.length === 0) return;
    try {
      await Promise.all(
        ids.map((id) =>
          fetch(`/Products/${encodeURIComponent(id)}`, {
            method: "DELETE",
          })
        )
      );
      await refetch();
      setSelected(new Set());
      handleCloseProductDetails();
      if (onToast) onToast(`Deleted ${ids.length} products`, "success");
    } catch (e) {
      if (onToast) onToast("Failed to delete products", "error");
    }
  };

  const updateRow = async (index, updated) => {
    const productId = data[index]?.productId ?? data[index]?.ProductId;
    if (!productId) return;
    try {
      const payload = { ...updated };
      payload.active = toYesNo(payload.active);

      const res = await fetch(`/Products/${encodeURIComponent(productId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Update failed");
      await refetch();
      if (onToast) onToast("Product updated", "success");
    } catch (_) {
      if (onToast) onToast("Failed to update", "error");
    }
  };

  const submitEdit = async (e) => {
    e.preventDefault();
    await updateRow(editIndex, editForm);
    setIsEditing(false);
    setEditIndex(null);
  };

  // SORTING DATA
  const sortedData = useMemo(() => {
    if (!sortConfig.key) return data;
    const sorted = [...data].sort((a, b) => {
      const aVal = a[sortConfig.key] ?? "";
      const bVal = b[sortConfig.key] ?? "";
      if (!isNaN(Number(aVal)) && !isNaN(Number(bVal)) && aVal !== "" && bVal !== "") {
        return sortConfig.direction === "asc" ? Number(aVal) - Number(bVal) : Number(bVal) - Number(aVal);
      }
      return sortConfig.direction === "asc"
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });
    return sorted;
  }, [data, sortConfig]);

  const totalItems = sortedData.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedData = sortedData.slice(startIndex, endIndex);

  const panelOpen = !!(detailsLoading || detailsError || selectedProductDetails);
  return (
    <div className="flex h-full w-full overflow-hidden">
      <div className="relative flex overscroll-none font-[poppins,sans-serif] flex-col items-start h-full overflow-hidden flex-1 w-full">
      {dataLoading && (
        <div className="absolute inset-0 z-40 bg-white/75 backdrop-blur-sm flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
        </div>
      )}
      {selected.size > 0 && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 bg-indigo-50 rounded-lg sm:rounded-xl px-4 sm:px-6 py-3 sm:py-3.5 shadow-sm border border-indigo-100 mb-4 w-full backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center font-semibold text-sm">
              {selected.size}
            </div>
            <span className="text-sm sm:text-base text-gray-700">selected</span>
          </div>
          <div className="hidden sm:flex flex-1" />
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              className="flex-1 sm:flex-none bg-white border border-gray-300 rounded-lg px-3 sm:px-4 py-2 text-xs sm:text-sm text-gray-700 font-medium hover:bg-gray-50 hover:shadow-sm transition-all duration-200"
              onClick={exportCsv}
            >
              Export
            </button>
            {isAdmin && (
              <button
                aria-label="Delete selected"
                className="flex-1 sm:flex-none bg-white border border-red-200 text-red-600 rounded-lg px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium hover:bg-red-50 transition-all duration-200"
                onClick={handleDeleteClick}
              >
                <FiTrash2 className="inline mr-1" /> Delete
              </button>
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white w-full sm:w-96 rounded-2xl shadow-2xl p-6 transform animate-in zoom-in-95 duration-200">
            <div className="mb-6 text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h4 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">Confirm Delete</h4>
              <p className="text-sm sm:text-base text-gray-600">
                Are you sure you want to delete <span className="font-semibold text-gray-900">{deleteCount}</span> product{deleteCount > 1 ? "s" : ""}?
              </p>
            </div>
            <div className="flex gap-3 justify-center">
              <button type="button" onClick={() => setShowDeleteModal(false)} className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium text-sm transition-all duration-200">
                Cancel
              </button>
              <button type="button" onClick={confirmDelete} className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium text-sm transition-all duration-200">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Products Table */}
      <div className="w-full flex flex-col rounded-xl border border-gray-200 shadow-sm bg-white flex-1 min-h-0">
        <div className="flex-1 min-h-0 overflow-x-auto overflow-y-auto relative visible-scrollbar">
          <table className="min-w-max w-full border-collapse">
            <thead className="sticky top-0 z-30 bg-white shadow-sm">
              <tr>
                <th className="sticky left-0 z-20 min-w-40 sm:min-w-12 w-10 sm:w-12 px-2 sm:px-3 py-3 text-center bg-gray-50">
                  <input
                    type="checkbox"
                    aria-label="Select all"
                    checked={allSelected}
                    ref={(el) => { if (el) el.indeterminate = someSelected; }}
                    onChange={toggleAll}
                    className="w-3 h-3 sm:w-4 sm:h-4 rounded border-gray-300 text-indigo-600 cursor-pointer"
                  />
                </th>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={`px-4 py-3 text-left text-xs sm:text-sm font-semibold text-gray-700 select-none cursor-pointer hover:bg-gray-100 transition-colors duration-150 whitespace-nowrap ${col.key === "name" ? "sticky left-10 sm:left-12 z-30 min-w-40 bg-gray-50" : "min-w-20 sm:min-w-32"
                      }`}
                    onClick={() => handleSort(col.key)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="truncate">{col.label}</span>
                      {sortConfig.key === col.key && (
                        <span className="text-indigo-600 flex-shrink-0">{sortConfig.direction === "asc" ? "↑" : "↓"}</span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedData.map((product, index) => {
                const globalIndex = (currentPage - 1) * itemsPerPage + index;
                return (
                  <tr key={product?.productId || product?.name || index} className={`transition-all duration-150 hover:bg-gray-50 ${selected.has(globalIndex) ? "bg-indigo-50" : "bg-white"}`}>
                    <td className="sticky left-0 bg-inherit text-center min-w-10 sm:min-w-12 w-10 sm:w-12 px-2 sm:px-3 py-3">
                      <input
                        type="checkbox"
                        aria-label={`Select row ${globalIndex + 1}`}
                        checked={selected.has(globalIndex)}
                        onChange={() => toggleRow(globalIndex)}
                        className="w-3 h-3 sm:w-4 sm:h-4 rounded border-gray-300 text-indigo-600 cursor-pointer"
                      />
                    </td>
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={`px-4 py-3 text-left text-xs sm:text-sm text-gray-700 ${col.key === "name" ? "sticky left-10 sm:left-12 min-w-40 bg-white max-w-xs overflow-hidden" : "max-w-xs truncate overflow-hidden"
                          }`}
                      >
                        {col.key === "active" ? (
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${isActiveYes(product.active) ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                            }`}>
                            {product.active || "No"}
                          </span>
                        ) : col.key === "name" ? (
                          <a
                            href={`/dashboard/Products?id=${product.productId || product.ProductId}`}
                            onClick={(e) => {
                              e.preventDefault();
                              handleShowProductDetails(product.productId || product.ProductId);
                            }}
                            className="flex items-center gap-2 font-medium text-indigo-600 cursor-pointer hover:text-indigo-700 transition-colors duration-150 group w-full min-w-0"
                          >
                            <span
                              className="inline-flex items-center justify-center w-8 h-8 rounded-lg shadow-sm font-semibold text-sm transition-transform duration-200 group-hover:scale-110 flex-shrink-0"
                              style={{
                                background: getColorFromString(product.name, 0.35, 85),
                                color: getDarkerColorFromString(product.name, 1, 45),
                              }}
                              title={product.name}
                            >
                              {getInitials(product.name)}
                            </span>
                            <span className="group-hover:underline truncate min-w-0">
                              {highlightMatch ? highlightMatch(product.name, search) : product.name}
                            </span>
                          </a>
                        ) : col.key === "baseCurrencyAmount" ? (
                          <span className="font-semibold">
                            {(() => {
                              const val = product.baseCurrencyAmount;
                              if (typeof val === "number" && !isNaN(val)) return `₹${val.toLocaleString("en-IN")}`;
                              const num = Number(val);
                              return !isNaN(num) ? `₹${num.toLocaleString("en-IN")}` : (highlightMatch ? highlightMatch(val, search) : val);
                            })()}
                          </span>
                        ) : (
                          (() => {
                            const raw = product[col.key];
                            const val = dateFields.has(col.key) ? formatDateOnly(raw) : raw;
                            return highlightMatch && typeof val === "string" ? highlightMatch(val, search) : val;
                          })()
                        )}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="sticky bottom-0 flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t border-gray-200 bg-white shadow-sm">
          <div className="text-xs sm:text-sm text-gray-600">
            <span className="font-medium">{Math.min(startIndex + 1, totalItems)}</span>-<span className="font-medium">{Math.min(endIndex, totalItems)}</span> of <span className="font-medium">{totalItems}</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1} className="px-3 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-indigo-50 disabled:opacity-40">
              <span>←</span> <span className="hidden sm:inline">Prev</span>
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const pageNum = Math.max(1, currentPage - 2) + i;
                if (pageNum > totalPages) return null;
                return (
                  <button key={pageNum} onClick={() => setCurrentPage(pageNum)} className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${pageNum === currentPage ? 'bg-indigo-600 text-white shadow-sm' : 'border border-gray-300 text-gray-700 hover:bg-gray-100'
                    }`}>
                    {pageNum}
                  </button>
                );
              })}
              {totalPages > 5 && currentPage < totalPages - 2 && <span className="text-gray-400 px-2 font-medium">...</span>}
            </div>
            <button onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages} className="px-3 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-indigo-50 disabled:opacity-40">
              <span className="hidden sm:inline">Next</span> <span>→</span>
            </button>
            <span className="text-xs sm:text-sm text-gray-600 font-medium">
              Page <span className="font-bold text-indigo-600">{currentPage}</span>/<span className="font-bold text-gray-700">{totalPages}</span>
            </span>
          </div>
        </div>
      </div>

      </div>
      {/* Product Details Slide-in Popup */}
      {(detailsLoading || detailsError || selectedProductDetails) && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40" onClick={handleCloseProductDetails} />
          <div className="fixed right-0 top-0 h-full w-[60%] bg-white shadow-2xl z-50 flex flex-col overflow-hidden border-l border-gray-200 animate-in slide-in-from-right duration-300 text-sm">
            <div className="flex items-center gap-5 p-8 border-b border-gray-200/80 bg-white backdrop-blur-sm">
              <div className="w-16 h-16 rounded-full flex items-center justify-center font-semibold text-2xl shadow-xl transform hover:scale-105 transition-transform duration-200" style={{ background: "linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)", color: "white" }}>
                {selectedProductDetails?.name ? String(selectedProductDetails.name).charAt(0).toUpperCase() : "P"}
              </div>
              <div className="flex flex-col gap-1 flex-1">
                <div className="font-normal text-gray-900 text-lg">{selectedProductDetails?.name || "Product"}</div>
                <div className="text-gray-600 flex items-center gap-2">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                  Product Details
                </div>
              </div>
              <button className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full w-12 h-12 flex items-center justify-center transition-all duration-200" onClick={handleCloseProductDetails}>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 visible-scrollbar">
              <form className="space-y-8" onSubmit={async (e) => {
                e.preventDefault();
                if (!selectedProductDetails) return;
                try {
                  const payload = { ...selectedProductDetails };
                  payload.active = toYesNo(payload.active);
                  const res = await fetch(`/Products/${selectedProductDetails.productId}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                  });
                  if (res.ok) {
                    await refetch();
                    if (onToast) onToast("Product updated successfully", "success");
                    handleCloseProductDetails();
                  } else {
                    if (onToast) onToast("Failed to update product", "error");
                  }
                } catch (err) {
                  if (onToast) onToast("Error updating product", "error");
                }
              }}>
                {detailsLoading && (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                  </div>
                )}
                {detailsError && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
                    <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-red-700 font-normal">{detailsError}</p>
                  </div>
                )}
                {selectedProductDetails && (
                  <>
                    <div className="bg-white rounded-2xl p-6">
                      <div className="flex items-center gap-2 mb-5">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                          </svg>
                        </div>
                        <h3 className="font-normal text-gray-900 text-lg">Product Information</h3>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="flex flex-col gap-2">
                          <label className="font-normal text-gray-700 text-xs flex items-center gap-2">
                            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                            </svg>
                            Name
                          </label>
                          <input type="text" className="w-full rounded-xl px-4 py-3.5 text-gray-800 bg-gray-100 border-2 border-gray-200 outline-none cursor-not-allowed" value={selectedProductDetails.name || ""} disabled />
                        </div>

                        {/* Active Dropdown - Shows Yes/No */}
                        <div className="flex flex-col gap-2">
                          <label className="font-normal text-gray-700 text-sm flex items-center gap-2">
                            <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Active
                          </label>
                          <div className="relative">
                            <select
                              className="w-full rounded-xl pl-4 pr-10 py-3.5 text-gray-800 bg-gray-50 border-2 border-gray-200 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 outline-none transition-all duration-150 appearance-none cursor-pointer"
                              value={selectedProductDetails.active || "Yes"}
                              onChange={(e) =>
                                setSelectedProductDetails({
                                  ...selectedProductDetails,
                                  active: e.target.value,
                                })
                              }
                            >
                              <option value="Yes">Yes</option>
                              <option value="No">No</option>
                            </select>
                            <svg className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </div>

                        <div className="flex flex-col gap-2">
                          <label className="font-normal text-gray-700 text-sm flex items-center gap-2">
                            <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Base Currency Amount
                          </label>
                          <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-normal">₹</span>
                            <input type="number" step="1" min="0" className="w-full rounded-xl pl-10 pr-4 py-3.5 text-gray-800 bg-gray-50 border-2 border-gray-200 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 outline-none transition-all duration-150 font-normal"
                              value={selectedProductDetails.baseCurrencyAmount || ""}
                              onChange={(e) => setSelectedProductDetails({ ...selectedProductDetails, baseCurrencyAmount: e.target.value })}
                            />
                          </div>
                        </div>

                        <div className="flex flex-col gap-2">
                          <label className="font-normal text-gray-700 text-sm flex items-center gap-2">
                            <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                            </svg>
                            Category
                          </label>
                          <div className="relative">
                            <select className="w-full rounded-xl pl-4 pr-10 py-3.5 text-gray-800 bg-gray-50 border-2 border-gray-200 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 outline-none transition-all duration-150 appearance-none cursor-pointer"
                              value={selectedProductDetails.category || ""}
                              onChange={(e) => setSelectedProductDetails({ ...selectedProductDetails, category: e.target.value })}
                            >
                              <option value="" disabled>Select Category</option>
                              <option value="Software">Software</option>
                              <option value="Hardware">Hardware</option>
                              <option value="Service">Service</option>
                              <option value="Software/Hardware">Software/Hardware</option>
                            </select>
                            <svg className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </div>

                        <div className="flex flex-col gap-2">
                          <label className="font-normal text-gray-700 text-sm flex items-center gap-2">
                            <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            Created At
                          </label>
                          <input type="date" className="w-full rounded-xl px-4 py-3.5 text-gray-800 bg-gray-50 border-2 border-gray-200 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 outline-none transition-all duration-150"
                            value={formatDateOnly(selectedProductDetails.createdAt || "")}
                            onChange={(e) => setSelectedProductDetails({
                              ...selectedProductDetails,
                              createdAt: e.target.value ? new Date(e.target.value).toISOString() : "",
                            })}
                          />
                        </div>

                        <div className="flex flex-col gap-2">
                          <label className="font-normal text-gray-700 text-sm flex items-center gap-2">
                            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            Created By
                          </label>
                          <input type="text" disabled className="w-full rounded-xl px-4 py-3.5 text-gray-800 bg-gray-50 border-2 border-gray-200 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 outline-none transition-all duration-150 opacity-60 cursor-not-allowed" value={selectedProductDetails.createdBy || ""} />
                        </div>
                        <div className="flex flex-col gap-2">
                          <label className="font-normal text-gray-700 text-sm flex items-center gap-2">
                            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Updated At
                          </label>

                          <input
                            type="date"
                            disabled
                            className="w-full rounded-xl px-4 py-3.5 text-gray-800 bg-gray-50 border-2 border-gray-200 opacity-60 cursor-not-allowed"
                            value={formatDateOnly(selectedProductDetails.updatedAt || "")}
                          />
                        </div>

                        <div className="flex flex-col gap-2">
                          <label className="font-normal text-gray-700 text-sm flex items-center gap-2">
                            <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            Updated By
                          </label>

                          <input
                            type="text"
                            disabled
                            className="w-full rounded-xl px-4 py-3.5 text-gray-800 bg-gray-50 border-2 border-gray-200 opacity-60 cursor-not-allowed"
                            value={selectedProductDetails.updatedBy || ""}
                          />
                        </div>
                      </div>
                    </div>
                  </>
                )}

                <div className="flex justify-between items-center gap-3 pt-6mt-8 bg-white backdrop-blur-sm rounded-xl p-6 -mx-2">
                  {isAdmin && (
                    <button type="button" className="px-5 py-3 rounded-xl border-2 border-red-200 bg-white hover:bg-red-50 hover:border-red-300 text-red-600 font-normal transition-all duration-200 flex items-center gap-2 shadow-sm hover:shadow-md"
                      onClick={() => {
                        if (selectedProductDetails) {
                          const idx = data.findIndex((a) => a.name === selectedProductDetails.name);
                          if (idx !== -1) {
                            setSelected(new Set([idx]));
                            setDeleteCount(1);
                            setShowDeleteModal(true);
                          }
                        }
                      }}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Delete Product
                    </button>
                  )}
                  <button type="submit" className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-normal shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-2 transform hover:scale-105">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}

      {/* Edit form modal */}
      {isEditing && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-lg font-semibold">Edit Product</h4>
              <button onClick={() => setIsEditing(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <form onSubmit={submitEdit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input type="text" value={editForm.name} disabled className="w-full rounded-lg px-3 py-2 bg-gray-100 border border-gray-300" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Active</label>
                <select
                  className="w-full rounded-lg px-3 py-2 border border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                  value={editForm.active}
                  onChange={(e) => setEditForm({ ...editForm, active: e.target.value })}
                >
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Base Currency Amount</label>
                <input type="text" value={editForm.baseCurrencyAmount} onChange={(e) => setEditForm({ ...editForm, baseCurrencyAmount: e.target.value })} className="w-full rounded-lg px-3 py-2 border border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select value={editForm.category || ""} onChange={(e) => setEditForm({ ...editForm, category: e.target.value })} className="w-full rounded-lg px-3 py-2 border border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none">
                  <option value="" disabled>Select Category</option>
                  <option value="Software">Software</option>
                  <option value="Hardware">Hardware</option>
                  <option value="Service">Service</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Created At</label>
                <input type="date" value={formatDateOnly(editForm.createdAt)} onChange={(e) => setEditForm({ ...editForm, createdAt: e.target.value ? new Date(e.target.value).toISOString() : "" })} className="w-full rounded-lg px-3 py-2 border border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Created By</label>
                <input type="text" value={editForm.createdBy} onChange={(e) => setEditForm({ ...editForm, createdBy: e.target.value })} className="w-full rounded-lg px-3 py-2 border border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" />
              </div>

              <div className="flex gap-3 justify-end pt-4">
                <button type="button" onClick={() => setIsEditing(false)} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Product;