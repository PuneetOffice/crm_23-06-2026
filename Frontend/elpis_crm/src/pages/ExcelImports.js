import React, { useState, useRef, useEffect } from "react";
import {
  Upload,
  X,
  FileSpreadsheet,
  CheckCircle2,
  ArrowDownToLine,
} from "lucide-react";
import { toast } from "sonner";
import { FiUsers, FiBriefcase, FiBox, FiDollarSign } from "react-icons/fi";
import apiClient from "../api/client";

// Exponential backoff retry logic
const retryWithBackoff = async (fn, maxRetries = 3, initialDelay = 1000) => {
  let lastError;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Don't retry if it's a client error (4xx) unless it's a timeout/network error
      if (error.response && error.response.status >= 400 && error.response.status < 500) {
        if (!error.code?.includes('TIMEOUT') && error.message !== 'Network Error') {
          throw error;
        }
      }
      
      if (attempt < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, attempt); // Exponential backoff
        console.log(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
};

export default function ExcelImports() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [table, setTable] = useState(null);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const abortControllerRef = useRef(null);
  const [progress, setProgress] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Warn user before leaving during import
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (loading) {
        e.preventDefault();
        e.returnValue = "Import in progress. Leaving now may result in incomplete data. Are you sure?";
        return e.returnValue;
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [loading]);

  // Save import state to localStorage for resilience
  useEffect(() => {
    if (loading && file && table) {
      const state = {
        fileName: file.name,
        fileSize: file.size,
        table: table,
        timestamp: new Date().toISOString(),
      };
      localStorage.setItem("elpis_import_state", JSON.stringify(state));
    } else {
      localStorage.removeItem("elpis_import_state");
    }
  }, [loading, file, table]);

  const validateFile = (selectedFile) => {
    const validTypes = ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv', 'application/csv'];
    if (!validTypes.includes(selectedFile.type) && !selectedFile.name.match(/\.(xlsx?|csv)$/i)) {
      toast.error('Invalid file type. Please upload Excel (.xlsx, .xls) or CSV file');
      return false;
    }
    
    const maxSize = 50 * 1024 * 1024;
    if (selectedFile.size > maxSize) {
      toast.error('File too large. Maximum size is 50MB');
      return false;
    }
    
    if (selectedFile.size < 1024) {
      toast.error('File is too small or empty');
      return false;
    }
    
    return true;
  };

  const getTableConfig = (tableType) => {
    const tableName = tableType.toLowerCase();
    switch (tableType) {
      case "Accounts":
        return { endpoint: `/import/${tableName}`, label: "Accounts", icon: FiBriefcase, color: "blue" };
      case "Contacts":
        return { endpoint: `/import/${tableName}`, label: "Contacts", icon: FiUsers, color: "blue" };
      case "Products":
        return { endpoint: `/import/${tableName}`, label: "Products", icon: FiBox, color: "amber" };
      case "Deals":
        return { endpoint: `/import/${tableName}`, label: "Deals", icon: FiDollarSign, color: "emerald" };
      default:
        return { endpoint: "", label: "", icon: null, color: "gray" };
    }
  };

  const handleTableSelect = (value) => {
    setTable(value);
    setStep(2);
  };

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    if (selected && validateFile(selected)) {
      setFile(selected);
      toast.success(`Selected: ${selected.name}`);
    }
  };

  const removeFile = () => {
    setFile(null);
    toast.info("File removed");
  };

  const closeModal = () => {
    if (loading) return;
    setOpen(false);
    setStep(1);
    setTable(null);
    setFile(null);
    setProgress(null);
  };

  const cancelUpload = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setLoading(false);
      setProgress(null);
      setUploadProgress(0);
      toast.info("Import cancelled");
    }
  };

  const upload = async (e) => {
    e.preventDefault();

    if (!file) {
      toast.error("Please select a file to upload");
      return;
    }

    setLoading(true);
    setUploadProgress(0);
    setProgress("Import in progress, please wait...");

    const formData = new FormData();
    formData.append("file", file);

    const { endpoint } = getTableConfig(table);

    // Create abort controller for this request
    abortControllerRef.current = new AbortController();

    try {
      const res = await retryWithBackoff(async () => {
        return await apiClient.post(endpoint, formData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
          signal: abortControllerRef.current.signal,
          onUploadProgress: (progressEvent) => {
            const { loaded, total } = progressEvent;
            const percentCompleted = Math.round((loaded * 100) / total);
            setUploadProgress(percentCompleted);
          },
        });
      }, 3, 1000);

      // Parse detailed response
      const { success, message, rowsInserted = 0, rowsSkipped = 0, errors = [] } = res.data;

      if (success) {
        const detail = `${rowsInserted} rows imported${rowsSkipped > 0 ? `, ${rowsSkipped} skipped` : ""}`;
        toast.success(`${message || "Import successful"} (${detail})`);
        
        // Refresh data - dispatch event that other components can listen to
        window.dispatchEvent(new CustomEvent("importComplete", { 
          detail: { table, rowsInserted, rowsSkipped } 
        }));
        
        closeModal();
      } else {
        toast.error(message || "Import failed");
      }

    } catch (error) {
      // Handle abort
      if (error.name === "AbortError") {
        console.log("Import was cancelled by user");
        return;
      }

      const message = error.response?.data?.message || error.message || "Upload failed";
      const lower = String(message).toLowerCase();

      // Network resilience – distinguish error types
      if (error.code === "ECONNABORTED" || lower.includes("timeout")) {
        toast.error("Upload timed out. This may happen with very large files. Check your network and try again.");
      } else if (lower.includes("network") || !navigator.onLine) {
        toast.error("Network disconnected. Please check your connection and retry.");
      } else if (lower.includes("invalid")) {
        toast.error("Invalid data format. Please check the file and try again.");
      } else if (lower.includes("validation")) {
        toast.error("Data validation failed. Please check the file contents.");
      } else if (error.response?.status === 413) {
        toast.error("File too large. Please reduce file size and try again.");
      } else {
        toast.error(message);
      }
      
      console.error("[Import Error]", { error, message });
    } finally {
      setLoading(false);
      setProgress(null);
      setUploadProgress(0);
      abortControllerRef.current = null;
    }
  };
  return (
    <div>
      {/* IMPORT BUTTON */}
      <button
        onClick={() => setOpen(true)}
        className="group flex items-center rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 font-medium border border-emerald-600 shadow-sm hover:shadow-md transition-all duration-200 focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
      >
        <span className="flex rounded-md bg-white/20 items-center justify-center w-10 h-10">
          <ArrowDownToLine className="w-5 h-5" />
        </span>
        <span className="ml-2">Import File</span>
      </button>

      {/* MODAL */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl min-h-[460px] overflow-hidden transition-all duration-300">
            {/* HEADER */}
            <div className="relative px-6 sm:px-8 py-6 bg-gradient-to-r from-blue-50 to-blue-50 border-b border-gray-200">
              <button
                onClick={closeModal}
                className="absolute top-4 right-4 p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-200/50 rounded-lg transition-colors focus:ring-2 focus:ring-blue-500 focus:outline-none"
                disabled={loading}
              >
                <X size={20} />
              </button>
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-600 rounded-xl">
                  <FileSpreadsheet className="text-white" size={24} />
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
                    {step === 1 ? "Import File" : `Import ${table}`}
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">
                    {step === 1 
                      ? "Select a data type to import" 
                      : `Upload Excel to import ${table?.toLowerCase()}`
                    }
                  </p>
                </div>
              </div>
            </div>

            {/* STEP 1 – TABLE SELECT */}
            {step === 1 && (
              <div className="p-6 sm:p-8 flex flex-col gap-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {["Accounts", "Contacts", "Products", "Deals"].map((tableType) => {
                    const config = getTableConfig(tableType);
                    const colorConfig = {
                      blue: "from-blue-50 via-blue-50 to-white border-blue-200 text-blue-700 hover:border-blue-300 hover:shadow-blue-100",
                      blue: "from-blue-50 via-blue-50 to-white border-blue-200 text-blue-700 hover:border-blue-300 hover:shadow-blue-100",
                      amber: "from-amber-50 via-amber-50 to-white border-amber-200 text-amber-700 hover:border-amber-300 hover:shadow-amber-100",
                      emerald: "from-emerald-50 via-emerald-50 to-white border-emerald-200 text-emerald-700 hover:border-emerald-300 hover:shadow-emerald-100",
                    };
                    const bgClass = colorConfig[config.color] || colorConfig.blue;
                    
                    return (
                      <button
                        key={tableType}
                        onClick={() => handleTableSelect(tableType)}
                        type="button"
                        className={`p-6 border-2 rounded-xl cursor-pointer hover:shadow-lg transition-all duration-200 bg-gradient-to-br ${bgClass} flex flex-col items-center justify-center h-[140px]`}
                      >
                        <config.icon size={28} className="mb-3" />
                        <h3 className="font-semibold text-base mb-1">{tableType}</h3>
                        <p className="text-xs text-gray-600 text-center">
                          {tableType === "Accounts" && "Import accounts data"}
                          {tableType === "Contacts" && "Import contacts data"}
                          {tableType === "Products" && "Import products data"}
                          {tableType === "Deals" && "Import deals data"}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* STEP 2 – FILE UPLOAD */}
            {step === 2 && (
              <form onSubmit={upload} className="p-8 flex flex-col gap-6">
                {loading && (
                  <div className="bg-orange-50 border-l-4 border-orange-400 p-3 rounded text-sm text-orange-700">
                    <strong>⚠️ Important:</strong> Do not close this browser tab or refresh the page during import. 
                    This may result in incomplete data.
                  </div>
                )}
                <div 
                  className="mb-2 flex flex-col items-center justify-center h-48 border-2 border-dashed rounded-2xl cursor-pointer transition-all duration-200 border-blue-300 bg-blue-50 relative"
                  onDragEnter={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const droppedFile = e.dataTransfer.files?.[0];
                    if (droppedFile && validateFile(droppedFile)) {
                      setFile(droppedFile);
                      toast.success(`Selected: ${droppedFile.name}`);
                    }
                  }}
                  onClick={() => document.getElementById("excelFileInput").click()}
                >
                  <input
                    id="excelFileInput"
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    onChange={handleFileChange}
                    disabled={loading}
                  />

                  {!file ? (
                    <>
                      <Upload className="w-12 h-12 text-blue-600 mb-3 animate-bounce" />
                      <p className="text-lg font-medium text-slate-700">
                        <span className="text-blue-600 underline">Click</span>{" "}
                        or drag & drop Excel file
                      </p>
                      <span className="text-xs text-slate-400 mt-1">
                        Supported: .xlsx, .xls, .csv
                      </span>
                    </>
                  ) : (
                    <div className="flex items-center gap-2 bg-blue-100 px-3 py-2 rounded-lg max-w-xs relative z-20">
                      <FileSpreadsheet className="text-blue-600 w-5 h-5 flex-shrink-0" />
                      <div className="flex flex-col flex-1 min-w-0">
                        <span 
                          className="font-medium text-slate-700 truncate text-sm" 
                          title={file.name}
                        >
                          {file.name}
                        </span>
                        <span className="text-xs text-slate-500">
                          {(file.size / 1024).toFixed(2)} KB
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          removeFile();
                        }}
                        className="ml-auto p-1 rounded hover:bg-red-200 flex-shrink-0 relative z-30"
                        disabled={loading}
                      >
                        <X className="text-red-500 w-5 h-5" />
                      </button>
                    </div>
                  )}
                  {loading && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 z-10 rounded-2xl p-6">
                      <svg
                        className="animate-spin h-8 w-8 text-blue-600 mb-4"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8v8z"
                        ></path>
                      </svg>
                      <span className="text-blue-600 font-semibold mb-2">
                        {progress || "Uploading..."}
                      </span>
                      
                      {/* Progress Bar */}
                      <div className="w-full max-w-xs mb-3 bg-gray-200 rounded-full h-2.5">
                        <div 
                          className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                          style={{ width: `${uploadProgress}%` }}
                        ></div>
                      </div>

                      {/* Progress Percentage */}
                      <span className="text-sm text-gray-600 font-medium mb-4">
                        {uploadProgress}% Complete
                      </span>

                      <button
                        type="button"
                        onClick={cancelUpload}
                        className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600"
                      >
                        Cancel Upload
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex gap-4 mt-2">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    disabled={loading}
                    className="flex-1 py-3 bg-slate-100 rounded-xl font-semibold text-slate-700 hover:bg-slate-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Back
                  </button>

                  <button
                    type="submit"
                    disabled={!file || loading}
                    className={`
                      flex-1 py-3 rounded-xl font-semibold
                      bg-gradient-to-r from-blue-600 to-blue-700
                      text-white flex items-center justify-center gap-2
                      shadow-md transition
                      ${
                        !file || loading
                          ? "opacity-60 cursor-not-allowed"
                          : "hover:from-blue-700 hover:to-blue-800"
                      }
                    `}
                  >
                    {loading ? (
                      <>
                        <svg
                          className="animate-spin h-5 w-5 mr-2 text-white"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          ></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8v8z"
                          ></path>
                        </svg>
                        Uploading...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 />
                        Upload File
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
