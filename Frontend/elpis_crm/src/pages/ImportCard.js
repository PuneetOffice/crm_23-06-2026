import React, { useState } from "react";
import { FiUpload, FiCheck, FiAlertCircle, FiDownload, FiLoader } from "react-icons/fi";
import UploadZone from "./UploadZone";
import apiClient from "../api/client";

function ImportCard({
  dataType,
  icon: Icon,
  description,
  comingSoon = false,
  highlight = false,
  isLinkImport = false,
  onSuccess,
}) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [error, setError] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);

  const endpoints = {
    Accounts: "/import/accounts",
    Contacts: "/import/contacts",
    Deals: "/import/deals",
    "Deal Contact Links": "/import/deals/link-contacts",
    "Call Logs": "/import/calllogs",
    Tasks: "/import/tasks",
    Notes: "/import/notes",
  };

  const handleFileSelect = (file) => {
    setSelectedFile(file);
    setError("");
    setImportResult(null);
  };

  const handleImport = async () => {
    if (!selectedFile || comingSoon) return;

    setIsImporting(true);
    setError("");
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const endpoint = endpoints[dataType];
      if (!endpoint) {
        throw new Error(`Unknown data type: ${dataType}`);
      }

      // Upload with progress tracking
      const response = await apiClient.post(endpoint, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          setUploadProgress(percentCompleted);
        },
      });

      // Success response
      if (response.data && response.data.success !== false) {
        const result = {
          success: true,
          rowsImported: response.data.rowsImported || 0,
          rowsSkipped: response.data.rowsSkipped || 0,
          rowErrors: response.data.rowErrors || [],
          elapsed: response.data.elapsed || "N/A",
        };
        setImportResult(result);
        setSelectedFile(null);
        
        if (typeof onSuccess === "function") {
          onSuccess(dataType);
        }
        if (dataType === "Deal Contact Links") {
          window.dispatchEvent(new CustomEvent("importComplete", { detail: { table: "Deals" } }));
        }
      } else {
        throw new Error(response.data?.error || "Import failed");
      }
    } catch (err) {
      console.error("Import error:", err);
      const errorMsg = err.response?.data?.error || err.message || "Failed to import data";
      setError(errorMsg);
      setImportResult({
        success: false,
        error: errorMsg,
      });
    } finally {
      setIsImporting(false);
      setUploadProgress(0);
    }
  };

  const downloadTemplate = async () => {
    try {
      // For now, just show a notification that templates will be available
      alert(`Template for ${dataType} import will be available for download soon.`);
    } catch (err) {
      console.error("Download template error:", err);
    }
  };

  const cardBorder = highlight
    ? "border-emerald-400 ring-2 ring-emerald-100"
    : "border-gray-200";

  return (
    <div
      className={`bg-white border rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden h-full flex flex-col ${cardBorder}`}
    >
      {/* Card Header */}
      <div
        className={`p-4 border-b border-gray-100 flex items-start justify-between ${
          highlight ? "bg-gradient-to-r from-emerald-50 to-teal-50" : "bg-gradient-to-r from-gray-50 to-gray-100"
        }`}
      >
        <div className="flex items-start gap-3">
          <div
            className={`p-2 rounded-lg ${
              comingSoon
                ? "bg-gray-100 text-gray-400"
                : highlight
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-blue-100 text-blue-600"
            }`}
          >
            <Icon size={20} />
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-900">{dataType}</h3>
            <p className="text-xs text-gray-600 mt-0.5">{description}</p>
          </div>
        </div>
        {comingSoon && (
          <div className="inline-block px-2.5 py-1 bg-yellow-100 text-yellow-800 text-xs font-semibold rounded-full">
            Coming Soon
          </div>
        )}
      </div>

      {/* Card Body */}
      <div className="p-4 flex-1 flex flex-col">
        {!importResult ? (
          <>
            {/* File Upload Zone */}
            <UploadZone
              onFileSelect={handleFileSelect}
              selectedFile={selectedFile}
              isLoading={isImporting || comingSoon}
              supportedFormats={[".xlsx", ".xlsb", ".xls", ".csv"]}
              maxSizeMB={50}
            />

            {/* Progress Bar */}
            {isImporting && uploadProgress > 0 && (
              <div className="mt-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-medium text-gray-700">Uploading...</p>
                  <p className="text-xs text-gray-600">{uploadProgress}%</p>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Import Button */}
            <div className="mt-3 flex gap-2">
              <button
                onClick={handleImport}
                disabled={!selectedFile || isImporting || comingSoon}
                className={`flex-1 px-3 py-1.5 rounded-lg font-medium text-white text-sm transition-all duration-200 flex items-center justify-center gap-2 ${
                  comingSoon || !selectedFile
                    ? "bg-gray-300 cursor-not-allowed"
                    : isImporting
                    ? "bg-blue-600 cursor-wait"
                    : "bg-blue-600 hover:bg-blue-700 active:scale-95"
                }`}
              >
                {isImporting ? (
                  <>
                    <FiLoader size={16} className="animate-spin" />
                    <span>Importing...</span>
                  </>
                ) : comingSoon ? (
                  <>
                    <FiUpload size={16} />
                    <span>Coming Soon</span>
                  </>
                ) : (
                  <>
                    <FiUpload size={16} />
                    <span>{isLinkImport ? "Link contacts" : "Import Data"}</span>
                  </>
                )}
              </button>
              <button
                onClick={downloadTemplate}
                disabled={isImporting || comingSoon}
                className="px-3 py-1.5 rounded-lg font-medium text-gray-700 text-sm bg-gray-100 hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                title="Download import template"
              >
                <FiDownload size={16} />
              </button>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                <FiAlertCircle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-red-700">{error}</p>
              </div>
            )}
          </>
        ) : (
          <>
            {/* Import Result */}
            {importResult.success ? (
              <div className="text-center py-3">
                <div className="flex justify-center mb-2">
                  <div className="p-2 bg-green-100 rounded-full">
                    <FiCheck size={24} className="text-green-600" />
                  </div>
                </div>
                <h4 className="text-base font-semibold text-gray-900 mb-1">
                  {isLinkImport ? "Links updated!" : "Import Successful!"}
                </h4>
                <p className="text-xs text-gray-600 mb-3">
                  {isLinkImport
                    ? "Existing deals were matched by DealId and linked to contacts."
                    : "Your data has been imported successfully."}
                </p>

                {/* Results Summary */}
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="bg-green-50 rounded-lg p-2">
                    <p className="text-lg font-bold text-green-600">
                      {importResult.rowsImported}
                    </p>
                    <p className="text-xs text-gray-600">
                      {isLinkImport ? "Deals updated" : "Rows imported"}
                    </p>
                  </div>
                  {importResult.rowsSkipped > 0 && (
                    <div className="bg-yellow-50 rounded-lg p-2">
                      <p className="text-lg font-bold text-yellow-600">
                        {importResult.rowsSkipped}
                      </p>
                      <p className="text-xs text-gray-600">Rows Skipped</p>
                    </div>
                  )}
                </div>

                {/* Show Details Button */}
                {(importResult.rowErrors?.length > 0 || importResult.rowsSkipped > 0) && (
                  <button
                    onClick={() => setShowDetails(!showDetails)}
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium mb-3"
                  >
                    {showDetails ? "Hide" : "Show"} Details
                  </button>
                )}

                {/* Detailed Errors */}
                {showDetails && importResult.rowErrors?.length > 0 && (
                  <div className="mt-2 max-h-40 overflow-y-auto bg-gray-50 rounded-lg p-2 text-left">
                    <p className="text-xs font-semibold text-gray-700 mb-1">
                      Row Errors:
                    </p>
                    <div className="space-y-1">
                      {importResult.rowErrors.slice(0, 10).map((err, idx) => (
                        <p key={idx} className="text-xs text-gray-600 break-words">
                          {err}
                        </p>
                      ))}
                      {importResult.rowErrors.length > 10 && (
                        <p className="text-xs text-gray-500 italic">
                          ...and {importResult.rowErrors.length - 10} more errors
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-3">
                <div className="flex justify-center mb-2">
                  <div className="p-2 bg-red-100 rounded-full">
                    <FiAlertCircle size={24} className="text-red-600" />
                  </div>
                </div>
                <h4 className="text-base font-semibold text-gray-900 mb-1">
                  Import Failed
                </h4>
                <p className="text-xs text-gray-600 mb-3">
                  {importResult.error || "An error occurred during import"}
                </p>
              </div>
            )}

            {/* Reset Button */}
            <button
              onClick={() => {
                setImportResult(null);
                setSelectedFile(null);
                setError("");
              }}
              className="mt-3 w-full px-4 py-1.5 rounded-lg font-medium text-gray-700 text-sm bg-gray-100 hover:bg-gray-200 transition-colors"
            >
              Import Another File
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default ImportCard;
